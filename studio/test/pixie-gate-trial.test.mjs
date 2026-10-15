import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trialGate } from '../src/host/pixie-gate-trial.ts';

const definition = () => ({ id: 'gate', name: 'Trial', enabled: true, point: 'input', match: {},
  stages: [{ id: 'check', kind: 'command', role: 'check', command: { command: 'never by default' } }, { id: 'note', kind: 'converse', role: 'note', prompt: '{{subject}}' }],
  onError: 'pass', confirmRevision: false, forward: { kind: 'original' },
  hooks: { start: { command: 'start' }, end: { command: 'end' } }, limits: { stageTimeoutMs: 1000, maxSteersPerTurn: 0 },
});
const signal = () => new AbortController().signal;

test('trial skips commands and both hooks by default while running models', async () => {
  const calls = [];
  const result = await trialGate({ definition: definition(), text: 'sample', toolName: 'read', hooksContext: 'untrusted context' }, {
    session: () => { throw Error('must not resolve session'); },
    runner: async () => ({ run: async (stage, context) => { calls.push(stage.id); assert.equal(context.original, 'sample'); assert.equal(context.tool.name, 'read'); assert.deepEqual(context.hooks.context, ['untrusted context']); return { verdict: 'note', text: 'note' }; }, runHook: async () => { throw Error('must not run'); } }),
  }, signal());
  assert.deepEqual(calls, ['note']);
  assert.deepEqual(result.skipped, ['hooks.start', 'check', 'hooks.end']);
  assert.match(result.result.stages.check.reason, /^skipped:/);
  assert.equal(result.result.verdict, 'pass');
  assert.deepEqual(result.result.forward, { kind: 'original', text: 'sample' });
  assert.ok(result.durations.note >= 0);
});

test('explicit consent propagates the resolved session policy to every command', async () => {
  const calls = [];
  const session = { sessionId: 'active', cwd: '/workspace', sandboxPolicy: { sessionId: 'active', workspaceRoot: '/workspace', mode: 'read-only' } };
  const observe = context => { assert.deepEqual(context.sandboxPolicy, session.sandboxPolicy); assert.equal(context.cwd, session.cwd); };
  const result = await trialGate({ definition: definition(), text: 'sample', executeCommands: true, sessionId: 'active' }, {
    session: id => { assert.equal(id, 'active'); return session; },
    runner: async () => ({ run: async (stage, context) => { observe(context); calls.push(stage.id); return { verdict: 'pass' }; }, runHook: async (_command, event, context) => { observe(context); calls.push(event); return { verdict: 'pass' }; } }),
  }, signal());
  assert.deepEqual(calls, ['start', 'check', 'note', 'end']); assert.deepEqual(result.skipped, []);
});

for (const payload of [{ executeCommands: true }, { executeCommands: 'true' }, { executeCommands: true, sessionId: 'missing' }]) test(`trial rejects unsafe command request ${JSON.stringify(payload)}`, async () => {
  await assert.rejects(trialGate({ definition: definition(), text: 'sample', ...payload }, {
    session: () => ({ sessionId: 'wrong', cwd: '/workspace' }), runner: async () => { throw Error('must not construct runner'); },
  }, signal()), /session|consent|policy/i);
});

test('invalid definitions fail before accessing dependencies', async () => {
  await assert.rejects(trialGate({ definition: {}, text: 'sample' }, {}, signal()), /Gate needs/);
});

test('trial preserves pipeline errors and cancellation rather than applying results', async () => {
  const gate = definition(); delete gate.hooks; gate.stages = [gate.stages[1]]; gate.onError = 'block';
  const deps = { runner: async () => ({ run: async () => ({ verdict: 'error', error: 'model offline' }) }) };
  const result = await trialGate({ definition: gate, text: 'original' }, deps, signal());
  assert.equal(result.result.verdict, 'error'); assert.equal(result.result.appliedPolicy, 'block'); assert.equal(result.result.forward.kind, 'none');
  const abort = new AbortController(); abort.abort();
  assert.equal((await trialGate({ definition: gate, text: 'original' }, deps, abort.signal)).result.verdict, 'cancelled');
});

test('trial runs disabled draft without mutating saved enabled state', async () => {
  const draft = { ...definition(), enabled: false };
  const calls = [];
  const response = await trialGate({ definition: draft, text: 'sample' }, {
    session: () => { throw Error('no session'); },
    runner: async () => ({ run: async stage => { calls.push(stage.kind); return { verdict: 'note', text: 'fake model output' }; }, runHook: async () => { throw Error('no command'); } }),
  }, signal());
  assert.equal(draft.enabled, false);
  assert.deepEqual(calls, ['converse']);
  assert.equal(response.result.stages.note.text, 'fake model output');
  assert.deepEqual(response.skipped, ['hooks.start', 'check', 'hooks.end']);
});
