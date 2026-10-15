import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { JSDOM } from 'jsdom';
import { GateEditor } from '../src/pixie-gate-editor.tsx';
import { PixieSettingsPage } from '../src/pixie-settings.tsx';
const dom = new JSDOM('<!doctype html><body></body>');
globalThis.window = dom.window; globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const seed = () => ({ definition: { id: 'gate1', name: 'Guard', enabled: true, point: 'input', match: { agents: 'root', sources: ['user'] }, stages: [{ id: 'first', kind: 'converse', role: 'revise', prompt: '{{subject}}' }], forward: { kind: 'replace', from: 'subject' }, onError: 'pass', confirmRevision: false, limits: { stageTimeoutMs: 1000, maxSteersPerTurn: 1 } }, presetIds: ['p'] });
const button = (h, name) => [...h.querySelectorAll('button')].find(b => b.textContent === name);
const input = (h, label) => h.querySelector(`[aria-label="${label}"]`);
const click = async el => { assert.ok(el); await act(async () => el.click()); };
const change = async (el, value) => { assert.ok(el); await act(async () => { el.value = value; Simulate.change(el); }); };
async function setup(t, overrides = {}, locale = 'en') {
  const saves = [];
  const actions = { read: async () => [seed()], presets: async () => [{ id: 'p', name: 'Preset' }], models: async () => ({ groups: [] }), save: async entries => { saves.push(structuredClone(entries)); }, ...overrides };
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(React.createElement(GateEditor, { actions, locale })));
  t.after(async () => { await act(async () => root.unmount()); host.remove(); });
  return { host, saves, actions };
}
test('gate list supports add, duplicate disabled copy, delete and preset summary', async t => {
  const { host, saves } = await setup(t);
  assert.match(host.textContent, /1 presets/);
  assert.equal(button(host, 'Saved').disabled, true);
  await click(button(host, 'Duplicate'));
  assert.equal(input(host, 'Name').value, 'Guard (Duplicate)');
  await click(button(host, 'Save'));
  assert.equal(saves[0].length, 2); assert.equal(saves[0][1].definition.enabled, false);
  await click(button(host, 'Delete'));
  await click(button(host, 'Add gate'));
  await change(input(host, 'Name'), 'New');
  await click(button(host, 'Save'));
  assert.deepEqual(saves[1].map(e => e.definition.name), ['Guard', 'New']);
});
test('preset checkboxes support multiple selection, removal and unknown saved ids', async t => {
  const entry = seed(); entry.presetIds.push('missing');
  const { host, saves } = await setup(t, { read: async () => [entry], presets: async () => [{ id: 'p', name: 'Preset' }, { id: 'q', name: 'Second' }] });
  const group = input(host, 'Connected presets');
  assert.equal(host.querySelector('select[multiple]'), null);
  const boxes = group.querySelectorAll('input[type=checkbox]');
  assert.deepEqual([...boxes].map(box => box.checked), [true, false, true]);
  await click(boxes[1]); await click(boxes[0]);
  await click(button(host, 'Save'));
  assert.deepEqual(saves[0][0].presetIds, ['missing', 'q']);
});

