/** Navigation preserves mounted feature drafts and the preset editor slot. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { SettingsLayout } from '../src/settings-layout.tsx';
const dom = new JSDOM('<div id="root"></div>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');

test('section navigation preserves drafts and renders the separate override editor', async () => {
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(React.createElement(SettingsLayout, { locale: 'ko', presets: React.createElement('button', null, 'preset editor') }, React.createElement('textarea', { defaultValue: 'draft' }))));
    const [dsh, studio] = document.querySelectorAll('nav button');
    const sections = document.querySelectorAll('section');
    const draft = document.querySelector('textarea');
    draft.value = 'unsaved changes';
    assert.equal(studio.getAttribute('aria-pressed'), 'true');
    assert.equal(sections[0].hidden, true);
    await act(async () => dsh.click());
    assert.equal(sections[0].hidden, false);
    assert.equal(sections[1].hidden, true);
    assert.equal(dsh.getAttribute('aria-controls'), sections[0].id);
    assert.equal(sections[0].querySelector('button').textContent, 'preset editor');
    await act(async () => studio.click());
    assert.equal(sections[1].hidden, false);
    assert.equal(document.querySelector('textarea'), draft);
    assert.equal(draft.value, 'unsaved changes');
    for (const [locale, label] of [['en', 'DSH settings'], ['zh', 'DSH 设置']]) {
      await act(async () => root.render(React.createElement(SettingsLayout, { locale }, React.createElement('textarea'))));
      assert.equal(document.querySelector('nav button').textContent, label);
    }
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
