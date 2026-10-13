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
  const catalog = { tools, presets: [{ id: 'minimal', sections: [], tools, promptProviders: [{ name: '@deepseek-ai/dsh-persona', description: 'Base persona instructions' }] }] };
  let request;
  function Harness() {
    const [provided, onProvidedChange] = React.useState(defaultProvidedTools);
    return React.createElement(PromptToolsPrototype, { catalog, locale: 'en', prompt: 'Studio text', onPromptChange() {}, provided, onProvidedChange, onPreview: async input => {
      request = input;
      return { prompt: 'Assembled exactly', sections: [{ name: 'z-first', text: 'First' }, { name: 'a-second', text: 'Second' }], context: 'Runtime', tools: [{ name: 'read', description: 'Reads files', parameters: { type: 'object', required: ['path'], properties: { path: { type: 'string', description: 'A file path', minLength: 1 } } } }] };
    } });
  }
  const click = async text => act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === text).click());
  try {
    await act(async () => root.render(React.createElement(Harness)));
    const transfers = document.querySelectorAll('.studio-tool-transfer');
    assert.equal(transfers.length, 2);
    assert.equal(transfers[0].textContent.includes('Base persona'), true);
    assert.equal(document.querySelectorAll('input[type=checkbox]').length, 0);
    const transfer = transfers[1];
    const custom = transfer.querySelector('button[aria-label="read_batch"]');
    await act(async () => transfer.querySelector('button[aria-label="Details: read_batch"]').click());
    assert.equal(custom.getAttribute('aria-pressed'), 'false');
    assert.match(document.querySelector('.studio-selection-detail').textContent, /read_batch/);
    await act(async () => custom.click());
    assert.equal(custom.getAttribute('aria-pressed'), 'true');
    assert.equal(custom.closest('article').dataset.selected, 'true');
    await act(async () => [...transfer.querySelectorAll('button')].find(b => b.textContent === 'Add →').click());
    assert.equal(transfer.querySelectorAll('fieldset')[1].textContent.includes('read_batch'), true);
    assert.equal(transfer.textContent.includes(tools[3].description), true);
    await act(async () => transfers[0].querySelector('button[aria-label="@deepseek-ai/dsh-persona"]').click());
    await click('Add →');
    await click('Preview prompt');
    assert.deepEqual(request.providers, ['@deepseek-ai/dsh-persona']);
    assert.equal(request.tools.includes('read_batch'), true);
    assert.equal(request.prompt, 'Studio text');
    assert.deepEqual([...document.querySelectorAll('.studio-prompt-document h3')].map(e => e.textContent), ['z-first', 'a-second', 'Model-facing tool schemas']);
    assert.equal(document.body.textContent.includes('Assembled exactly'), false);
    assert.equal(document.body.textContent.includes('Runtime'), false);
    assert.equal(document.querySelectorAll('.studio-prompt-stages').length, 0);
    assert.equal(document.querySelectorAll('.studio-prompt-document pre').length, 0);
    assert.match(document.querySelector('.studio-schema-tool').textContent, /minLength/);
    assert.equal(document.querySelector('.studio-schema-tool').open, false);
    assert.equal(request.preset, 'minimal');
    assert.equal(Object.hasOwn(request, 'persona'), false);
    const { Simulate } = await import('react-dom/test-utils');
    const persona = document.querySelector('textarea');
    await act(async () => Simulate.change(persona, { target: { value: 'Edited persona' } }));
    const description = document.querySelector('.studio-selection-detail textarea');
    await act(async () => Simulate.change(description, { target: { value: 'Edited tool description' } }));
    await click('Preview prompt');
    assert.equal(request.persona, 'Edited persona');
    assert.equal(request.toolOverrides.read_batch.description, 'Edited tool description');
    await click('Use original persona');
    await act(async () => [...document.querySelectorAll('.studio-selection-detail button')].find(b => b.textContent === 'Use original').click());
    await click('Preview prompt');
    assert.equal(Object.hasOwn(request, 'persona'), false);
    assert.equal(Object.hasOwn(request.toolOverrides, 'read_batch'), false);
    await act(async () => transfers[0].querySelector('button[aria-label="Details: @deepseek-ai/dsh-persona"]').click());
    const providerDetail = document.querySelector('.studio-selection-detail');
    await act(async () => Simulate.change(providerDetail.querySelector('textarea'), { target: { value: 'Suffix override' } }));
    await act(async () => Simulate.change(providerDetail.querySelector('select'), { target: { value: 'true' } }));
    await click('Preview prompt');
    assert.deepEqual(request.providerConfigs['@deepseek-ai/dsh-persona'], { suffix: 'Suffix override', includeRuntimeContext: true });
    await act(async () => providerDetail.querySelector('button').click());
    await click('Preview prompt');
    assert.equal(Object.hasOwn(request.providerConfigs, '@deepseek-ai/dsh-persona'), false);
    assert.equal(document.querySelectorAll('input[type=checkbox]').length, 0);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});
