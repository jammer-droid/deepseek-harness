import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { JSDOM } from 'jsdom';
import { GateComposer } from '../src/pixie-gate-composer.tsx';
import { GateResultDetails } from '../src/pixie-gate-result.tsx';
import { PixieSettingsPage } from '../src/pixie-settings.tsx';
import { makeJudgeStage } from '../src/pixie-gate-judge-editor.tsx';
const dom = new JSDOM('<!doctype html><body></body>');
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const button = (h, name) => [...h.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent) === name);
const input = (h, label) => h.querySelector(`[aria-label="${label}"]`);
const click = async el => { assert.ok(el); await act(async () => el.click()); };
const change = async (el, value) => { assert.ok(el); await act(async () => { el.value = value; Simulate.change(el); }); };
const definition = () => ({ id: 'gate1', name: 'Guard', enabled: true, point: 'input', match: {}, stages: [{ id: 'first', kind: 'converse', role: 'check', prompt: '{{subject}}' }], forward: { kind: 'original' }, onError: 'pass', confirmRevision: false, limits: { stageTimeoutMs: 1000, maxSteersPerTurn: 1 } });
async function render(t, component, props) {
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(React.createElement(component, { locale: 'en', ...props })));
  t.after(async () => { await act(async () => root.unmount()); host.remove(); }); return host;
}
async function editor(t) {
  const saves = [], trials = [];
  const host = await render(t, GateComposer, { open: true, entry: { definition: definition(), presetIds: [] }, models: { groups: [] }, onClose() {}, onSave: async entry => { saves.push([structuredClone(entry)]); return true; }, trial: request => { trials.push(request); return { result: Promise.resolve({ result: { verdict: 'pass', original: request.text, subject: request.text, notes: [], stages: {}, records: [], hooks: {}, forward: { kind: 'original', text: request.text } }, durations: {}, skipped: [] }), cancel() {} }; } });
  await click(host.querySelector('[data-gate-node="stage-0"]'));
  await click([...input(host, 'Kind').querySelectorAll('[role=radio]')].find(b => b.textContent === 'Judge'));
  return { host, saves, trials };
}
test('judge validation notices localize ordinary invalid drafts in ko en zh', async t => {
  const { GateJudgeEditor } = await import('../src/pixie-gate-judge-editor.tsx');
  for (const [locale, expected] of [['ko', ['옵션', '질문', '범위']], ['en', ['options', 'question', 'range']], ['zh', ['选项', '问题', '范围']]]) {
    const cases = [
      { questions: { q: { type: 'choice', options: { a: '', b: 'B' } } }, pass: { mode: 'all', conditions: [{ question: 'q', type: 'choice', allowed: ['a'] }] } },
      { questions: { q: { type: 'noul', question: 'Q' } }, pass: { mode: 'all', conditions: [{ question: 'missing', type: 'noul', threshold: 0.5 }] } },
      { questions: { q: { type: 'noul', question: 'Q' } }, pass: { mode: 'all', conditions: [{ question: 'q', type: 'noul', threshold: 2 }] } },
    ];
    const duplicateStage = { id: 'judge', kind: 'judge', questions: { q: { type: 'noul', question: 'Q' }, other: { type: 'noul', question: 'Other' } }, pass: { mode: 'all', conditions: [{ question: 'q', type: 'noul', threshold: 0.5 }] } };
    const duplicateHost = await render(t, GateJudgeEditor, { stage: duplicateStage, definition: { ...definition(), stages: [duplicateStage] }, index: 0, onChange() {}, locale });
    await change(duplicateHost.querySelector('[data-judge-question] input'), 'other');
    assert.match(duplicateHost.querySelector('[role=alert]').textContent, locale === 'ko' ? /고유/ : locale === 'zh' ? /唯一/ : /unique/);
    for (const [i, value] of cases.entries()) {
      const stage = { id: 'judge', kind: 'judge', ...value };
      const host = await render(t, GateJudgeEditor, { stage, definition: { ...definition(), stages: [stage] }, index: 0, onChange() {}, locale });
      const notices = [...host.querySelectorAll('[role=alert]')].map(n => n.textContent).join(' ');
      assert.ok(notices.includes(expected[i]), notices);
      if (locale !== 'en') assert.doesNotMatch(notices, /Judge|Choice|needs|unknown|out of range/);
    }
  }
});

