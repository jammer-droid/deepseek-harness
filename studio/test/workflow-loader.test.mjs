/** Real Loader and generated Gateway exercise the workflow declaration service. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import Loader from '@deepseek-ai/cordis-plugin-loader';
import TypertRegistry from '@deepseek-ai/dsh-typert-registry';
import * as ApiRemotes from '@deepseek-ai/dsh-api-remotes';
import Gateway from '@deepseek-ai/dsh-api-gateway';
import Storage from '@deepseek-ai/dsh-storage';
import Llm, { LlmAdapter, ReasoningEffortId } from '@deepseek-ai/dsh-llm';
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
    const draft = { id: 'deadcafe-1234-4234-8234-123456789abc', expectedRevision: 0, document: { documentVersion: 3, systems: [], connections: [], name: 'Draft', mainRoleId: 'main', roles: [{ id: 'main', name: 'Main', components: [], model: { provider: 'fixture', model: 'writer' } }] } };
    const stored = await save(draft);
    assert.equal(stored.revision, 1);
    assert.deepEqual(await ctx.typertGateway.invoke({ namespace: 'studioWorkflows', method: 'drafts', args: {} }), [stored]);
    await assert.rejects(save(draft), error => error.details?.reason === 'revision-conflict');
    const catalog = await ctx.typertGateway.invoke({ namespace: 'studioWorkflows', method: 'catalog', args: {} });
    assert.equal(catalog.revision, 1);
    assert.deepEqual(await ctx.typertGateway.invoke({ namespace: 'studioWorkflows', method: 'validate', args: { document: draft.document } }), await ctx.studioWorkflows.validate(draft.document));
    const providerEntry = await ctx.loader.create({ name: 'test-provider' });
    await ctx.loader.await();
    for (const row of ctx.loader.entries()) await row.fiber?.await();
    const systemDocument = { ...draft.document, systems: [{ instanceId: 'system-1', id: 'test.system', version: 1, scope: 'workflow', executionLocation: 'dsh', config: { unseen: ['retained'] } }] };
    const validate = document => ctx.typertGateway.invoke({ namespace: 'studioWorkflows', method: 'validate', args: { document } });
    const before = await validate(systemDocument);
    assert.equal(before.valid, false);
    assert.deepEqual(before.diagnostics.map(issue => issue.code), ['model-lookup-failed']);
    const providerRow = [...ctx.loader.entries()].find(row => row.options.name === 'test-provider');
    await providerRow.fiber.dispose();
    const unavailable = await validate(systemDocument);
    assert.equal(unavailable.valid, false);
    assert.equal(unavailable.diagnostics[0].code, 'missing-registration');
    assert.ok(unavailable.catalogRevision > before.catalogRevision);
    assert.equal(before.valid, false);
    assert.deepEqual(before.diagnostics.map(issue => issue.code), ['model-lookup-failed']);
    await ctx.loader.create({ name: 'test-provider' }); await ctx.loader.await();
    for (const row of ctx.loader.entries()) await row.fiber?.await();
    assert.deepEqual((await validate(systemDocument)).diagnostics.map(issue => issue.code), ['model-lookup-failed']);
    assert.deepEqual(await validate(systemDocument), await ctx.studioWorkflows.validate(systemDocument));
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

test('Workflow Gateway observes effect-owned LLM routes and preserves invalid saved selections', { timeout: 10000 }, async () => {
  const ctx = new Context();
  const eventAbort = new AbortController();
  let events;
  try {
    await ctx.plugin(Storage);
    ctx.storage.backend.register('memory', new MemoryStorageBackend(new MemoryMediaPool()));
    ctx.provide('storageDomain', new DomainFacility(ctx, { backend: 'memory', routes: {} }));
    ctx.provide('profileContext', { name: 'web' });
    await ctx.plugin(TypertRegistry);
    await ctx.plugin(Gateway);
    await ctx.plugin(ApiRemotes);
    ctx.effect(() => ctx.typert.register(TYPERT));
    await ctx.plugin(Loader);
    class FixtureAdapter extends LlmAdapter {
      async listModels(provider) { return [{ provider, id: 'writer', name: 'Writer' }]; }
      async resolveModel(provider, id) {
        return { provider, id, name: 'Writer', reasoning: {
          efforts: [{ id: ReasoningEffortId('low'), name: 'Low' }], defaultEffort: ReasoningEffortId('low'),
        } };
      }
      async *stream() { assert.fail('workflow editing must not generate'); }
    }
    const provider = { inject: ['llm'], apply(providerContext) {
      providerContext.effect(() => providerContext.llm.registerAdapter(['fixture'], new FixtureAdapter()));
    } };
    ctx.loader.internal = { version: 'v2', async import(name) {
      if (name === 'test-llm') return Llm;
      if (name === 'test-model-provider') return provider;
      assert.equal(name, '@local/dsh-studio-workflows'); return Workflows;
    } };
    const settle = async () => {
      await ctx.loader.await();
      for (const row of ctx.loader.entries()) await row.fiber?.await();
    };
    await ctx.loader.create({ name: '@local/dsh-studio-workflows' });
    await settle();
    const invoke = (method, args = {}) => ctx.typertGateway.invoke({ namespace: 'studioWorkflows', method, args });
    assert.equal((await invoke('models')).status, 'unavailable');
    const initialRevision = (await invoke('catalog')).revision;
    events = (await ctx.typertGateway.wireStream.open('$events', { args: {} }, undefined, undefined, eventAbort.signal))[Symbol.asyncIterator]();
    assert.equal((await events.next()).value.type, 'ready');
    await ctx.loader.create({ name: 'test-llm' });
    await settle();
    await ctx.loader.create({ name: 'test-model-provider' });
    await settle();
    const modelCatalog = await invoke('models');
    assert.equal(modelCatalog.status, 'available');
    assert.deepEqual(modelCatalog.providers[0].models[0].reasoning, { efforts: [{ id: 'low', name: 'Low' }], defaultEffort: 'low' });
    const selected = { provider: 'fixture', model: 'writer', reasoningEffort: 'low' };
    const document = { documentVersion: 3, name: 'Two roles', mainRoleId: 'main', roles: [
      { id: 'main', name: 'Main', components: [], model: selected },
      { id: 'review', name: 'Review', components: [], model: { ...selected, reasoningEffort: 'unsupported' } },
    ], systems: [], connections: [] };
    const before = await invoke('validate', { document });
    assert.equal(before.valid, false);
    assert.deepEqual(before, await ctx.studioWorkflows.validate(document));
    assert.deepEqual(before.diagnostics.map(issue => [issue.code, issue.target]), [[
      'unsupported-reasoning', { kind: 'role', roleId: 'review', fieldPath: 'reasoningEffort' },
    ]]);
    assert.ok(before.catalogRevision > initialRevision);
    const stored = await invoke('save', { request: { id: 'deadcafe-1234-4234-8234-123456789abc', expectedRevision: 0, document } });
    assert.deepEqual(stored.document, document);
    const validDocument = { ...document, roles: document.roles.map(role => ({ ...role, model: selected })) };
    assert.equal((await invoke('validate', { document: validDocument })).valid, true);
    const providerRow = [...ctx.loader.entries()].find(row => row.options.name === 'test-model-provider');
    await providerRow.fiber.dispose();
    assert.deepEqual(await invoke('models'), { status: 'available', providers: [] });
    const removed = await invoke('validate', { document });
    assert.deepEqual(removed.diagnostics.map(issue => issue.code), ['unsupported-provider', 'unsupported-provider']);
    assert.ok(removed.catalogRevision > before.catalogRevision);
    assert.deepEqual(await invoke('drafts'), [stored]);
    assert.equal(stored.document.roles[1].model.reasoningEffort, 'unsupported');
    for (const expected of [before.catalogRevision, removed.catalogRevision]) {
      let notification;
      do {
        const next = await events.next();
        assert.equal(next.done, false);
        notification = next.value;
      } while (notification.event !== 'studio-workflows/catalog-changed');
      assert.deepEqual(notification.args, [expected]);
    }
    await ctx.loader.create({ name: 'test-model-provider' });
    await settle();
    assert.equal((await invoke('validate', { document: validDocument })).valid, true);
    assert.deepEqual(await invoke('drafts'), [stored]);
  } finally {
    eventAbort.abort();
    await events?.return?.();
    await ctx.fiber.dispose();
  }
});
