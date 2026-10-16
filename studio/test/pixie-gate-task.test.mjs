import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { JSDOM } from 'jsdom';
import { PixieSettingsPage } from '../src/pixie-settings.tsx';
import { GATE_TEMPLATES, makeTask, taskProblem, taskVariables } from '../src/pixie-gate-task.ts';
const dom = new JSDOM('<!doctype html><body></body>');
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const button = (h, name) => [...h.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent) === name);
const pick = (h, title) => [...h.querySelectorAll('button.studio-pick')].find(b => b.querySelector('.studio-pick-title').textContent.startsWith(title));
const input = (h, label) => h.querySelector(`[aria-label="${label}"]`);
const click = async el => { assert.ok(el); await act(async () => el.click()); };
const change = async (el, value) => { assert.ok(el); await act(async () => { el.value = value; Simulate.change(el); }); };
async function settings(t, locale = 'en') {
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const gateActions = { read: async () => [], presets: async () => [{ id: 'p', name: 'Preset' }], models: async () => ({ groups: [] }), save: async () => {}, trial: () => ({ result: new Promise(() => {}), cancel() {} }) };
  await act(async () => root.render(React.createElement(PixieSettingsPage, { locale, gateActions, actions: { read: async () => ({ contextMode: 'fresh', systemPrompt: '', allowThreadModel: false }), models: gateActions.models, save: async s => s } })));
  t.after(async () => { await act(async () => root.unmount()); host.remove(); });
  return host;
}
const page = (h, label) => h.querySelector(`section[aria-label="${label}"]`);

test('gate group holds composition and scope pages after Judge, each marked as a preview', async t => {
  const host = await settings(t, 'ko');
  const nav = [...host.querySelectorAll('nav.studio-nav > *')].map(el => el.textContent);
  assert.deepEqual(nav.slice(-3), ['게이트', '게이트 구성', '적용 범위']);
  assert.ok(nav.indexOf('판정') < nav.indexOf('게이트'));
  assert.match(page(host, '게이트 구성').textContent, /화면 시안입니다/);
});

test('new gate starts from templates; background tasks are listed but not selectable', async t => {
  const host = await settings(t);
  const comp = page(host, 'Gate composition');
  await click(button(comp, 'New gate'));
  const picker = comp.querySelector('dialog');
  assert.match(picker.textContent, /Instruction format check/);
  assert.equal(pick(picker, 'Pre-compaction'), undefined);
  assert.match(picker.querySelector('[aria-disabled=true]').textContent, /Coming soon/);
  await click(pick(picker, 'Translate the final answer'));
  const editor = [...comp.querySelectorAll('dialog')].find(d => input(d, 'What Pixie does'));
  assert.equal(input(editor, 'When').value, 'turn-end');
  assert.match(input(editor, 'What Pixie does').value, /translate it into Korean/);
  assert.equal(input(editor, 'Confirm before replacing'), null);
  await click(button(editor, 'Apply'));
  const card = comp.querySelector('[data-gate-task]');
  assert.match(card.querySelector('.studio-gate-sentence').textContent, /When the agent finishes its answer→If the answer is in English/);
});

