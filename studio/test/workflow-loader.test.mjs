/** Real Loader and generated Gateway exercise the workflow declaration service. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import Loader from '@deepseek-ai/cordis-plugin-loader';
import TypertRegistry from '@deepseek-ai/dsh-typert-registry';
import Gateway from '@deepseek-ai/dsh-api-gateway';
import Storage from '@deepseek-ai/dsh-storage';
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain';
import { MemoryStorageBackend, MemoryMediaPool } from '../../packages/storage/storage-domain/tests/helpers/memory-backend.ts';
import * as Workflows from '../packages/workflows/index.js';
import { TYPERT } from '../packages/workflows/lib/typert.host.js';

test('Workflow declarations mount independently and leave with their Loader row', async () => {
  const ctx = new Context();
  try {
    await ctx.plugin(Storage);
    ctx.storage.backend.register('memory', new MemoryStorageBackend(new MemoryMediaPool()));
    ctx.provide('storageDomain', new DomainFacility(ctx, { backend: 'memory', routes: {} }));
    ctx.provide('profileContext', { name: 'web' });
    await ctx.plugin(TypertRegistry);
    await ctx.plugin(Gateway);
    ctx.effect(() => ctx.typert.register(TYPERT));
    await ctx.plugin(Loader);
    ctx.loader.internal = { version: 'v2', async import(name) { assert.equal(name, '@local/dsh-studio-workflows'); return Workflows; } };
    const entry = await ctx.loader.create({ name: '@local/dsh-studio-workflows' });
    await ctx.loader.await();
    for (const mounted of ctx.loader.entries()) await mounted.fiber?.await();
    const invoke = () => ctx.typertGateway.invoke({ namespace: 'studioWorkflows', method: 'components', args: {} });
    assert.deepEqual(await invoke(), [{ id: 'studio.instructions', version: 1, scope: 'role', fields: [{ key: 'text', kind: 'text', required: true }] }]);
    const save = request => ctx.typertGateway.invoke({ namespace: 'studioWorkflows', method: 'save', args: { request } });
    const draft = { id: 'deadcafe-1234-4234-8234-123456789abc', expectedRevision: 0, document: { name: 'Draft', mainRole: { name: 'Main', components: [] } } };
    const stored = await save(draft);
    assert.equal(stored.revision, 1);
    assert.deepEqual(await ctx.typertGateway.invoke({ namespace: 'studioWorkflows', method: 'drafts', args: {} }), [stored]);
    await assert.rejects(save(draft), error => error.details?.reason === 'revision-conflict');
    assert.equal(ctx.get('studioRoles'), undefined);
    assert.equal(ctx.get('studioDelegation'), undefined);
    assert.equal(ctx.get('configEditor'), undefined);
    assert.equal(ctx.get('llm'), undefined);
    const mounted = [...ctx.loader.entries()].find(row => row.options.name === '@local/dsh-studio-workflows');
    await mounted.fiber.dispose();
    await assert.rejects(invoke(), /unavailable/);
  } finally { await ctx.fiber.dispose(); }
});
