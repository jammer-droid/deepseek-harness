import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { JSDOM } from 'jsdom';
import { GateComposer, stageVariables } from '../src/pixie-gate-composer.tsx';
import { makeTemplateGate } from '../src/pixie-gate-editor.tsx';
import { validateGateDefinition } from '../src/pixie-gate-contracts.ts';
import { PixieSettingsPage } from '../src/pixie-settings.tsx';
const dom = new JSDOM('<!doctype html><body></body>');
globalThis.window = dom.window; globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const seed = () => ({ definition: { id: 'gate1', name: 'Guard', enabled: true, point: 'input', match: { agents: 'root', sources: ['user'] }, stages: [{ id: 'first', kind: 'converse', role: 'revise', prompt: '{{subject}}' }], forward: { kind: 'replace', from: 'subject' }, onError: 'pass', confirmRevision: false, limits: { stageTimeoutMs: 1000, maxSteersPerTurn: 1 } }, presetIds: ['p'] });
const button = (h, name) => [...h.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent) === name);
const input = (h, label) => h.querySelector(`[aria-label="${label}"]`);
const node = (h, id) => h.querySelector(`[data-gate-node="${id}"]`);
const radio = (h, group, name) => [...input(h, group).querySelectorAll('[role=radio]')].find(b => b.textContent === name || b.querySelector('.studio-pick-title')?.textContent === name);
const click = async el => { assert.ok(el); await act(async () => el.click()); };
const change = async (el, value) => { assert.ok(el); await act(async () => { el.value = value; Simulate.change(el); }); };
const trial = () => ({ result: Promise.resolve({ result: { verdict: 'pass', original: 'a', subject: 'a', notes: [], stages: {}, records: [], hooks: {}, forward: { kind: 'original', text: 'a' } }, durations: {}, skipped: [] }), cancel() {} });
async function mount(t, element) {
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(element));
  t.after(async () => { await act(async () => root.unmount()); host.remove(); });
  return { host, root };
}
async function composer(t, entry = seed(), { onSave, locale = 'en' } = {}) {
  const saves = []; let closed = 0;
  const { host } = await mount(t, React.createElement(GateComposer, { entry, open: true, models: { groups: [] }, trial, locale, onClose: () => { closed++; },
    onSave: onSave ?? (async next => { saves.push(structuredClone(next)); return true; }) }));
  return { host, saves, closed: () => closed };
}
async function settings(t, overrides = {}, locale = 'en') {
  const saves = [];
  const gateActions = { read: async () => [seed()], presets: async () => [{ id: 'p', name: 'Preset' }, { id: 'q', name: 'Second' }], models: async () => ({ groups: [] }), save: async entries => { saves.push(structuredClone(entries)); }, trial, ...overrides };
  const { host } = await mount(t, React.createElement(PixieSettingsPage, { locale, gateActions, actions: { read: async () => ({ contextMode: 'fresh', systemPrompt: '', allowThreadModel: false }), models: gateActions.models, save: async s => s } }));
  return { host, saves };
}
const page = (h, label) => h.querySelector(`section[aria-label="${label}"]`);

test('Pixie settings put gates in their own navigation group with composition and scope pages', async t => {
  const { host } = await settings(t, {}, 'ko');
  const nav = [...host.querySelectorAll('nav.studio-nav > *')].map(el => el.textContent);
  assert.deepEqual(nav.slice(-3), ['게이트', '게이트 구성', '적용 범위']);
  assert.ok(nav.indexOf('판정') < nav.indexOf('게이트'));
  await click(button(host, '게이트 구성'));
  assert.equal(page(host, '게이트 구성').hidden, false);
  assert.ok(page(host, '게이트 구성').querySelector('[data-gate-card="gate1"]'));
});

