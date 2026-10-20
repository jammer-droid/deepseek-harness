/** #38 Plugins service: installed list by scope, include with initial config, register snippet, migration, profile settings. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { composeProfileConfig, configDiff, profileSnippet, secretKeys, snippetId } from '../src/profile-config.ts';
import { withoutSecrets } from '../src/secret-fields.ts';

const dom = new JSDOM('<!doctype html><body></body>');
globalThis.window = dom.window; globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!dom.window.HTMLDialogElement.prototype.showModal) {
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
}
const EXA = '@deepseek-ai/dsh-web-search-exa';

test('profile config: diff excludes secrets, compose keeps / replaces / deletes secrets and follows inherited values', () => {
  const roles = { apiKeyEnv: 'credential-ref' };
  assert.deepEqual(configDiff({ searchType: 'auto', apiKey: 'a' }, { searchType: 'neural', apiKey: 'b', apiKeyEnv: 'X' }, roles), { searchType: 'neural', apiKeyEnv: 'X' });
  assert.deepEqual(secretKeys({ token: 'secret' }, { apiKey: 1, model: 2 }), ['apiKey', 'token']);
  const inherited = { searchType: 'auto', baseURL: 'https://api' };
  const current = { searchType: 'neural', apiKey: 'old-key' };
  assert.deepEqual(composeProfileConfig({ inherited, current, diff: { searchType: 'keyword' }, secrets: {} }), { searchType: 'keyword', baseURL: 'https://api', apiKey: 'old-key' });
  assert.deepEqual(composeProfileConfig({ inherited, current, diff: {}, secrets: { apiKey: { action: 'replace', value: 'new-key' } } }), { searchType: 'auto', baseURL: 'https://api', apiKey: 'new-key' });
  assert.deepEqual(composeProfileConfig({ inherited, current, diff: {}, secrets: { apiKey: { action: 'delete' } } }), inherited, 'equal to inherited, so configEditor drops the override');
  assert.throws(() => composeProfileConfig({ inherited, current, diff: { apiKey: 'x' }, secrets: {} }), /secret action/);
  assert.throws(() => composeProfileConfig({ inherited, current, diff: {}, secrets: { apiKey: { action: 'replace', value: '' } } }), /Enter a value/);
});

test('register snippet and secret-free schema', () => {
  assert.equal(snippetId(EXA), 'web-search-exa');
  assert.equal(profileSnippet(EXA, 'web-search-exa', ['apiKey']), "- insert:\n    - id: web-search-exa\n      name: '@deepseek-ai/dsh-web-search-exa'\n      config:\n        apiKey: <apiKey>\n");
  const schema = { anyOf: [{ type: 'object', properties: { apiKey: {}, searchType: {} } }, { $ref: '#/x' }] };
  assert.deepEqual(Object.keys(withoutSecrets(schema).anyOf[0].properties), ['searchType']);
});

async function render(t, element) {
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  t.after(() => { act(() => root.unmount()); host.remove(); });
  await act(async () => root.render(element));
  await act(async () => {});
  return host;
}
const click = async (scope, text) => act(async () => [...scope.querySelectorAll('button')].find(b => b.textContent === text).click());

function fixture(overrides = {}) {
  const calls = [];
  const plugins = [
    { package: EXA, entry: EXA, version: '0.2.1-rc.2', scope: 'profile', evidence: 'compatibility', state: 'installed' },
    { package: 'my-tools', entry: 'my-tools', version: '1.0.0', scope: 'unknown', evidence: 'none', state: 'installed' },
    { package: 'agent-x', entry: 'agent-x', scope: 'agent', evidence: 'compatibility', state: 'installed' },
    { package: 'in', entry: 'in', scope: 'agent', evidence: 'master', state: 'in-master' },
  ];
  const view = { patchId: 'web', name: '@deepseek-ai/dsh-web', role: 'service', schema: { type: 'object', properties: { searchProvider: { type: 'string' } } },
    effective: { searchProvider: 'deepseek' }, inherited: { searchProvider: 'deepseek' }, diff: {}, secrets: [] };
  const exaView = { patchId: 'web-search-exa', name: EXA, role: 'plugin', schema: { type: 'object', properties: { apiKey: { type: 'string' }, searchType: { type: 'string' } } },
    effective: {}, inherited: {}, diff: {}, secrets: [{ key: 'apiKey', set: false }] };
  const actions = {
    installed: async () => ({ plugins, errors: {} }),
    migration: async () => overrides.migration ?? [],
    migrate: async id => { calls.push(['migrate', id]); return { appliedIn: [{ preset: 'a', name: 'Alpha' }] }; },
    include: async (name, config) => { calls.push(['include', name, config]); },
    schema: async () => ({ type: 'object', properties: { limit: { type: 'integer' } } }),
    profiles: async () => [exaView, view],
    saveProfile: async payload => { calls.push(['save', payload]); if (overrides.saveError) throw new Error(overrides.saveError); return [exaView, { ...view, diff: payload.diff, effective: payload.diff }]; },
    copy: async text => { calls.push(['copy', text]); },
  };
  return { actions, calls };
}

test('installed page shows scope badges and the right action per row', async t => {
  const { PluginsPage } = await import('../src/plugins-page.tsx');
  const { actions } = fixture();
  const host = await render(t, React.createElement(PluginsPage, { locale: 'en', actions }));
  const rows = [...host.querySelectorAll('.studio-settings-card')[0].querySelectorAll('.studio-settings-row')].map(row => row.textContent);
  assert.match(rows[0], /Profile-wide.*Newly installed.*Checked by Studio.*Register in profile/);
  assert.match(rows[1], /Needs check.*Include as agent feature/);
  assert.match(rows[2], /Agent feature.*Set up and include/);
  assert.match(rows[3], /In base composition/);
  assert.ok(!/Set up and include|Register/.test(rows[3]));
});

test('include opens the initial settings, warns for unknown scope, and sends config with the name', async t => {
  const { PluginsPage } = await import('../src/plugins-page.tsx');
  const { actions, calls } = fixture();
  const host = await render(t, React.createElement(PluginsPage, { locale: 'en', actions }));
  await click(host, 'Include as agent feature');
  await act(async () => {});
  const dialog = document.querySelector('dialog[open]');
  assert.match(dialog.textContent, /not confirmed that this plugin runs per preset/);
  const { Simulate } = await import('react-dom/test-utils');
  const input = dialog.querySelector('input[type=number]');
  input.value = '3';
  await act(async () => Simulate.change(input));
  await click(dialog, 'Include');
  assert.deepEqual(calls, [['include', 'my-tools', { limit: 3 }]]);
});

test('register shows the patch snippet and copies it', async t => {
  const { PluginsPage } = await import('../src/plugins-page.tsx');
  const { actions, calls } = fixture();
  const host = await render(t, React.createElement(PluginsPage, { locale: 'en', actions }));
  await click(host, 'Register in profile');
  const dialog = document.querySelector('dialog[open]');
  assert.match(dialog.querySelector('pre').textContent, /- id: web-search-exa\n {6}name: '@deepseek-ai\/dsh-web-search-exa'/);
  await click(dialog, 'Copy');
  assert.equal(calls[0][0], 'copy');
});

test('migration card moves a row and reports presets to reapply', async t => {
  const { PluginsPage } = await import('../src/plugins-page.tsx');
  const { actions, calls } = fixture({ migration: [{ id: 'dsh-web-search-exa', entry: EXA, config: {}, overrides: [{ preset: 'a', name: 'Alpha', config: {} }], appliedIn: [] }] });
  const host = await render(t, React.createElement(PluginsPage, { locale: 'en', actions }));
  assert.match(host.textContent, /Per-preset settings: Alpha/);
  await click(host, 'Move');
  assert.deepEqual(calls, [['migrate', 'dsh-web-search-exa']]);
  assert.match(host.textContent, /Reapply these presets before registering it in the profile: Alpha/);
});

test('profile settings: service row, secret keep/replace, save sends diff and secret actions, failures keep edits', async t => {
  const { PluginsPage } = await import('../src/plugins-page.tsx');
  const { actions, calls } = fixture();
  const host = await render(t, React.createElement(PluginsPage, { locale: 'en', actions }));
  await act(async () => [...host.querySelectorAll('.studio-nav-item')].find(b => b.textContent === 'Profile settings').click());
  await act(async () => {});
  const page = [...host.querySelectorAll('.studio-page-stack')].find(node => /Profile settings/.test(node.querySelector('h1, h2')?.textContent ?? ''));
  assert.match(page.textContent, /Service/);
  assert.match(page.textContent, /apiKey: Not set/);
  const buttons = [...page.querySelectorAll('button')].filter(b => b.textContent === 'Settings');
  await act(async () => buttons[0].click());
  const dialog = document.querySelector('dialog[open]');
  assert.match(dialog.textContent, /Applies to every session/);
  assert.equal(dialog.querySelectorAll('input[aria-label$="apiKey"]').length, 0, 'secret is not in the schema form');
  const save = () => [...dialog.querySelectorAll('button')].find(b => /^(Save|Saved|Saving…)$/.test(b.textContent));
  assert.equal(save().disabled, true);
  const { Simulate } = await import('react-dom/test-utils');
  await act(async () => Simulate.change(dialog.querySelector('select[aria-label="apiKey: Secret"]'), { target: { value: 'replace' } }));
  await act(async () => Simulate.change(dialog.querySelector('input[type=password]'), { target: { value: 'sk-new' } }));
  assert.equal(save().disabled, false);
  await act(async () => save().click());
  assert.deepEqual(calls.at(-1), ['save', { patchId: 'web-search-exa', diff: {}, secrets: { apiKey: { action: 'replace', value: 'sk-new' } } }]);
});

test('profile save failure keeps edits and shows the error', async t => {
  const { PluginsPage } = await import('../src/plugins-page.tsx');
  const { actions } = fixture({ saveError: 'overridden by a home patch' });
  const host = await render(t, React.createElement(PluginsPage, { locale: 'en', actions }));
  await act(async () => [...host.querySelectorAll('.studio-nav-item')].find(b => b.textContent === 'Profile settings').click());
  await act(async () => {});
  const page = [...host.querySelectorAll('.studio-page-stack')].find(node => /Profile settings/.test(node.querySelector('h1, h2')?.textContent ?? ''));
  await act(async () => [...page.querySelectorAll('button')].filter(b => b.textContent === 'Settings')[1].click());
  const dialog = document.querySelector('dialog[open]');
  const { Simulate } = await import('react-dom/test-utils');
  await act(async () => Simulate.change(dialog.querySelector('input[type=text]'), { target: { value: 'exa' } }));
  await act(async () => [...dialog.querySelectorAll('button')].find(b => b.textContent === 'Save').click());
  assert.match(dialog.textContent, /Could not save\. Your edits are kept\. overridden by a home patch/);
  assert.equal(dialog.querySelector('input[type=text]').value, 'exa');
});
