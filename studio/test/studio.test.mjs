import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
for (const part of ['shell']) test(`${part} build exposes loader contract`, async () => {
  let loaded;
  vm.runInNewContext(await readFile(new URL(`../packages/${part}/client.js`, import.meta.url), 'utf8'), { window: { __ModuleLoader__: { load(value) { loaded = value; } } } });
  assert.equal(loaded.id, `@local/dsh-studio-${part}`);
  const module = loaded.factory(name => { assert.ok(['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-ui-slots'].includes(name)); return {}; });
  assert.equal(typeof module.apply, 'function'); assert.ok(module.inject.includes('slots'));
});
