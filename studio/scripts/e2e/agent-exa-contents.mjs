#!/usr/bin/env node
/**
 * #39 L0: a real `web_fetch` through the `exa-contents` provider. The model is the scripted mock (only the
 * tool call is scripted); the fetch itself goes to the real Exa API, so the profile needs an Exa key on the
 * `web-fetch-exa` row and `web.fetchProvider: exa-contents` (see plugins-exa-contents.mjs).
 *
 *   node studio/scripts/e2e/server.mjs up --profile e39 --mock-llm --plugin <dsh-web-fetch-exa tgz>
 *   node studio/scripts/e2e/agent-exa-contents.mjs [--profile e39]
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { mockSay, mockScript, runAgent } from './agent.mjs';

const args = process.argv.slice(2);
const value = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const URL_OK = 'https://example.com/';

/** Tool results of one session as `{ name, isError, text }`, read from its session log. */
function toolResults(t, sessionId) {
  const file = t.sessionFile(sessionId);
  if (!file || !existsSync(file)) return [];
  const out = spawnSync('zstd', ['-dc', file], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const events = out.stdout.split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
  const names = new Map(events.filter(e => e.type === 'tool/call').map(e => [e.data?.callId, e.data?.name]));
  return events.filter(e => e.type === 'tool/result').map(e => {
    const message = e.data?.message ?? {};
    const id = message.toolCallId ?? message.source?.callId;
    return { name: names.get(id), isError: message.isError === true, text: (message.content ?? []).map(b => b.text ?? '').join('\n') };
  });
}

await runAgent({ name: 'agent-exa-contents', profile: value('--profile') }, async t => {
  const preset = await t.preset({ tools: ['web_fetch'] });
  const session = await t.session(preset);
  const after = await t.prompt(session, mockScript([['web_fetch', { url: URL_OK }], mockSay('fetched')]));
  if (!(await t.settle(session, { after, timeoutMs: 120_000 }))) return;
  const [result] = toolResults(t, session).filter(r => r.name === 'web_fetch');
  await t.check('web_fetch returned a result', () => { if (!result) throw new Error('no web_fetch result'); });
  await t.check('web_fetch succeeded through Exa (HTTP 200, page text)', () => {
    if (result.isError) throw new Error(result.text.slice(0, 300));
    if (!/Fetched https:\/\/example\.com\/? \(HTTP 200\)/.test(result.text)) throw new Error(result.text.slice(0, 300));
    if (!/Example Domain/i.test(result.text)) throw new Error(`page text missing: ${result.text.slice(0, 300)}`);
  });
  t.handoff('exa-contents-fetch', result?.text ?? '');
});
