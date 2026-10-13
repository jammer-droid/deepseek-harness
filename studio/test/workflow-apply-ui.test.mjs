/** Response loss requires readback without another write or editor replacement. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { WorkflowApply } from '../src/workflow-apply.tsx';
import { applyText } from '../src/workflow-apply-locales.ts';
const dom = new JSDOM('<div id="root"></div>');
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const Modal = ({ open, children }) => open ? React.createElement('div', { role: 'dialog' }, children) : null;
const saved = { id: 'draft', revision: 3 };
const state = { applied: { id: 'draft', revision: 1, draftRevision: 3 }, activation: 'active', experiments: 'targeted', observations: [] };
async function click(label) { const button = [...document.querySelectorAll('button')].find(item => item.textContent === label); assert.ok(button); await act(async () => button.click()); }
test('localized apply confirmation, unknown outcome, readback, dirty protection and cleanup', async () => {
  for (const locale of ['en', 'ko', 'zh']) {
    const t = applyText(locale); const root = createRoot(document.getElementById('root'));
    let writes = 0, stored = [state], disposed = 0;
    const api = { subscribeConnection: () => () => { disposed++; }, applications: async () => stored, applyDraft: async request => { assert.deepEqual(request, { id: 'draft', draftRevision: 3, expectedRevision: 1 }); writes++; stored = [state]; throw new Error('response lost'); } };
    const render = dirty => root.render(React.createElement(WorkflowApply, { api, saved, dirty, disabled: false, locale, Modal }));
    await act(async () => render(false));
    await click(t.apply); assert.ok(document.querySelector('[role="dialog"]').textContent.includes(t.notice));
    await click(t.confirm); assert.equal(writes, 1); assert.ok(document.body.textContent.includes(t.unknown)); assert.ok(!document.body.textContent.includes(t.active), 'stale activation is not presented as confirmed');
    assert.equal([...document.querySelectorAll('button')].find(item => item.textContent === t.apply).disabled, true);
    await click(t.query); assert.equal(writes, 1); assert.ok(document.body.textContent.includes(t.active)); assert.ok(document.body.textContent.includes(t.targeted));
    await act(async () => render(true)); assert.equal([...document.querySelectorAll('button')].find(item => item.textContent === t.apply).disabled, true);
    await click(t.query); assert.ok(document.body.textContent.includes(t.dirty)); assert.equal(writes, 1);
    await act(async () => root.unmount()); assert.equal(disposed, 1);
  }
  dom.window.close();
});