test('composition cards summarize the flow and open the composer modal for editing', async t => {
  const { host, saves } = await settings(t);
  const comp = page(host, 'Gate composition');
  const card = comp.querySelector('[data-gate-card="gate1"]');
  assert.match(card.textContent, /Guard/); assert.match(card.textContent, /Input/); assert.match(card.textContent, /On/);
  assert.match(card.querySelector('.studio-gate-strip').textContent, /Model · Revise/);
  assert.match(card.textContent, /1 presets/);
  await click(button(card, 'Edit'));
  const dialog = comp.querySelector('dialog');
  assert.ok(dialog.querySelector('[data-gate-node="point"]'));
  await change(input(dialog, 'Name'), 'Renamed');
  await click(button(dialog, 'Save'));
  assert.equal(saves[0][0].definition.name, 'Renamed');
  assert.deepEqual(saves[0][0].presetIds, ['p']);
  assert.equal(button(dialog, 'Saved').disabled, true);
});

test('new gate, starter template, duplicate and delete persist through the cards', async t => {
  const { host, saves } = await settings(t);
  const comp = page(host, 'Gate composition');
  await click(button(comp, 'Start from example'));
  await click(button(comp.querySelector('dialog'), 'Save'));
  assert.equal(saves[0].length, 2);
  assert.deepEqual(saves[0][1].definition.stages.map(s => s.kind), ['command', 'judge', 'converse']);
  assert.equal(saves[0][1].definition.enabled, false);
  await click(button(comp.querySelector('dialog'), 'Close'));
  await click(button(comp.querySelector('[data-gate-card="gate1"]'), 'Duplicate'));
  assert.equal(saves[1].length, 3); assert.equal(saves[1][2].definition.enabled, false); assert.match(saves[1][2].definition.name, /Guard \(Duplicate\)/);
  await click(button(comp.querySelector('[data-gate-card="gate1"]'), 'Delete'));
  await click(button(comp, 'Confirm delete'));
  assert.deepEqual(saves[2].map(e => e.definition.id).includes('gate1'), false);
});

test('starter template is valid and wires measured size into the judge and plan', () => {
  for (const locale of ['ko', 'en', 'zh']) {
    const entry = makeTemplateGate(locale);
    const g = validateGateDefinition(entry.definition);
    assert.deepEqual(g.forward, { kind: 'append', from: ['plan'] });
    assert.match(g.stages[1].questions.fits.question, /\{\{stages\.measure\.text\}\}/);
    assert.match(g.stages[2].prompt, /\{\{stages\.measure\.text\}\}/);
  }
});

test('flow shows every step with what goes in and comes out; revise changes carried text', async t => {
  const entry = seed(); entry.definition.stages.push({ id: 'after', kind: 'command', role: 'check', command: { command: 'true' } });
  const { host } = await composer(t, entry);
  const nodes = [...host.querySelectorAll('[data-gate-node]')].map(n => n.dataset.gateNode);
  assert.deepEqual(nodes, ['point', 'start', 'stage-0', 'stage-1', 'end', 'result', 'trial']);
  assert.match(node(host, 'point').textContent, /Message text/);
  assert.match(node(host, 'stage-0').textContent, /In: Original → Out: Revises the current text/);
  assert.match(node(host, 'stage-1').textContent, /In: Revised by first/);
  assert.match(node(host, 'result').textContent, /Replace with Final current text/);
  await click(node(host, 'stage-1'));
  const panel = host.querySelector('.studio-gate-panel');
  assert.match(panel.querySelector('.studio-gate-io').textContent, /Revised by first.*stdin.*Pass continues/s);
  assert.match(panel.textContent, /exit 2 fails/);
});

test('steps are added between nodes up to five and removed with at least one left', async t => {
  const { host } = await composer(t);
  await click(button(host, 'Add stage 2'));
  assert.equal(host.querySelector('[data-gate-node="stage-1"][aria-current=step]') !== null, true);
  for (let i = 0; i < 3; i++) await click(button(host, `Add stage ${i + 3}`));
  assert.equal(host.querySelectorAll('[data-gate-node^="stage-"]').length, 5);
  assert.equal(host.querySelector('.studio-gate-add'), null);
  await click(node(host, 'stage-0')); await click(button(host, 'Move down'));
  assert.equal(input(host, 'Stage ID').value, 'first');
  assert.equal(node(host, 'stage-1').getAttribute('aria-current'), 'step');
});

