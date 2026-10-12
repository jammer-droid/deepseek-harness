/** Navigation preserves mounted drafts, the preset editor slot, and the mock design pages. */
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

test('section navigation keeps every section mounted and starts on workflows', async () => {
  const root = createRoot(document.getElementById('root'));
  try {
    const pages = { workflows: React.createElement('p', null, 'workflow mock'), agents: React.createElement('p', null, 'agent mock'), components: React.createElement('p', null, 'component mock'), systems: React.createElement('p', null, 'system mock') };
    await act(async () => root.render(React.createElement(SettingsLayout, { locale: 'ko', pages, presets: React.createElement('button', null, 'preset editor') }, React.createElement('textarea', { defaultValue: 'draft' }))));
    const [workflows, agents, components, systems, dsh, studio] = document.querySelectorAll('nav.studio-nav button');
    const sections = [...document.querySelectorAll('section')];
    const visible = () => sections.filter(section => !section.hidden).map(section => section.id);
    const draft = document.querySelector('textarea');
    draft.value = 'unsaved changes';
    assert.equal(workflows.getAttribute('aria-current'), 'page');
    assert.deepEqual(visible(), [workflows.getAttribute('aria-controls')]);
    assert.equal(document.getElementById(workflows.getAttribute('aria-controls')).textContent, 'workflow mock');
    for (const [button, text] of [[agents, 'agent mock'], [components, 'component mock'], [systems, 'system mock']]) {
      await act(async () => button.click());
      assert.deepEqual(visible(), [button.getAttribute('aria-controls')]);
      assert.equal(document.getElementById(button.getAttribute('aria-controls')).textContent, text);
    }
    await act(async () => dsh.click());
    assert.equal(document.getElementById(dsh.getAttribute('aria-controls')).querySelector('button').textContent, 'preset editor');
    await act(async () => studio.click());
    assert.equal(studio.getAttribute('aria-current'), 'page');
    assert.equal(workflows.getAttribute('aria-current'), null);
    assert.equal(document.querySelector('textarea'), draft);
    assert.equal(draft.value, 'unsaved changes');
    for (const [locale, label] of [['en', 'Workflows'], ['zh', '工作流']]) {
      await act(async () => root.render(React.createElement(SettingsLayout, { locale }, React.createElement('textarea'))));
      assert.equal(document.querySelector('nav.studio-nav button').textContent, label);
    }
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});

test('a controlled section follows its owner and reports selections', async () => {
  const dom2 = new JSDOM('<div id="root"></div>');
  globalThis.window = dom2.window;
  globalThis.document = dom2.window.document;
  const root = createRoot(document.getElementById('root'));
  const selected = [];
  try {
    await act(async () => root.render(React.createElement(SettingsLayout, { locale: 'en', section: 'systems', onSectionChange: value => selected.push(value) })));
    const buttons = [...document.querySelectorAll('nav.studio-nav button')];
    assert.equal(buttons[3].getAttribute('aria-current'), 'page');
    await act(async () => buttons[1].click());
    assert.deepEqual(selected, ['agents']);
  } finally {
    await act(async () => root.unmount());
    dom2.window.close();
  }
});
