import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { PromptToolsPrototype, defaultProvidedTools } from '../src/prompt-tools-prototype.tsx';
import { promptProviders, selectPromptProviders } from '../src/prompt-composition.ts';

test('prompt providers are explicitly classified and nested dependencies preserved', () => {
  const rows = [{ name: 'cordis:group', group: true, config: [{ name: '@deepseek-ai/dsh-persona', config: { prefix: 'Hello' } }, { name: 'tool-provider' }] }];
  assert.equal(promptProviders(rows)[0].name, '@deepseek-ai/dsh-persona');
  assert.deepEqual(selectPromptProviders(rows, [])[0].config, [{ name: 'tool-provider' }]);
  assert.throws(() => selectPromptProviders(rows, ['unknown']));
  assert.equal(rows[0].config.length, 2);
});

test('two-column selection keeps prompt on top and uses authoritative assembly order', async () => {
  const dom = new JSDOM('<div id="root"></div>');
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  const tools = ['read', 'grep', 'glob', 'read_batch'].map(name => ({ name, description: `${name}: full model-facing description\nincluding usage constraints` }));
  const catalog = { tools, presets: [{ id: 'standard', sections: [], tools, promptProviders: [{ name: '@deepseek-ai/dsh-persona', description: 'Base persona instructions' }] }] };
  let request;
  function Harness() {
    const [provided, onProvidedChange] = React.useState(defaultProvidedTools);
    return React.createElement(PromptToolsPrototype, { catalog, locale: 'en', prompt: 'Studio text', onPromptChange() {}, provided, onProvidedChange, onPreview: async input => {
      request = input;
      return { prompt: 'Assembled exactly', sections: [{ name: 'z-first', text: 'First' }, { name: 'a-second', text: 'Second' }], context: 'Runtime', tools: [] };
    } });
  }
  const click = async text => act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === text).click());
  try {
    await act(async () => root.render(React.createElement(Harness)));
    const transfers = document.querySelectorAll('.studio-tool-transfer');
    assert.equal(transfers.length, 2);
    assert.equal(transfers[0].textContent.includes('Base persona'), true);
    assert.equal(document.querySelectorAll('textarea').length, 1);
    const transfer = transfers[1];
    const custom = transfer.querySelector('input[aria-label="read_batch"]');
    await act(async () => custom.click());
    await act(async () => [...transfer.querySelectorAll('button')].find(b => b.textContent === 'Add →').click());
    assert.equal(transfer.querySelectorAll('fieldset')[1].textContent.includes('read_batch'), true);
    assert.equal(transfer.textContent.includes(tools[3].description), true);
    await act(async () => transfers[0].querySelector('input').click());
    await click('Add →');
    await click('Preview prompt');
    assert.deepEqual(request.providers, ['@deepseek-ai/dsh-persona']);
    assert.equal(request.tools.includes('read_batch'), true);
    assert.equal(request.prompt, 'Studio text');
    assert.deepEqual([...document.querySelectorAll('.studio-prompt-document h3')].map(e => e.textContent), ['z-first', 'a-second']);
    assert.equal(document.body.textContent.includes('Assembled exactly'), true);
    assert.equal(document.querySelectorAll('textarea').length, 1);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});
