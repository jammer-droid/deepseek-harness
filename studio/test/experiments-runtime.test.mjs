import { test } from 'node:test';
import { Context } from '@deepseek-ai/cordis';
import Loader from '@deepseek-ai/cordis-plugin-loader';
import Include from '@deepseek-ai/cordis-plugin-include';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mountAgentLoopTestDependencies } from '../../packages/test-support/agent-loop-testkit/lib/index.js';
import AgentLoop from '../../packages/core/agent-loop/lib/index.js';
import GoalService from '../../packages/goal/goal/lib/index.js';
import * as GoalRoundDriver from '../../packages/goal/goal-round-driver/lib/index.js';
import { LlmAdapter } from '@deepseek-ai/dsh-llm';
import { installTasks } from '../packages/experiments/src/runtime-tasks.ts';
import { createScope } from '../../packages/core/scope/lib/index.js';
import SystemPrompt from '../../packages/core/system-prompt/lib/index.js';
import ToolRuntime from '../../packages/core/tools/lib/index.js';
import assert from 'node:assert/strict';
import { applyPrompt, SHARED_RULES } from '../packages/experiments/src/runtime-prompt.ts';
import { createLifetime } from '../packages/experiments/src/runtime-lifetime.ts';
import { installPolicies } from '../packages/experiments/src/runtime.ts';
import { initialSettings } from '../packages/experiments/src/settings.ts';
import { installBatch } from '../packages/experiments/src/runtime-batch.ts';
import { installOffload } from '../packages/experiments/src/runtime-offload.ts';

test('YAML Loader policy masks scoped schemas, denies dispatch and restores tools on plugin disposal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-runtime-loader-'));
  const ctx = new Context();
  try {
    await ctx.plugin(SystemPrompt, {}); await ctx.plugin(ToolRuntime);
    ctx.provide('goals', { disarm() {} });
    ctx.tools.register({ name: 'get_goal', description: 'goal', parameters: { type: 'object', properties: {} }, output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] }, async execute() { return 'ran'; } });
    const agent = { id: 'agent', options: {}, session: { header: { id: 'agent' } } };
    await ctx.plugin(Object.assign(inner => { agent.ctx = createScope(inner, agent).ctx; }, { inject: ['tools', 'systemPrompt'] }));
    const settings = structuredClone(initialSettings); settings.targets.goals = 'main';
    ctx.baseUrl = pathToFileURL(root).href + '/';
    await ctx.plugin(Loader); ctx.loader.builtins.include = Include;
    ctx.loader.internal = { version: 'v2', async import() { return { name: 'runtime-policy-fixture', inject: ['tools', 'systemPrompt'], apply(inner) { installPolicies(inner, () => settings); } }; } };
    const path = join(root, 'cordis.yml'); await writeFile(path, '- name: runtime-policy-fixture\n');
    await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(path).href } }); await ctx.loader.await();
    const entry = [...ctx.loader.entries()].find(entry => entry.options.name === 'runtime-policy-fixture'); await entry.fiber.await();
    const fiber = entry.fiber;
    await ctx.serial('agent/created', { agent });
    assert.equal(ctx.tools.schemas(agent).some(tool => tool.name === 'get_goal'), false);
    assert.equal(ctx.tools.schemas().some(tool => tool.name === 'get_goal'), true);
    const result = await ctx.tools.execute({ name: 'get_goal', arguments: {}, callId: 'denied', agent, signal: new AbortController().signal }); assert.equal(result.isError, true);
    await fiber.dispose();
    assert.equal(ctx.tools.schemas(agent).some(tool => tool.name === 'get_goal'), true);
    const restored = await ctx.tools.execute({ name: 'get_goal', arguments: {}, callId: 'restored', agent, signal: new AbortController().signal }); assert.equal(restored.isError, false);
  } finally { await ctx.fiber.dispose(); assert.equal(resolve(root), root); assert.ok(root.startsWith(join(tmpdir(), 'studio-runtime-loader-'))); await rm(root, { recursive: true, force: true }); }
});

test('optimization context survives complete override, stays scoped and disposes without changing the override', async () => {
  const ctx = new Context();
  try {
    await ctx.plugin(SystemPrompt, {});
    ctx.systemPrompt.section({ name: 'preset:complete', order: 0, complete: true, text: 'EXACT USER OVERRIDE' });
    const scope = {}; let scoped;
    await ctx.plugin(Object.assign(inner => { scoped = createScope(inner, scope).ctx; }, { inject: ['systemPrompt'] }));
    const dispose = scoped.on('system-prompt/assemble', async (_assembly, _context, next) => applyPrompt(await next(), { headless: true, goals: false, waiting: false }));
    const assembly = await ctx.systemPrompt.assemble({ scope });
    assert.deepEqual(assembly.sections, [{ name: 'preset:complete', text: 'EXACT USER OVERRIDE' }]);
    assert.ok(assembly.contexts.find(context => context.name === 'studio:prompt-optimization')?.text.startsWith(SHARED_RULES));
    assert.equal((await ctx.systemPrompt.assemble()).contexts.some(context => context.name === 'studio:prompt-optimization'), false);
    const restore = scoped.systemPrompt.suppressRuntimeContext();
    assert.equal((await ctx.systemPrompt.assemble({ scope })).contexts.length, 0);
    restore(); dispose();
    assert.equal((await ctx.systemPrompt.assemble({ scope })).contexts.some(context => context.name === 'studio:prompt-optimization'), false);
  } finally { await ctx.fiber.dispose(); }
});

