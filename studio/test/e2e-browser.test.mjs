import assert from 'node:assert/strict';
import test from 'node:test';
import { PLUGIN_FAILURE, errorLine, parseView, pickPlaywright, shotName, summarize } from '../scripts/e2e/browser-lib.mjs';

test('pickPlaywright prefers the newest stable playwright and skips core and prereleases', () => {
  const entries = ['playwright-core@1.61.1', 'playwright@1.9.0', 'playwright@1.61.1', 'playwright@1.63.0-alpha-2026-08-31', 'zod@3.0.0'];
  assert.equal(pickPlaywright(entries), 'playwright@1.61.1');
  assert.equal(pickPlaywright(['zod@3.0.0']), undefined);
});

test('parseView reads theme, width and height', () => {
  assert.deepEqual(parseView('light'), { theme: 'light', width: 1440, height: 900 });
  assert.deepEqual(parseView('dark@480'), { theme: 'dark', width: 480, height: 900 });
  assert.deepEqual(parseView('dark@1280x720'), { theme: 'dark', width: 1280, height: 720 });
  assert.throws(() => parseView('sepia'), /Invalid view/);
});

test('shotName is file-safe and view-tagged', () => {
  assert.equal(shotName('pixie tab/settings', { theme: 'dark', width: 480 }), 'pixie-tab-settings.dark-480.png');
});

test('summarize fails on failed checks, page errors or plugin activation failures', () => {
  const checks = [{ name: 'a', view: 'light-1440', ok: true }, { name: 'b', view: 'light-1440', ok: false, error: 'x' }];
  const failed = summarize({ checks });
  assert.equal(failed.ok, false);
  assert.equal(failed.level, 'L0');
  assert.deepEqual(failed.failures, [{ name: 'b', view: 'light-1440', error: 'x' }]);
  const passing = [{ name: 'a', view: 'light-1440', ok: true }];
  assert.equal(summarize({ checks: passing }).ok, true);
  assert.equal(summarize({ checks: passing, pageErrors: ['e', 'e'] }).pageErrors.length, 1);
  assert.equal(summarize({ checks: passing, pageErrors: ['e'] }).ok, false);
  assert.equal(summarize({ checks: passing, pluginFailures: ['web boot: 1 entry did not activate'] }).ok, false);
});

test('PLUGIN_FAILURE matches DSH activation failures and errorLine keeps the first line', () => {
  assert.ok(PLUGIN_FAILURE.test('web boot: 1 entry did not activate'));
  assert.ok(PLUGIN_FAILURE.test('Failed to load plugins'));
  assert.ok(!PLUGIN_FAILURE.test('플러그인'));
  assert.equal(errorLine(new Error('\u001b[2mlocator.click: Timeout\u001b[22m\nCall log: ...')), 'locator.click: Timeout');
});
