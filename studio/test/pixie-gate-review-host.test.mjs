import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommandOutput, DefaultStageRunner } from '../src/host/pixie-gate-runner.ts';
import { gateInput } from '../src/host/pixie-gate-input.ts';
import { runGate } from '../src/host/pixie-gate-pipeline.ts';
import { gateUsage } from '../src/host/pixie-gate-store.ts';
import { LlmJudgeEngine } from '../src/host/pixie-judge.ts';
import { validateGateDefinition } from '../src/pixie-gate-contracts.ts';

const note = { id: 'n', kind: 'converse', role: 'note', prompt: '{{subject}}' };
const revise = { id: 'r', kind: 'converse', role: 'revise', prompt: '{{subject}}' };
const definition = stages => validateGateDefinition({ id: 'g', name: 'Repro', enabled: true, point: 'input', match: { agents: 'any', sources: ['user'] }, stages, limits: { stageTimeoutMs: 1000, maxSteersPerTurn: 0 }, forward: stages.some(stage => stage.id === 'n') ? { kind: 'replace', from: 'n' } : { kind: 'original' }, onError: 'block', confirmRevision: true });
async function inputCase(stages, forward, noteText = '바뀐 텍스트') {
  const gate = definition(stages);
  if (forward) gate.forward = forward;
  let recorded;
  const listener = gateInput({
    definitions: async () => [{ definition: gate, presetIds: ['p'] }],
    preset: () => 'p', isRoot: () => true, policy: () => undefined,
    runner: async () => ({ run: async stage => stage.id === 'r' ? { verdict: 'revise', text: 'subject 수정본' } : { verdict: 'note', text: noteText }, runHook: async () => ({ verdict: 'pass' }) }),
    recorder: { start: async () => ({ id: 'run', original: '원문' }), finish: async (_session, _id, value) => { recorded = value; } },
    emit: () => {},
  });
  const decision = await listener({ agent: { id: 'fake-session', ctx: {}, session: { header: { cwd: '/tmp/pixie-gate-review-all/repro' } } }, turn: 1, signal: new AbortController().signal }, async () => ({ kind: 'enter', messages: [{ id: 'm', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '원문' }] }] }));
  return { decision, recorded };
}
test('1 null verdict: current pass vs expected error', t => {
  let current;
  try { current = parseCommandOutput('{"verdict":null}', 'check'); }
  catch (error) { current = { verdict: 'error', error: String(error) }; }
  t.diagnostic(`current=${JSON.stringify(current)}; expected verdict=error`);
  assert.equal(current.verdict, 'error');
});
test('2a confirm note replacement: current enter vs expected reject + forward suggestion', async t => {
  const { decision, recorded } = await inputCase([note]);
  const current = { kind: decision.kind, text: decision.messages?.[0].content[0].text, suggestion: recorded.rejection?.suggestion, applied: recorded.applied };
  t.diagnostic(`current=${JSON.stringify(current)}; expected reject, suggestion=바뀐 텍스트`);
  assert.deepEqual({ kind: decision.kind, suggestion: recorded.rejection?.suggestion }, { kind: 'reject', suggestion: '바뀐 텍스트' });
});
test('2b revise + forward other note: current subject suggestion vs expected actual forward text', async t => {
  const { decision, recorded } = await inputCase([revise, note]);
  assert.equal(decision.kind, 'reject');
  assert.equal(recorded.result.forward.text, '바뀐 텍스트');
  t.diagnostic(`current suggestion=${recorded.rejection.suggestion}; actual forward=${recorded.result.forward.text}`);
  assert.equal(recorded.rejection.suggestion, recorded.result.forward.text);
});
test('3 judge usage: current missing vs expected input 10/output 20', async t => {
  const usage = { inputTokens: 10, outputTokens: 20 };
  const llm = { async *stream() {
    yield { type: 'usage', usage };
    yield { type: 'text-delta', text: JSON.stringify({ answers: { safe: { noul: 1 } } }) };
    yield { type: 'finish', reason: { kind: 'stop' } };
  } };
  const model = { provider: 'fake', model: 'fake' };
  const stage = { id: 'j', kind: 'judge', questions: { safe: { type: 'noul', question: 'Safe?' } }, pass: { mode: 'all', conditions: [{ question: 'safe', type: 'noul', threshold: 0.7 }] } };
  const engineResult = await new LlmJudgeEngine(llm, model).judge({ state: '원문', questions: stage.questions }, new AbortController().signal);
  assert.equal(engineResult.ok, true);
  const runner = new DefaultStageRunner({ llm, model, shell: { resolve() { throw new Error('unexpected shell'); }, execute() { throw new Error('unexpected shell'); } } });
  const result = await runner.run(stage, { gate: definition([stage, note]), sessionId: 'fake-session', cwd: '/tmp/pixie-gate-review-all/repro', turn: 1, original: '원문', subject: '원문', stages: {}, signal: new AbortController().signal, timeoutMs: 1000 });
  assert.equal(result.verdict, 'pass');
  t.diagnostic(`engine=${JSON.stringify(engineResult)}; stage=${JSON.stringify(result)}; expected usage=${JSON.stringify(usage)}`);
  assert.deepEqual(result.usage, usage);
});

