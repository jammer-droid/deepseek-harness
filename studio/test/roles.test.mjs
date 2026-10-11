import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain';
import { MemoryStorageBackend, MemoryMediaPool } from '../../packages/storage/storage-domain/tests/helpers/memory-backend.ts';
import { RoleSettings } from '../src/host/roles.ts';

const roles = {
  implementer: { instructions: 'Implement the requested change.', provider: 'test', model: 'model', reasoningEffort: 'high' },
  reviewer: { instructions: 'Review without changing files.', provider: 'test', model: 'model', reasoningEffort: 'high' },
};
async function fixture(pool = new MemoryMediaPool()) {
  const ctx = new Context();
  await ctx.plugin(Storage);
  ctx.storage.backend.register('memory', new MemoryStorageBackend(pool));
  const storageDomain = new DomainFacility(ctx, { backend: 'memory', routes: {} });
  const llm = {
    async listModels() { return [{ id: 'model' }]; },
    async resolveCallConfig(route) { return route; },
  };
  const service = await RoleSettings.open({ storageDomain, llm, profile: 'web' });
  return { service, pool, llm, async close() { await service.close(); await ctx.fiber.dispose(); } };
}

test('Unsupported model or effort is refused without changing saved roles', async () => {
  const f = await fixture();
  f.llm.resolveCallConfig = async () => { throw new Error('UNSUPPORTED_REASONING_EFFORT'); };
  await assert.rejects(f.service.apply({ expectedProcessId: f.service.describe().processId, expectedRevision: 0, expectedSnapshotId: null, roles }), /UNSUPPORTED_REASONING_EFFORT/);
  assert.equal(f.service.describe().snapshotId, null);
  assert.throws(() => f.service.capture('reviewer'), /roles-not-applied/);
  await f.close();
});

test('A saved setting whose runtime revalidation fails blocks new captures and is recoverable after restart', async () => {
  const f = await fixture();
  let calls = 0;
  f.llm.resolveCallConfig = async route => { if (++calls > 2) throw new Error('provider-unavailable'); return route; };
  const state = await f.service.apply({ expectedProcessId: f.service.describe().processId, expectedRevision: 0, expectedSnapshotId: null, roles });
  assert.equal(state.status, 'apply-failed');
  assert.ok(state.snapshotId);
  assert.equal(state.appliedSnapshotId, null);
  assert.throws(() => f.service.capture('implementer'), /roles-not-applied/);
  await f.close();
  const restored = await fixture(f.pool);
  assert.equal(restored.service.describe().status, 'applied');
  await restored.close();
});

test('Concurrent stale revisions cannot overwrite an applied snapshot', async () => {
  const f = await fixture();
  const request = { expectedProcessId: f.service.describe().processId, expectedRevision: 0, expectedSnapshotId: null, roles };
  const results = await Promise.allSettled([f.service.apply(request), f.service.apply(request)]);
  assert.deepEqual(results.map(result => result.status), ['fulfilled', 'rejected']);
  const original = f.service.capture('implementer');
  const state = f.service.describe();
  await f.service.apply({ expectedProcessId: state.processId, expectedRevision: state.revision, expectedSnapshotId: state.snapshotId, roles: { ...roles, implementer: { ...roles.implementer, instructions: 'Changed instructions.' } } });
  assert.equal(original.settings.instructions, 'Implement the requested change.');
  await f.close();
});

test('An obsolete process token cannot Apply after an empty profile restart', async () => {
  const first = await fixture();
  const stale = first.service.describe();
  await first.close();
  const second = await fixture(first.pool);
  await assert.rejects(second.service.apply({ expectedProcessId: stale.processId, expectedRevision: stale.revision, expectedSnapshotId: stale.snapshotId, roles }), /revision-conflict/);
  await second.close();
});

test('Unknown models are not silently substituted', async () => {
  const f = await fixture();
  f.llm.listModels = async () => [];
  await assert.rejects(f.service.apply({ expectedProcessId: f.service.describe().processId, expectedRevision: 0, expectedSnapshotId: null, roles }), /unsupported-model/);
  assert.equal(f.service.describe().snapshotId, null);
  await f.close();
});

test('Save rejection preserves the previous applied snapshot', async () => {
  const f = await fixture();
  const initial = f.service.describe();
  const saved = await f.service.apply({ expectedProcessId: initial.processId, expectedRevision: initial.revision, expectedSnapshotId: initial.snapshotId, roles });
  f.pool.failNextWrites = 1;
  await assert.rejects(f.service.apply({ expectedProcessId: saved.processId, expectedRevision: saved.revision, expectedSnapshotId: saved.snapshotId, roles }), /injected write failure/);
  assert.deepEqual(f.service.describe(), saved);
  assert.equal(f.service.capture('implementer').snapshotId, saved.snapshotId);
  await f.close();
});

test('Close rejects new execution and Apply requests', async () => {
  const f = await fixture();
  const state = f.service.describe();
  await f.close();
  await assert.rejects(f.service.apply({ expectedProcessId: state.processId, expectedRevision: state.revision, expectedSnapshotId: state.snapshotId, roles }), /roles-closed/);
});

test('Close drains an admitted Apply before releasing storage', async () => {
  const f = await fixture();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  f.llm.resolveCallConfig = async route => { await gate; return route; };
  const initial = f.service.describe();
  const applying = f.service.apply({ expectedProcessId: initial.processId, expectedRevision: initial.revision, expectedSnapshotId: initial.snapshotId, roles });
  let closed = false;
  const closing = f.close().then(() => { closed = true; });
  await Promise.resolve();
  assert.equal(closed, false);
  release();
  const result = await applying;
  assert.equal(result.status, 'applied');
  await closing;
  assert.throws(() => f.service.capture('implementer'), /roles-closed/);
});

test('An initialization save failure releases the domain for a subsequent open', async () => {
  const ctx = new Context();
  await ctx.plugin(Storage);
  const pool = new MemoryMediaPool();
  ctx.storage.backend.register('memory', new MemoryStorageBackend(pool));
  const storageDomain = new DomainFacility(ctx, { backend: 'memory', routes: {} });
  const llm = { async listModels() { return []; }, async resolveCallConfig(route) { return route; } };
  pool.failNextWrites = 1;
  await assert.rejects(RoleSettings.open({ storageDomain, llm, profile: 'web' }), /injected write failure/);
  const service = await RoleSettings.open({ storageDomain, llm, profile: 'web' });
  assert.equal(service.describe().status, 'unconfigured');
  await service.close(); await ctx.fiber.dispose();
});

test('Apply persists fixed roles and restart restores the same durable snapshot', async () => {
  const first = await fixture();
  const before = first.service.describe();
  assert.equal(before.status, 'unconfigured');
  const applied = await first.service.apply({ expectedProcessId: before.processId, expectedRevision: before.revision, expectedSnapshotId: null, roles });
  assert.equal(applied.status, 'applied');
  assert.deepEqual(first.service.capture('implementer').settings, roles.implementer);
  await first.close();
  const second = await fixture(first.pool);
  assert.equal(second.service.describe().snapshotId, applied.snapshotId);
  assert.equal(second.service.describe().status, 'applied');
  assert.deepEqual(second.service.capture('reviewer').settings, roles.reviewer);
  await second.close();
});
