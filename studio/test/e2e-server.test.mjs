import assert from 'node:assert/strict';
import test from 'node:test';
import { credentialRefs, findServerUrl, parseArgs, parseDuration, pluginSpecs, redactUrl, supportedVersions } from '../scripts/e2e/server-lib.mjs';

test('parseArgs reads commands, repeatable plugins and inline values', () => {
  const options = parseArgs(['up', '--profile=e2e-a', '--port', '19420', '--plugin', 'a', '--plugin=b', '--with-desktop-plugins', '--timeout', '2m']);
  assert.equal(options.command, 'up');
  assert.equal(options.profile, 'e2e-a');
  assert.equal(options.port, 19420);
  assert.deepEqual(options.plugins, ['a', 'b']);
  assert.equal(options.desktopPlugins, true);
  assert.equal(options.timeoutMs, 120_000);
});

test('parseArgs refuses user profile names, bad ports and unknown flags', () => {
  for (const name of ['desktop', 'web', 'headless']) assert.throws(() => parseArgs(['up', '--profile', name]), /Refusing/);
  assert.throws(() => parseArgs(['up', '--port', '70000']), /port/);
  assert.throws(() => parseArgs(['up', '--profile', '../x']), /Invalid profile/);
  assert.throws(() => parseArgs(['up', '--nope']), /Unknown option/);
  assert.throws(() => parseArgs(['start']), /Usage/);
});

test('parseDuration accepts seconds, minutes and milliseconds', () => {
  assert.equal(parseDuration('90'), 90_000);
  assert.equal(parseDuration('15s'), 15_000);
  assert.equal(parseDuration('250ms'), 250);
  assert.throws(() => parseDuration('soon'), /Invalid duration/);
});

test('findServerUrl returns the URL for the selected port only', () => {
  const log = 'boot\ndsh web: http://127.0.0.1:19388/?token=old-Token_1\ndsh web: http://127.0.0.1:19411/?token=abc-DEF_9\n';
  assert.equal(findServerUrl(log, 19411), 'http://127.0.0.1:19411/?token=abc-DEF_9');
  assert.equal(findServerUrl(log), 'http://127.0.0.1:19388/?token=old-Token_1');
  assert.equal(findServerUrl(log, 19500), undefined);
});

test('pluginSpecs copies other plugins and never Studio', () => {
  const specs = pluginSpecs({ dependencies: {
    '@matamt-dbg/dsh-studio': '^0.6.1', '@local/dsh-studio-shell': 'file:/x.tgz',
    'dsh-plugin-subscriptions': 'file:/abs/subs.tgz', dshmarket: '^1.66.21',
  } });
  assert.deepEqual(specs, ['/abs/subs.tgz', 'dshmarket@^1.66.21']);
});

test('supportedVersions splits the peer range and redactUrl hides tokens', () => {
  assert.deepEqual(supportedVersions('0.2.0-rc.2 || 0.2.1-rc.2'), ['0.2.0-rc.2', '0.2.1-rc.2']);
  assert.equal(redactUrl('x http://127.0.0.1:1/?token=a-b_c y'), 'x http://127.0.0.1:1/?token=<redacted> y');
});

test('--with-secrets accepts known kinds only', () => {
  assert.deepEqual(parseArgs(['up', '--with-secrets', 'keys, subscriptions']).secrets, ['keys', 'subscriptions']);
  assert.throws(() => parseArgs(['up', '--with-secrets', 'keys,browser']), /Unknown secret kind/);
});

test('credentialRefs keeps API key refs and drops device and browser grants', () => {
  const filtered = credentialRefs({
    version: 1,
    records: { 'client-connection/browser-session': { kind: 'grant' }, 'deepseek-account-platform/device': { kind: 'grant' } },
    refs: { DEEPSEEK_API_KEY: 'a', TYPESAFE_API_KEY: 'b' },
  });
  assert.deepEqual(filtered, { version: 1, records: {}, refs: { DEEPSEEK_API_KEY: 'a', TYPESAFE_API_KEY: 'b' } });
  assert.deepEqual(credentialRefs(undefined).refs, {});
});

test('subscriptionSummary reports counts and earliest expiry without token values', async () => {
  const { subscriptionSummary } = await import('../scripts/e2e/server-lib.mjs');
  const now = Date.UTC(2026, 9, 17);
  const summary = subscriptionSummary({
    codex: { default: 'a', accounts: { a: { accessToken: 'secret', expiresAt: now + 90 * 60_000 }, b: { expiresAt: now + 30 * 60_000 } } },
    claude: { accounts: { c: { expiresAt: (now + 600 * 60_000) / 1000 } } },
    grok: { accounts: {} },
  }, now);
  assert.deepEqual(summary, { codex: { accounts: 2, expiresInMin: 30 }, claude: { accounts: 1, expiresInMin: 600 }, grok: { accounts: 0, expiresInMin: null } });
  assert.ok(!JSON.stringify(summary).includes('secret'));
});
