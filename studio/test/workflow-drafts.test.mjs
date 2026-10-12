/** Real storage domain verifies document ownership across profile restarts. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import { z } from 'zod';
import { DomainFacility, defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain';
import { MemoryStorageBackend, MemoryMediaPool } from '../../packages/storage/storage-domain/tests/helpers/memory-backend.ts';
import { ComponentRegistry, instructionsDefinition } from '../packages/workflows/src/component-registry.ts';
import { DraftStore } from '../packages/workflows/src/drafts.ts';
async function fixture(pool = new MemoryMediaPool(), profile = 'web') {
  const ctx = new Context();
  await ctx.plugin(Storage);
  ctx.storage.backend.register('memory', new MemoryStorageBackend(pool));
  const facility = new DomainFacility(ctx, { backend: 'memory', routes: {} });
  const registry = new ComponentRegistry();
  registry.register(instructionsDefinition);
  const store = await DraftStore.open(facility, profile);
  return { store, pool, registry, async close() { await store.close(); await ctx.fiber.dispose(); } };
}
test('Local usage flags and retained connections survive save and reopen', async () => {
  const pool = new MemoryMediaPool();
  const first = await fixture(pool);
  const document = { documentVersion: 3, name: 'Disabled', mainRoleId: 'main', roles: [{ id: 'main', name: 'Main', components: [{ instanceId: 'c', id: 'missing', version: 1, scope: 'role', enabled: false, config: { text: 'Keep' } }] }], systems: [{ instanceId: 's', id: 'missing-system', version: 1, scope: 'workflow', executionLocation: 'dsh', enabled: false, config: { keep: true } }], connections: [{ id: 'wire', from: { kind: 'component', instanceId: 'c', portId: 'out' }, to: { kind: 'system', instanceId: 's', portId: 'in' } }] };
  await first.store.save({ id: randomUUID(), expectedRevision: 0, document });
  await first.close();
  const second = await fixture(pool);
  assert.deepEqual(second.store.list()[0].document, document);
  await second.close();
});

test('Legacy reads normalize deterministically without changing persisted revision or writing', async () => {
  const pool = new MemoryMediaPool();
  const ctx = new Context(); await ctx.plugin(Storage);
  ctx.storage.backend.register('memory', new MemoryStorageBackend(pool));
  const facility = new DomainFacility(ctx, { backend: 'memory', routes: {} });
  const legacy = defineDomain({ name: 'studio_workflow_drafts', version: 1, tables: { profiles: domainTable(z.object({ drafts: z.array(z.json()) })) } });
  const domain = await facility.open(legacy);
  const id = '550e8400-e29b-41d4-a716-446655440000';
  const document = { name: 'Old', mainRole: { name: 'Main', components: [{ id: 'future', version: 3, scope: 'role', config: { nested: [null, true] } }, { id: 'future', version: 3, scope: 'role', config: {} }] } };
  await domain.table('profiles').put('web', { drafts: [{ id, revision: 7, document }] });
  await domain.close(); await ctx.fiber.dispose();
  const first = await fixture(pool);
  pool.failNextWrites = 1;
  const normalized = first.store.list()[0];
  assert.deepEqual(first.store.list()[0], normalized);
  assert.equal(pool.failNextWrites, 1);
  pool.failNextWrites = 0;
  assert.equal(normalized.document.documentVersion, 3);
  assert.equal(normalized.document.mainRoleId, normalized.document.roles[0].id);
  assert.equal(normalized.document.roles[0].model, undefined);
  assert.deepEqual(normalized.document.systems, []);
  assert.equal(normalized.revision, 7);
  assert.notEqual(normalized.document.roles[0].components[0].instanceId, normalized.document.roles[0].components[1].instanceId);
  await first.close();
  const inspectionContext = new Context(); await inspectionContext.plugin(Storage);
  inspectionContext.storage.backend.register('memory', new MemoryStorageBackend(pool));
  const inspectionFacility = new DomainFacility(inspectionContext, { backend: 'memory', routes: {} });
  const raw = await inspectionFacility.open(legacy);
  assert.deepEqual(raw.table('profiles').get('web'), { drafts: [{ id, revision: 7, document }] });
  await raw.close(); await inspectionContext.fiber.dispose();
  const second = await fixture(pool);
  try {
    assert.deepEqual(second.store.list()[0], normalized);
    normalized.document.roles[0].components.reverse();
    const saved = await second.store.save({ id, expectedRevision: 7, document: normalized.document });
    assert.equal(saved.revision, 8);
    assert.deepEqual(saved.document, normalized.document);
  } finally { await second.close(); }
});

test('Version two reads preserve stable instances and configuration until explicit save', async () => {
  const pool = new MemoryMediaPool(); const ctx = new Context(); await ctx.plugin(Storage);
  ctx.storage.backend.register('memory', new MemoryStorageBackend(pool));
  const facility = new DomainFacility(ctx, { backend: 'memory', routes: {} });
  const raw = await facility.open(defineDomain({ name: 'studio_workflow_drafts', version: 1, tables: { profiles: domainTable(z.json()) } }));
  const document = { documentVersion: 2, name: 'Preserved', mainRole: { name: 'Author', components: [{ instanceId: 'stable', id: 'unknown', version: 8, scope: 'custom', config: { nested: [true, null] } }] }, systems: [], connections: [{ id: 'stale', from: { kind: 'component', instanceId: 'stable', portId: 'out' }, to: { kind: 'system', instanceId: 'deleted', portId: 'in' } }] };
  const id = '550e8400-e29b-41d4-a716-446655440000';
  await raw.table('profiles').put('web', { drafts: [{ id, revision: 4, document }] });
  await raw.close(); await ctx.fiber.dispose();
  const f = await fixture(pool);
  try {
    const migrated = f.store.list()[0];
    assert.deepEqual(migrated.document.roles, [{ id: `legacy:${id}:role:main`, ...document.mainRole }]);
    assert.equal(migrated.document.initialModel, undefined);
    assert.deepEqual(migrated.document.connections, document.connections);
    const saved = await f.store.save({ id, expectedRevision: 4, document: migrated.document });
    assert.equal(saved.revision, 5); assert.equal(saved.document.documentVersion, 3);
  } finally { await f.close(); }
});

test('Duplicate role and cross-role component identities cannot overwrite saved content', async () => {
  const f = await fixture();
  try {
    const candidate = request('Kept'); const saved = await f.store.save(candidate);
    for (const duplicateRole of [true, false]) {
      const document = structuredClone(candidate.document); const role = structuredClone(document.roles[0]);
      if (!duplicateRole) role.id = 'another'; else role.components = [];
      document.roles.push(role);
      await assert.rejects(f.store.save({ ...candidate, expectedRevision: 1, document }), error => error.reason === 'invalid-document');
      assert.deepEqual(f.store.list(), [saved]);
    }
  } finally { await f.close(); }
});

test('Malformed durable documents fail opening instead of becoming empty drafts', async () => {
  const pool = new MemoryMediaPool(); const ctx = new Context(); await ctx.plugin(Storage);
  ctx.storage.backend.register('memory', new MemoryStorageBackend(pool));
  const facility = new DomainFacility(ctx, { backend: 'memory', routes: {} });
  const raw = await facility.open(defineDomain({ name: 'studio_workflow_drafts', version: 1, tables: { profiles: domainTable(z.json()) } }));
  await raw.table('profiles').put('web', { drafts: [{ id: '550e8400-e29b-41d4-a716-446655440000', revision: 1, document: { broken: true } }] });
  await raw.close();
  await assert.rejects(DraftStore.open(facility, 'web'));
  await ctx.fiber.dispose();
});

test('Malformed wire documents and duplicate stable identities cannot overwrite saved content', async () => {
  const f = await fixture();
  try {
    const candidate = request('Kept'); const saved = await f.store.save(candidate);
    for (const mutate of [d => { delete d.documentVersion; }, d => { d.roles[0].components.push({ ...d.roles[0].components[0] }); }, d => { d.connections = [{ id: 'c', from: { kind: 'alien', instanceId: 'x', portId: 'p' }, to: { kind: 'system', instanceId: 's', portId: 'p' } }]; }, d => { d.unrecognized = true; }]) {
      const document = structuredClone(candidate.document); mutate(document);
      await assert.rejects(f.store.save({ ...candidate, expectedRevision: 1, document }), error => error.reason === 'invalid-document');
      assert.deepEqual(f.store.list(), [saved]);
    }
    const document = structuredClone(candidate.document);
    document.systems = [{ instanceId: 'system', id: 'missing', version: 99, scope: 'unsupported', executionLocation: 'elsewhere', config: { nested: [null, { ok: true }] } }];
    document.connections = [{ id: 'dangling', from: { kind: 'component', instanceId: 'deleted', portId: 'out' }, to: { kind: 'system', instanceId: 'system', portId: 'in' } }];
    assert.deepEqual((await f.store.save({ ...candidate, expectedRevision: 1, document })).document, document);
  } finally { await f.close(); }
});

test('Recovery reads observe admitted saves and optional fields may be absent', async () => {
  const f = await fixture();
  try {
    f.registry.register({ id: 'optional', version: 1, scope: 'role', fields: [{ key: 'note', kind: 'text', required: false }] });
    const candidate = request('Optional');
    candidate.document.roles[0].components.push({ instanceId: 'optional-1', id: 'optional', version: 1, scope: 'role', config: {} });
    const saving = f.store.save(candidate);
    assert.deepEqual(await f.store.read(), [await saving]);
    candidate.document.roles[0].components[1].config.note = 42;
    assert.equal((await f.store.save({ ...candidate, expectedRevision: 1 })).document.roles[0].components[1].config.note, 42);
  } finally { await f.close(); }
});

test('Failed durability suspends queued writes and reopening recovers confirmed state', async () => {
  const f = await fixture();
  const before = await f.store.save(request('Before'));
  f.pool.failNextWrites = 1;
  const results = await Promise.allSettled([f.store.save(request('Failed')), f.store.save(request('Queued'))]);
  assert.deepEqual(results.map(item => item.reason?.reason), ['storage-uncertain', 'storage-uncertain']);
  assert.throws(() => f.store.list(), error => error.reason === 'storage-uncertain');
  await f.close();
  const reopened = await fixture(f.pool);
  try { assert.deepEqual(reopened.store.list(), [before]); await reopened.store.save(request('Recovered')); }
  finally { await reopened.close(); }
});

test('Closing drains accepted writes and rejects later saves', async () => {
  const f = await fixture();
  const accepted = f.store.save(request('Accepted'));
  const closing = f.close();
  await assert.rejects(f.store.save(request('Late')), error => error.reason === 'closed');
  const stored = await accepted;
  await closing;
  const reopened = await fixture(f.pool);
  try { assert.deepEqual(reopened.store.list(), [stored]); } finally { await reopened.close(); }
});

test('Unknown versions and nested JSON survive saving and reopening', async () => {
  const f = await fixture();
  const candidate = request('Unknown');
  candidate.document.roles[0].components.push({ instanceId: 'future-1', id: 'future.component', scope: 'role', version: 42, config: { nested: [null, true, 3, { key: 'value' }] } });
  const saved = await f.store.save(candidate);
  saved.document.roles[0].components[1].config.nested[3].key = 'mutated return';
  assert.deepEqual(f.store.list()[0].document, candidate.document);
  await f.close();
  const reopened = await fixture(f.pool);
  try { assert.deepEqual(reopened.store.list()[0].document, candidate.document); }
  finally { await reopened.close(); }
});

function request(name) { return { id: randomUUID(), expectedRevision: 0, document: { documentVersion: 3, systems: [], connections: [], name, mainRoleId: 'main', roles: [{ id: 'main', name: 'Main', components: [{ ...instructionsDefinition, instanceId: randomUUID(), fields: undefined, config: { text: name } }].map(({ fields, ...instance }) => instance) }] } }; }

test('Multiple drafts survive reopening and stay isolated from another profile', async () => {
  const first = await fixture();
  const a = await first.store.save(request('First'));
  const b = await first.store.save(request('Second'));
  assert.equal(first.store.list().length, 2);
  await first.close();
  const other = await fixture(first.pool, 'desktop');
  assert.deepEqual(other.store.list(), []);
  await other.close();
  const reopened = await fixture(first.pool);
  try { assert.deepEqual(reopened.store.list(), [a, b]); } finally { await reopened.close(); }
});

test('Concurrent stale saves cannot overwrite and separate drafts do not conflict', async () => {
  const f = await fixture();
  try {
    const create = request('A');
    const results = await Promise.allSettled([f.store.save(create), f.store.save(create)]);
    assert.deepEqual(results.map(item => item.status), ['fulfilled', 'rejected']);
    assert.equal(results[1].reason.reason, 'revision-conflict');
    await f.store.save(request('B'));
    const updated = await f.store.save({ ...create, expectedRevision: 1, document: { ...create.document, name: 'Updated' } });
    assert.equal(updated.revision, 2);
    assert.equal(f.store.list().length, 2);
  } finally { await f.close(); }
});
