/**
 * Web search cost, live sessions (L0). Runs the same web tasks in fresh sessions on the isolated
 * server and records conversation usage, web tool calls, result size and which provider answered.
 * Model behaviour is not asserted; only facts that do not depend on the model's wording.
 *
 *   WEB_COST_PROVIDER=legacy|api node studio/scripts/e2e/web-cost-session.mjs
 *
 * Env: STUDIO_E2E_HOME, STUDIO_E2E_PROFILE (server to drive), WEB_COST_RUN (run directory),
 * WEB_COST_TASKS (number of tasks, default all). Writes dist/e2e/web-cost/<run>/sessions-<provider>.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAgent } from './agent.mjs';
import { SESSION_TASKS, sessionCost } from './web-cost-lib.mjs';

const provider = process.env.WEB_COST_PROVIDER;
if (!['legacy', 'api'].includes(provider)) {
  console.log(JSON.stringify({ ok: false, error: 'Set WEB_COST_PROVIDER=legacy or api' }));
  process.exit(2);
}
const studio = fileURLToPath(new URL('../..', import.meta.url));
const outDir = path.join(studio, 'dist/e2e/web-cost', process.env.WEB_COST_RUN ?? new Date().toISOString().slice(0, 10));
const tasks = SESSION_TASKS.slice(0, Number(process.env.WEB_COST_TASKS) || SESSION_TASKS.length);

const events = file => {
  const out = spawnSync('zstd', ['-dc', file], { encoding: 'utf8', maxBuffer: 512 << 20 });
  if (out.error?.code === 'ENOENT') throw new Error('zstd not found on PATH: environment blocked');
  return out.stdout.split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
};

await runAgent({ name: `web-cost-${provider}` }, async t => {
  const preset = await t.preset({ name: `__web_cost_${provider}__`, tools: ['web_search', 'web_fetch'] });
  const runs = [];
  // Sessions run one after another so the Search API QPS limit and cache effects stay comparable.
  for (const [index, task] of tasks.entries()) {
    const session = await t.session(preset);
    const after = await t.prompt(session, task);
    const settled = await t.settle(session, { after, timeoutMs: 600_000 });
    const file = t.sessionFile(session);
    const cost = file ? sessionCost(events(file)) : undefined;
    runs.push({ task: index + 1, session, settled, ...cost });
    await t.check(`task ${index + 1} turn completed`, () => settled && cost?.turns.at(-1) === 'completed');
    await t.check(`task ${index + 1} web_search called`, () => (cost?.tools.web_search ?? 0) > 0);
    // Provider identity: only the legacy provider logs its Messages request into the session.
    if (cost?.tools.web_search) {
      await t.check(`task ${index + 1} provider is ${provider}`, () => {
        if (provider === 'legacy' ? cost.legacySearchRequests > 0 : cost.legacySearchRequests === 0) return true;
        throw new Error(`legacy search requests ${cost.legacySearchRequests} for ${provider}`);
      });
    }
    t.handoff(`task-${index + 1}`, `Task: ${task}\nReply:\n${t.reply(session)}`);
  }
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, `sessions-${provider}.json`), JSON.stringify({ provider, profile: t.state.profile, runtime: t.state.version, sha256: t.state.sha256, runs }, null, 2));
});
