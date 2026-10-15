import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateGateDefinition, evaluateJudgePass } from '../src/pixie-gate-contracts.ts';
import { DEFAULT_JUDGE_SYSTEM_PROMPT } from '../src/pixie-contracts.ts';
import { parsePixieSettings } from '../src/host/pixie-store.ts';
import { DefaultStageRunner } from '../src/host/pixie-gate-runner.ts';
import { runGate } from '../src/host/pixie-gate-pipeline.ts';

const model = { provider: 'p', model: 'base' };
const judge = (id = 'j') => ({ id, kind: 'judge', questions: { safe: { type: 'noul', question: 'Safe? {{subject}}' } }, pass: { mode: 'all', conditions: [{ question: 'safe', type: 'noul', threshold: 0.7 }] } });
const gate = (stages = [judge()], extra = {}) => validateGateDefinition({ id: 'g', name: 'Gate', enabled: true, point: 'input', match: {}, stages, forward: { kind: 'original' }, limits: { stageTimeoutMs: 100, maxSteersPerTurn: 1 }, ...extra });
const input = { sessionId: 's', cwd: '/work', turn: 1, original: 'subtitle', hooks: { context: ['hook'], decision: 'none' }, sandboxPolicy: { mode: 'read-only', workspaceRoot: '/work', sessionId: 's' } };
const answer = n => JSON.stringify({ answers: { safe: { noul: n } } });
function setup(outputs, extra = {}) {
  const calls = [];
  const llm = { stream(options) { calls.push(options); return (async function* () { yield { type: 'text-delta', text: outputs.shift() }; yield { type: 'finish', reason: { kind: 'stop' } }; })(); } };
  const shell = { resolve: request => request, execute: async () => ({ result: async () => ({ exitCode: 0, timedOut: false, stdout: { text: '{"data":{"lines":1820}}', truncated: false }, stderr: { text: '' } }) }) };
  return { calls, runner: new DefaultStageRunner({ llm, shell, model, ...extra }) };
}
const run = (g, runner, signal = new AbortController().signal) => runGate(g, input, runner, { signal });

test('judge contract validates question ids, type-specific limits, references and fixed check role', () => {
  assert.equal(gate().stages[0].kind, 'judge');
  for (const mutate of [s => { s.questions = {}; }, s => { s.questions['bad.id'] = s.questions.safe; }, s => { s.pass.conditions[0].question = 'absent'; }, s => { s.pass.conditions[0].threshold = 1.01; }, s => { s.pass.conditions[0].threshold = -0.1; }, s => { s.pass.conditions = []; }, s => { s.role = 'revise'; }, s => { s.questions.safe.criteria = { true: 1 }; }, s => { s.questions.safe.question = '{{stages.later.text}}'; }]) {
    const stage = judge(); mutate(stage); assert.throws(() => gate([stage]));
  }
  const stage = judge(); stage.questions.safe = { type: 'score', levels: ['bad', 'good'] }; stage.pass.conditions = [{ question: 'safe', type: 'score', min: 1 }];
  assert.doesNotThrow(() => gate([stage])); stage.pass.conditions[0].min = 2; assert.throws(() => gate([stage]), /range/);
  stage.questions.safe = { type: 'choice', options: { yes: 'yes', no: 'no' } }; stage.pass.conditions = [{ question: 'safe', type: 'choice', allowed: ['unknown'] }]; assert.throws(() => gate([stage]), /choices/);
});

test('all/any pass rules include boundaries and explain every failed condition', () => {
  const conditions = [{ question: 'n', type: 'noul', threshold: 0.7 }, { question: 's', type: 'score', min: 1 }, { question: 'c', type: 'choice', allowed: ['yes'] }];
  const answers = { n: { type: 'noul', noul: 0.7 }, s: { type: 'score', score: 1 }, c: { type: 'choice', choice: 'yes' } };
  assert.equal(evaluateJudgePass({ mode: 'all', conditions }, answers).pass, true);
  answers.n.noul = 0.699; answers.s.score = 0.999;
  const failed = evaluateJudgePass({ mode: 'all', conditions }, answers); assert.equal(failed.pass, false); assert.match(failed.reason, /n:.*s:/);
  assert.equal(evaluateJudgePass({ mode: 'any', conditions }, answers).pass, true);
  answers.c.choice = 'no'; assert.equal(evaluateJudgePass({ mode: 'any', conditions }, answers).pass, false);
  assert.throws(() => evaluateJudgePass({ mode: 'any', conditions }, {}), /answer/);
});

