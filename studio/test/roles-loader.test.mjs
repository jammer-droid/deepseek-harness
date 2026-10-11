import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Context } from '@deepseek-ai/cordis';
import Loader from '@deepseek-ai/cordis-plugin-loader';
import Include from '@deepseek-ai/cordis-plugin-include';
import Storage from '@deepseek-ai/dsh-storage';
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain';
import TypertRegistry from '@deepseek-ai/dsh-typert-registry';
import Gateway from '@deepseek-ai/dsh-api-gateway';
import LlmRuntime, { LlmAdapter, ReasoningEffortId } from '@deepseek-ai/dsh-llm';
class ModelCatalog extends LlmAdapter {
  async listModels(provider) { return [{ provider, id: 'model', name: 'Model' }]; }
  async resolveModel(provider, model) { return { provider, id: model, name: model, reasoning: { efforts: [{ id: ReasoningEffortId('high'), name: 'High' }] } }; }
  async *stream() { throw new Error('Settings must never invoke a model'); }
}
import { MemoryStorageBackend } from '../../packages/storage/storage-domain/tests/helpers/memory-backend.ts';
import * as RolesPlugin from '../packages/roles/index.js';
import { TYPERT } from '../packages/roles/lib/typert.host.js';

test('YAML Loader mounts the built plugin and generated Gateway accepts only explicit valid Apply', async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-roles-loader-'));
  assert.equal(resolve(root), root);
  const ctx = new Context();
  try {
    await ctx.plugin(Storage);
    ctx.storage.backend.register('memory', new MemoryStorageBackend());
    ctx.provide('storageDomain', new DomainFacility(ctx, { backend: 'memory', routes: {} }));
    ctx.provide('profileContext', { name: 'web' });
    await ctx.plugin(LlmRuntime);
    ctx.llm.registerAdapter(['test'], new ModelCatalog());
    await ctx.plugin(TypertRegistry);
    await ctx.plugin(Gateway);
    const unregister = ctx.typert.register(TYPERT);
    ctx.effect(() => unregister);
    ctx.baseUrl = pathToFileURL(root).href + '/';
    await ctx.plugin(Loader);
    ctx.loader.builtins.include = Include;
    ctx.loader.internal = { version: 'v2', async import(name) { if (name === '@local/dsh-studio-roles') return RolesPlugin; throw new Error(`Unexpected import ${name}`); } };
    const configPath = join(root, 'cordis.yml');
    await writeFile(configPath, "- name: '@local/dsh-studio-roles'\n");
    await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } });
    await ctx.loader.await();
    for (const entry of ctx.loader.entries()) await entry.fiber?.await();
    const invoke = (method, args) => ctx.typertGateway.invoke({ namespace: 'studioRoles', method, args });
    const before = await invoke('describe', {});
    assert.equal(before.status, 'unconfigured');
    await assert.rejects(invoke('apply', { request: { roles: {} } }));
    const role = { instructions: 'Execute this fixed role.', provider: 'test', model: 'model' };
    const request = { expectedProcessId: before.processId, expectedRevision: before.revision, expectedSnapshotId: before.snapshotId, roles: { implementer: role, reviewer: role } };
    await assert.rejects(invoke('apply', { request: { ...request, roles: { ...request.roles, reviewer: { ...role, reasoningEffort: 'maximum' } } } }));
    assert.equal((await invoke('describe', {})).snapshotId, null);
    const applied = await invoke('apply', { request });
    assert.equal(applied.status, 'applied');
    assert.equal((await invoke('describe', {})).snapshotId, applied.snapshotId);
    await assert.rejects(invoke('apply', { request }));
    assert.equal(ctx.studioRoles.capture('implementer').snapshotId, applied.snapshotId);
    await assert.rejects(invoke('capture', { role: 'implementer' }));
    const entry = [...ctx.loader.entries()].find(entry => entry.options.name === '@local/dsh-studio-roles');
    await entry.fiber.dispose();
    await assert.rejects(invoke('describe', {}), /unavailable/);
  } finally {
    await ctx.fiber.dispose();
    assert.ok(root.startsWith(join(tmpdir(), 'studio-roles-loader-')));
    await rm(root, { recursive: true, force: true });
  }
});
