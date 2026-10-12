/** Real storage domain verifies document ownership across profile restarts. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain';
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
  const store = await DraftStore.open(facility, profile, registry);
  return { store, pool, registry, async close() { await store.close(); await ctx.fiber.dispose(); } };
}
test('Recovery reads observe admitted saves and optional fields may be absent', async () => {
  const f = await fixture();
  try {
    f.registry.register({ id: 'optional', version: 1, scope: 'role', fields: [{ key: 'note', kind: 'text', required: false }] });
    const candidate = request('Optional');
    candidate.document.mainRole.components.push({ id: 'optional', version: 1, scope: 'role', config: {} });
    const saving = f.store.save(candidate);
    assert.deepEqual(await f.store.read(), [await saving]);
    candidate.document.mainRole.components[1].config.note = 42;
    await assert.rejects(f.store.save({ ...candidate, expectedRevision: 1 }), error => error.reason === 'invalid-document');
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
  candidate.document.mainRole.components.push({ id: 'future.component', scope: 'role', version: 42, config: { nested: [null, true, 3, { key: 'value' }] } });
  const saved = await f.store.save(candidate);
  saved.document.mainRole.components[1].config.nested[3].key = 'mutated return';
  assert.deepEqual(f.store.list()[0].document, candidate.document);
  await f.close();
  const reopened = await fixture(f.pool);
  try { assert.deepEqual(reopened.store.list()[0].document, candidate.document); }
  finally { await reopened.close(); }
});

function request(name) { return { id: randomUUID(), expectedRevision: 0, document: { name, mainRole: { name: 'Main', components: [{ ...instructionsDefinition, fields: undefined, config: { text: name } }].map(({ fields, ...instance }) => instance) } } }; }

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
