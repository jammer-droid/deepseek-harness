import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('bundle contains only the shell and no managed preset', () => {
  const manifest = JSON.parse(read('../packages/bundle/package.json'));
  assert.deepEqual(Object.keys(manifest.dependencies), ['@local/dsh-studio-shell']);
  assert.equal(read('../packages/bundle/cordis.patch.yml'), "- insert:\n    - id: local-dsh-studio-shell\n      name: '@local/dsh-studio-shell'\n");
  const sources = readdirSync(new URL('../src/', import.meta.url));
  assert.ok(!sources.some(name => /^(mock|roles|workflow|preset|catalog|experiments|general)/.test(name)));
});

test('built client registers only the Studio panel and sidebar, without feature or remote effects', () => {
  let plugin;
  vm.runInNewContext(read('../packages/shell/client.js'), {
    window: { __ModuleLoader__: { load({ factory }) {
      plugin = factory(name => {
        if (name === 'react' || name === 'react/jsx-runtime') return {};
        if (name === '@deepseek-ai/dsh-client-ui-slots') return { resolveSlotLabel: value => value };
        throw new Error(`Unexpected runtime dependency: ${name}`);
      });
    } } },
  });
  assert.deepEqual(Array.from(plugin.inject), ['slots', 'locale']);
  const registrations = [];
  const subscriptions = [];
  const ctx = {
    effect: fn => fn(),
    locale: { addLanguage() {}, subscribe() { return () => {}; } },
    slots: {
      entriesOfSlot: () => [],
      subscribe: name => { subscriptions.push(name); return () => {}; },
      inject: (_name, fn) => fn(),
      register: options => { registrations.push(options); return () => {}; },
    },
  };
  plugin.apply(ctx);
  assert.deepEqual(registrations.map(item => item.name), ['main', 'sidebar.panellist']);
  assert.equal(registrations[0].key, 'local-dsh-studio');
  assert.equal(registrations[1].id, 'local-dsh-studio');
  assert.deepEqual(Object.keys(registrations[0].children), ['local.dsh-studio.services']);
  assert.deepEqual(subscriptions, ['local.dsh-studio.services']);
});