test('tasks gate failure and success, cancellation drains work without cancelling predecessors', async () => {
  let tool; let sequence = 0; const records = new Map(); const listeners = new Set(); const commands = [];
  const jobs = {
    events: { subscribe(_filter, fn) { listeners.add(fn); return () => listeners.delete(fn); } },
    get(id) { const record = records.get(id); if (!record) throw new Error('unknown'); return record.view; },
    start(spec) { const id = `task-${++sequence}`; const record = { view: { id, status: 'running' } }; records.set(id, record); record.hooks = spec.run({ id, append() {} }); record.done = record.hooks.done.then(outcome => { Object.assign(record.view, outcome); for (const listener of [...listeners]) listener({ type: 'settled', job: record.view }); }); return id; },
    async wait(id, _timeout, _owner, signal) { signal?.throwIfAborted(); await records.get(id).done; return this.get(id); },
    kill(id) { records.get(id).hooks.cancel('cancelled'); },
  };
  let began; const started = new Promise(resolve => { began = resolve; });
  const tools = { register(value) { tool = value; return () => {}; }, async execute(exec) { commands.push(exec.arguments.command); if (exec.arguments.command === 'long') { began(); await new Promise(resolve => exec.signal.addEventListener('abort', resolve, { once: true })); } const failed = exec.arguments.command === 'fail'; return { isError: false, content: [], value: { kind: 'foreground', exitCode: failed ? 1 : 0, signal: null } }; } };
  const life = createLifetime(); installTasks({ get: name => ({ jobs, tools })[name] }, life, 120000, 600000);
  const exec = { signal: new AbortController().signal, agent: { id: 's' }, callId: 'call', rootCallId: 'call', token: {} };
  const run = (command, dependencies = [], background = false) => tool.execute({ command, description: command, requires_success: dependencies, background }, exec);
  const first = await run('ok'); assert.equal(first.status, 'completed'); const second = await run('dependent', [first.task_id]); assert.equal(second.status, 'completed');
  await assert.rejects(run('foreign', ['missing-task']), /Unknown or foreign/);
  const failed = await run('fail'); const blocked = await run('blocked', [failed.task_id]); assert.equal(blocked.status, 'failed'); assert.equal(commands.includes('blocked'), false);
  const long = await run('long', [], true); await started;
  const waiting = await run('waiting', [long.task_id], true); jobs.kill(waiting.task_id); await records.get(waiting.task_id).done;
  assert.equal(jobs.get(long.task_id).status, 'running'); assert.equal(commands.includes('waiting'), false);
  await life.dispose(); assert.equal(jobs.get(long.task_id).status, 'killed'); assert.equal(listeners.size, 0);
});

test('waiting overrides actual foreground and job waits and joins cancellation', async () => {
  const settings = structuredClone(initialSettings); settings.targets.waiting = 'main'; settings.bashWaitMs = 555; settings.jobWaitMs = 333; settings.jobWaitCapMs = 444;
  const env = environment(settings); const calls = [];
  env.definitions.set('bash', { name: 'bash', execute(args, exec) { calls.push(['bash', args.timeoutMs, exec.signal]); return Promise.resolve('ok'); } });
  env.definitions.set('job_output', { name: 'job_output', execute(args) { calls.push(['output', args.wait]); return Promise.resolve('read'); } });
  env.jobs.wait = async (_id, timeout, _owner, signal) => { calls.push(['wait', timeout, signal]); };
  env.create(); assert.equal(env.mode, 'native');
  const exec = { signal: new AbortController().signal, agent: { id: 's' } };
  await env.registrations.get('bash').execute({ command: 'x' }, exec);
  await env.registrations.get('job_output').execute({ job_id: 'task-1', wait: true }, exec);
  await env.registrations.get('job_output').execute({ job_id: 'task-1', wait: true, timeout_ms: 999 }, exec);
  assert.deepEqual(calls.map(call => call.slice(0, 2)), [['bash', 555], ['wait', 333], ['output', false], ['wait', 444], ['output', false]]);
  await env.dispose(); assert.equal(env.registrations.size, 0); assert.equal(calls[0][2].aborted, true);
});

