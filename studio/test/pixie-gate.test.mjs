import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateGateDefinition } from '../src/pixie-gate-contracts.ts';
import { DefaultStageRunner } from '../src/host/pixie-gate-runner.ts';
import { runGate } from '../src/host/pixie-gate-pipeline.ts';

const model = { provider: 'p', model: 'm' };
const input = { sessionId: 's', cwd: '/work', turn: 3, original: '자막을 번역해 줘', source: 'user', sandboxPolicy: { mode: 'read-only', workspaceRoot: '/work', sessionId: 's' }, hooks: { context: ['hook context'], decision: 'none' } };
const converse = (id, role = 'note', prompt = '{{subject}}') => ({ id, kind: 'converse', role, prompt });
const command = (id = 'measure', role = 'check') => ({ id, kind: 'command', role, command: { command: 'measure' } });
const definition = (stages = [converse('a')], extra = {}) => ({ id: 'g', name: 'Gate', enabled: true, point: 'input', match: {}, stages, forward: { kind: 'original' }, limits: { stageTimeoutMs: 100, maxSteersPerTurn: 2 }, ...extra });
function setup(outputs = [], shellResults = []) {
  const calls = [], commands = [];
  const llm = { stream(options) { calls.push(options); const output = outputs.shift(); return (async function* () {
    if (output instanceof Error) throw output;
    yield { type: 'text-delta', text: output ?? 'note' }; yield { type: 'finish', reason: { kind: 'stop' } };
  })(); } };
  const shell = { resolve(request) { commands.push(request); return request; }, async execute() { return { async result() {
    const value = shellResults.shift(); if (value instanceof Error) throw value;
    return { exitCode: 0, timedOut: false, stdout: { text: '', truncated: false }, stderr: { text: '' }, ...value };
  } }; } };
  return { runner: new DefaultStageRunner({ llm, shell, model }), calls, commands };
}
const output = text => ({ stdout: { text, truncated: false } });
const run = (g, runner, options = {}) => runGate(validateGateDefinition(g), input, runner, { signal: new AbortController().signal, hooks: runner, ...options });

test('subtitle recipe: command → converse check → note → append with hook context', async () => {
  const fake = setup(['{"pass":true}', '분할 번역'], [output('{"data":{"lines":1820,"chars":64000}}')]);
  const g = definition([command(), converse('check', 'check', '{{stages.measure.data}}'), converse('plan', 'note', '{{original}} {{hooks.context}}')], { forward: { kind: 'append', from: ['plan'] } });
  const result = await run(g, fake.runner);
  assert.equal(result.verdict, 'pass');
  assert.deepEqual(result.stages.measure.data, { lines: 1820, chars: 64000 });
  assert.deepEqual(result.notes, ['분할 번역']);
  assert.deepEqual(result.forward, { kind: 'append', text: input.original, contexts: ['분할 번역'], source: 'studio-pixie-gate' });
  assert.equal(fake.calls[0].messages[0].content[0].text, '{"lines":1820,"chars":64000}');
  assert.match(fake.calls[1].messages[0].content[0].text, /hook context/);
  const stdin = JSON.parse(fake.commands[0].stdin);
  assert.equal(stdin.pixie_gate, '1'); assert.equal(stdin.event, 'stage'); assert.equal(stdin.session_id, 's');
  assert.deepEqual(fake.commands[0].sandboxPolicy, input.sandboxPolicy);
  assert.equal(fake.commands[0].workdir, '/work'); assert.equal(fake.commands[0].env.DSH_PIXIE_GATE_ID, 'g');
});

test('definition defaults and 1/3/5 stage limits; 0/6/judge and invalid IDs rejected', () => {
  const g = validateGateDefinition(definition()); assert.equal(g.onError, 'pass'); assert.equal(g.confirmRevision, false); assert.deepEqual(g.match, { agents: 'root', sources: ['user'] });
  for (const n of [1, 3, 5]) assert.equal(validateGateDefinition(definition(Array.from({ length: n }, (_, i) => converse(`s${i}`)))).stages.length, n);
  for (const n of [0, 6]) assert.throws(() => validateGateDefinition(definition(Array.from({ length: n }, (_, i) => converse(`s${i}`)))), /1–5/);
  assert.throws(() => validateGateDefinition(definition([{ id: 'j', kind: 'judge' }])), /not yet supported/);
  for (const stages of [[converse('start')], [converse('a'), converse('a')], [converse('subject')]]) assert.throws(() => validateGateDefinition(definition(stages)), /stage id/);
});

