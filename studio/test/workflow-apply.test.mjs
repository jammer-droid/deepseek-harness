/** Application compiler rejects unsupported execution without discarding drafts. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ComponentRegistry, instructionsDefinition } from '../packages/workflows/src/component-registry.ts';
import { WorkflowCompiler } from '../packages/workflows/src/compiler.ts';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain';
import { MemoryStorageBackend, MemoryMediaPool } from '../../packages/storage/storage-domain/tests/helpers/memory-backend.ts';
import { DraftStore } from '../packages/workflows/src/drafts.ts';
import { AppliedStore } from '../packages/workflows/src/applied.ts';
import { WorkflowRuntime } from '../packages/workflows/src/runtime.ts';
import { WorkflowApplication } from '../packages/workflows/src/application.ts';
const id = '550e8400-e29b-41d4-a716-446655440000';
async function fixture(pool = new MemoryMediaPool(), failActivation = false) {
  const ctx = new Context(); await ctx.plugin(Storage);
  ctx.storage.backend.register('memory', new MemoryStorageBackend(pool));
  const facility = new DomainFacility(ctx, { backend: 'memory', routes: {} });
  const drafts = await DraftStore.open(facility, 'web');
  const applied = await AppliedStore.open(facility, 'web');
  const activations = [];
  const runtime = { async activate(record) { activations.push(record); if (failActivation) throw new Error('mount rejected'); }, async inspect() { return { activation: failActivation ? 'failed' : 'active', experiments: 'unknown', observations: [] }; }, async close() {} };
  const application = new WorkflowApplication(drafts, applied, compiler().compiler, runtime);
  return { application, drafts, activations, pool, async close() { await application.close(); await drafts.close(); await ctx.fiber.dispose(); } };
}
test('applied storage is separate, serialized, requeryable and restored without a rewrite', async () => {
  const pool = new MemoryMediaPool(); const f = await fixture(pool);
  await f.drafts.save({ id, expectedRevision: 0, document: document() });
  assert.deepEqual(await f.application.read(), []);
  const request = { id, draftRevision: 1, expectedRevision: 0 };
  const results = await Promise.allSettled([f.application.apply(request), f.application.apply(request)]);
  assert.equal(results[0].status, 'fulfilled'); assert.equal(results[1].reason.reason, 'revision-conflict');
  assert.equal(f.activations.length, 1);
  const changed = document(); changed.name = 'Not applied';
  await f.drafts.save({ id, expectedRevision: 1, document: changed });
  assert.equal((await f.application.read())[0].applied.document.name, 'Applied');
  await f.close();
  const reopened = await fixture(pool);
  await reopened.application.restore();
  assert.equal(reopened.activations.length, 1);
  assert.equal((await reopened.application.read())[0].applied.revision, 1);
  await reopened.close();
});
test('activation rejection preserves committed application and explicit failed status', async () => {
  const f = await fixture(undefined, true);
  await f.drafts.save({ id, expectedRevision: 0, document: document() });
  const result = await f.application.apply({ id, draftRevision: 1, expectedRevision: 0 });
  assert.equal(result.activation, 'failed'); assert.equal(result.applied.revision, 1);
  assert.equal((await f.application.read())[0].applied.revision, 1);
  await f.close();
});
test('uncertain applied persistence never activates and freezes later operations', async () => {
  const f = await fixture(); await f.drafts.save({ id, expectedRevision: 0, document: document() });
  f.pool.failNextWrites = 1;
  const request = { id, draftRevision: 1, expectedRevision: 0 };
  await assert.rejects(f.application.apply(request), error => error.reason === 'storage-uncertain');
  await assert.rejects(f.application.apply(request), error => error.reason === 'storage-uncertain');
  await assert.rejects(f.application.read(), error => error.reason === 'storage-uncertain');
  assert.equal(f.activations.length, 0);
  await f.close();
});
const document = () => ({ documentVersion: 3, name: 'Applied', mainRoleId: 'main', roles: [{ id: 'main', name: 'Main', model: { provider: 'probe', model: 'probe' }, components: [{ instanceId: 'one', id: 'studio.instructions', version: 1, scope: 'role', config: { text: 'First' } }] }], systems: [], connections: [] });
function compiler(validate = async () => ({ issues: [] })) {
  const registry = new ComponentRegistry(); registry.register(instructionsDefinition);
  return { registry, compiler: new WorkflowCompiler(registry, () => ({ validate }), () => registry.catalog().revision) };
}
test('compile preserves ordered enabled instructions and independent role selections', async () => {
  const f = compiler(); const input = document();
  input.roles[0].components.push({ instanceId: 'off', id: 'missing', version: 1, scope: 'role', enabled: false, config: {} });
  input.roles[0].components.push({ instanceId: 'two', id: 'studio.instructions', version: 1, scope: 'role', config: { text: 'Second' } });
  const before = structuredClone(input);
  const result = await f.compiler.compile(input);
  assert.deepEqual(result.roles[0].instructions, [{ instanceId: 'one', text: 'First' }, { instanceId: 'two', text: 'Second' }]);
  assert.deepEqual(input, before);
});
test('declarations alone do not authorize component execution', async () => {
  const f = compiler(); f.registry.register({ id: 'future', version: 1, scope: 'role', fields: [] });
  const input = document(); input.roles[0].components.push({ instanceId: 'x', id: 'future', version: 1, scope: 'role', config: {} });
  await assert.rejects(f.compiler.compile(input), error => error.reason === 'unsupported-adapter');
});
test('active unsupported systems refuse while disabled systems are retained but excluded', async () => {
  const f = compiler(); f.registry.registerSystem({ id: 'future-system', version: 1, scope: 'workflow', fields: [], executionLocations: ['dsh'], ports: [] });
  const input = document(); input.systems.push({ instanceId: 's', id: 'future-system', version: 1, scope: 'workflow', config: {} });
  await assert.rejects(f.compiler.compile(input), error => error.reason === 'unsupported-adapter');
  input.systems[0].enabled = false; await f.compiler.compile(input); assert.equal(input.systems.length, 1);
});
test('route observations distinguish explicit effort from provider defaults and dispose only owned registrations', async () => {
  let disposals = 0; const runtime = new WorkflowRuntime(() => ({ register: async () => async () => { disposals++; }, list: async () => [{ id: `studio-workflow:${id}` }] }));
  const compiled = await compiler().compiler.compile(document());
  const record = { id, revision: 1, draftRevision: 1, presetId: `studio-workflow:${id}`, document: document(), compiled, experiments: 'not-targeted' };
  await runtime.activate(record);
  runtime.observe(id, 1, 'a', { provider: 'probe', model: 'probe', reasoningEffort: 'high' });
  assert.equal((await runtime.inspect(record)).observations[0].matches, true);
  record.revision = 2; record.compiled.roles[0].model.reasoningEffort = 'low'; await runtime.activate(record);
  runtime.observe(id, 2, 'b', { provider: 'probe', model: 'probe', reasoningEffort: 'low' });
  runtime.observe(id, 2, 'c', { provider: 'probe', model: 'probe', reasoningEffort: 'high' });
  assert.deepEqual((await runtime.inspect(record)).observations.map(item => item.matches), [true, true, false]);
  assert.equal(disposals, 1); await runtime.close(); assert.equal(disposals, 2);
});
test('model lookup racing registration changes cannot authorize stale execution', async () => {
  const f = compiler(async () => { f.registry.register({ id: 'late', version: 1, scope: 'role', fields: [] }); return { issues: [] }; });
  await assert.rejects(f.compiler.compile(document()), error => error.reason === 'catalog-changed');
});