test('real AgentLoop and GoalRoundDriver leave selected main goals disarmed while child rounds run', { timeout: 10000 }, async () => {
  const ctx = new Context(); const requests = [];
  try {
    await mountAgentLoopTestDependencies(ctx); await ctx.plugin(GoalService); await ctx.plugin(GoalRoundDriver); await ctx.plugin(AgentLoop, { agents: [] });
    class Adapter extends LlmAdapter { async *stream(options) { requests.push(options); yield { type: 'block-start', index: 0, blockType: 'text' }; yield { type: 'block-end', index: 0, block: { type: 'text', text: 'done' } }; yield { type: 'finish', reason: { kind: 'stop' } }; } }
    ctx.llm.registerAdapter(['mock'], new Adapter());
    const settings = structuredClone(initialSettings); settings.targets.goals = 'main'; settings.targets.headless = 'sub';
    ctx.systemPrompt.section({ name: 'preset:complete', order: 0, complete: true, text: 'MODEL OVERRIDE' });
    await ctx.plugin(Object.assign(inner => installPolicies(inner, () => settings), { inject: ['tools', 'systemPrompt'] }));
    const main = await ctx.agentLoop.create('experiments-main', { provider: 'mock', model: 'mock' });
    const sub = await ctx.agentLoop.create('experiments-sub', { provider: 'mock', model: 'mock', subagentDepth: 1 });
    const goal = ctx.goals.create(main, { objective: 'must not autorun', maxGoalRounds: 1 });
    assert.equal(ctx.goals.get(main).activation, 'disarmed'); assert.equal(ctx.goals.get(main).revision, goal.revision);
    const childTurn = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { off(); reject(new Error(`Child goal did not settle: ${JSON.stringify(ctx.goals.get(sub))}`)); }, 5000);
      const off = ctx.on('goal/changed', payload => { if (payload.agent === sub && ctx.goals.get(sub)?.phase === 'blocked') { clearTimeout(timeout); off(); resolve(); } });
    });
    ctx.goals.create(sub, { objective: 'child can autorun', maxGoalRounds: 1 });
    await childTurn;
    assert.equal(ctx.goals.get(main).roundsStarted, 0); assert.equal(ctx.goals.get(main).phase, 'active'); assert.equal(ctx.goals.get(main).activation, 'disarmed');
    assert.equal(ctx.goals.get(sub).roundsStarted, 1); assert.equal(requests.length, 1);
    assert.ok(JSON.stringify(requests[0]).includes(SHARED_RULES.split('\n')[0]));
    assert.ok(JSON.stringify(requests[0]).includes('MODEL OVERRIDE'));
  } finally { await ctx.fiber.dispose(); }
});

function environment(settings) {
  const listeners = new Map(); const disposers = []; const guards = []; const masks = []; const registrations = new Map();
  const definitions = new Map(['create_goal', 'get_goal', 'update_goal', 'todo_write', 'bash', 'job_output', 'job_kill'].map(name => [name, { name }]));
  let disarmed = 0; let mode; const jobs = {};
  const tools = { get: name => definitions.get(name), guard(fn) { guards.push(fn); return () => guards.splice(guards.indexOf(fn), 1); }, restrict(mask) { masks.push(mask); return () => masks.splice(masks.indexOf(mask), 1); }, presentAs(value) { mode = value; return () => { mode = undefined; }; }, register(tool) { registrations.set(tool.name, tool); return () => registrations.delete(tool.name); } };
  const scoped = {
    get(name) { return { tools, goals: { disarm() { disarmed++; } }, systemPrompt: {}, jobs }[name]; },
    on(name, fn) { listeners.set(name, fn); return () => listeners.delete(name); },
    effect(body) { const value = body(); const cleanup = typeof value === 'function' ? [value] : [...value]; const dispose = async () => { for (const fn of cleanup.toReversed()) await fn(); }; disposers.push(dispose); return dispose; },
  };
  let created; const pluginDisposers = [];
  installPolicies({ on(_name, listener) { created = listener; }, effect(body) { pluginDisposers.push(body()); } }, () => settings);
  return { scoped, listeners, guards, masks, registrations, definitions, jobs, create(depth = 0) { return created({ agent: { ctx: scoped, id: 'session', options: {}, session: { header: { id: 'session', delegationDepth: depth } } } }); }, get disarmed() { return disarmed; }, get mode() { return mode; }, async dispose() { for (const fn of pluginDisposers.toReversed()) await fn(); } };
}