test('roles, forward and prompt variables validated before execution', () => {
  for (const point of ['turn-end', 'tool-before']) {
    assert.throws(() => validateGateDefinition(definition([converse('a', 'revise')], { point })), /revise/);
    for (const forward of [{ kind: 'replace', from: 'subject' }, { kind: 'append', from: ['a'] }]) assert.throws(() => validateGateDefinition(definition(undefined, { point, forward })), /forward/);
  }
  for (const prompt of ['{{unknown}}', '{{stages.later.text}}', '{{stages.a.text}}', '{{stages.start.data}}', '{{subject']) assert.throws(() => validateGateDefinition(definition([converse('a', 'note', prompt)])), /variable/);
  assert.doesNotThrow(() => validateGateDefinition(definition([converse('a'), converse('b', 'note', '{{stages.a.text}} {{stages.a.reason}} {{stages.a.data}} {{stages.start.data}}')], { hooks: { start: { command: 'start' } } })));
});

for (const [name, value, verdict] of [
  ['empty exit 0', {}, 'pass'], ['data JSON', output('{"data":12}'), 'pass'],
  ['exit 2', { exitCode: 2, stderr: { text: 'denied' } }, 'fail'],
  ['other exit', { exitCode: 1 }, 'error'], ['timeout', { timedOut: true }, 'error'],
  ['unavailable', new Error('spawn failed'), 'error'], ['invalid JSON', output('{broken'), 'error'],
  ['wrong verdict', output('{"verdict":"revise","text":"x"}'), 'error'],
  ['truncated', { stdout: { text: 'x', truncated: true } }, 'error'],
  ['oversized UTF8', output('한'.repeat(90000)), 'error'],
]) test(`command ${name}`, async () => {
  const { runner } = setup([], [value]); const result = await run(definition([command()]), runner);
  assert.equal(result.stages.measure.verdict, verdict);
  if (verdict === 'error') { assert.equal(result.verdict, 'error'); assert.equal(result.records[0].appliedPolicy, 'pass'); assert.equal(result.forward.kind, 'original'); }
});

test('command text revise/note and missing sandbox refuses to execute', async () => {
  for (const role of ['revise', 'note']) {
    const fake = setup([], [output('new text')]); const result = await run(definition([command('a', role)]), fake.runner);
    assert.equal(result.stages.a.verdict, role);
  }
  const fake = setup(); const result = await runGate(validateGateDefinition(definition([command()])), { ...input, sandboxPolicy: undefined }, fake.runner, { signal: new AbortController().signal });
  assert.equal(result.verdict, 'error'); assert.match(result.stages.measure.error, /sandbox policy/); assert.equal(fake.commands.length, 0);
});

for (const text of ['oops', '{}', '{"pass":"true"}', '{"pass":true,"extra":1}', '{"pass":false,"reason":2}', '[]']) test(`strict converse check rejects ${text}`, async () => {
  const { runner } = setup([text]); const result = await run(definition([converse('a', 'check')], { onError: 'block' }), runner);
  assert.equal(result.verdict, 'error'); assert.equal(result.appliedPolicy, 'block'); assert.equal(result.forward.kind, 'none');
});

for (const n of [1, 3, 5]) test(`${n} converse stages sequentially revise/check/note`, async () => {
  const stages = Array.from({ length: n }, (_, i) => converse(`s${i}`, i === 0 ? 'revise' : i % 2 ? 'check' : 'note'));
  const fake = setup(stages.map(s => s.role === 'check' ? '{"pass":true}' : s.role === 'revise' ? 'revised' : 'note'));
  const result = await run(definition(stages, { forward: { kind: 'replace', from: 'subject' } }), fake.runner);
  assert.equal(result.verdict, 'revise'); assert.equal(result.forward.text, 'revised'); assert.equal(result.records.length, n);
  for (const call of fake.calls.slice(1)) assert.equal(call.messages[0].content[0].text, 'revised');
});

