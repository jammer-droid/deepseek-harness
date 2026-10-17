/** Bulk Korean judging plan and record merge (#30 S5). No network. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attemptFrom, mergeRecord, MAX_ATTEMPTS, openRows, planNamespace, questionsFor, renderDictionary } from '../scripts/dsh-ko-judge.mjs';

const english = new Map([['a', ['Save']], ['b', ['Open {name}']], ['c', ['MCP']], ['d', ['New text', 'Old text']]]);

test('asks the three translate-skill questions per id', () => {
  const questions = questionsFor('k01');
  assert.deepEqual(Object.keys(questions), ['k01_natural', 'k01_meaning', 'k01_style']);
  assert.match(questions.k01_style.instructions, /합쇼체/);
});

test('plans only text without a verdict; verbatim tokens and judged text are skipped', () => {
  const record = { rows: [{ key: 'a', attempts: [{ ko: '저장', natural: 1.8, meaning: 0.9, style: 0.7, pass: true }], result: 'pass' }] };
  const plan = planNamespace({ ko: { a: '저장', b: '{name} 열기', c: 'MCP', d: '새 문구', e: '없음' } }, record, english);
  assert.deepEqual(plan.items.map(item => [item.key, item.en]), [['b', 'Open {name}'], ['d', 'New text'], ['d', 'Old text']]);
  assert.deepEqual(plan.skipped, ['e']);
  const changed = planNamespace({ ko: { a: '저장하기' } }, record, english);
  assert.deepEqual(changed.items.map(item => item.key), ['a']);
});

test('reads answers into attempts and treats missing answers as unjudged', () => {
  const answers = { k01_natural: { score: 1.6 }, k01_meaning: { noul: 0.9 }, k01_style: { noul: 0.49 } };
  assert.deepEqual(attemptFrom('저장', 'k01', answers), { ko: '저장', natural: 1.6, meaning: 0.9, style: 0.49, pass: false });
  assert.deepEqual(attemptFrom('저장', 'k02', answers), { ko: '저장', error: 'missing answer' });
});

test('merges versions by their worst score and marks unresolved after the attempt cap', () => {
  const pass = { natural: 1.7, meaning: 0.9, style: 0.6, pass: true };
  const both = mergeRecord(undefined, 'ns', [
    { key: 'd', ko: '새 문구', en: 'New text', attempt: { ko: '새 문구', ...pass } },
    { key: 'd', ko: '새 문구', en: 'Old text', attempt: { ko: '새 문구', natural: 1.7, meaning: 0.3, style: 0.6, pass: false } },
  ], '2026-10-17');
  assert.equal(both.record.rows[0].result, 'pending');
  assert.equal(both.record.rows[0].attempts[0].meaning, 0.3);

  const failing = { natural: 1.2, meaning: 0.9, style: 0.6, pass: false };
  let record;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    ({ record } = mergeRecord(record, 'ns', [{ key: 'x', ko: `시도 ${attempt}`, en: 'X', attempt: { ko: `시도 ${attempt}`, ...failing } }], '2026-10-17'));
    assert.equal(record.rows[0].result, attempt < MAX_ATTEMPTS ? 'pending' : 'unresolved');
  }
  ({ record } = mergeRecord(record, 'ns', [{ key: 'y', ko: '와이', en: 'Y', attempt: { ko: '와이', error: 'HTTP 500' } }], '2026-10-17'));
  assert.equal(record.rows.find(row => row.key === 'y').result, 'unjudged');
});

test('renders a dictionary with keys moved to fallback', () => {
  const text = renderDictionary({ ko: { a: '저장', 'b.c': "it's\n둘째 줄" }, fallback: ['z'] }, ['a']);
  assert.match(text, /'b\.c': 'it\\'s\\n둘째 줄',/);
  assert.match(text, /fallback: \['z', 'a'\],/);
  assert.doesNotMatch(text, /저장/);
});

test('a failing key left unchanged stays open across runs until rewritten or moved to fallback', () => {
  const record = { rows: [
    { key: 'a', attempts: [{ ko: '시간', natural: 1.3, meaning: 0.4, style: 0.6, pass: false }], result: 'pending' },
    { key: 'b', attempts: [{ ko: '닫기', natural: 1.9, meaning: 0.9, style: 0.7, pass: true }], result: 'pass' },
    { key: 'c', attempts: [{ ko: '시도', natural: 1.0, meaning: 0.9, style: 0.6, pass: false }], result: 'pending' },
  ] };
  const dictionary = { ko: { a: '시간', b: '닫기' }, fallback: ['c'] };
  assert.equal(planNamespace(dictionary, record, new Map([['a', ['hours']], ['b', ['Close']]])).items.length, 0);
  assert.deepEqual(openRows(record, dictionary).map(row => row.key), ['a']);
});
