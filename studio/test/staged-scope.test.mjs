/** Exercise staged-path restrictions in isolated Git indexes, including renames. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('../scripts/check-staged-scope.mjs', import.meta.url));
test('staged scope allows Studio and rejects core additions, deletions and renames', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'studio-scope-')));
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('GIT_') || key.startsWith('STUDIO_APPROV')) delete env[key];
  const git = (...args) => execFileSync('git', args, { cwd: dir, env, stdio: 'pipe' });
  const check = extra => spawnSync(process.execPath, [script], { cwd: dir, env: { ...env, ...extra }, encoding: 'utf8' });
  try {
    git('init');
    git('config', 'user.name', 'Scope test');
    git('config', 'user.email', 'scope@example.invalid');
    mkdirSync(join(dir, 'studio'));
    writeFileSync(join(dir, 'core.ts'), 'core\n');
    git('add', '.');
    git('-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'fixture');
    writeFileSync(join(dir, 'studio', 'draft.ts'), 'draft\n');
    git('add', '.');
    assert.equal(check().status, 0);
    writeFileSync(join(dir, 'outside.ts'), 'outside\n');
    git('add', '.');
    assert.equal(check().status, 1);
    assert.equal(check({ STUDIO_APPROVED_PATHS: '["outside.ts"]' }).status, 1);
    assert.equal(check({ STUDIO_APPROVED_PATHS: '["outside.ts"]', STUDIO_APPROVAL_REASON: 'Fixture explicit approval' }).status, 0);
    git('reset', '--', 'outside.ts');
    git('mv', 'core.ts', 'studio/core.ts');
    assert.equal(check().status, 1, 'moving core into Studio must not evade the guard');
    git('reset', '--hard', 'HEAD');
    git('rm', 'core.ts');
    assert.equal(check().status, 1, 'core deletion must be rejected');
    assert.equal(check({ STUDIO_APPROVED_PATHS: '["*"]', STUDIO_APPROVAL_REASON: 'No wildcard' }).status, 1);
  } finally {
    assert.ok(dir.startsWith(join(realpathSync(tmpdir()), 'studio-scope-')));
    rmSync(dir, { recursive: true, force: true });
  }
});
