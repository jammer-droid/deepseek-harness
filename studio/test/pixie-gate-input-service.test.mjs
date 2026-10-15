import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import { PixieService } from '../src/host/pixie-service.ts';

for (const sandbox of [true, false]) test(`Cordis service composition uses public shell/session policy; available=${sandbox}`, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-input-service-'));
  const ctx = new Context(); const requests = []; const events = []; const agent = { id: 'session', ctx, session: { header: { cwd: dir } } };
  for (const key of ['llm', 'commands', 'sessionController', 'agentPresets', 'agents', 'shell', 'sandboxPolicy']) ctx.provide(key);
  ctx.set('llm', {}); ctx.set('commands', { register: () => () => {} });
  ctx.set('sessionController', { list: async () => ({ items: [{ sessionId: 'session' }] }) });
  ctx.set('agentPresets', { composedPreset: context => { assert.equal(context, ctx); return 'p'; } });
  ctx.set('agents', { roots: () => [agent] });
  if (sandbox) ctx.set('sandboxPolicy', { resolve: ({ session }) => { assert.equal(session, agent.session); return { mode: 'read-only', workspaceRoot: dir, sessionId: 'session' }; } });
  ctx.set('shell', { resolve: request => { requests.push(request); return request; }, execute: async () => ({ result: async () => ({ exitCode: 0, timedOut: false, stdout: { text: '{"verdict":"revise","text":"new"}', truncated: false }, stderr: { text: '' } }) }) });
  ctx.on('pixie-gate/end', run => { events.push(run); });
  ctx.on('agent/pre-step', async (_payload, next) => { const value = await next(); return value.kind === 'reject' ? value : { ...value, messages: [...value.messages, { id: 'hook', role: 'user', source: { kind: 'hooks-claude-code' }, content: [{ type: 'text', text: 'hook context' }] }] }; });
  const fiber = ctx.plugin(PixieService, dir); await fiber;
  try {
    const service = ctx.get('studioPixie');
    await service.saveGateDefinitions(JSON.stringify([{ presetIds: ['p'], definition: { id: 'g', name: 'Gate', enabled: true, point: 'input', match: {}, stages: [{ id: 's', kind: 'command', role: 'revise', command: { command: 'trusted' } }], forward: { kind: 'replace', from: 'subject' }, limits: { stageTimeoutMs: 1000, maxSteersPerTurn: 0 } } }]));
    assert.equal((await service.gateDefinitions()).length, 1);
    const message = { id: 'm', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'original' }] };
    const payload = { agent, messages: [message], turn: 1, step: 1, signal: new AbortController().signal };
    const result = await ctx.waterfall('agent/pre-step', payload, async () => ({ kind: 'enter', messages: [message] }));
    assert.equal(result.messages[0].content[0].text, sandbox ? 'new' : 'original');
    assert.equal(result.messages[1].content[0].text, 'hook context');
    assert.equal(requests.length, sandbox ? 1 : 0);
    if (sandbox) {
      assert.equal(requests[0].workdir, dir); assert.equal(requests[0].sandboxPolicy.mode, 'read-only');
      assert.deepEqual(JSON.parse(requests[0].stdin).hooks.context, ['hook context']);
    }
    assert.equal(events[0].status, sandbox ? 'done' : 'error');
    assert.equal((await service.gateRuns('session')).runs[0].applied, sandbox ? 'replaced' : 'pass');
  } finally { await fiber.dispose(); }
});
