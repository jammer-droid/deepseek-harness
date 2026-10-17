/** The Pixie Loop guide's examples are real specs (#31 D13): every JSON block validates, both languages carry the same
 * specs, the checks example compiles, and the translation example runs through the engine with fake models.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateLoopChecks, validateLoopSpec, runCodeChecks } from '../src/pixie-loop-contracts.ts';
import { COMPILE_SYSTEM, INTERPRET_SYSTEM, runLoop } from '../src/host/pixie-loop-engine.ts';
import { pixieLoopSkill } from '../src/host/pixie-hook-skill.ts';

const read = name => readFileSync(new URL(`../release/docs/appendix/${name}`, import.meta.url), 'utf8');
const blocks = text => [...text.matchAll(/```json\n([\s\S]*?)\n```/g)].map(match => JSON.parse(match[1]));
/** Guide specs are tool arguments; the tool takes `run_in_background` off before validating, as here. */
const asSpec = ({ run_in_background: _background, ...spec }) => spec;

test('every JSON block in both guides is a valid spec or checks object, and the languages match', () => {
  const en = blocks(read('pixie-loop.md')), ko = blocks(read('pixie-loop.ko.md'));
  assert.equal(en.length, 4); assert.deepEqual(ko, en);
  validateLoopChecks(en[0]);
  for (const spec of en.slice(1)) validateLoopSpec(asSpec(spec));
});

test('the translation example calibrates with its own code checks and runs end to end', async () => {
  const spec = validateLoopSpec(asSpec(blocks(read('pixie-loop.md'))[1]));
  // The worker's first answers: one good, one drops a placeholder, one stays English.
  const first = { 'Save {name}': '{name} 저장', 'Delete {count} items': '항목 삭제', 'Close': 'Close' };
  const fixed = { 'Delete {count} items': '항목 {count}개 삭제', 'Close': '닫기' };
  const compiled = JSON.stringify({ questions: { faithful: { type: 'noul', instructions: 'Does `output` keep the full meaning of `input`?' } }, pass: { faithful: { min: 0.7 } } });
  const llm = { stream: options => (async function* () {
    const input = options.messages[0].content[0].text;
    const text = options.system === COMPILE_SYSTEM ? compiled : options.system === INTERPRET_SYSTEM ? 'Keep every placeholder and write Korean.'
      : options.messages.length === 1 ? first[input] : fixed[input];
    yield { type: 'text-delta', text }; yield { type: 'finish', reason: { kind: 'stop' } };
  })() };
  // The engine reads meaning: the 4xx calibration failure and the 반말 failure are unfaithful/impolite.
  const judge = { kind: 'judge', label: 'fake', async judge(request) {
    const bad = /재시도$|열어라$/.test(request.state.output);
    return { ok: true, answers: { faithful: { type: 'noul', noul: bad ? 0.05 : 0.92 } } };
  } };
  const items = Object.keys(first).map((input, index) => ({ id: `k${index + 1}`, input }));
  const run = await runLoop(spec, items, { llm, model: { provider: 'p', model: 'm' }, judge }, { sessionId: 's', signal: new AbortController().signal });
  assert.equal(run.status, 'done', run.reason);
  assert.deepEqual(run.items.map(item => [item.id, item.status, item.attempts.length]).sort(), [['k1', 'passed', 1], ['k2', 'passed', 2], ['k3', 'passed', 2]]);
  const k2 = run.items.find(item => item.id === 'k2');
  assert.match(k2.attempts[0].codeFailures[0].message, /missing \{count\}/);
  assert.equal(runCodeChecks(spec.codeChecks, 'Close', 'Close')[0].check, 'regex');
});

test('the packaged loop skill carries the English guide', () => {
  const skill = pixieLoopSkill();
  assert.equal(skill.name, 'studio-pixie-loop-guide');
  assert.match(skill.files['SKILL.md'], /^---\nname: studio-pixie-loop-guide\n/);
  assert.equal(skill.files['guide.md'], read('pixie-loop.md'));
});
