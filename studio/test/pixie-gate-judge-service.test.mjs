import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import { PixieService } from '../src/host/pixie-service.ts';
import { PixieStore } from '../src/host/pixie-store.ts';
import { PixieGateDefinitions } from '../src/host/pixie-gate-definitions.ts';

test('thread pruning preserves the shared gate definition file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-judge-prune-'));
  const definitions = new PixieGateDefinitions(join(dir, 'gates.json'));
  await definitions.save([]);
  const store = new PixieStore(dir);
  assert.deepEqual(await store.prune(async () => false), []);
  // Reading through definitions alone would hide deletion behind its ENOENT default.
  const { access } = await import('node:fs/promises');
  await access(join(dir, 'gates.json'));
});

for (const recipe of ['sandwich', 'subtitle']) test(`judge ${recipe} runs through input service with dedicated settings and manual trial`, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-judge-service-'));
  const ctx = new Context(), calls = [];
  const agent = { id: 'session', ctx, session: { header: { cwd: dir } } };
  for (const key of ['llm', 'commands', 'sessionController', 'agentPresets', 'agents', 'shell', 'sandboxPolicy']) ctx.provide(key);
  ctx.set('llm', { stream(options) { calls.push(options); return (async function* () {
    const judge = options.model === 'judge';
    yield { type: 'text-delta', text: judge ? '{"answers":{"safe":{"noul":1}}}' : 'translation plan' };
    yield { type: 'finish', reason: { kind: 'stop' } };
  })(); } });
  ctx.set('commands', { register: () => () => {} });
  ctx.set('sessionController', { list: async () => ({ items: [{ sessionId: 'session' }] }) });
  ctx.set('agentPresets', { composedPreset: () => 'p' }); ctx.set('agents', { roots: () => [agent] });
  ctx.set('sandboxPolicy', { resolve: () => ({ mode: 'read-only', workspaceRoot: dir, sessionId: 'session' }) });
  ctx.set('shell', { resolve: request => request, execute: async () => ({ result: async () => ({ exitCode: 0, timedOut: false, stdout: { text: '{"data":{"lines":1820}}', truncated: false }, stderr: { text: '' } }) }) });
  const fiber = ctx.plugin(PixieService, dir); await fiber;
  try {
    const service = ctx.get('studioPixie');
    const legacy = { contextMode: 'fresh', systemPrompt: 'converse', allowThreadModel: true, model: { provider: 'p', model: 'base' } };
    await service.saveSettings(JSON.stringify(legacy)); assert.deepEqual(await service.readSettings(), legacy);
    const settings = { ...legacy, judgeModel: { provider: 'p', model: 'judge' }, judgeSystemPrompt: 'dedicated judgment' };
    await service.saveSettings(JSON.stringify(settings)); assert.deepEqual(await service.readSettings(), settings);
    const judge = id => ({ id, kind: 'judge', questions: { safe: { type: 'noul', question: 'Safe?' } }, pass: { mode: 'all', conditions: [{ question: 'safe', type: 'noul', threshold: 1 }] } });
    const converse = { id: 'plan', kind: 'converse', role: 'note', prompt: '{{subject}}' };
    const stages = recipe === 'sandwich' ? [judge('first'), converse, judge('last')] : [{ id: 'measure', kind: 'command', role: 'check', command: { command: 'measure' } }, judge('check'), converse];
    const definition = { id: 'g', name: 'Gate', enabled: true, point: 'input', match: {}, stages, forward: { kind: 'append', from: ['plan'] }, limits: { stageTimeoutMs: 1000, maxSteersPerTurn: 0 } };
    await service.saveGateDefinitions(JSON.stringify([{ presetIds: ['p'], definition }]));
    const message = { id: 'm', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'subtitle' }] };
    const result = await ctx.waterfall('agent/pre-step', { agent, messages: [message], turn: 1, step: 1, signal: new AbortController().signal }, async () => ({ kind: 'enter', messages: [message] }));
    assert.equal(result.kind, 'enter'); assert.equal(result.messages.at(-1).source.kind, 'studio-pixie-gate'); assert.equal(result.messages.at(-1).content[0].text, 'translation plan');
    const run = (await service.gateRuns('session')).runs[0]; assert.equal(run.applied, 'appended');
    for (const call of calls.filter(call => call.model === 'judge')) assert.equal(call.system, settings.judgeSystemPrompt);
    if (recipe === 'subtitle') assert.match(calls[0].messages[0].content[0].text, /1820/);
    const manual = await service.judge(JSON.stringify({ state: 'manual', questions: judge('j').questions }), new AbortController().signal);
    assert.equal(manual.ok, true); assert.equal(calls.at(-1).model, 'judge'); assert.equal(calls.at(-1).system, settings.judgeSystemPrompt);
  } finally { await fiber.dispose(); }
});
