import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { missingFeatures } from '../src/host/preset-store.ts';
import { masterComposition } from '../src/host/master-composition.ts';
import { dump } from 'js-yaml';

async function mount(element) {
  const dom = new JSDOM('<div id="root"></div>');
  globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(element));
  return { root, dom, rerender: next => act(async () => root.render(next)), close: async () => { await act(async () => root.unmount()); dom.window.close(); } };
}
const entries = [
  { id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs' },
  { id: 'delegation/studio-master-roles', name: '@matamt-dbg/dsh-studio/roles' },
  { id: 'time-context', name: '@deepseek-ai/dsh-time-context' },
  { id: 'compaction/compaction-basic', name: '@deepseek-ai/dsh-compaction-basic', config: {} },
  { id: 'compaction/command-compact', name: '@deepseek-ai/dsh-command-compact' },
];

test('plugin switches cover every Master entry except delegation, with defaults/override/excluded and dependencies', async () => {
  const { FeatureInclusion } = await import('../src/feature-inclusion.tsx');
  let state = { overrides: { 'compaction/compaction-basic': { auto: false } }, excluded: [] };
  const render = () => React.createElement(FeatureInclusion, { locale: 'en', entries, overrides: state.overrides, excluded: state.excluded, onChange: next => { state = next; } });
  const view = await mount(render());
  try {
    const rows = () => [...document.querySelectorAll('.studio-settings-row')].map(row => row.textContent);
    assert.equal(rows().length, 4, 'tool providers are listed too; delegation plugins are not');
    assert.match(rows()[0], /@deepseek-ai\/dsh-tool-fs.*Defaults/);
    assert.match(rows()[1], /Current time notice.*Defaults/);
    assert.match(rows()[2], /Automatic compaction.*Override.*Automatic compaction off \(auto: false\)/);
    // auto:false is not exclusion: /compact stays included.
    assert.match(rows()[3], /Manual compaction.*Defaults/);
    const toggle = label => document.querySelector(`button[role=switch][aria-label="${label}"]`);
    await act(async () => toggle('Automatic compaction').click());
    assert.deepEqual(state, { overrides: {}, excluded: ['compaction/compaction-basic'] }, 'exclusion drops the override');
    await view.rerender(render());
    assert.match(rows()[3], /Excluded with dependency · Requires: Automatic compaction/);
    assert.equal(toggle('Manual compaction (/compact)').disabled, true);
    await act(async () => toggle('Automatic compaction').click());
    assert.deepEqual(state, { overrides: {}, excluded: [] }, 'turning it back on returns to defaults');
  } finally { await view.close(); }
});

test('missing features are detected only for applied snapshots that lack a non-excluded feature', () => {
  const full = dump(masterComposition());
  const legacy = dump(masterComposition().filter(row => !['agent-instructions', 'time-context', 'compaction', 'skill-filesystem'].includes(row.id)));
  const request = { preset: 'studio-master', providers: ['@deepseek-ai/dsh-persona'], tools: [], prompt: '', model: 'x' };
  assert.deepEqual(missingFeatures({ request, applied: { name: 'a', description: '', plugins: full } }), []);
  assert.deepEqual(missingFeatures({ request, applied: { name: 'a', description: '', plugins: legacy } }).sort(),
    ['@deepseek-ai/dsh-agent-instructions', '@deepseek-ai/dsh-command-compact', '@deepseek-ai/dsh-compaction-basic', '@deepseek-ai/dsh-compaction-tool-result-pruner', '@deepseek-ai/dsh-skill-filesystem', '@deepseek-ai/dsh-time-context']);
  // An explicit exclusion is intent, not a gap; its dependant follows.
  assert.deepEqual(missingFeatures({ request: { ...request, configExclusions: ['compaction/compaction-basic', 'time-context', 'agent-instructions', 'skill-filesystem', 'compaction/tool-result-pruner'] }, applied: { name: 'a', description: '', plugins: legacy } }), []);
  assert.deepEqual(missingFeatures({ request }), [], 'drafts have nothing applied to compare');
});

test('preset list offers restore for missing features and reapplies only after confirmation', async () => {
  const { PresetList } = await import('../src/preset-manager.tsx');
  const preset = { id: 'studio-user-a', name: 'Creator', description: '', status: 'applied', agents: [], conveniences: {}, missingFeatures: ['@deepseek-ai/dsh-compaction-basic'],
    request: { preset: 'studio-master', providers: [], tools: [], prompt: '', model: 'x' } };
  const applied = [];
  const api = { list: async () => [preset], save: async () => preset, apply: async id => { applied.push(id); return preset; }, delete: async () => {} };
  const view = await mount(React.createElement(PresetList, { locale: 'en', api, revision: 0 }));
  try {
    await act(async () => {});
    assert.match(document.querySelector('.studio-preset-card').textContent, /Missing features.*Automatic compaction/);
    const click = async text => act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === text).click());
    await click('Restore');
    assert.deepEqual(applied, [], 'nothing changes before confirmation');
    assert.match(document.querySelector('dialog[open]').textContent, /\+ Automatic compaction/);
    await click('Restore and reapply');
    assert.deepEqual(applied, ['studio-user-a']);
  } finally { await view.close(); }
});

test('catalog change notice lists +/-/~ and the cleanup, and cleans only on confirm', async () => {
  const { CatalogChangeNotice } = await import('../src/master-change-notice.tsx');
  const change = { added: { tools: ['image_generate'], configs: [] }, removed: { tools: ['x_search'], configs: ['extra'] }, changed: { tools: ['bash'] },
    cleanup: [{ id: 'studio-user-a', name: 'Mine', tools: ['x_search'], configs: ['extra'] }] };
  let confirmed = 0, refreshed = 0;
  const actions = { read: async () => change, confirm: async () => { confirmed++; return { cleaned: 1 }; } };
  const view = await mount(React.createElement(CatalogChangeNotice, { actions, locale: 'en', onConfirmed: () => refreshed++ }));
  try {
    await act(async () => {});
    const click = async text => act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === text).click());
    await click('Review');
    const text = document.querySelector('dialog[open]').textContent;
    assert.match(text, /\+ image_generate/); assert.match(text, /- x_search/); assert.match(text, /- extra/); assert.match(text, /~ bash/);
    assert.match(text, /Mine.*x_search, extra/);
    await click('Later');
    assert.equal(confirmed, 0); assert.ok(document.querySelector('[role=status]'), 'the notice stays until confirmed');
    await click('Review'); await click('Confirm and clean');
    assert.equal(confirmed, 1); assert.equal(refreshed, 1);
    assert.equal(document.querySelector('[role=status]'), null);
  } finally { await view.close(); }
});
