import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<div id="root"></div>');
globalThis.window = dom.window; globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
import { act } from 'react';
import { RoleEditor } from '../src/roles-editor.tsx';

test('Editing a field waits for explicit Apply and preserves the draft on rejection', async () => {
  const root = createRoot(document.getElementById('root'));
  const role = { instructions: 'Original', provider: 'test', model: 'model' };
  const state = { processId: 'process', revision: 1, snapshotId: 'snapshot', appliedSnapshotId: 'snapshot', roles: { implementer: role, reviewer: role }, status: 'applied' };
  let submitted;
  await act(async () => root.render(React.createElement(RoleEditor, { locale: 'en', state, onApply: async request => { submitted = request; throw new Error('conflict'); }, onReload: async () => {} })));
  const area = document.querySelector('textarea');
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(area, 'Changed');
    area.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    area.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  assert.equal(submitted, undefined);
  await act(async () => root.render(React.createElement(RoleEditor, { locale: 'en', state: { ...state, revision: 2 }, onApply: async request => { submitted = request; throw new Error('conflict'); }, onReload: async () => {} })));
  await act(async () => document.querySelector('button').click());
  assert.equal(submitted.expectedRevision, 1);
  assert.equal(submitted.roles.implementer.instructions, 'Changed');
  assert.match(document.body.textContent, /Apply was rejected/);
  assert.equal(area.value, 'Changed');
  await act(async () => root.unmount()); dom.window.close();
});

test('The settings form shows two fixed roles, explicit Apply, and new-child-only guidance', () => {
  const html = renderToStaticMarkup(React.createElement(RoleEditor, { locale: 'en', state: { processId: 'process', revision: 0, snapshotId: null, appliedSnapshotId: null, roles: null, status: 'unconfigured' }, onApply: async () => {}, onReload: async () => {} }));
  assert.equal(html + '\n', readFileSync(new URL('./roles-ui.expected.html', import.meta.url), 'utf8'));
  assert.match(html, /Implementer/);
  assert.match(html, /Reviewer/);
  assert.match(html, /Apply/);
  assert.match(html, /new children only/);
  assert.match(html, /Unsaved changes/);
});
