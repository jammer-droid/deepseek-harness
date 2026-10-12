/** User-only confirmation gates writes; failed saves keep drafts visible. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { PresetEditor } from '../src/preset-editor.tsx';
const dom = new JSDOM('<div id="root"></div>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');

test('toggle requires confirmation, saves explicitly and preserves failed draft', async () => {
  const root = createRoot(document.getElementById('root'));
  let calls = 0;
  let reject = false;
  let lastRequest;
  let state = [{ entryId: 'preset-test', id: 'test', name: 'Test', revision: 'one', overridden: false, availability: 'available', plugins: [{ path: [0], name: 'tool', disabled: false, fields: [] }], components: [{ key: 'extra', name: 'extra-tool', source: 'Custom', plugins: [] }] }];
  const api = {
    async describe() { return structuredClone(state); },
    async apply(request) {
      calls++;
      lastRequest = structuredClone(request);
      if (reject) throw new Error('offline');
      state = [{ ...state[0], plugins: request.plugins, overridden: true, revision: 'two' }];
      return structuredClone(state);
    },
  };
  const button = text => [...document.querySelectorAll('button')].find(node => node.textContent === text);
  try {
    await act(async () => root.render(React.createElement(PresetEditor, { locale: 'en', api })));
    assert.equal(calls, 0);
    assert.equal(button('Apply override').disabled, true);
    await act(async () => document.querySelectorAll('input')[0].click());
    assert.equal(button('Apply override').disabled, true);
    await act(async () => document.querySelectorAll('input')[1].click());
    assert.equal(button('Apply override').disabled, false);
    await act(async () => button('Apply override').click());
    assert.equal(calls, 1);
    assert.equal(state[0].plugins[0].disabled, true);
    assert.match(document.body.textContent, /Saved/);
    reject = true;
    await act(async () => document.querySelectorAll('input')[0].click());
    await act(async () => document.querySelectorAll('input')[1].click());
    await act(async () => button('Apply override').click());
    assert.equal(calls, 2);
    assert.match(document.querySelector('[role="alert"]').textContent, /outcome unknown/);
    assert.equal(document.querySelectorAll('input')[0].checked, true);
    assert.equal(document.querySelector('fieldset').disabled, true);
    await act(async () => button('Reload saved settings').click());
    assert.equal(document.querySelector('fieldset').disabled, false);
    assert.equal(document.querySelectorAll('input')[0].checked, false);
    reject = false;
    await act(async () => button('Remove').click());
    assert.match(document.body.textContent, /Pending removal/);
    await act(async () => {
      const select = document.querySelectorAll('select')[1];
      select.value = 'extra';
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
    await act(async () => button('Add component').click());
    assert.match(document.body.textContent, /Pending additions/);
    assert.equal(button('Apply override').disabled, true);
    await act(async () => document.querySelectorAll('input')[1].click());
    await act(async () => button('Apply override').click());
    assert.deepEqual(lastRequest.remove, [[0]]);
    assert.deepEqual(lastRequest.add, ['extra']);
    assert.doesNotMatch(document.body.textContent, /Pending additions|Pending removal/);
    await act(async () => button('Remove').click());
    await act(async () => button('Discard draft').click());
    assert.doesNotMatch(document.body.textContent, /Pending removal/);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});