test('point is chosen from explained options; restricted points hide revise and replace', async t => {
  const { host, saves } = await composer(t);
  assert.match(input(host, 'Intervention point').textContent, /before the tool runs/);
  await click(radio(host, 'Intervention point', 'Before tool'));
  assert.match(host.querySelector('[role=status].studio-notice-info').textContent, /unsupported revise/);
  await click(node(host, 'stage-0'));
  assert.equal(radio(host, 'Role', 'Revise'), undefined);
  await click(node(host, 'result'));
  assert.equal(input(host, 'Forward to the model'), null);
  assert.match(host.querySelector('.studio-gate-panel').textContent, /Denies the tool call/);
  await click(button(host, 'Save'));
  assert.equal(saves[0].definition.point, 'tool-before'); assert.equal(saves[0].definition.forward.kind, 'original');
});

test('start hook is a separate node and exposes its output variables to stages', async t => {
  const { host, saves } = await composer(t);
  assert.match(node(host, 'start').textContent, /Not used/);
  await click(node(host, 'start'));
  assert.match(host.querySelector('.studio-gate-io').textContent, /exit 2 fails the gate/);
  await click(button(host, 'Add hook'));
  await change(input(host, 'Start hook command'), 'echo hi');
  await click(node(host, 'stage-0'));
  assert.match(input(host, 'Available variables').textContent, /\{\{stages\.start\.data\}\}/);
  await click(button(host, 'Save'));
  assert.equal(saves[0].definition.hooks.start.command, 'echo hi');
  assert.deepEqual(stageVariables(saves[0].definition, 0).slice(-3), ['{{stages.start.text}}', '{{stages.start.reason}}', '{{stages.start.data}}']);
});

test('validation opens the failing step and shows the error beside its field', async t => {
  const { host, saves } = await composer(t);
  await click(node(host, 'stage-0'));
  await change(input(host, 'Prompt'), '{{stages.later.text}}');
  await click(node(host, 'point'));
  await click(button(host, 'Save'));
  assert.equal(saves.length, 0);
  assert.equal(node(host, 'stage-0').getAttribute('aria-current'), 'step');
  assert.match(node(host, 'stage-0').textContent, /Needs attention/);
  assert.match(input(host, 'Prompt').parentElement.textContent, /preceding stage IDs/);
  await change(input(host, 'Prompt'), '{{subject}}');
  await click(node(host, 'result')); await click(radio(host, 'Forward to the model', 'Original + appended results'));
  await click(button(host, 'Save'));
  assert.match(host.querySelector('.studio-gate-panel').textContent, /Select forwarding sources/);
});

test('save failure keeps the draft with a dismissible notice; unsaved close asks first', async t => {
  let fail = true;
  const { host, closed } = await composer(t, seed(), { onSave: async () => { if (fail) throw new Error('disk failure'); return true; } });
  await change(input(host, 'Name'), 'Edited'); await click(button(host, 'Save'));
  assert.match(host.querySelector('[role=alert]').textContent, /Could not save.*disk failure/);
  assert.equal(input(host, 'Name').value, 'Edited');
  await click(button(host.querySelector('[role=alert]'), 'Close'));
  assert.equal(host.querySelector('[role=alert]'), null);
  await click(button(host.querySelector('footer'), 'Close'));
  assert.equal(closed(), 0); assert.match(host.textContent, /unsaved changes/);
  await click(button(host, 'Discard and close')); assert.equal(closed(), 1);
  fail = false;
});

test('scope page edits enabled, presets, agents, sources and tools, and blocks binding conflicts', async t => {
  const second = seed(); second.definition.id = 'gate2'; second.definition.name = 'Tools'; second.definition.point = 'tool-after'; second.definition.enabled = false; second.definition.match = { agents: 'root' }; second.definition.forward = { kind: 'original' }; second.definition.stages[0].role = 'check'; second.presetIds = [];
  const third = seed(); third.definition.id = 'gate3'; third.definition.name = 'Other'; third.definition.enabled = false;
  const { host, saves } = await settings(t, { read: async () => [seed(), second, third] });
  const scope = page(host, 'Scope');
  assert.equal(button(scope, 'Saved').disabled, true);
  assert.equal(input(scope, 'Input sources Tools'), null);
  await change(input(scope, 'Tool names Tools'), 'bash, read');
  await change(input(scope, 'Target agents Tools'), 'child');
  await click(input(scope, 'Enabled Tools'));
  await click(input(scope, 'Connected presets Tools').querySelectorAll('input')[1]);
  await click(input(scope, 'Input sources Guard').querySelectorAll('input')[1]);
  await click(button(scope, 'Save'));
  const saved = saves[0];
  assert.deepEqual(saved[1].definition.match, { agents: 'child', tools: ['bash', 'read'] });
  assert.equal(saved[1].definition.enabled, true); assert.deepEqual(saved[1].presetIds, ['q']);
  assert.deepEqual(saved[0].definition.match.sources, ['user', 'agent-message']);
  await click(input(scope, 'Enabled Other'));
  assert.match(scope.textContent, /Only one enabled gate per preset/);
  assert.equal(button(scope, 'Save').disabled, true);
});

