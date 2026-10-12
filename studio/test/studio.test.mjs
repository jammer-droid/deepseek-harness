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
  const languages = []; const effects = [];
  module.apply({
    locale: {
      addLanguage(language) { languages.push(language); return () => languages.splice(languages.indexOf(language), 1); },
      subscribe() { return () => {}; },
    },
    effect(dispose) { effects.push(dispose()); },
    slots: { subscribe() { return () => {}; }, inject() {}, entriesOfSlot() { return []; } },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(languages)), [{ id: 'ko', label: '한국어', fallback: 'en' }]);
  for (const dispose of effects) if (typeof dispose === 'function') dispose();
  assert.equal(languages.length, 0);
});
