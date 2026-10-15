import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gateTools } from '../src/host/pixie-gate-tools.ts';
const text = value => [{ type: 'text', text: value }];
function harness(point, result, options = {}) {
  const abort = new AbortController(); const records = []; const inputs = []; const events = [];
  const gate = { id: 'g', name: 'gate', enabled: true, point, match: { agents: options.agents ?? 'any', tools: ['search'] }, stages: [{ id: 's', kind: 'converse', role: 'check', prompt: '' }], limits: { stageTimeoutMs: 1000, maxSteersPerTurn: 1 }, forward: options.forward ?? { kind: 'original' }, onError: options.onError ?? 'pass' };
  const exec = { callId: 'call-original', name: 'search', arguments: { q: 'query' }, signal: abort.signal, agent: { id: 'session', ctx: {}, session: { header: { cwd: '/workspace' }, snapshotEvents: () => [{ type: 'turn/start', data: { turn: 3 } }] } } };
  const listeners = gateTools({ definitions: async () => [{ definition: gate, presetIds: ['p'] }], preset: () => options.preset ?? 'p', isRoot: () => options.root ?? true, policy: () => undefined,
    runner: async () => ({ run: async (_, input) => { inputs.push(input); if (options.cancel) abort.abort(); return result; } }), recorder: { start: async () => ({ id: 'run' }), finish: async (_, __, settlement) => { records.push(settlement); if (options.lateCancel) abort.abort(); return true; } }, emit: (...args) => events.push(args) });
  const invoke = (decision = { kind: point === 'tool-before' ? 'allow' : 'accept' }, outcome = { isError: true, content: text('original') }) => point === 'tool-before' ? listeners.before(exec, async () => decision) : listeners.after(exec, outcome, async () => decision);
  return { exec, records, inputs, events, invoke };
}
for (const point of ['tool-before', 'tool-after']) for (const verdict of ['pass', 'note', 'fail']) test(`${point} ${verdict}`, async () => {
  const h = harness(point, { verdict, text: 'feedback' }); const decision = await h.invoke();
  assert.equal(decision.kind, verdict === 'fail' ? point === 'tool-before' ? 'deny' : 'block' : point === 'tool-before' ? 'allow' : 'accept');
  assert.equal(h.records[0].applied, verdict === 'fail' ? point === 'tool-before' ? 'denied' : 'blocked' : 'none');
  assert.equal(h.inputs[0].tool.call_id, 'call-original'); assert.equal(h.records[0].tool.callId, h.exec.callId); assert.equal(h.events.length, 2);
});
for (const kind of ['deny', 'cancel', 'block']) test(`preserve downstream ${kind}`, async () => {
  const h = harness(kind === 'block' ? 'tool-after' : 'tool-before', { verdict: 'fail' }); const decision = { kind };
  assert.equal(await h.invoke(decision), decision); assert.equal(h.records.length, 0);
});
test('ask is passed into hooks and preserved on pass', async () => {
  const h = harness('tool-before', { verdict: 'pass' }); const decision = { kind: 'ask', reason: 'approval' };
  assert.equal(await h.invoke(decision), decision); assert.equal(h.inputs[0].hooks.decision, 'ask'); assert.equal(h.records[0].hooksInput, 'observed');
});
test('replace uses downstream content and leaves original call identity untouched', async () => {
  const h = harness('tool-after', { verdict: 'revise', text: 'new' }, { forward: { kind: 'replace', from: 'subject' } });
  const value = await h.invoke({ kind: 'accept', content: text('downstream') }); assert.deepEqual(value.content, text('new'));
  assert.equal(h.inputs[0].original, 'downstream'); assert.equal(h.exec.callId, 'call-original'); assert.equal(h.records[0].applied, 'replaced');
});
for (const value of [null, 'structured', { data: 1 }]) test(`value result is never content-replaced ${JSON.stringify(value)}`, async () => {
  const h = harness('tool-after', { verdict: 'revise', text: 'new' }, { forward: { kind: 'replace', from: 'subject' } }); const decision = { kind: 'accept' };
  assert.equal(await h.invoke(decision, { isError: false, value, content: text('original') }), decision);
  assert.equal(h.records[0].applied, 'none'); assert.equal(h.records[0].reason, 'value-bearing result');
});
test('append preserves downstream contexts; base contexts are not duplicated', async () => {
  const h = harness('tool-after', { verdict: 'note', text: 'extra' }, { forward: { kind: 'append', from: ['s'] } });
  const prior = { role: 'user', content: text('prior') }; const base = { role: 'user', content: text('base') };
  const value = await h.invoke({ kind: 'accept', additionalContexts: [prior] }, { isError: false, value: 1, content: text('original'), additionalContexts: [base] });
  assert.equal(value.additionalContexts[0], prior); assert.equal(value.additionalContexts.length, 2); assert.equal(value.additionalContexts[1].source.kind, 'studio-pixie-gate');
  assert.deepEqual(h.inputs[0].hooks.context, ['base', 'prior']); assert.equal(h.records[0].applied, 'appended');
});
for (const point of ['tool-before', 'tool-after']) for (const lateCancel of [false, true]) test(`${point} cancellation late=${lateCancel}`, async () => {
  const h = harness(point, { verdict: 'fail' }, { cancel: !lateCancel, lateCancel }); const decision = { kind: point === 'tool-before' ? 'allow' : 'accept' }; const value = await h.invoke(decision);
  assert.equal(value === decision, !lateCancel); assert.equal(h.records[0].applied === 'none', !lateCancel);
});
for (const options of [{ preset: 'outside' }, { agents: 'child', root: true }, { agents: 'root', root: false }, { tool: 'other' }]) test(`tool filter ${JSON.stringify(options)}`, async () => {
  const h = harness('tool-before', { verdict: 'fail' }, options); if (options.tool) h.exec.name = options.tool;
  await h.invoke(); assert.equal(h.records.length, 0);
});
