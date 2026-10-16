import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { JSDOM } from 'jsdom';
import { GateResultDetails } from '../src/pixie-gate-result.tsx';
import { PixieSettingsPage } from '../src/pixie-settings.tsx';
const dom = new JSDOM('<!doctype html><body></body>');
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const button = (h, name) => [...h.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent) === name);
const input = (h, label) => h.querySelector(`[aria-label="${label}"]`);
const click = async el => { assert.ok(el); await act(async () => el.click()); };
const change = async (el, value) => { assert.ok(el); await act(async () => { el.value = value; Simulate.change(el); }); };
async function render(t, component, props) {
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(React.createElement(component, { locale: 'en', ...props })));
  t.after(async () => { await act(async () => root.unmount()); host.remove(); }); return host;
}
test('judge answer summary uses recorded labels, falls back to ids and keeps failure reason', async t => {
  const stage = { questions: { c: { type: 'choice', options: { yes: 'Approved', no: 'Rejected' } }, s: { type: 'score', levels: ['Low', 'High'] }, n: { type: 'noul', question: 'Safe?' } } };
  const result = { verdict: 'fail', original: 'a', subject: 'a', notes: [], records: [], hooks: {}, forward: { kind: 'none' }, stages: { first: { verdict: 'fail', reason: 'n: noul must be >= 0.8', data: { answers: { c: { type: 'choice', choice: 'yes', probabilities: { yes: 0.9, no: 0.1 }, confidence: 0.8 }, s: { type: 'score', score: 1, probabilities: [0, 1], confidence: 1 }, n: { type: 'noul', noul: 0.2 } } } } } };
  result.stages.first.data.questions = stage.questions;
  const host = await render(t, GateResultDetails, { result });
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
  const stage = { questions: { n: { type: 'noul', question: '안전한가?' }, s: { type: 'score', levels: ['미흡', '충분'] }, c: { type: 'choice', options: { no: '거부', yes: '승인' } } } };
  const result = { verdict: 'fail', original: 'a', subject: 'a', notes: [], records: [], hooks: {}, forward: { kind: 'none' }, stages: { first: { verdict: 'fail', reason: 'legacy raw reason', data: { failedConditions: [{ question: 'n', type: 'noul', threshold: 0.5, actual: 0.2 }, { question: 's', type: 'score', min: 1, actual: 0 }, { question: 'c', type: 'choice', allowed: ['yes'], actual: 'no' }] } } } };
  result.stages.first.data.questions = stage.questions;
  const host = await render(t, GateResultDetails, { locale: 'ko', result });
  assert.match(host.textContent, /질문 "안전한가\?": 예 확률 0.2 < 기준 0.5/);
  assert.match(host.textContent, /점수 미흡 < 최소 충분/); assert.match(host.textContent, /선택 거부이 허용 옵션 아님/); assert.doesNotMatch(host.textContent, /legacy raw reason/);
  delete result.stages.first.data.questions;
  const fallback = await render(t, GateResultDetails, { result });
  assert.match(fallback.textContent, /Question "n": yes probability 0.2 < threshold 0.5/); assert.match(fallback.textContent, /score 0 < minimum 1/); assert.match(fallback.textContent, /selection no is not allowed/);
  const chinese = await render(t, GateResultDetails, { result, locale: 'zh' }); assert.match(chinese.textContent, /阈值 0.5/);
});
