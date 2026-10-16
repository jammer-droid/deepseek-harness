import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { JSDOM } from 'jsdom';
import { GateComposer, stageVariables } from '../src/pixie-gate-composer.tsx';
import { makeTemplateGate } from '../src/pixie-gate-editor.tsx';
import { validateGateDefinition } from '../src/pixie-gate-contracts.ts';
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
