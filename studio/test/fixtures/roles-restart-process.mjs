/** Artifact-plane child process: only the external model catalog is simulated. */
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import { JsonStorageBackend } from '@deepseek-ai/dsh-storage-json';
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain';
import LlmRuntime, { LlmAdapter, ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import * as RolesPlugin from '../../packages/roles/index.js';

class ModelCatalog extends LlmAdapter {
  async listModels(provider) { return [{ provider, id: 'fixed-model', name: 'Fixed model' }]; }
  async resolveModel(provider, model) {
    return { provider, id: model, name: model, reasoning: { efforts: ['low', 'high'].map(id => ({ id: ReasoningEffortId(id), name: id })) } };
  }
  async *stream() { throw new Error('Role settings must not invoke a model'); }
}

const [storageRoot, phase, inputJson] = process.argv.slice(2);
assert.ok(storageRoot);
assert.ok(phase === 'apply' || phase === 'restore');
const input = JSON.parse(inputJson);
const ctx = new Context();
const backend = new JsonStorageBackend(storageRoot);
let output;
try {
  await ctx.plugin(Storage);
  ctx.effect(() => ctx.storage.backend.register('json', backend));
  ctx.provide('storageDomain', new DomainFacility(ctx, { backend: 'json', routes: {} }));
  ctx.provide('profileContext', { name: 'restart-profile' });
  await ctx.plugin(LlmRuntime);
  ctx.effect(() => ctx.llm.registerAdapter(['test'], new ModelCatalog()));
  await ctx.plugin(RolesPlugin);
  const initial = ctx.studioRoles.describe();
  let staleRejected = false;
  if (phase === 'apply') {
    assert.equal(initial.status, 'unconfigured');
    await ctx.studioRoles.apply({ expectedProcessId: initial.processId, expectedRevision: initial.revision, expectedSnapshotId: initial.snapshotId, roles: input.roles });
  } else {
    // Match the new revision and current snapshot to isolate the old-process token.
    await assert.rejects(ctx.studioRoles.apply({ expectedProcessId: input.previous.processId, expectedRevision: initial.revision, expectedSnapshotId: initial.snapshotId, roles: input.roles }), error => {
      assert.equal(error.code, 'studio-roles/rejected');
      assert.equal(error.message, 'revision-conflict');
      staleRejected = true;
      return true;
    });
    assert.deepEqual(ctx.studioRoles.describe(), initial);
  }
  output = { pid: process.pid, initial, state: ctx.studioRoles.describe(), staleRejected, captures: { implementer: ctx.studioRoles.capture('implementer'), reviewer: ctx.studioRoles.capture('reviewer') } };
} finally {
  try { await ctx.fiber.dispose(); }
  finally { await backend.close(); }
}
process.stdout.write(JSON.stringify(output) + '\n');