test('stage controls enforce 1–5 stages and disable judge; order follows explicit moves', async t => {
  const { host } = await setup(t);
  assert.equal(host.querySelector('[data-gate-editor-stage] button:last-child').disabled, true);
  assert.equal(input(host, 'Kind').querySelector('[value=judge]').disabled, true);
  for (let i = 0; i < 4; i++) await click(button(host, 'Add stage'));
  assert.equal(button(host, 'Add stage').disabled, true);
  assert.match(host.textContent, /At most 5 stages/);
  await click(button(host, 'Move down'));
  assert.equal(input(host, 'Stage ID').value, 'stage1');
  const second = host.querySelectorAll('[data-gate-editor-stage]')[1];
  assert.equal(input(second, 'Stage ID').value, 'first');
});
test('changing point explicitly reports role and forward cleanup', async t => {
  const { host, saves } = await setup(t);
  await change(input(host, 'Point'), 'tool-before');
  assert.match(host.querySelector('[role=alert]').textContent, /unsupported revise/);
  assert.equal(input(host, 'Role').value, 'check');
  assert.equal(input(host, 'Role').querySelector('[value=revise]'), null);
  assert.equal(input(host, 'Forward').value, 'original');
  await click(button(host, 'Save'));
  assert.equal(saves[0][0].definition.point, 'tool-before');
});
test('throw-first validation localizes name, stage ID, prompt and forward errors beside fields', async t => {
  const { host, saves } = await setup(t);
  await change(input(host, 'Name'), ''); await click(button(host, 'Save'));
  assert.match(input(host, 'Name').parentElement.textContent, /Enter a name/);
  await change(input(host, 'Name'), 'Okay');
  await change(input(host, 'Stage ID'), 'subject'); await click(button(host, 'Save'));
  assert.match(input(host, 'Stage ID').parentElement.textContent, /Stage IDs must be unique/);
  await change(input(host, 'Stage ID'), 'first');
  await change(input(host, 'Prompt'), '{{stages.later.text}}'); await click(button(host, 'Save'));
  assert.match(input(host, 'Prompt').parentElement.textContent, /preceding stage IDs/);
  await change(input(host, 'Prompt'), '{{subject}}');
  await change(input(host, 'Forward'), 'append'); await click(button(host, 'Save'));
  assert.match(input(host, 'Forward').parentElement.textContent, /Select forwarding sources/);
  assert.equal(saves.length, 0);
});
test('save transitions through saving; failure preserves draft and retry becomes saved', async t => {
  let resolve, reject, calls = 0;
  const { host } = await setup(t, { save: () => { calls++; return new Promise((yes, no) => { resolve = yes; reject = no; }); } });
  await change(input(host, 'Name'), 'Edited'); await click(button(host, 'Save'));
  assert.equal(button(host, 'Saving…').disabled, true);
  assert.equal(host.querySelector('fieldset').disabled, true);
  await act(async () => reject(new Error('disk failure')));
  assert.match(host.querySelector('[role=alert]').textContent, /Save failed.*disk failure/);
  assert.equal(input(host, 'Name').value, 'Edited');
  await click(button(host, 'Save')); await act(async () => resolve());
  assert.equal(calls, 2); assert.equal(button(host, 'Saved').disabled, true);
});
test('gate page is retained in the Pixie settings navigation with Korean labels', async t => {
  const { actions } = await setup(t);
  const host = document.createElement('div'); const root = createRoot(host);
  await act(async () => root.render(React.createElement(PixieSettingsPage, { locale: 'ko', gateActions: actions, actions: { read: async () => ({ contextMode: 'fresh', systemPrompt: '', allowThreadModel: false }), models: actions.models, save: async s => s } })));
  await click(button(host, '게이트'));
  assert.equal(host.querySelector('section[aria-label="게이트"]').hidden, false);
  assert.equal(button(host.querySelector('section[aria-label="게이트"]'), '저장됨').disabled, true);
  await act(async () => root.unmount());
});
test('Chinese localization and command validation use localized inline feedback', async t => {
  const { host } = await setup(t, {}, 'zh');
  await change(input(host, '类型'), 'command');
  await click(button(host, '保存'));
  assert.match(input(host, '命令').parentElement.textContent, /请检查命令内容/);
});

test('editor separates localized sections, list summary, selection and compact model', async t => {
  const { host } = await setup(t, {}, 'ko');
  for (const label of ['게이트', '기본', '대상', '결과 처리', '훅', '단계', '시험 실행']) assert.ok(host.querySelector(`section[aria-label="${label}"]`));
  const list = host.querySelector('section[aria-label="게이트"]');
  assert.match(list.textContent, /입력 · 켜짐 · 프리셋 1개 · 단계 1개/);
  assert.doesNotMatch(list.textContent, /켜짐:/);
  assert.equal(list.querySelector('button[aria-pressed="true"]').textContent, 'Guard');
  assert.equal(list.contains(input(host, '이름')), false);
  assert.ok(host.querySelector('section[aria-label="기본"]').contains(input(host, '연결 프리셋')));
  assert.equal(input(host, '모델').className, input(host, '종류').className);
});