test('creation snapshots separate main/sub and remove policy effects on plugin disposal', async () => {
  const settings = structuredClone(initialSettings); settings.targets.goals = 'main';
  const env = environment(settings); env.create(1); assert.equal(env.guards.length, 0);
  env.create(0); assert.equal(env.disarmed, 1); assert.match(env.guards[0]({ name: 'get_goal' }), /disabled/);
  assert.equal(env.guards[0]({ name: 'read' }), undefined); assert.deepEqual(env.masks[0].deny, ['create_goal', 'get_goal', 'update_goal', 'todo_write']);
  settings.targets.goals = 'off'; env.listeners.get('goal/changed')(); assert.equal(env.disarmed, 2);
  const result = await env.listeners.get('agent/pre-step')({}, async () => ({ kind: 'enter' })); assert.equal(result.kind, 'enter'); assert.equal(env.disarmed, 3);
  await env.dispose(); assert.equal(env.guards.length, 0); assert.equal(env.listeners.size, 0); assert.equal(env.masks.length, 0);
});

test('prompt policies preserve unselected tools, contexts, variables and immutable input', () => {
  const assembly = { sections: [{ name: 'tool:goal', text: 'goals' }, { name: 'deployment:persona-suffix', text: 'persona' }], contexts: [{ name: 'context', text: 'keep' }], tools: [{ name: 'get_goal', description: 'goal', parameters: {} }], variables: { value: 'keep' } };
  const original = structuredClone(assembly);
  const headless = applyPrompt(assembly, { goals: false, headless: true, waiting: false });
  assert.equal(headless.tools.length, 1); assert.equal(headless.sections[1].text, 'persona'); assert.deepEqual(headless.contexts[0], assembly.contexts[0]); assert.ok(headless.contexts[1].text.startsWith(SHARED_RULES)); assert.deepEqual(applyPrompt(headless, { goals: false, headless: true, waiting: false }).contexts, headless.contexts); assert.equal(headless.variables, assembly.variables); assert.deepEqual(assembly, original);
  const goals = applyPrompt(assembly, { goals: true, headless: false, waiting: false }); assert.equal(goals.tools.length, 0); assert.equal(goals.sections.length, 1);
  assert.throws(() => applyPrompt({ ...assembly, sections: [{ name: 'tools:sdk', text: 'sdk' }] }, { goals: false, headless: true, waiting: false }), /native/);
});

test('lifetime disposal aborts admitted work, joins it and refuses new work', async () => {
  const life = createLifetime(); let settled = false;
  const pending = life.run(async signal => { await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true })); settled = true; });
  await Promise.resolve(); await life.dispose(); await pending; assert.equal(settled, true); assert.throws(() => life.run(async () => 1), /disposed/); await life.dispose();
});

test('batch prevalidates all reads and stops after a policy denial', async () => {
  let tool; const seen = []; const contexts = [];
  const ctx = { get() { return { register(definition) { tool = definition; return () => {}; }, async execute(call) { seen.push(call); return { isError: true, content: [{ type: 'text', text: 'denied' }], additionalContexts: ['notice'] }; } }; } };
  const life = createLifetime(); installBatch(ctx, life, true, 8, 200);
  const exec = { signal: new AbortController().signal, callId: 'root', rootCallId: 'root', token: {}, deferContext(context) { contexts.push(context); } };
  await assert.rejects(tool.execute({ calls: [{ name: 'glob', arguments: {} }, { name: 'read', arguments: {} }] }, exec)); assert.equal(seen.length, 0);
  const result = await tool.execute({ calls: [{ name: 'glob', arguments: {} }, { name: 'grep', arguments: {} }] }, exec);
  assert.equal(seen.length, 1); assert.equal(seen[0].parent, exec.token); assert.equal(result[0].isError, true); assert.deepEqual(contexts, ['notice']);
  await assert.rejects(tool.execute({ calls: [{ name: 'get_goal', arguments: {} }] }, exec)); await life.dispose();
});

test('offload bounds rendered output but skips nested and explicit canonical replacements', async () => {
  let hook; const saved = []; const life = createLifetime();
  installOffload({ get() { return { async saveText(value) { saved.push(value); return { bytes: value.content.length, locator: '/full.txt', retrievalHint: 'Use read.' }; } }; }, on(_name, fn) { hook = fn; return () => {}; }, logger: { warn() {} } }, life, 1024, 100);
  const content = [{ type: 'text', text: 'x'.repeat(3000) }]; const exec = { name: 'read', callId: 'read-1', agent: { session: { header: { id: 's' } } } };
  const output = await hook(exec, { content }, async () => ({ kind: 'accept' })); assert.ok(output.content[0].text.length <= 1024); assert.equal(saved[0].content.length, 3000); assert.equal(Object.hasOwn(output, 'value'), false);
  await hook({ ...exec, parent: {} }, { content }, async () => ({ kind: 'accept' })); await hook(exec, { content }, async () => ({ kind: 'accept', value: 'replacement' })); assert.equal(saved.length, 1); await life.dispose();
});
