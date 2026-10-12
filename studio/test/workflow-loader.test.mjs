/** Real Loader and generated Gateway exercise the workflow declaration service. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import Loader from '@deepseek-ai/cordis-plugin-loader';
import TypertRegistry from '@deepseek-ai/dsh-typert-registry';
import * as ApiRemotes from '@deepseek-ai/dsh-api-remotes';
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
    await ctx.plugin(ApiRemotes);
    const eventAbort = new AbortController();
    const events = (await ctx.typertGateway.wireStream.open('$events', { args: {} }, undefined, undefined, eventAbort.signal))[Symbol.asyncIterator]();
    assert.equal((await events.next()).value.type, 'ready');
    ctx.effect(() => ctx.typert.register(TYPERT));
    await ctx.plugin(Loader);
    const revisions = [];
    ctx.on('studio-workflows/catalog-changed', revision => revisions.push(revision));
    const provider = { inject: ['studioWorkflows'], apply(providerContext) {
      providerContext.effect(() => providerContext.studioWorkflows.registerSystem({ id: 'test.system', version: 1, scope: 'workflow', fields: [], ports: [], executionLocations: ['dsh'] }));
    } };
    ctx.loader.internal = { version: 'v2', async import(name) { if (name === 'test-provider') return provider; assert.equal(name, '@local/dsh-studio-workflows'); return Workflows; } };
    const entry = await ctx.loader.create({ name: '@local/dsh-studio-workflows' });
    await ctx.loader.await();
    for (const mounted of ctx.loader.entries()) await mounted.fiber?.await();
    const invoke = () => ctx.typertGateway.invoke({ namespace: 'studioWorkflows', method: 'components', args: {} });
    assert.deepEqual(await invoke(), [{ id: 'studio.instructions', version: 1, scope: 'role', fields: [{ key: 'text', kind: 'text', required: true }] }]);
    const save = request => ctx.typertGateway.invoke({ namespace: 'studioWorkflows', method: 'save', args: { request } });
    const draft = { id: 'deadcafe-1234-4234-8234-123456789abc', expectedRevision: 0, document: { documentVersion: 2, systems: [], connections: [], name: 'Draft', mainRole: { name: 'Main', components: [] } } };
    const stored = await save(draft);
    assert.equal(stored.revision, 1);
    assert.deepEqual(await ctx.typertGateway.invoke({ namespace: 'studioWorkflows', method: 'drafts', args: {} }), [stored]);
    await assert.rejects(save(draft), error => error.details?.reason === 'revision-conflict');
    const catalog = await ctx.typertGateway.invoke({ namespace: 'studioWorkflows', method: 'catalog', args: {} });
    assert.equal(catalog.revision, 1);
    assert.deepEqual(await ctx.typertGateway.invoke({ namespace: 'studioWorkflows', method: 'validate', args: { document: draft.document } }), ctx.studioWorkflows.validate(draft.document));
    const providerEntry = await ctx.loader.create({ name: 'test-provider' });
    await ctx.loader.await();
    for (const row of ctx.loader.entries()) await row.fiber?.await();
    const systemDocument = { ...draft.document, systems: [{ instanceId: 'system-1', id: 'test.system', version: 1, scope: 'workflow', executionLocation: 'dsh', config: { unseen: ['retained'] } }] };
    const validate = document => ctx.typertGateway.invoke({ namespace: 'studioWorkflows', method: 'validate', args: { document } });
    const before = await validate(systemDocument);
    assert.equal(before.valid, true);
    const providerRow = [...ctx.loader.entries()].find(row => row.options.name === 'test-provider');
    await providerRow.fiber.dispose();
    const unavailable = await validate(systemDocument);
    assert.equal(unavailable.valid, false);
    assert.equal(unavailable.diagnostics[0].code, 'missing-registration');
    assert.ok(unavailable.catalogRevision > before.catalogRevision);
    assert.equal(before.valid, true);
    await ctx.loader.create({ name: 'test-provider' }); await ctx.loader.await();
    for (const row of ctx.loader.entries()) await row.fiber?.await();
    assert.equal((await validate(systemDocument)).valid, true);
    assert.deepEqual(await validate(systemDocument), ctx.studioWorkflows.validate(systemDocument));
    await assert.rejects(validate({ ...systemDocument, documentVersion: 99 }), /invalid-document|validation/i);
    assert.deepEqual(revisions.slice(0, 4), [1, 2, 3, 4]);
    for (const revision of [1, 2, 3, 4]) {
      const notification = (await events.next()).value;
      assert.equal(notification.event, 'studio-workflows/catalog-changed');
      assert.deepEqual(notification.args, [revision]);
    }
    eventAbort.abort(); await events.return?.();
    assert.deepEqual((await ctx.studioWorkflows.drafts())[0], stored);
    assert.equal(ctx.get('studioRoles'), undefined);
    assert.equal(ctx.get('studioDelegation'), undefined);
    assert.equal(ctx.get('configEditor'), undefined);
    assert.equal(ctx.get('llm'), undefined);
    const mounted = [...ctx.loader.entries()].find(row => row.options.name === '@local/dsh-studio-workflows');
    await mounted.fiber.dispose();
    await assert.rejects(invoke(), /unavailable/);
  } finally { await ctx.fiber.dispose(); }
});