test('scope edits survive saving a flow in the composer, and scope fields are not composer fields', async t => {
  const { host, saves } = await settings(t);
  const scope = page(host, 'Scope');
  await click(input(scope, 'Enabled Guard'));
  const comp = page(host, 'Gate composition');
  await click(button(comp.querySelector('[data-gate-card="gate1"]'), 'Edit'));
  const dialog = comp.querySelector('dialog');
  assert.equal(input(dialog, 'Connected presets'), null); assert.equal(input(dialog, 'Target agents'), null);
  await change(input(dialog, 'Name'), 'Flow saved'); await click(button(dialog, 'Save'));
  assert.equal(saves[0][0].definition.enabled, true);
  assert.equal(input(scope, 'Enabled Flow saved').getAttribute('aria-checked'), 'false');
  await click(button(scope, 'Save'));
  assert.equal(saves[1][0].definition.enabled, false); assert.equal(saves[1][0].definition.name, 'Flow saved');
});

test('invalid definitions show diagnostics and raw JSON, confirm overwrite, and remove on next save', async t => {
  const invalid = [{ index: 2, raw: { broken: true }, error: { code: 'options', message: 'Empty option' } }];
  const { host, saves } = await settings(t, { read: async () => ({ entries: [seed()], invalid }) });
  const scope = page(host, 'Scope');
  assert.match(scope.textContent, /1 gates could not be loaded/);
  assert.match(scope.textContent, /"broken": true/);
  await click(input(scope, 'Enabled Guard'));
  await click(button(scope, 'Save'));
  assert.equal(saves.length, 0); assert.match(scope.textContent, /permanently remove/);
  await click(button(scope, 'Cancel'));
  await click(button(scope, 'Remove from list'));
  assert.doesNotMatch(scope.textContent, /1 gates could not be loaded/);
  await click(button(scope, 'Save'));
  assert.equal(saves.length, 1);
});

test('broken file requires confirmation before a composer save replaces it', async t => {
  const { host, saves } = await settings(t, { read: async () => ({ entries: [seed()], invalid: [], error: { code: 'invalid-json', message: 'Malformed JSON' } }) });
  const comp = page(host, 'Gate composition');
  assert.match(comp.textContent, /original file was not changed/);
  await click(button(comp.querySelector('[data-gate-card="gate1"]'), 'Edit'));
  await change(input(comp.querySelector('dialog'), 'Name'), 'Changed');
  await click(button(comp.querySelector('dialog'), 'Save'));
  assert.equal(saves.length, 0);
  await click(button(comp, 'Overwrite and save'));
  assert.equal(saves.length, 1); assert.equal(saves[0][0].definition.name, 'Changed');
});

for (const [locale, label] of [['ko', '불러오지 못한 게이트 1개'], ['zh', '无法加载 1 个门控']]) test(`gate pages are localized: ${locale}`, async t => {
  const { host } = await settings(t, { read: async () => ({ entries: [seed()], invalid: [{ index: 0, raw: null, error: { code: 'options', message: 'Empty option' } }] }) }, locale);
  assert.ok(host.textContent.includes(label));
  await click(button(page(host, locale === 'ko' ? '게이트 구성' : '门控构成').querySelector('[data-gate-card="gate1"]'), locale === 'ko' ? '편집' : '编辑'));
  assert.doesNotMatch(host.querySelector('.studio-gate-flow').textContent, /Message text|Input|Original/);
});