test('fail stops immediately and preserves fix; error fail-open does not apply partial revisions', async () => {
  const fake = setup(['{"pass":false,"reason":"large","fix":"split"}', 'unused']);
  const result = await run(definition([converse('a', 'check'), converse('b')]), fake.runner);
  assert.equal(result.verdict, 'fail'); assert.equal(result.stages.a.text, 'split'); assert.equal(fake.calls.length, 1);
  const other = setup(['revised', 'bad']);
  const failed = await run(definition([converse('a', 'revise'), converse('b', 'check')], { forward: { kind: 'replace', from: 'subject' } }), other.runner);
  assert.equal(failed.subject, 'revised'); assert.equal(failed.forward.text, input.original);
});

for (const verdict of ['skip', 'fail']) test(`start hook ${verdict} prevents stages; end observes immutable result`, async () => {
  const fake = setup([], [output(verdict === 'skip' ? '{"verdict":"pass","data":{"skip":true}}' : '{"verdict":"fail","reason":"stop"}'), { exitCode: 2 }]);
  const result = await run(definition(undefined, { hooks: { start: { command: 'start' }, end: { command: 'end' } } }), fake.runner);
  assert.equal(result.verdict, verdict); assert.equal(fake.calls.length, 0); assert.equal(result.hooks.end.verdict, 'fail');
  assert.equal(JSON.parse(fake.commands[1].stdin).result.verdict, verdict);
});

test('start data reaches prompt; end error remains observation only', async () => {
  const fake = setup(['note'], [output('{"data":{"ready":true}}'), new Error('end unavailable')]);
  const result = await run(definition([converse('a', 'note', '{{stages.start.data}}')], { hooks: { start: { command: 'start' }, end: { command: 'end' } } }), fake.runner);
  assert.equal(fake.calls[0].messages[0].content[0].text, '{"ready":true}');
  assert.deepEqual(result.hooks.start.data, { ready: true });
  assert.deepEqual(Object.keys(result.stages), ['a']);
  assert.deepEqual(result.records.map(record => record.id), ['a']);
  assert.equal(result.verdict, 'pass'); assert.equal(result.hooks.end.verdict, 'error');
});

test('forward is reserved and forward errors preserve user stage results', async () => {
  assert.throws(() => validateGateDefinition(definition([converse('forward')])), /stage id/);
  const fake = setup(['ok', '{"pass":true}']);
  const result = await run(definition([converse('note'), converse('c', 'check')], { forward: { kind: 'replace', from: 'c' } }), fake.runner);
  assert.equal(result.verdict, 'error');
  assert.deepEqual(result.stages.note, { verdict: 'note', text: 'ok' });
  assert.equal(result.stages.c.verdict, 'pass');
  assert.deepEqual(Object.keys(result.stages), ['note', 'c']);
  assert.equal(result.forwardError.verdict, 'error');
  assert.match(result.forwardError.error, /c has no text/);
  assert.deepEqual(result.forward, { kind: 'original', text: input.original });
  assert.deepEqual(result.records.map(record => record.id), ['note', 'c']);
});

for (const role of ['revise', 'note']) for (const text of ['{broken', '  [broken']) test(`command ${role} rejects JSON-like malformed stdout ${text}`, async () => {
  const fake = setup([], [output(text)]);
  const result = await run(definition([command('a', role)]), fake.runner);
  assert.equal(result.stages.a.verdict, 'error');
  assert.match(result.stages.a.error, /Invalid command JSON/);
  assert.equal(result.subject, input.original);
  assert.deepEqual(result.notes, []);
});

