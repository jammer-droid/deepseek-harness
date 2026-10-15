import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gateInput } from '../src/host/pixie-gate-input.ts';
import { PixieGateStore } from '../src/host/pixie-gate-store.ts';
import { PixieGateDefinitions } from '../src/host/pixie-gate-definitions.ts';

const definition = (patch = {}) => ({ id: 'g', name: 'Gate', enabled: true, point: 'input', match: { agents: 'any', sources: ['user'] }, stages: [{ id: 's', kind: 'converse', role: 'revise', prompt: '{{subject}}' }], limits: { stageTimeoutMs: 1000, maxSteersPerTurn: 0 }, forward: { kind: 'replace', from: 'subject' }, onError: 'pass', confirmRevision: false, ...patch });
const message = (kind, text) => ({ id: kind, role: 'user', source: { kind }, content: [{ type: 'text', text }] });
async function harness(result, patch = {}, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'studio-input-'));
  const recorder = new PixieGateStore(root);
  const abort = new AbortController(); const events = []; const inputs = [];
  const listener = gateInput({ definitions: async () => [{ definition: definition(patch), presetIds: ['p'] }], preset: () => options.preset ?? 'p', isRoot: () => options.root ?? true, policy: () => undefined,
    runner: async () => ({ run: async (_stage, input) => { inputs.push(input); return typeof result === 'function' ? result(abort) : result; }, runHook: async () => { abort.abort(); return { verdict: 'pass' }; } }), recorder,
    emit: (event, run) => events.push([event, run]),
  });
  const original = message('user', 'original');
  const others = ['runtime-context', 'model-selection', 'hooks-claude-code', 'hooks-codex'].map(kind => message(kind, kind));
  const decision = { kind: 'enter', messages: [original, ...others], startsRequestSeries: true };
  const invoke = (next = async () => decision) => listener({ agent: { id: 'session', ctx: {}, session: { header: { cwd: root } } }, turn: 1, signal: abort.signal }, next);
  return { invoke, recorder, abort, events, inputs, decision, others };
}
for (const [name, result, patch, applied, kind] of [
  ['pass', { verdict: 'pass' }, {}, 'pass', 'enter'],
  ['replace', { verdict: 'revise', text: 'new' }, {}, 'replaced', 'enter'],
  ['append', { verdict: 'note', text: 'context' }, { forward: { kind: 'append', from: ['s'] } }, 'appended', 'enter'],
  ['reject', { verdict: 'fail', reason: 'bad', text: 'suggestion' }, {}, 'rejected', 'reject'],
  ['confirm', { verdict: 'revise', text: 'new' }, { confirmRevision: true }, 'rejected', 'reject'],
  ['error pass', { verdict: 'error', error: 'oops' }, {}, 'pass', 'enter'],
  ['error block', { verdict: 'error', error: 'oops' }, { onError: 'block' }, 'rejected', 'reject'],
]) test(`input ${name}: decision, recording, hooks and unrelated messages`, async () => {
  const h = await harness(result, patch); const value = await h.invoke();
  assert.equal(value.kind, kind);
  const run = (await h.recorder.read('session')).runs[0];
  assert.equal(run.applied, applied); assert.equal(run.original, 'original');
  assert.equal(run.hooksInput, 'observed');
  assert.deepEqual(h.inputs[0].hooks.context, ['hooks-claude-code', 'hooks-codex']);
  assert.deepEqual(h.events.map(e => e[0]), ['pixie-gate/start', 'pixie-gate/end']);
  if (kind === 'reject') { assert.equal(run.rejection.status, 'pending'); assert.equal(run.rejection.original, 'original'); assert.ok(run.rejection.reason); }
  else {
    assert.equal(value.startsRequestSeries, true);
    for (const other of h.others) assert.ok(value.messages.includes(other));
    if (applied === 'pass') assert.equal(value, h.decision);
    if (applied === 'replaced') { assert.equal(value.messages[0].content[0].text, 'new'); assert.deepEqual(value.messages[0].source, { kind: 'user' }); }
    if (applied === 'appended') { assert.equal(value.messages[0], h.decision.messages[0]); assert.equal(value.messages.at(-1).source.kind, 'studio-pixie-gate'); }
  }
});
for (const when of ['before', 'stage', 'end']) test(`cancellation ${when} applies nothing`, async () => {
  const h = await harness(abort => { if (when === 'stage') abort.abort(); return { verdict: 'revise', text: 'new' }; }, when === 'end' ? { hooks: { end: { command: 'observe' } } } : {});
  if (when === 'before') h.abort.abort();
  assert.equal(await h.invoke(), h.decision);
  const run = (await h.recorder.read('session')).runs[0]; assert.equal(run.applied, 'none'); assert.equal(run.status, 'cancelled'); assert.equal(run.rejection, undefined);
});
for (const [verdict, expected] of [['revise', 'replaced'], ['fail', 'rejected']]) test(`cancellation during finish preserves committed ${verdict} decision`, async () => {
  const h = await harness({ verdict, text: 'new', reason: 'bad' });
  const finish = h.recorder.finish.bind(h.recorder);
  h.recorder.finish = async (...args) => { const saved = await finish(...args); h.abort.abort(); return saved; };
  const value = await h.invoke();
  const run = (await h.recorder.read('session')).runs[0];
  assert.equal(run.applied, expected);
  if (verdict === 'fail') assert.equal(value.kind, 'reject');
  else assert.equal(value.messages[0].content[0].text, 'new');
  assert.equal(h.events.at(-1)[1].applied, expected);
});
test('downstream rejection is returned without consulting gate definitions', async () => {
  const h = await harness({ verdict: 'fail' }); const reject = { kind: 'reject' };
  assert.equal(await h.invoke(async () => reject), reject); assert.equal(h.events.length, 0);
});
for (const [name, patch, options] of [['outside preset', {}, { preset: 'outside' }], ['root only', { match: { agents: 'root' } }, { root: false }], ['child only', { match: { agents: 'child' } }, { root: true }], ['source', { match: { agents: 'any', sources: ['agent-message'] } }, {}]]) test(`filter ${name}`, async () => {
  const h = await harness({ verdict: 'fail' }, patch, options); assert.equal(await h.invoke(), h.decision); assert.equal(h.events.length, 0);
});
test('per-message processing preserves relay source metadata, attachments and usage', async () => {
  const h = await harness({ verdict: 'revise', text: 'new', usage: { inputTokens: 2, outputTokens: 3 } }, { match: { agents: 'child', sources: ['agent-message'] } }, { root: false });
  const first = message('agent-message', 'first'); first.source.senderSessionId = 'sender'; first.source.form = 'relay'; first.content.push({ type: 'image', url: 'image' });
  const second = message('agent-message', 'second');
  const value = await h.invoke(async () => ({ kind: 'enter', messages: [first, second] }));
  assert.equal(h.inputs.length, 2); assert.deepEqual(h.inputs.map(i => i.original), ['first', 'second']);
  assert.deepEqual(value.messages[0].source, first.source); assert.deepEqual(value.messages[0].content[1], first.content[1]);
  const runs = (await h.recorder.read('session')).runs; assert.equal(runs.length, 2); assert.equal(runs[0].usage.inputTokens, 2); assert.equal(runs[0].hooksInput, 'unverified');
});
test('a later rejection discards earlier staged replacement', async () => {
  let n = 0; const h = await harness(() => ++n === 1 ? { verdict: 'revise', text: 'new' } : { verdict: 'fail', reason: 'bad' });
  assert.equal((await h.invoke(async () => ({ kind: 'enter', messages: [message('user', 'a'), message('user', 'b')] }))).kind, 'reject');
  assert.deepEqual((await h.recorder.read('session')).runs.map(run => run.applied), ['none', 'rejected']);
});
test('definition store validates atomically and persists defaults, preset bindings and errors', async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-definitions-')); const file = join(root, 'gates.json'); const store = new PixieGateDefinitions(file);
  assert.deepEqual(await store.read(), []);
  const gate = definition({ match: {} }); delete gate.onError;
  await store.save([{ definition: gate, presetIds: ['p'] }]);
  assert.equal((await store.read())[0].definition.onError, 'pass');
  assert.deepEqual((await store.read())[0].definition.match.sources, ['user']);
  const before = await readFile(file, 'utf8');
  for (const rows of [[{ definition: definition({ stages: [] }), presetIds: ['p'] }], [{ definition: definition(), presetIds: [123] }], [{ definition: definition(), presetIds: ['p'] }, { definition: definition({ id: 'other' }), presetIds: ['p'] }]]) assert.throws(() => store.save(rows));
  assert.equal(await readFile(file, 'utf8'), before);
  await writeFile(file, 'broken'); await assert.rejects(store.read());
  await writeFile(join(root, 'not-dir'), 'file');
  await assert.rejects(new PixieGateDefinitions(join(root, 'not-dir', 'gates.json')).save([{ definition: definition(), presetIds: [] }]));
});
