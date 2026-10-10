import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { remoteManager, createController, DEMO_PACKAGE, DEMO_PATCH } from '../src/controller.ts';
import { createTimer } from '../src/timer.ts';
const row = { moduleName: DEMO_PACKAGE, patchId: DEMO_PATCH, entryId: 'actual:resolved-id', enabled: false, fiberPhase: null };

test('real Remote envelope is unwrapped for reads and writes', async () => {
  let current = { ...row };
  const controller = createController(remoteManager({
    listPlugins: async () => ({ ok: true, value: [current] }),
    setPluginEnabled: async (id, enabled) => {
      assert.equal(id, row.entryId); current = { ...current, enabled };
      return { ok: true, value: { application: 'applied' } };
    },
  }));
  await controller.refresh(); await controller.toggle();
  assert.equal(controller.getSnapshot().row.enabled, true);
  assert.match(controller.getSnapshot().notice, /적용/);
});
test('Remote failure clears stale state instead of reporting OFF', async () => {
  let fail = false;
  const controller = createController(remoteManager({ listPlugins: async () => fail ? { ok: false, error: 'disconnected' } : { ok: true, value: [row] } }));
  await controller.refresh(); fail = true; await controller.refresh();
  assert.equal(controller.getSnapshot().row, null);
  assert.match(controller.getSnapshot().error, /disconnected/);
});

test('timer owns exactly one interval and disposes idempotently', () => {
  let callback, cleared = 0, time = 1000, notices = 0;
  const timer = createTimer({ now: () => time, setInterval(fn, delay) { assert.equal(delay, 1000); callback = fn; return 42; }, clearInterval(id) { assert.equal(id, 42); cleared++; } });
  timer.subscribe(() => notices++);
  time = 4000; callback(); assert.equal(timer.getSnapshot(), 3); assert.equal(notices, 1);
  timer.dispose(); timer.dispose(); callback(); assert.equal(cleared, 1); assert.equal(notices, 1);
});
test('toggle uses resolved identity and rereads persisted state', async () => {
  let current = { ...row }, calls = 0;
  const controller = createController({ listPlugins: async () => [current], async setPluginEnabled(id, enabled) { calls++; assert.equal(id, row.entryId); current = { ...current, enabled, fiberPhase: 'active' }; return { application: 'applied' }; } });
  await controller.refresh(); await controller.toggle();
  assert.equal(calls, 1); assert.equal(controller.getSnapshot().row.enabled, true);
  assert.equal(controller.getSnapshot().busy, false);
});
test('ambiguous entries fail closed', async () => {
  const controller = createController({ listPlugins: async () => [row, row], setPluginEnabled() { throw Error('must not call'); } });
  await controller.refresh(); await controller.toggle(); assert.equal(controller.getSnapshot().row, null);
});
test('late responses cannot overwrite newer state', async () => {
  let resolve; let calls = 0;
  const controller = createController({ listPlugins() { return ++calls === 1 ? new Promise(r => resolve = r) : Promise.resolve([{ ...row, enabled: true }]); } });
  const first = controller.refresh(); await controller.refresh(); resolve([row]); await first;
  assert.equal(controller.getSnapshot().row.enabled, true);
});
test('disposed controller ignores pending loads', async () => {
  let resolve; const controller = createController({ listPlugins: () => new Promise(r => resolve = r) });
  const pending = controller.refresh(); controller.dispose(); resolve([row]); await pending;
  assert.equal(controller.getSnapshot().row, null);
});
test('restart requirement is visible, not represented as active', async () => {
  const controller = createController({ listPlugins: async () => [row], setPluginEnabled: async () => ({ application: 'restart-required' }) });
  await controller.refresh(); await controller.toggle(); assert.match(controller.getSnapshot().notice, /재시작/); assert.equal(controller.getSnapshot().row.fiberPhase, null);
});
for (const part of ['shell', 'demo']) test(`${part} build exposes loader contract`, async () => {
  let loaded;
  vm.runInNewContext(await readFile(new URL(`../packages/${part}/client.js`, import.meta.url), 'utf8'), { window: { __ModuleLoader__: { load(value) { loaded = value; } } } });
  assert.equal(loaded.id, `@local/dsh-studio-${part}`);
  const module = loaded.factory(name => { assert.ok(['react', 'react/jsx-runtime'].includes(name)); return {}; });
  assert.equal(typeof module.apply, 'function'); assert.ok(module.inject.includes('slots'));
});
