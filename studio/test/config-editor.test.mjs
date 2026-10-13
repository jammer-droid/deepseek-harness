import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { ConfigEditor } from '../src/config-editor.tsx';

import { readFileSync } from 'node:fs';

test('rc.2 projected Configs render individual controls and inherited schema defaults', async () => {
  const entries = JSON.parse(readFileSync(new URL('./runtime-config-fixture.json', import.meta.url), 'utf8'));
  const dom = new JSDOM('<div id="root"></div>');
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { Simulate } = await import('react-dom/test-utils');
  const root = createRoot(document.getElementById('root'));
  let latest; let calls = 0;
  function Harness() {
    const [value, setValue] = React.useState(Object.fromEntries(entries.map(e => [e.id, {}])));
    latest = value;
    return React.createElement(ConfigEditor, { entries, locale: 'en', value, onChange(next) { calls++; setValue(next); } });
  }
  const control = label => document.querySelector(`[aria-label="${label}"]`);
  try {
    await act(async () => root.render(React.createElement(Harness)));
    assert.equal(control('tool-fs: readLimit')?.type, 'number');
    assert.equal(control('tool-fs: readLimit').value, '2000');
    assert.equal(control('tool-fs: readMaxBytes').value, '51200');
    assert.equal(control('tool-bash: enableRunInBackground').value, 'true');
    assert.equal(control('spill-policy: maxInlineTokens')?.type, 'number');
    assert.equal(calls, 0, 'displayed defaults must not become saved overrides');
    await act(async () => { const input = control('tool-fs: readLimit'); input.value = '120'; Simulate.change(input); });
    assert.deepEqual(latest['tool-fs'], { readLimit: 120 });
    await act(async () => control('Reset override: tool-fs: readLimit').click());
    assert.deepEqual(latest['tool-fs'], {});
    assert.equal(control('tool-fs: readLimit').value, '2000');
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});

const entry = {
  id: 'plugin', name: 'Example plugin',
  config: { count: 7, enabled: true, title: 'base', nested: { limit: 9, untouched: 'keep' }, mode: 'a', list: [1], union: null },
  schema: { type: 'object', $defs: { options: { type: 'object', properties: { limit: { type: 'integer' }, untouched: { type: 'string' } } } }, properties: {
    count: { type: 'number', default: 99 }, enabled: { type: 'boolean' }, title: { type: 'string' },
    nested: { $ref: '#/$defs/options' }, mode: { enum: ['a', 'b', false, 0] }, list: { type: 'array', items: { type: 'number' } },
    union: { anyOf: [{ type: 'string' }, { type: 'null' }] }, absent: { type: 'string', default: 'Do not save' },
    readonly: { type: 'string', readOnly: true },
  } },
};

test('selection, recursive inputs and reset preserve inheritance and immutable false/zero/empty overrides', async () => {
  const dom = new JSDOM('<div id="root"></div>');
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { Simulate } = await import('react-dom/test-utils');
  const root = createRoot(document.getElementById('root'));
  const initial = Object.freeze({ other: Object.freeze({ retained: true }) });
  const baseBefore = structuredClone(entry.config);
  let latest = initial;
  let calls = 0;
  function Harness({ locale = 'en', entries = [entry] }) {
    const [value, setValue] = React.useState(initial);
    return React.createElement(ConfigEditor, { entries, locale, value, onChange(next) { latest = next; calls++; setValue(next); } });
  }
  const control = label => [...document.querySelectorAll('[aria-label]')].find(element => element.getAttribute('aria-label') === label);
  const click = label => act(async () => { assert.ok(control(label), label); control(label).click(); });
  const change = (label, value) => act(async () => {
    const element = control(label); assert.ok(element, label); element.value = value;
    Simulate.change(element);
  });
  try {
    await act(async () => root.render(React.createElement(Harness)));
    assert.equal(calls, 0);
    assert.ok(control('Available Configs')); assert.ok(control('Selected Configs'));
    assert.match(control('Selected Configs').textContent, /Schema unavailable/);
    const search = document.querySelector('input[type=search]');
    await act(async () => Simulate.change(search, { target: { value: 'nested' } }));
    assert.ok(control('Add: plugin'), 'nested schema fields are discoverable');
    await click('Add: plugin');
    assert.deepEqual(latest, { other: { retained: true }, plugin: {} });
    assert.equal(control('plugin: count').value, '7');
    assert.equal(control('plugin: absent').value, 'Do not save');
    assert.equal(control('plugin: nested.limit').value, '9');
    assert.equal(control('plugin: readonly').disabled, true);
    const card = control('Remove: plugin').closest('.studio-card');
    assert.equal(card.querySelector('[data-studio-modified]'), null);
    await change('plugin: count', '8');
    assert.equal(card.querySelector('[data-studio-modified]').textContent, 'Modified');
    await act(async () => Simulate.change(search, { target: { value: 'no-such-setting' } }));
    assert.match(control('Available Configs').textContent, /No matching results/);
    assert.equal(control('plugin: count').value, '8', 'search retains selected draft edits');
    await act(async () => Simulate.change(search, { target: { value: '' } }));
    await change('plugin: count', '7');
    assert.equal(card.querySelector('[data-studio-modified]'), null, 'same as original is not modified');
    await click('Reset override: plugin: count');
    assert.equal(card.querySelector('[data-studio-modified]'), null);
    const selected = latest;
    await change('plugin: count', '0');
    await change('plugin: enabled', 'false');
    await change('plugin: title', '');
    await change('plugin: nested.limit', '0');
    const beforeFraction = calls;
    await change('plugin: nested.limit', '0.5');
    assert.equal(calls, beforeFraction, 'integer inputs must not emit fractional overrides');
    await change('plugin: mode', '2');
    assert.deepEqual(latest.plugin, { count: 0, enabled: false, title: '', nested: { limit: 0 }, mode: false });
    assert.deepEqual(selected.plugin, {});
    assert.equal(latest.other, initial.other);
    const edited = latest;
    await click('Reset override: plugin: nested.limit');
    assert.equal(control('plugin: nested.limit').value, '9');
    assert.equal(Object.hasOwn(latest.plugin, 'nested'), false);
    assert.deepEqual(edited.plugin.nested, { limit: 0 });
    for (const key of ['count', 'enabled', 'title', 'mode']) await click(`Reset override: plugin: ${key}`);
    assert.deepEqual(latest.plugin, {});
    assert.equal(control('plugin: enabled').value, 'true');
    assert.equal(control('plugin: title').value, 'base');
    assert.deepEqual(entry.config, baseBefore);

    assert.equal(document.querySelectorAll('textarea').length, 0);
    assert.match(control('plugin: list').textContent, /not yet supported/);
    assert.match(control('plugin: union').textContent, /not yet supported/);
    await click('Remove: plugin');
    assert.deepEqual(latest, { other: { retained: true } });
    await click('Add: plugin');
    assert.deepEqual(latest.plugin, {});
    assert.deepEqual(initial, { other: { retained: true } });

    const errors = [{ id: 'broken', name: 'Broken', schema: entry.schema, error: 'Projection failed' }, { id: 'missing', name: 'Missing' }];
    await act(async () => root.render(React.createElement(Harness, { entries: errors })));
    assert.equal(control('Add: broken').disabled, true);
    assert.equal(control('Add: missing').disabled, true);
    assert.equal(document.querySelectorAll('input:not([type=search]), select, textarea').length, 0);
    assert.ok(control('Remove: plugin'));
    for (const [locale, available, selected] of [['ko-KR', '사용 가능한 Config', '선택한 Config'], ['zh-CN', '可用 Config', '已选 Config']]) {
      await act(async () => root.render(React.createElement(Harness, { entries: errors, locale })));
      assert.ok(control(available)); assert.ok(control(selected));
    }
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});

test('local reference cycles and unsupported schemas show unsupported notices without free-form editors', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const schema = { type: 'object', properties: { cyclic: { $ref: '#/$defs/cycle' }, remote: { $ref: 'https://example.invalid/schema' } }, $defs: { cycle: { $ref: '#/$defs/cycle' } } };
  const html = renderToStaticMarkup(React.createElement(ConfigEditor, { entries: [{ id: 'refs', name: 'Refs', schema }], value: { refs: {} }, onChange() { assert.fail('Rendering must not write defaults'); }, locale: 'en' }));
  assert.match(html, /aria-label="refs: cyclic"/);
  assert.match(html, /aria-label="refs: remote"/);
  assert.equal((html.match(/<textarea/g) ?? []).length, 0);
  assert.match(html, /not yet supported/);
});
