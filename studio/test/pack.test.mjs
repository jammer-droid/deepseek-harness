/** Packed bundle keeps native dependencies alongside local component archives. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
test('packed bundle preserves native dependencies and overrides only Studio components', () => {
  execFileSync(process.execPath, ['pack.mjs'], { cwd: root });
  const original = JSON.parse(readFileSync(new URL('../packages/bundle/package.json', import.meta.url)));
  const staged = JSON.parse(readFileSync(new URL('../dist/bundle/package.json', import.meta.url)));
  const packed = JSON.parse(execFileSync('tar', ['-xOf', `dist/local-dsh-studio-${original.version}.tgz`, 'package/package.json'], { cwd: root, encoding: 'utf8' }));
  assert.deepEqual(packed.dependencies, staged.dependencies);
  assert.deepEqual(Object.keys(packed.dependencies).sort(), Object.keys(original.dependencies).sort());
  for (const [name, value] of Object.entries(original.dependencies)) {
    if (name.startsWith('@local/dsh-studio-')) assert.match(packed.dependencies[name], /^file:.*\.tgz$/);
    else {
      assert.equal(value, 'workspace:*');
      assert.equal(packed.dependencies[name], original.peerDependencies['@deepseek-ai/dsh']);
    }
  }
});
