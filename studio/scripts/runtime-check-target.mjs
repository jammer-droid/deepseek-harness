import assert from 'node:assert/strict';

/** Mutating smoke checks require an explicitly acknowledged disposable target. */
export function runtimeCheckTarget(raw, env = process.env) {
  assert.equal(env.STUDIO_TEST_ISOLATED, '1', 'Set STUDIO_TEST_ISOLATED=1 only for a disposable Studio test profile');
  const url = new URL(raw);
  assert.equal(url.protocol, 'http:');
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.username, '');
  assert.equal(url.password, '');
  const port = env.STUDIO_TEST_PORT;
  assert.match(port ?? '', /^\d+$/, 'Set STUDIO_TEST_PORT to the verified test server port');
  assert.ok(Number(port) > 0 && Number(port) <= 65535);
  assert.equal(url.port || '80', String(Number(port)), 'URL must match the explicitly selected test port');
  assert.ok(url.searchParams.get('token'), 'Use the complete authenticated URL from the test server');
  return url;
}