test('judge creation hides role, edits noul and submits judge draft in trial payload', async t => {
  const { host, saves, trials } = await editor(t);
  assert.equal(input(host, 'Role'), null); assert.match(host.textContent, /only decide pass or fail/);
  await change(input(host, 'Question text'), 'Is {{subject}} safe?'); assert.match(input(host, 'Select question').textContent, /question1 · Noul — Is/); await change(input(host, 'True criterion'), 'safe'); await change(input(host, 'False criterion'), 'unsafe');
  await change(input(host, 'Threshold (0–1)'), '0.8'); await change(input(host, 'Condition mode'), 'any');
  await click(button(host, 'Save'));
  const stage = saves[0][0].definition.stages[0]; assert.equal(stage.role, undefined); assert.deepEqual(stage.questions.question1.criteria, { true: 'safe', false: 'unsafe' }); assert.equal(stage.pass.conditions[0].threshold, 0.8); assert.equal(stage.pass.mode, 'any');
  await click(host.querySelector('[data-gate-node="trial"]'));
  await change(input(host, 'Sample input (required)'), 'sample'); await click(button(host, 'Run trial'));
  assert.deepEqual(trials[0].definition.stages[0], stage); assert.equal(trials[0].executeCommands, false);
});
test('choice edits options and allows multi-select while deleted options keep invalid conditions', async t => {
  const { host, saves } = await editor(t);
  await change(input(host, 'Question type'), 'choice');
  for (const el of host.querySelectorAll('[aria-label="Option label"]')) await change(el, 'Option');
  assert.match(host.querySelector('[data-judge-condition]').textContent, /type must match/);
  await change(input(host, 'Select question'), 'question1');
  await change(input(host, 'Option label'), 'Approved'); await click(button(host, 'Add option'));
  await change([...host.querySelectorAll('[aria-label="Option label"]')].at(-1), 'Other');
  const boxes = input(host, 'Allowed options').querySelectorAll('input'); await click(boxes[1]);
  await click(button(host, 'Save')); assert.deepEqual(saves[0][0].definition.stages[0].pass.conditions[0].allowed, ['yes', 'no']);
  await click(button(host.querySelector('[data-judge-option="0"]'), 'Delete'));
  assert.match(host.querySelector('[data-judge-condition]').textContent, /known allowed choices/);
  assert.match(input(host, 'Allowed options').textContent, /yes/);
  await click(button(host, 'Save')); assert.equal(saves.length, 1);
});
test('score levels enforce 2–10 and removed questions remain as broken condition references', async t => {
  const { host, saves } = await editor(t);
  await change(input(host, 'Question type'), 'score'); await change(input(host, 'Select question'), 'question1');
  await change(input(host, 'Level label'), 'Low'); await click(button(host, 'Add score level'));
  await change(input(host, 'Minimum score level'), '2');
  for (let i = 0; i < 7; i++) await click(button(host, 'Add score level'));
  assert.equal(button(host, 'Add score level').disabled, true);
  await click(button(host, 'Save')); assert.equal(saves[0][0].definition.stages[0].questions.question1.levels.length, 10);
  await click(button(host, 'Add question'));
  await click(button(host.querySelector('[data-judge-question="0"]'), 'Delete'));
  assert.equal(input(host, 'Select question').value, 'question1'); assert.match(host.querySelector('[data-judge-condition]').textContent, /unknown question/);
  await click(button(host, 'Add condition')); assert.equal(host.querySelectorAll('[data-judge-condition]').length, 2);
  await click(button(host.querySelector('[data-judge-condition="0"]'), 'Delete')); await click(button(host, 'Save')); assert.equal(saves.length, 2);
});
test('judge answer summary uses recorded labels, falls back to ids and keeps failure reason', async t => {
  const stage = { ...makeJudgeStage('first'), questions: { c: { type: 'choice', options: { yes: 'Approved', no: 'Rejected' } }, s: { type: 'score', levels: ['Low', 'High'] }, n: { type: 'noul', question: 'Safe?' } } };
  const result = { verdict: 'fail', original: 'a', subject: 'a', notes: [], records: [], hooks: {}, forward: { kind: 'none' }, stages: { first: { verdict: 'fail', reason: 'n: noul must be >= 0.8', data: { answers: { c: { type: 'choice', choice: 'yes', probabilities: { yes: 0.9, no: 0.1 }, confidence: 0.8 }, s: { type: 'score', score: 1, probabilities: [0, 1], confidence: 1 }, n: { type: 'noul', noul: 0.2 } } } } } };
  result.stages.first.data.questions = stage.questions;
  const host = await render(t, GateResultDetails, { result, definition: { ...definition(), stages: [stage] } });
  assert.match(host.textContent, /Approved · Probability: 90% · Confidence: 80%/); assert.match(host.textContent, /High · Confidence: 100%/); assert.match(host.textContent, /Safe\?: 0.2/); assert.match(host.textContent, /n: noul must be >= 0.8/);
  delete result.stages.first.data.questions;
  const fallback = await render(t, GateResultDetails, { result }); assert.match(fallback.textContent, /c: yes/); assert.match(fallback.textContent, /s: 1/);
});
test('judge settings legacy fields, save states, model fallback and reset', async t => {
  const saves = []; let resolve;
  const host = await render(t, PixieSettingsPage, { actions: { read: async () => ({ contextMode: 'fresh', systemPrompt: 'original', allowThreadModel: true }), models: async () => ({ groups: [{ id: 'p', name: 'Provider', models: [{ id: 'm', name: 'Model' }] }] }), save: settings => { saves.push(structuredClone(settings)); return new Promise(r => { resolve = () => r(settings); }); } } });
  await click(button(host, 'Judge')); const page = host.querySelector('section[aria-label="Judge"]');
  assert.equal(input(page, 'Judge model').value, ''); assert.equal(input(page, 'Judge system prompt').value, ''); assert.equal(button(page, 'Saved').disabled, true);
  await change(input(page, 'Judge model'), JSON.stringify(['p', 'm'])); await change(input(page, 'Judge system prompt'), 'Custom JSON instruction');
  await click(button(page, 'Save')); assert.equal(button(page, 'Saving…').disabled, true); assert.equal(page.querySelector('fieldset').disabled, true);
  await act(async () => resolve()); assert.equal(button(page, 'Saved').disabled, true); assert.equal(saves[0].systemPrompt, 'original'); assert.deepEqual(saves[0].judgeModel, { provider: 'p', model: 'm' });
  await click(button(page, 'Restore default')); await change(input(page, 'Judge model'), ''); await click(button(page, 'Save')); await act(async () => resolve());
  assert.equal(Object.hasOwn(saves[1], 'judgeSystemPrompt'), false); assert.equal(Object.hasOwn(saves[1], 'judgeModel'), false);
});

