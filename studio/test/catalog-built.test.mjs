import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import yaml from 'js-yaml';

test('distribution excludes the preserved catalog experiment and its preset', async () => {
  const read = path => readFile(new URL(path, import.meta.url), 'utf8');
  const entries = yaml.load(await read('../packages/bundle/cordis.patch.yml'))[0].insert;
  assert.ok(!entries.some(entry => entry.name === '@local/dsh-studio-sub-agent-catalog' || entry.config?.id === 'studio-composed-roles'));
  const manifest = JSON.parse(await read('../packages/bundle/package.json'));
  assert.ok(!('@local/dsh-studio-sub-agent-catalog' in manifest.dependencies));
  for (const file of ['../build.mjs', '../build-desktop.mjs', '../pack.mjs', '../src/experiments.tsx', '../src/shell.tsx']) {
    assert.doesNotMatch(await read(file), /sub-agent-catalog|CatalogToggle|role-catalog-toggle/);
  }
  assert.ok(entries.some(entry => entry.name === '@local/dsh-studio-experiments'));
  assert.match(await read('../packages/sub-agent-catalog/src/index.ts'), /startActivation/);
});
