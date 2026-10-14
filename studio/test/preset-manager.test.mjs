import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { OptimizationPrototype } from '../src/optimization-prototype.tsx';

test('preset creation keeps tab drafts together and list applies/deletes owned presets', async () => {
  const dom = new JSDOM('<div id="root"></div>');
  globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const { createRoot } = await import('react-dom/client');
  const { Simulate } = await import('react-dom/test-utils');
  const root = createRoot(document.getElementById('root'));
  let saved, applied, removed;
  let rows = [];
  const api = { list: async () => rows, save: async payload => { saved = { ...JSON.parse(payload), id: 'studio-user-test', status: 'draft' }; rows = [saved]; return saved; }, apply: async id => { applied = id; return saved; }, delete: async id => { removed = id; rows = []; } };
  const click = async text => act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === text).click());
  try {
    await act(async () => root.render(React.createElement(OptimizationPrototype, { locale: 'en', presetActions: api, catalog: { presets: [{ id: 'minimal', tools: [], sections: [], promptProviders: [] }], tools: [] } })));
    assert.deepEqual([...document.querySelectorAll('nav button')].map(b => b.textContent), ['Preset list', 'Create preset', 'Tool providers']);
    assert.deepEqual([...document.querySelectorAll('[role=tab]')].map(b => b.textContent), ['Prompts & tools', 'Execution settings', 'Subagent settings']);
    await click('Create preset');
    const name = [...document.querySelectorAll('label')].find(e => e.textContent === 'Preset name').querySelector('input');
    await act(async () => Simulate.change(name, { target: { value: 'My preset' } }));
    const prompt = [...document.querySelectorAll('textarea')].find(e => e.value.includes('Report evidence'));
    await act(async () => Simulate.change(prompt, { target: { value: 'My instructions' } }));
    await click('Execution settings'); await click('Subagent settings'); await click('Prompts & tools');
    assert.equal(prompt.value, 'My instructions');
    await click('Save preset');
    assert.equal(saved.request.prompt, 'My instructions');
    assert.ok(saved.conveniences); assert.equal(saved.agents.length, 2);
    assert.match(document.querySelector('.studio-tool-cards').textContent, /My preset/);
    await click('Apply to DSH'); assert.equal(applied, saved.id);
    await click('Delete'); assert.ok(document.querySelector('dialog[open]'));
    await click('Confirm delete'); assert.equal(removed, saved.id); assert.equal(rows.length, 0);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});

test('the subagent tab hides selected tools from subagents and round-trips through save', async () => {
  const dom = new JSDOM('<div id="root"></div>');
  globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  const preset = { id: 'studio-user-a', name: 'A', description: '', status: 'draft', agents: [], conveniences: {},
    request: { preset: 'studio-master', providers: [], tools: ['read', 'ask_user_question', 'subagent_role'], prompt: '', model: 'testLLM', subagentToolFilter: { deny: ['present'] } } };
  let saved;
  const api = { list: async () => [preset], save: async payload => { saved = JSON.parse(payload); return { ...saved, status: 'draft' }; }, apply: async () => preset, delete: async () => {} };
  const tool = name => ({ name, description: name, parameters: { type: 'object', properties: {} } });
  const catalog = { presets: [{ id: 'studio-master', tools: [], sections: [], promptProviders: [] }], tools: ['read', 'ask_user_question', 'present', 'subagent_role'].map(tool) };
  const click = async text => act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === text).click());
  try {
    await act(async () => root.render(React.createElement(OptimizationPrototype, { locale: 'en', presetActions: api, catalog })));
    await click('Edit');
    await click('Subagent settings');
    const list = document.querySelector('ul[aria-label="Tools hidden from subagents"]');
    assert.ok(list);
    // Only tools the preset selects are offered; subagent_role is never hidden; a stale hidden tool is shown so it can be cleared.
    assert.deepEqual([...list.querySelectorAll('button[role=switch]')].map(b => b.getAttribute('aria-label')), ['read', 'ask_user_question', 'present']);
    assert.match(list.textContent, /Not selected in this preset/);
    await act(async () => list.querySelector('button[aria-label="present"]').click());
    await act(async () => list.querySelector('button[aria-label="ask_user_question"]').click());
    await click('Save preset');
    assert.deepEqual(saved.request.subagentToolFilter, { deny: ['ask_user_question'] });
    assert.deepEqual(saved.request.tools, ['read', 'ask_user_question', 'subagent_role']);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});
