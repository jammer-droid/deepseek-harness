/** Deployment planning and failure containment without installing into a user profile. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { parseOptions, deploy } from '../deploy-web.mjs';

test('requires explicit absolute home and rejects profile/launcher overrides', () => {
  for (const args of [[], ['--home'], ['--home', 'relative'], ['--profile', 'desktop'], ['--home', '/tmp/a', '--home', '/tmp/b'], ['--dsh', 'dsh']]) {
    assert.throws(() => parseOptions(args));
  }
  assert.deepEqual(parseOptions(['--home', '/tmp/studio web', '--dry-run']), { home: '/tmp/studio web', dryRun: true });
  assert.deepEqual(parseOptions(['--help']), { help: true });
});

test('dry run invokes no build or install operation', async () => {
  await deploy({ home: '/tmp/studio-preview', dryRun: true }, () => assert.fail('dry run executed a command'));
});

test('ordered deployment fixes the web profile and uses a distinct release path', async () => {
  const calls = [];
  await deploy({ home: '/tmp/studio-test-not-installed', dryRun: false }, (...args) => calls.push(args));
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0][1], ['run', 'build']);
  assert.match(calls[1][1][0], /pack\.mjs$/);
  assert.deepEqual(calls[2][1].slice(0, 7), ['--import', 'tsx/esm', 'apps/cli/src/bin.ts', 'plugin', '--profile', 'web', 'add']);
  assert.ok(calls[2][1][7].startsWith(calls[1][2].env.STUDIO_PACK_DIST + path.sep));
  assert.equal(calls[2][2].env.DSH_HOME, '/tmp/studio-test-not-installed');
  assert.equal(calls[2][2].env.STUDIO_RUNTIME_VERSION, undefined);
  assert.equal(calls[2][2].env.DSH_PROFILE, undefined);
});

test('build or packaging failure prevents later deployment steps', async () => {
  for (const failAt of [1, 2, 3]) {
    let calls = 0;
    await assert.rejects(deploy({ home: '/tmp/studio-test-not-installed', dryRun: false }, () => {
      if (++calls === failAt) throw new Error('step failed');
    }), /step failed/);
    assert.equal(calls, failAt);
  }
});
