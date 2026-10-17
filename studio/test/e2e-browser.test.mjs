import assert from 'node:assert/strict';
import test from 'node:test';
import { ARIA_LIMIT, PLUGIN_FAILURE, errorLine, parseView, pickPlaywright, repairItem, repairsFrom, shotName, slug, summarize } from '../scripts/e2e/browser-lib.mjs';

test('repairItem builds one loop input with goal, selector and a capped snapshot', () => {
  const item = repairItem({ id: 'a.light-1440', name: 'Panel', goal: 'The Presets tab', selector: '[role=tab]', view: 'light-1440', error: 'Timeout', aria: 'x'.repeat(ARIA_LIMIT + 10) });
  assert.equal(item.id, 'a.light-1440');
  assert.equal(item.selector, '[role=tab]');
  assert.match(item.input, /^Goal: The Presets tab\n/);
  assert.match(item.input, /Failed selector: \[role=tab\]/);
  assert.match(item.input, /… \(cut\)$/);
  assert.ok(item.input.length < ARIA_LIMIT + 400);
});

test('repairsFrom applies only passed, changed outputs', () => {
  const map = { a: 'old-a', b: 'old-b', c: 'old-c', d: 'old-d' };
  const repairs = repairsFrom(map, [
    { id: 'a', status: 'passed', output: ' new-a ' },
    { id: 'b', status: 'escalated', output: 'new-b' },
    { id: 'c', status: 'passed', output: 'old-c' },
    { id: 'z', status: 'passed', output: 'new-z' },
  ]);
  assert.deepEqual(repairs, { 'old-a': 'new-a' });
});

test('slug keeps file-safe names', () => {
  assert.equal(slug('Studio panel opens'), 'Studio-panel-opens');
  assert.equal(slug('  '), 'step');
});

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

test('classifyRepairs covers every queued item and names each unresolved reason', async () => {
  const { classifyRepairs } = await import('../scripts/e2e/browser-lib.mjs');
  const map = { a: 'old-a', b: 'old-b', c: 'old-c', d: 'old-d' };
  const { repairs, unresolved } = classifyRepairs(map, [
    { id: 'a', status: 'passed', output: 'new-a' },
    { id: 'b', status: 'escalated', output: 'x' },
    { id: 'c', status: 'passed', output: ' old-c ' },
    { id: 'z', status: 'passed', output: 'new-z' },
  ]);
  assert.deepEqual(repairs, { 'old-a': 'new-a' });
  assert.deepEqual(unresolved.map(item => [item.id, item.reason]), [['b', 'not passed'], ['c', 'no new selector'], ['z', 'unknown id'], ['d', 'missing from results']]);
});