for (const forward of [{ kind: 'original' }, { kind: 'append', from: ['r'] }]) test(`confirmation ignores revise with ${forward.kind}`, async () => {
  const { decision, recorded } = await inputCase([revise, note], forward);
  assert.equal(decision.kind, 'enter');
  assert.equal(recorded.rejection, undefined);
});
test('identical replacement is pass without confirmation', async () => {
  const { decision, recorded } = await inputCase([note], undefined, '원문');
  assert.equal(decision.kind, 'enter'); assert.equal(recorded.applied, 'pass');
});
const input = { sessionId: 's', cwd: '/work', turn: 1, original: '원문', sandboxPolicy: { mode: 'read-only', workspaceRoot: '/work', sessionId: 's' } };
const signal = () => new AbortController().signal;
function commandRunner(verdict) {
  return new DefaultStageRunner({ llm: {}, shell: {
    resolve: request => request,
    execute: async () => ({ result: async () => ({ exitCode: 0, timedOut: false, stdout: { text: JSON.stringify({ verdict }), truncated: false }, stderr: { text: '' } }) }),
  } });
}
for (const verdict of [null, 'unknown', 42, false, {}, []]) {
  for (const role of ['check', 'revise', 'note']) test(`invalid ${JSON.stringify(verdict)} errors in ${role}`, async () => {
    const stage = { id: 'c', kind: 'command', role, command: { command: 'fake' } };
    const gate = { ...definition([stage]), forward: { kind: 'original' } };
    const result = await runGate(gate, input, commandRunner(verdict), { signal: signal() });
    assert.equal(result.verdict, 'error'); assert.equal(result.stages.c.verdict, 'error');
  });
  for (const event of ['start', 'end']) test(`invalid ${JSON.stringify(verdict)} in ${event} hook`, async () => {
    const gate = { ...definition([note]), forward: { kind: 'original' }, hooks: { [event]: { command: 'fake' } } };
    const result = await runGate(gate, input, { run: async () => ({ verdict: 'pass' }) }, { signal: signal(), hooks: commandRunner(verdict) });
    assert.equal(result.hooks[event].verdict, 'error'); assert.equal(result.verdict, event === 'start' ? 'error' : 'pass');
    if (event === 'end') assert.deepEqual(result.forward, { kind: 'original', text: '원문' });
  });
}
const questions = {
  n: { type: 'noul', question: '질문 {{subject}}', criteria: { true: '참 {{original}}', false: '거짓 {{subject}}' } },
  c: { type: 'choice', options: { yes: '선택 {{subject}}', no: '아님 {{original}}' } },
  s: { type: 'score', levels: ['낮음 {{subject}}', '높음 {{original}}'] },
};
const answers = { n: { noul: 1 }, c: { choice: 'yes', probabilities: { yes: 1, no: 0 } }, s: { score: 1, probabilities: [0, 1] } };
const usage = { inputTokens: 10, outputTokens: 20, cacheReadTokens: 3, reasoningTokens: 4 };
for (const malformed of [false, true]) test(`judge rendered snapshots and usage: malformed=${malformed}`, async () => {
  const stage = { id: 'j', kind: 'judge', questions, pass: { mode: 'all', conditions: [{ question: 'n', type: 'noul', threshold: 0.7 }] } };
  const gate = { ...definition([stage, { ...stage, id: 'j2' }]), forward: { kind: 'original' } };
  const llm = { async *stream() {
    yield { type: 'usage', usage };
    yield { type: 'text-delta', text: malformed ? 'invalid' : JSON.stringify({ answers }) };
    yield { type: 'finish', reason: { kind: 'stop' } };
  } };
  const runner = new DefaultStageRunner({ llm, model: { provider: 'fake', model: 'fake' }, shell: {} });
  const result = await runGate(gate, input, runner, { signal: signal() });
  assert.equal(result.verdict, malformed ? 'error' : 'pass'); assert.deepEqual(result.stages.j.usage, usage);
  const count = malformed ? 1 : 2;
  assert.deepEqual(gateUsage(result), Object.fromEntries(Object.entries(usage).map(([k, v]) => [k, v * count])));
  assert.deepEqual(result.stages.j.data?.questions, {
    n: { type: 'noul', question: '질문 원문', criteria: { true: '참 원문', false: '거짓 원문' } },
    c: { type: 'choice', options: { yes: '선택 원문', no: '아님 원문' } },
    s: { type: 'score', levels: ['낮음 원문', '높음 원문'] },
  });
});