test('editor shows two fields up front; script, judge and limits live under Advanced', async t => {
  const host = await settings(t);
  const comp = page(host, 'Gate composition');
  await click(button(comp, 'New gate'));
  await click(pick(comp.querySelector('dialog'), 'Subtitle translation prep'));
  const editor = [...comp.querySelectorAll('dialog')].find(d => input(d, 'What Pixie does'));
  const advanced = editor.querySelector('details.studio-disclosure');
  assert.ok(advanced.contains(input(editor, 'Pixie hook script')));
  assert.equal(input(editor, 'Pixie hook script').value, 'measure-subtitle.sh');
  assert.match(editor.querySelector('.studio-gate-vars').textContent, /\{\{hooks\.measure-subtitle\.text\}\}/);
  assert.match(advanced.textContent, /<profile>\/studio-data\/pixie-gate\/commands\//);
  assert.ok(advanced.contains(input(editor, 'Decide the verdict with the judge model')));
  assert.ok(input(editor, 'Confirm before replacing'));
  await change(input(editor, 'What Pixie does'), '');
  await click(button(editor, 'Apply'));
  assert.match(editor.textContent, /Describe what Pixie should do/);
  assert.equal(comp.querySelector('[data-gate-task]'), null);
});

test('trial shows the fixed five-field result shape without calling a model', async t => {
  const host = await settings(t);
  const comp = page(host, 'Gate composition');
  await click(button(comp, 'New gate'));
  await click(pick(comp.querySelector('dialog'), 'Instruction format check'));
  const editor = [...comp.querySelectorAll('dialog')].find(d => input(d, 'What Pixie does'));
  await change(input(editor, 'Sample your instruction'), 'fix login');
  await click(button(editor, 'Run'));
  const result = editor.querySelector('dl.studio-gate-result');
  assert.deepEqual([...result.querySelectorAll('dt')].map(d => d.textContent), ['Verdict', 'Reason', 'Replacement', 'Addition', 'Note']);
});

test('scope toggles gates and presets; cards duplicate disabled and delete', async t => {
  const host = await settings(t);
  const comp = page(host, 'Gate composition');
  await click(button(comp, 'New gate'));
  await click(pick(comp.querySelector('dialog'), 'Blank gate'));
  const editor = [...comp.querySelectorAll('dialog')].find(d => input(d, 'What Pixie does'));
  await change(input(editor, 'What Pixie does'), 'Check it');
  await click(button(editor, 'Apply'));
  const scope = page(host, 'Scope');
  await click(input(scope, 'Enabled New gate'));
  const card = scope.querySelector('[data-gate-scope]'); const height = card.innerHTML.length;
  await click(button(card, 'Choose presets'));
  await click(input(scope, 'Presets New gate').querySelector('input'));
  await click(button(scope, 'Done'));
  assert.match(card.textContent, /1 presets/); assert.equal(card.querySelectorAll('input[type=checkbox]').length, 0);
  assert.match(comp.querySelector('[data-gate-task]').textContent, /On.*1 presets/s);
  await click(button(comp.querySelector('[data-gate-task]'), 'Duplicate'));
  const cards = comp.querySelectorAll('[data-gate-task]');
  assert.equal(cards.length, 2); assert.match(cards[1].textContent, /Off/);
  await click(button(cards[1], 'Delete'));
  assert.equal(comp.querySelectorAll('[data-gate-task]').length, 1);
});

test('hook script points to the guide instead of inlining its contract', async t => {
  const host = await settings(t);
  const comp = page(host, 'Gate composition');
  await click(button(comp, 'New gate'));
  await click(pick(comp.querySelector('dialog'), 'Digest search results'));
  const editor = [...comp.querySelectorAll('dialog')].find(d => input(d, 'What Pixie does'));
  assert.equal(input(editor, 'Tools'), null);
  assert.equal(input(editor, 'Pixie hook script').value, 'only-search-tools.sh');
  const link = [...editor.querySelectorAll('a')].find(a => a.textContent === 'Script guide');
  assert.match(link.getAttribute('href'), /docs\/guides\/pixie-gate\.md$/);
  assert.doesNotMatch(editor.textContent, /PIXIE_TOOL_NAME|exit code/i);
});

test('task model: templates, variables and problems', () => {
  assert.equal(GATE_TEMPLATES.filter(item => !item.available).length, 2);
  const task = makeTask('x'); task.instruction = 'do';
  assert.deepEqual(taskVariables(task), []);
  task.advanced.script = 'list-changed-files.sh';
  assert.deepEqual(taskVariables(task), ['{{hooks.list-changed-files.text}}', '{{hooks.list-changed-files.data}}']);
  task.advanced.judge = { question: '', threshold: 0.5 }; assert.equal(taskProblem(task), 'judge');
  task.advanced.judge.question = 'ok?'; task.advanced.judge.threshold = 2; assert.equal(taskProblem(task), 'judge');
  task.advanced.judge.threshold = 0.7; assert.equal(taskProblem(task), undefined);
});

for (const locale of ['ko', 'zh']) test(`preview is localized: ${locale}`, async t => {
  const host = await settings(t, locale);
  const comp = page(host, locale === 'ko' ? '게이트 구성' : '门控构成');
  await click(button(comp, locale === 'ko' ? '새 게이트' : '新建门控'));
  assert.doesNotMatch(comp.querySelector('dialog').textContent, /Instruction|Coming soon|Blank gate/);
});
