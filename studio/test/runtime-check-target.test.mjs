import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { runtimeCheckTarget } from '../scripts/runtime-check-target.mjs';
const env = { STUDIO_TEST_ISOLATED: '1', STUDIO_TEST_PORT: '19389' };
const url = 'http://127.0.0.1:19389/?token=test-only';
test('accepts an explicitly selected isolated non-default port', () => {
  assert.equal(runtimeCheckTarget(url, env).port, '19389');
});
test('rejects missing acknowledgement, wrong port, remote hosts and missing token', () => {
  for (const [target, config] of [
    [url, {}], [url, { ...env, STUDIO_TEST_ISOLATED: '0' }],
    [url, { ...env, STUDIO_TEST_PORT: '19388' }], [url, { ...env, STUDIO_TEST_PORT: '0' }],
    [url.replace('127.0.0.1', 'example.com'), env], [url.replace('http:', 'https:'), env],
    ['http://127.0.0.1:19389/', env], ['http://user@127.0.0.1:19389/?token=x', env],
  ]) assert.throws(() => runtimeCheckTarget(target, config));
});
test('every mutating smoke entry refuses an unacknowledged target before network access', () => {
  for (const name of ['web', 'master', 'optimized', 'session-roles', 'role']) {
    const result = spawnSync(process.execPath, [new URL(`../scripts/check-${name}-runtime.mjs`, import.meta.url).pathname, url],
      { encoding: 'utf8', env: { ...process.env, STUDIO_TEST_ISOLATED: '0' } });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /STUDIO_TEST_ISOLATED/);
  }
});
