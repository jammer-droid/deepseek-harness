/** User-visible draft selection and explicit save behavior. */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<div id="root"></div>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { WorkflowEditor } = await import('../src/workflow-editor.tsx');
test('Empty draft editor matches user-visible output', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { readFile } = await import('node:fs/promises');
  const output = renderToStaticMarkup(React.createElement(WorkflowEditor, { locale: 'en', components: [], initialDrafts: [], api: { drafts: async () => [], save: async () => { throw new Error('not called'); } } }));
  assert.equal(output + '\n', await readFile(new URL('./workflow-ui.expected.html', import.meta.url), 'utf8'));
});
after(() => dom.window.close());
test('Conflict reports retain edits and require explicit replacement with the saved version', async () => {
  const root = createRoot(document.getElementById('root'));
  const original = { id: '9b8208b1-54c8-4e0e-9a89-549939f8a816', revision: 1, document: { name: 'Original', mainRole: { name: 'Main', components: [] } } };
  const latest = { ...original, revision: 2, document: { ...original.document, name: 'Other editor' } };
  const api = { async drafts() { return [latest]; }, async save() { throw { code: 'studio-workflows/rejected', details: { reason: 'revision-conflict' } }; } };
  try {
    await act(async () => root.render(React.createElement(WorkflowEditor, { locale: 'en', components: [], initialDrafts: [original], api })));
    await input(document.querySelector('input'), 'My edits'); await click('Save draft');
    assert.match(document.querySelector('[role=alert]').textContent, /changed elsewhere/);
    assert.equal(document.querySelector('input').value, 'My edits');
    assert.equal(button('Save draft').disabled, true);
    await click('Read again'); await click('Keep editing');
    assert.equal(document.querySelector('input').value, 'My edits');
    await click('Read again'); await click('Discard and continue');
    assert.equal(document.querySelector('input').value, 'Other editor');
    assert.equal(document.querySelector('[role=status]').textContent, 'Saved');
  } finally { await act(async () => root.unmount()); }
});
test('Lost create response blocks dependent writes until readback finds the stable ID', async () => {
  const root = createRoot(document.getElementById('root'));
  let stored;
  let readsFail = true;
  let saves = 0;
  const api = {
    async drafts() { if (readsFail) throw new Error('offline'); return [stored]; },
    async save(request) { saves++; stored = { id: request.id, revision: 1, document: structuredClone(request.document) }; throw new Error('response lost'); },
  };
  try {
    await act(async () => root.render(React.createElement(WorkflowEditor, { locale: 'en', components: [], initialDrafts: [], api })));
    await click('New draft');
    await input(document.querySelector('input'), 'Retained');
    await click('Save draft');
    assert.equal(document.querySelector('input').value, 'Retained');
    assert.match(document.querySelector('[role=alert]').textContent, /not confirmed/);
    assert.equal(button('Save draft').disabled, true);
    assert.equal(button('New draft').disabled, true);
    await click('Read again'); await click('Discard and continue');
    assert.equal(document.querySelector('input').value, 'Retained');
    assert.equal(button('New draft').disabled, true);
    readsFail = false;
    await click('Read again'); await click('Discard and continue');
    assert.equal(document.querySelector('[role=alert]'), null);
    assert.equal(document.querySelector('[role=status]').textContent, 'Saved');
    assert.equal(document.querySelector('select').value, stored.id);
    assert.equal(saves, 1);
  } finally { await act(async () => root.unmount()); }
});
const components = [{ id: 'studio.instructions', version: 1, scope: 'role', fields: [{ key: 'text', kind: 'text', required: true }] }];
const button = text => [...document.querySelectorAll('button')].find(item => item.textContent === text);
async function click(text) { await act(async () => button(text).click()); }
async function input(element, value) {
  await act(async () => {
    const prototype = element.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
    element.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    element.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
}
test('Missing readback does not resolve a save that may still arrive', async () => {
  const root = createRoot(document.getElementById('root'));
  const api = { async drafts() { return []; }, async save() { throw new Error('transport lost'); } };
  try {
    await act(async () => root.render(React.createElement(WorkflowEditor, { locale: 'en', components, initialDrafts: [], api })));
    await click('New draft'); await input(document.querySelector('input'), 'Pending'); await click('Save draft');
    await click('Read again'); await click('Discard and continue');
    assert.equal(button('New draft').disabled, true);
    assert.equal(button('Save draft').disabled, true);
    assert.equal(document.querySelector('input').value, 'Pending');
  } finally { await act(async () => root.unmount()); }
});

test('Create, edit and save drafts; confirm before discarding local changes', async () => {
  const root = createRoot(document.getElementById('root'));
  const stored = [];
  const api = {
    async drafts() { return structuredClone(stored); },
    async save(request) {
      const result = { id: request.id, revision: request.expectedRevision + 1, document: structuredClone(request.document) };
      stored.push(result);
      return result;
    },
  };
  try {
    await act(async () => root.render(React.createElement(WorkflowEditor, { locale: 'en', components, initialDrafts: [], api })));
    await click('New draft');
    await input(document.querySelector('input'), 'First draft');
    await click('Add instructions');
    await input(document.querySelector('textarea'), 'Follow repository instructions.');
    assert.equal(stored.length, 0);
    await click('Save draft');
    assert.equal(stored.length, 1);
    assert.equal(stored[0].document.mainRole.components[0].config.text, 'Follow repository instructions.');
    assert.equal(document.querySelector('[role=status]').textContent, 'Saved');
    await input(document.querySelector('textarea'), 'Local edits');
    await click('New draft');
    assert.match(document.querySelector('[role=alert]').textContent, /Discard unsaved/);
    await click('Keep editing');
    assert.equal(document.querySelector('textarea').value, 'Local edits');
    await click('New draft');
    await click('Discard and continue');
    assert.equal(document.querySelector('input').value, '');
    await input(document.querySelector('input'), 'Second draft');
    await click('Save draft');
    assert.equal(stored.length, 2);
    assert.notEqual(stored[0].id, stored[1].id);
    await act(async () => {
      const select = document.querySelector('select');
      select.value = stored[0].id;
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
    assert.equal(document.querySelector('input').value, 'First draft');
    assert.equal(document.querySelector('textarea').value, 'Follow repository instructions.');
  } finally { await act(async () => root.unmount());  }
});
