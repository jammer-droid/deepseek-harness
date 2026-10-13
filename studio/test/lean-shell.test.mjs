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
  assert.ok(!sources.filter(name => !['preset-catalog.ts', 'preset-diagnostics.tsx', 'preset-export.ts'].includes(name)).some(name => /^(mock|roles|workflow|preset|catalog|experiments|general)/.test(name)));
});

test('built client mounts read-only catalog and registers Studio optimization', async () => {
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
  assert.deepEqual(Array.from(plugin.inject), ['slots', 'locale', 'remote']);
  const registrations = [];
  const subscriptions = [];
  const ctx = {
    get: () => ({ async $mount(contract) { assert.equal(contract.descriptors[0].method, 'read');
      const parameter = contract.descriptors.find(item => item.method === 'preview').parameters[0];
      assert.equal(parameter.codec.mode, 'strict', 'Remote input requires a strict codec at activation');
      const schema = parameter.codec.create();
      const request = { preset: 'standard', providers: [], tools: ['read'], prompt: 'literal', model: '' };
      assert.equal(schema.parse(request).prompt, 'literal');
      for (const invalid of [null, {}, { ...request, providers: [1] }, { ...request, tools: 'read' }, { ...request, model: null }]) assert.throws(() => schema.parse(invalid));
      return () => {}; } }),
    effect: fn => fn(),
    locale: { addLanguage() {}, subscribe() { return () => {}; } },
    slots: {
      entriesOfSlot: () => [],
      subscribe: name => { subscriptions.push(name); return () => {}; },
      inject: (_name, fn) => fn(),
      register: options => { registrations.push(options); return () => {}; },
    },
  };
  await plugin.apply(ctx);
  assert.deepEqual(registrations.map(item => item.name), ['main', 'local.dsh-studio.services', 'sidebar.panellist']);
  assert.equal(registrations[0].key, 'local-dsh-studio');
  assert.equal(registrations[1].id, 'optimization-prototype');
  assert.equal(registrations[2].id, 'local-dsh-studio');
  assert.deepEqual(Object.keys(registrations[0].children), ['local.dsh-studio.services']);
  assert.deepEqual(subscriptions, ['local.dsh-studio.services']);
});