test('disabled gate skips stages and both hooks with original forwarding', async () => {
  const fake = setup();
  const result = await run(definition(undefined, { enabled: false, hooks: { start: { command: 'start' }, end: { command: 'end' } } }), fake.runner);
  assert.equal(result.verdict, 'skip');
  assert.deepEqual(result.forward, { kind: 'original', text: input.original });
  assert.deepEqual(result.stages, {});
  assert.deepEqual(result.hooks, {});
  assert.deepEqual(result.records, []);
  assert.equal(fake.calls.length + fake.commands.length, 0);
});

for (const mode of ['timeout', 'cancel']) test(`end hook ${mode} only records error and preserves settled result`, async () => {
  const controller = new AbortController();
  let started, settle, signal, snapshot;
  const ready = new Promise(resolve => { started = resolve; });
  const runner = {
    run: async () => ({ verdict: 'revise', text: 'revised' }),
    runHook: async (_, event, context, result) => {
      assert.equal(event, 'end'); signal = context.signal; snapshot = structuredClone(result); started();
      return new Promise(resolve => { settle = resolve; });
    },
  };
  const pending = run(definition([converse('a', 'revise')], { forward: { kind: 'replace', from: 'subject' }, hooks: { end: { command: 'end', timeoutMs: mode === 'timeout' ? 10 : 1000 } } }), runner, { signal: controller.signal });
  await ready;
  if (mode === 'cancel') controller.abort(new Error('observer cancelled'));
  const result = await pending;
  assert.equal(result.hooks.end.verdict, 'error');
  assert.match(result.hooks.end.error, mode === 'timeout' ? /timed out/ : /observer cancelled/);
  assert.equal(signal.aborted, true);
  assert.deepEqual({ ...result, hooks: {} }, snapshot);
  assert.equal(result.verdict, 'revise');
  assert.deepEqual(result.forward, { kind: 'replace', text: 'revised' });
  const settled = structuredClone(result);
  settle({ verdict: 'fail', reason: 'late' });
  await Promise.resolve();
  assert.deepEqual(result, settled);
});

test('converse deadline cancels an uncooperative llm stream', async () => {
  let signal;
  const runner = new DefaultStageRunner({ model, shell: {}, llm: { stream(options) { signal = options.signal; return { [Symbol.asyncIterator]() { return { next: () => new Promise(() => {}) }; } }; } } });
  const result = await run(definition(undefined, { limits: { stageTimeoutMs: 10, maxSteersPerTurn: 1 } }), runner);
  assert.equal(result.verdict, 'error'); assert.equal(signal.aborted, true);
});

test('pipeline runner seam accepts future judge without pipeline changes', async () => {
  const gate = { ...validateGateDefinition(definition()), stages: [{ id: 'j', kind: 'judge' }] };
  const result = await runGate(gate, input, { run: async stage => { assert.equal(stage.kind, 'judge'); return { verdict: 'pass', data: { judge: true } }; } }, { signal: new AbortController().signal });
  assert.equal(result.stages.j.verdict, 'pass');
});

test('deadline bounds uncooperative runner and aborts its signal', async () => {
  let signal;
  const result = await run(definition(undefined, { limits: { stageTimeoutMs: 10, maxSteersPerTurn: 1 } }), { run: async (_, ctx) => { signal = ctx.signal; return new Promise(() => {}); } });
  assert.equal(result.verdict, 'error'); assert.match(result.stages.a.error, /timed out/); assert.equal(signal.aborted, true);
});

test('external cancellation stops running stages and starts no end hook or next stage', async () => {
  const controller = new AbortController(); let started; const ready = new Promise(resolve => { started = resolve; }); let count = 0;
  const runner = { run: async () => { count++; started(); return new Promise(() => {}); }, runHook: async () => { throw new Error('must not run'); } };
  const pending = run(definition([converse('a'), converse('b')], { hooks: { end: { command: 'end' } } }), runner, { signal: controller.signal });
  await ready; controller.abort(); const result = await pending;
  assert.equal(result.verdict, 'cancelled'); assert.equal(result.forward.kind, 'none'); assert.equal(count, 1);
  await run(definition(), runner, { signal: controller.signal }); assert.equal(count, 1);
});
