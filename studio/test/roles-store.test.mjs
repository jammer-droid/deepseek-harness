import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoleStore } from '../src/roles-store.ts';
const state = { processId: 'process', revision: 0, snapshotId: null, appliedSnapshotId: null, roles: null, status: 'unconfigured' };
test('A reconnect supersedes late Apply confirmation and requery failure blocks stale status', async () => {
  let finish;
  let reads = 0;
  const store = createRoleStore({ describe: async () => { reads++; if (reads === 2) throw new Error('offline'); return state; }, apply: () => new Promise(resolve => { finish = resolve; }) }, 'en');
  await store.reload();
  const applying = store.apply({});
  store.reset();
  await Promise.resolve();
  finish({ ...state, status: 'applied', snapshotId: 'late' });
  await applying;
  assert.equal(store.getSnapshot().unavailable, true);
  assert.equal(store.getSnapshot().state.snapshotId, null);
  await store.reload();
  assert.equal(store.getSnapshot().unavailable, false);
  store.dispose();
});
test('Disposed stores reject new Apply and do not start reads', async () => {
  let calls = 0;
  const store = createRoleStore({ describe: async () => { calls++; return state; }, apply: async () => { calls++; return state; } }, 'en');
  store.dispose();
  await store.reload();
  await assert.rejects(store.apply({}), /roles-closed/);
  assert.equal(calls, 0);
});
