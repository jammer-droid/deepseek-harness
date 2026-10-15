import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { JSDOM } from 'jsdom';
import { GateTrialPanel } from '../src/pixie-gate-trial-panel.tsx';
import { GateEditor } from '../src/pixie-gate-editor.tsx';
const dom = new JSDOM('<!doctype html><body></body>');
globalThis.window = dom.window; globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const definition = () => ({ id: 'g', name: 'Saved name', enabled: true, point: 'input', match: {}, stages: [{ id: 'check', kind: 'command', role: 'check', command: { command: 'echo ok' } }], onError: 'pass', confirmRevision: false, forward: { kind: 'original' }, limits: { stageTimeoutMs: 1000, maxSteersPerTurn: 1 } });
const response = () => ({ result: { verdict: 'pass', original: 'sample', subject: 'trial output', notes: [], records: [], hooks: {}, stages: { check: { verdict: 'pass', data: { skipped: true } } }, forward: { kind: 'original', text: 'sample' } }, skipped: ['check'], durations: { check: 2 } });
const button = (h, text) => [...h.querySelectorAll('button')].find(b => b.textContent === text);
const input = (h, text) => h.querySelector(`[aria-label="${text}"]`);
const click = async el => { assert.ok(el); await act(async () => el.click()); };
const change = async (el, value) => { assert.ok(el); await act(async () => { el.value = value; Simulate.change(el); }); };
async function setup(t, props = {}, editor = false) {
  const calls = []; const trial = request => { calls.push(request); return { result: Promise.resolve(response()), cancel() {} }; };
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const base = editor ? { actions: { read: async () => [{ definition: definition(), presetIds: [] }], save: async () => {}, presets: async () => [], models: async () => ({ groups: [] }), trial } } : { definition: definition(), trial };
  await act(async () => root.render(React.createElement(editor ? GateEditor : GateTrialPanel, { ...base, locale: 'en', ...props })));
  t.after(async () => { await act(async () => root.unmount()); host.remove(); });
  return { host, calls, root };
}
test('editor trial submits unsaved draft and displays result and skipped stage', async t => {
  const { host, calls } = await setup(t, {}, true);
  await change(input(host, 'Name'), 'Unsaved draft');
  assert.equal(button(host, 'Run trial').disabled, true);
  await change(input(host, 'Sample input (required)'), 'sample');
  await change(input(host, 'Hook context (optional)'), 'hook sample');
  await click(button(host, 'Run trial'));
  assert.equal(calls[0].definition.name, 'Unsaved draft');
  assert.equal(calls[0].text, 'sample'); assert.equal(calls[0].hooksContext, 'hook sample');
  assert.equal(calls[0].executeCommands, false); assert.equal(calls[0].sessionId, undefined);
  assert.match(host.textContent, /trial output/); assert.match(host.querySelector('[data-gate-stage=check]').textContent, /Skipped/);
});
test('settings trial disables commands without session policy context', async t => {
  const { host } = await setup(t);
  assert.equal(input(host, 'Execute commands').matches(':disabled'), true);
  assert.match(host.textContent, /session policy is unavailable in settings/);
});
test('explicit session enables opt-in commands and tool sample payload', async t => {
  const { host, calls } = await setup(t, { sessionId: 'session-1', definition: { ...definition(), point: 'tool-before' } });
  assert.equal(input(host, 'Execute commands').getAttribute('aria-checked'), 'false');
  assert.equal(input(host, 'Execute commands').matches(':disabled'), false);
  await change(input(host, 'Sample input (required)'), 'arguments');
  assert.equal(button(host, 'Run trial').disabled, true);
  await change(input(host, 'Tool name'), 'bash');
  await click(input(host, 'Execute commands'));
  await click(button(host, 'Run trial'));
  assert.equal(calls[0].executeCommands, true); assert.equal(calls[0].sessionId, 'session-1'); assert.equal(calls[0].toolName, 'bash');
});
test('cancel calls handle and discards a late result', async t => {
  let resolve, cancelled = 0;
  const { host } = await setup(t, { trial: () => ({ result: new Promise(r => { resolve = r; }), cancel() { cancelled++; } }) });
  await change(input(host, 'Sample input (required)'), 'sample'); await click(button(host, 'Run trial'));
  await click(button(host, 'Cancel trial')); assert.equal(cancelled, 1);
  await act(async () => resolve(response()));
  assert.match(host.textContent, /Trial cancelled/); assert.doesNotMatch(host.textContent, /trial output/);
  assert.equal(button(host, 'Run trial').disabled, false);
});
test('trial rejection is a Notice and permits retry', async t => {
  const { host } = await setup(t, { trial: () => ({ result: Promise.reject(new Error('provider unavailable')), cancel() {} }) });
  await change(input(host, 'Sample input (required)'), 'sample'); await click(button(host, 'Run trial'));
  assert.match(host.querySelector('[role=alert]').textContent, /Trial failed: provider unavailable/);
  assert.equal(button(host, 'Run trial').disabled, false);
});
test('unmount cancels pending preview', async t => {
  let cancelled = 0;
  const { host, root } = await setup(t, { trial: () => ({ result: new Promise(() => {}), cancel() { cancelled++; } }) });
  await change(input(host, 'Sample input (required)'), 'sample'); await click(button(host, 'Run trial'));
  await act(async () => root.render(null)); assert.equal(cancelled, 1);
});

test('disabled gate trial shows warning above results and inline command explanation', async t => {
  const { host } = await setup(t, { definition: { ...definition(), enabled: false } });
  const toggle = input(host, 'Execute commands');
  const row = toggle.closest('.studio-settings-row');
  assert.match(row.textContent, /session policy is unavailable/);
  assert.equal(toggle.closest('fieldset'), null);
  assert.ok(toggle.closest('.studio-settings-row-control'));
  await change(input(host, 'Sample input (required)'), 'sample');
  await click(button(host, 'Run trial'));
  assert.match(host.querySelector('[role=alert]').textContent, /This gate is off/);
  assert.ok(host.querySelector('[data-gate-stage=check]'));
});
