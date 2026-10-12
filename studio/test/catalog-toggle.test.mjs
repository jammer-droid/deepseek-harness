/** Profile-wide opt-in is explicit and uncertain mutations block retry. */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<div id="root"></div>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { CatalogToggle } = await import('../src/catalog-toggle.tsx');
after(() => dom.window.close());
function button(text) { return [...document.querySelectorAll('button')].find(item => item.textContent === text); }
test('Enable uses discovered identity and disable remains available after confirmation', async () => {
  const root = createRoot(document.getElementById('root'));
  let enabled = false; const changes = [];
  const api = {
    async listPlugins() { return [{ entryId: 'discovered-id', moduleName: '@local/dsh-studio-catalog', enabled, patchId: 'patch' }]; },
    async setPluginEnabled(id, value) { changes.push([id, value]); enabled = value; return { application: 'applied' }; },
  };
  try {
    await act(async () => root.render(React.createElement(CatalogToggle, { locale: 'en', api })));
    assert.deepEqual(changes, []);
    await act(async () => button('Enable').click());
    assert.deepEqual(changes, [['discovered-id', true]]);
    await act(async () => button('Disable').click());
    assert.deepEqual(changes, [['discovered-id', true], ['discovered-id', false]]);
  } finally { await act(async () => root.unmount()); }
});
test('Unknown change cannot be repeated until an explicit read', async () => {
  const root = createRoot(document.getElementById('root'));
  const api = {
    async listPlugins() { return [{ entryId: 'id', moduleName: '@local/dsh-studio-catalog', enabled: false, patchId: 'patch' }]; },
    async setPluginEnabled() { throw new Error('lost response'); },
  };
  try {
    await act(async () => root.render(React.createElement(CatalogToggle, { locale: 'en', api })));
    await act(async () => button('Enable').click());
    assert.equal(button('Enable').disabled, true);
    assert.match(document.body.textContent, /Read the state before trying again/);
    await act(async () => button('Read state').click());
    assert.equal(button('Enable').disabled, false);
  } finally { await act(async () => root.unmount()); }
});
