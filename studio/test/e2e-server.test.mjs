import assert from 'node:assert/strict';
import test from 'node:test';
import { findServerUrl, parseArgs, parseDuration, pluginSpecs, redactUrl, supportedVersions } from '../scripts/e2e/server-lib.mjs';

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
