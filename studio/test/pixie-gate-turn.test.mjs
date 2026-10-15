import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gateTurn } from '../src/host/pixie-gate-turn.ts';

function harness(result = { verdict: 'fail', text: 'fix' }, options = {}) {
  const abort = new AbortController(); const records = []; const inputs = []; const emitted = []; const steered = [];
  const agent = { id: 'session', ctx: {}, session: { header: { cwd: '/workspace' }, deriveMessages: () => [{ role: 'assistant', content: [{ type: 'text', text: 'answer' }] }] }, inbox: { nextStep: [] }, steer: message => steered.push(message) };
  const gate = { id: 'g', name: 'Gate', enabled: true, point: 'turn-end', match: { agents: options.agents ?? 'any' }, stages: [{ id: 's', kind: 'converse', role: 'check', prompt: '{{subject}}' }], limits: { stageTimeoutMs: 1000, maxSteersPerTurn: 1 }, forward: { kind: 'original' }, onError: 'pass' };
  const listener = gateTurn({ definitions: async () => [{ definition: gate, presetIds: ['p'] }], preset: () => options.preset ?? 'p', isRoot: () => options.root ?? true, policy: () => undefined,
    runner: async () => ({ run: async (_, input) => { inputs.push(input); if (options.cancel) abort.abort(); return result; } }),
    recorder: { start: async () => ({ id: 'run', original: 'answer' }), finish: async (_, __, value) => { records.push(value); if (options.lateCancel) abort.abort(); return true; } }, emit: (...args) => emitted.push(args) });
  return { agent, abort, records, inputs, steered, emitted, invoke: (turn = 1) => listener({ agent, turn, signal: abort.signal }) };
}
for (const verdict of ['pass', 'note', 'fail']) test(`turn ${verdict}`, async () => {
  const h = harness({ verdict, text: 'fix' }); await h.invoke();
  assert.equal(h.records[0].applied, verdict === 'fail' ? 'steered' : 'none');
  assert.equal(h.inputs[0].original, 'answer'); assert.equal(h.inputs[0].cwd, '/workspace');
  assert.equal(h.emitted.length, 2);
  if (verdict === 'fail') assert.equal(h.steered[0].source.kind, 'studio-pixie-gate');
});
test('repeated stopping in the same turn accumulates budget; next turn resets', async () => {
  const h = harness(); await h.invoke(); await h.invoke(); await h.invoke();
  assert.equal(h.steered.length, 1); assert.equal(h.records[2].reason, 'maxSteersPerTurn reached'); assert.equal(h.records[2].applied, 'none');
  await h.invoke(2); assert.equal(h.steered.length, 2);
});
test('existing steering is observed but gate still runs without duplicate correction', async () => {
  const h = harness(); h.agent.inbox.nextStep.push({ role: 'user', content: [{ type: 'text', text: 'other correction' }] }); await h.invoke();
  assert.deepEqual(h.inputs[0].hooks, { context: ['other correction'], decision: 'steer' });
  assert.equal(h.records[0].hooksInput, 'observed'); assert.equal(h.records[0].reason, 'existing steering'); assert.equal(h.steered.length, 0);
});
for (const lateCancel of [false, true]) test(`cancellation ${lateCancel ? 'during finish' : 'before commit'}`, async () => {
  const h = harness(undefined, { cancel: !lateCancel, lateCancel }); await h.invoke();
  assert.equal(h.records[0].applied, lateCancel ? 'steered' : 'none'); assert.equal(h.steered.length, lateCancel ? 1 : 0);
});
for (const options of [{ preset: 'outside' }, { agents: 'root', root: false }, { agents: 'child', root: true }]) test(`turn filter ${JSON.stringify(options)}`, async () => {
  const h = harness(undefined, options); await h.invoke(); assert.equal(h.records.length, 0);
});
test('child gate runs for a child', async () => { const h = harness(undefined, { agents: 'child', root: false }); await h.invoke(); assert.equal(h.steered.length, 1); });