test('structured failures localize all types and fall back to ids without definitions', async t => {
  const stage = { ...makeJudgeStage('first'), questions: { n: { type: 'noul', question: '안전한가?' }, s: { type: 'score', levels: ['미흡', '충분'] }, c: { type: 'choice', options: { no: '거부', yes: '승인' } } } };
  const result = { verdict: 'fail', original: 'a', subject: 'a', notes: [], records: [], hooks: {}, forward: { kind: 'none' }, stages: { first: { verdict: 'fail', reason: 'legacy raw reason', data: { failedConditions: [{ question: 'n', type: 'noul', threshold: 0.5, actual: 0.2 }, { question: 's', type: 'score', min: 1, actual: 0 }, { question: 'c', type: 'choice', allowed: ['yes'], actual: 'no' }] } } } };
  result.stages.first.data.questions = stage.questions;
  const host = await render(t, GateResultDetails, { locale: 'ko', result, definition: { ...definition(), stages: [stage] } });
  assert.match(host.textContent, /질문 "안전한가\?": 예 확률 0.2 < 기준 0.5/);
  assert.match(host.textContent, /점수 미흡 < 최소 충분/); assert.match(host.textContent, /선택 거부이 허용 옵션 아님/); assert.doesNotMatch(host.textContent, /legacy raw reason/);
  delete result.stages.first.data.questions;
  const fallback = await render(t, GateResultDetails, { result });
  assert.match(fallback.textContent, /Question "n": yes probability 0.2 < threshold 0.5/); assert.match(fallback.textContent, /score 0 < minimum 1/); assert.match(fallback.textContent, /selection no is not allowed/);
  const chinese = await render(t, GateResultDetails, { result, locale: 'zh' }); assert.match(chinese.textContent, /阈值 0.5/);
});