test('judge → converse → judge carries prior answers, original, subject and hooks', async () => {
  const fake = setup([answer(0.8), 'revised', answer(0.7)]);
  const result = await run(gate([judge('first'), { id: 'revise', kind: 'converse', role: 'revise', prompt: '{{stages.first.data}}' }, judge('last')]), fake.runner);
  assert.equal(result.verdict, 'revise'); assert.equal(result.stages.last.verdict, 'pass');
  assert.match(fake.calls[1].messages[0].content[0].text, /answers/);
  const prompt = fake.calls[2].messages[0].content[0].text;
  assert.match(prompt, /"subject": "revised"/); assert.match(prompt, /"original": "subtitle"/); assert.match(prompt, /"first"/); assert.match(prompt, /"hooks"/); assert.match(prompt, /Safe\? revised/);
});

test('subtitle command → judge → converse → append preserves measured data', async () => {
  const fake = setup([answer(1), 'split translation']);
  const result = await run(gate([{ id: 'measure', kind: 'command', role: 'check', command: { command: 'measure' } }, judge(), { id: 'plan', kind: 'converse', role: 'note', prompt: '{{stages.measure.data}}' }], { forward: { kind: 'append', from: ['plan'] } }), fake.runner);
  assert.equal(result.forward.kind, 'append'); assert.deepEqual(result.forward.contexts, ['split translation']); assert.match(fake.calls[0].messages[0].content[0].text, /1820/);
});

test('bad judge output remains error and failing thresholds report conditions', async () => {
  for (const text of ['not json', '{"answers":{}}', answer(1.1)]) {
    const result = await run(gate(), setup([text]).runner); assert.equal(result.verdict, 'error'); assert.equal(result.stages.j.verdict, 'error'); assert.equal(result.appliedPolicy, 'pass');
  }
  const failed = await run(gate(), setup([answer(0.69)]).runner); assert.equal(failed.verdict, 'fail'); assert.match(failed.stages.j.reason, /safe: noul must be >= 0.7/);
});

test('judge timeout and cancellation settle even if the llm ignores abort', async () => {
  let observed;
  const fake = setup([], { llm: { stream(options) { observed = options.signal; return { [Symbol.asyncIterator]() { return this; }, next: () => new Promise(() => {}) }; } } });
  const result = await run(gate(undefined, { limits: { stageTimeoutMs: 5, maxSteersPerTurn: 1 } }), fake.runner);
  assert.equal(result.verdict, 'error'); assert.match(result.stages.j.error, /timed out/); assert.equal(observed.aborted, true);
  const abort = new AbortController(); const pending = run(gate(), fake.runner, abort.signal); queueMicrotask(() => abort.abort());
  assert.equal((await pending).verdict, 'cancelled');
});

test('dedicated judge model and system fall back compatibly and stage model wins', async () => {
  const settings = { contextMode: 'fresh', systemPrompt: 'conversation', allowThreadModel: true, model };
  assert.deepEqual(parsePixieSettings(settings), settings);
  const dedicated = { ...settings, judgeModel: { provider: 'p', model: 'judge' }, judgeSystemPrompt: 'judge only' };
  assert.deepEqual(parsePixieSettings(dedicated), dedicated);
  assert.throws(() => parsePixieSettings({ ...settings, judgeSystemPrompt: 1 }), /judgeSystemPrompt/);
  const fallback = setup([answer(1)]); await run(gate(), fallback.runner); assert.equal(fallback.calls[0].model, 'base'); assert.equal(fallback.calls[0].system, DEFAULT_JUDGE_SYSTEM_PROMPT);
  const custom = setup([answer(1), answer(1)], dedicated); await run(gate(), custom.runner); assert.equal(custom.calls[0].model, 'judge'); assert.equal(custom.calls[0].system, 'judge only');
  await run(gate([{ ...judge(), model: { provider: 'p', model: 'stage' } }]), custom.runner); assert.equal(custom.calls[1].model, 'stage');
});
