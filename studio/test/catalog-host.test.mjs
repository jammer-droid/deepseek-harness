import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain';
import { MemoryStorageBackend, MemoryMediaPool } from '../../packages/storage/storage-domain/tests/helpers/memory-backend.ts';
import { catalogSpec } from '../packages/sub-agent-catalog/src/store.ts';
import { CatalogRemote } from '../packages/sub-agent-catalog/src/index.ts';
async function fixture(pool = new MemoryMediaPool(), start = async () => ({})) {
  const ctx = new Context();
  await ctx.plugin(Storage);
  ctx.storage.backend.register('memory', new MemoryStorageBackend(pool));
  const domain = await new DomainFacility(ctx, { backend: 'memory', routes: {} }).open(catalogSpec);
  const saved = { id: randomUUID(), revision: 1, document: { documentVersion: 3, name: 'Arbitrary workflow', mainRoleId: 'research', roles: [{ id: 'other', name: 'Not selected', components: [] }, { id: 'research', name: 'Research companion', model: { provider: 'exact-provider', model: 'exact-model', reasoningEffort: 'high' }, components: [{ instanceId: 'instructions', id: 'studio.instructions', version: 1, scope: 'role', config: { text: 'Verify sources' } }] }], systems: [], connections: [] } };
  for (const key of ['studioWorkflows', 'agents', 'subagents']) ctx.provide(key);
  const workflow = { drafts: async () => [saved], validate: async document => { assert.equal(document.roles.length, 1); assert.equal(document.roles[0].id, 'research'); assert.deepEqual(document.roles[0].components, []); return { valid: true, diagnostics: [] }; } };
  ctx.set('studioWorkflows', workflow);
  ctx.set('agents', { get: id => ({ id }) });
  const calls = [];
  ctx.set('subagents', { startActivation: async spec => { calls.push(spec); assert.ok(domain.table('children').get(spec.childId)); return start(spec); } });
  const service = new CatalogRemote(ctx, domain);
  const request = { parentId: 'parent', roleId: saved.id, revision: 1, task: 'Research a question', context: 'fresh' };
  return { ctx, domain, service, request, saved, calls, pool, workflow, close: () => ctx.fiber.dispose() };
}
test('native launch follows durable reservation and frozen role survives reopening', async () => {
  const f = await fixture();
  const { childId } = await f.service.launch(f.request);
  assert.equal(f.calls[0].request.persona, 'Verify sources');
  assert.equal(f.calls[0].delivery, 'parent');
  assert.deepEqual(await f.service.roles(), [{ id: f.saved.id, name: 'Arbitrary workflow', roleName: 'Research companion', revision: 1 }]);
  assert.deepEqual(f.calls[0].request.agentOptions, f.saved.document.roles[1].model);
  f.saved.document.roles[1].name = 'Edited later';
  f.saved.document.roles[1].model.model = 'Edited model';
  const original = await f.service.assignments('parent');
  assert.equal(original[0].role.name, 'Research companion');
  assert.equal(original[0].childId, childId);
  await f.close();
  const next = await fixture(f.pool);
  try { assert.deepEqual(await next.service.assignments('parent'), original); assert.deepEqual(await next.service.assignments('another'), []); }
  finally { await next.close(); }
});
test('stale revision and cancelled model calls never reserve or spawn', async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.service.launch({ ...f.request, revision: 2 }), /revision-conflict/);
    await assert.rejects(f.service.launchForAgent(f.request, AbortSignal.abort()), /abort/i);
    assert.equal(f.calls.length, 0);
    assert.deepEqual(await f.service.assignments('parent'), []);
  } finally { await f.close(); }
});
test('model validation failures refuse before reservation without poisoning admission', async () => {
  const f = await fixture();
  try {
    const validate = f.workflow.validate;
    f.workflow.validate = async () => ({ valid: false, diagnostics: [{ code: 'unsupported-reasoning' }] });
    await assert.rejects(f.service.launch(f.request), /invalid-component/);
    f.workflow.validate = async () => { throw new Error('model lookup failed'); };
    await assert.rejects(f.service.launch(f.request), /model lookup failed/);
    assert.equal(f.calls.length, 0);
    assert.deepEqual(await f.service.assignments('parent'), []);
    f.workflow.validate = validate;
    await f.service.launch(f.request);
    assert.equal(f.calls.length, 1);
  } finally { await f.close(); }
});
test('failed durable reservation never starts a child and closes admission', async () => {
  const f = await fixture();
  try {
    f.pool.failNextWrites = 1;
    await assert.rejects(f.service.launch(f.request), /admission-unknown/);
    assert.equal(f.calls.length, 0);
    await assert.rejects(f.service.launch(f.request), /admission-unavailable/);
  } finally { await f.close(); }
});
test('unknown admission retains snapshot and blocks another launch', async () => {
  const f = await fixture(undefined, async () => { throw new Error('lost receipt'); });
  try {
    await assert.rejects(f.service.launch(f.request), error => error.code === 'studio-catalog/rejected' && error.details.reason === 'admission-unknown' && typeof error.details.childId === 'string');
    assert.equal((await f.service.assignments('parent')).length, 1);
    await assert.rejects(f.service.launch(f.request), /admission-unavailable/);
    assert.equal(f.calls.length, 1);
  } finally { await f.close(); }
});
