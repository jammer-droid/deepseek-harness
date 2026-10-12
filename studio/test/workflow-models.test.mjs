import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { LlmRuntime, LlmAdapter, LlmError, ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import { WorkflowModels } from '../packages/workflows/src/models.ts';

class CatalogAdapter extends LlmAdapter {
  async listModels(provider) {
    return [{ provider, id: 'writer', name: 'Writer' }, { provider, id: 'plain', name: 'Plain' }];
  }
  async resolveModel(provider, id) {
    return { provider, id, name: id === 'writer' ? 'Writer' : 'Plain', ...(id === 'writer' ? {
      reasoning: { efforts: [{ id: ReasoningEffortId('low'), name: 'Low' }, { id: ReasoningEffortId('high'), name: 'High' }], defaultEffort: ReasoningEffortId('low') },
    } : {}) };
  }
  async *stream() { throw new Error('metadata validation must never generate'); }
}

function fixture(t, adapter = new CatalogAdapter()) {
  const ctx = new Context();
  const llm = new LlmRuntime(ctx);
  const registration = llm.registerAdapter(['example'], adapter);
  t.after(() => registration());
  return { models: new WorkflowModels(llm), llm, registration };
}

test('catalog exposes exact advertised reasoning and defaults and validation never rewrites roles', async (t) => {
  const { models } = fixture(t);
  assert.deepEqual(await models.catalog(), { status: 'available', providers: [{
    id: 'example', name: 'example', status: 'available', models: [
      { provider: 'example', id: 'writer', name: 'Writer', status: 'available', reasoning: {
        efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }], defaultEffort: 'low',
      } },
      { provider: 'example', id: 'plain', name: 'Plain', status: 'available' },
    ],
  }] });
  const selection = Object.freeze({ provider: 'example', model: 'writer' });
  assert.deepEqual(await models.validate(selection), { status: 'valid', issues: [] });
  assert.deepEqual(selection, { provider: 'example', model: 'writer' });
  assert.deepEqual(await models.validate({ ...selection, reasoningEffort: 'high' }), { status: 'valid', issues: [] });
});

test('exact advertised membership and explicit reasoning are required without substitution', async (t) => {
  const { models, llm, registration } = fixture(t);
  // Core intentionally permits unlisted routes; Studio must not inherit that permissiveness.
  assert.equal((await llm.resolveCallConfig({ provider: 'example', model: 'unlisted' })).model, 'unlisted');
  for (const [selection, code, field] of [
    [{ provider: 'absent', model: 'writer' }, 'unsupported-provider', 'provider'],
    [{ provider: 'example', model: 'unlisted' }, 'unsupported-model', 'model'],
    [{ provider: 'example', model: 'Writer' }, 'unsupported-model', 'model'],
    [{ provider: 'example', model: 'writer', reasoningEffort: 'extreme' }, 'unsupported-reasoning', 'reasoningEffort'],
    [{ provider: 'example', model: 'plain', reasoningEffort: 'low' }, 'unsupported-reasoning', 'reasoningEffort'],
    [{ provider: 'example', model: '' }, 'missing-model', 'model'],
  ]) {
    const result = await models.validate(Object.freeze(selection));
    assert.equal(result.status, 'invalid');
    assert.equal(result.issues[0].code, code);
    assert.equal(result.issues[0].field, field);
  }
  registration();
  assert.deepEqual(await models.catalog(), { status: 'available', providers: [] });
  assert.deepEqual(await models.validate({ provider: 'example', model: 'writer' }), {
    status: 'invalid', issues: [{ code: 'unsupported-provider', field: 'provider' }],
  });
});

test('provider and exact-model failures stay distinct from unsupported selections', async (t) => {
  class BrokenCatalog extends CatalogAdapter {
    async listModels(provider) {
      if (provider === 'offline') throw new LlmError('비공개 원문', 'AUTH');
      return super.listModels(provider);
    }
    async resolveModel(provider, model) {
      if (provider === 'degraded' && model === 'writer') throw new LlmError('opaque detail', 'RATE_LIMIT');
      return super.resolveModel(provider, model);
    }
  }
  const { llm, models } = fixture(t);
  const dispose = llm.registerAdapter(['offline', 'degraded'], new BrokenCatalog());
  t.after(dispose);
  const catalog = await models.catalog();
  assert.equal(catalog.status, 'partial');
  assert.equal(catalog.providers[0].status, 'available');
  assert.deepEqual(catalog.providers[1], { id: 'offline', name: 'offline', status: 'failed', models: [],
    failure: { operation: 'list-models', provider: 'offline', code: 'AUTH' } });
  assert.equal(catalog.providers[2].status, 'partial');
  assert.deepEqual(catalog.providers[2].models[0], { provider: 'degraded', id: 'writer', name: 'Writer', status: 'failed',
    failure: { operation: 'resolve-model', provider: 'degraded', model: 'writer', code: 'RATE_LIMIT' } });
  assert.equal(catalog.providers[2].models[1].status, 'available');
  assert.deepEqual(await models.validate({ provider: 'offline', model: 'writer' }), {
    status: 'unavailable', issues: [{ code: 'model-lookup-failed', field: 'model',
      failure: { operation: 'list-models', provider: 'offline', code: 'AUTH' } }],
  });
  assert.deepEqual(await models.validate({ provider: 'degraded', model: 'writer' }), {
    status: 'unavailable', issues: [{ code: 'model-lookup-failed', field: 'model',
      failure: { operation: 'resolve-call-config', provider: 'degraded', model: 'writer', code: 'RATE_LIMIT' } }],
  });
});

test('untyped failures never acquire unsupported meaning from their message', async (t) => {
  class BrokenLookup extends CatalogAdapter {
    async resolveModel() { throw new Error('UNSUPPORTED_REASONING_EFFORT'); }
  }
  const { models } = fixture(t, new BrokenLookup());
  const result = await models.validate({ provider: 'example', model: 'writer', reasoningEffort: 'low' });
  assert.deepEqual(result, { status: 'unavailable', issues: [{ code: 'model-lookup-failed', field: 'model', failure: {
    operation: 'resolve-call-config', provider: 'example', model: 'writer', code: 'unexpected-error',
  } }] });
});

test('provider enumeration failure is unavailable rather than unsupported', async () => {
  const models = new WorkflowModels({
    listProviders() { throw new LlmError('hidden', 'AUTH'); },
    async listModels() { assert.fail('failed enumeration cannot proceed'); },
    async resolveModelInfo() { assert.fail('failed enumeration cannot proceed'); },
    async resolveCallConfig() { assert.fail('failed enumeration cannot proceed'); },
  });
  assert.deepEqual(await models.catalog(), { status: 'unavailable', providers: [], failure: { operation: 'list-providers', code: 'AUTH' } });
  assert.deepEqual(await models.validate({ provider: 'example', model: 'writer' }), {
    status: 'unavailable', issues: [{ code: 'model-lookup-failed', field: 'model', failure: { operation: 'list-providers', code: 'AUTH' } }],
  });
});

test('missing LLM service is unavailable rather than an empty supported catalog', async () => {
  const models = new WorkflowModels();
  assert.deepEqual(await models.catalog(), {
    status: 'unavailable', providers: [], failure: { operation: 'service', code: 'service-unavailable' },
  });
  assert.deepEqual(await models.validate({ provider: 'example', model: 'writer' }), {
    status: 'unavailable', issues: [{ code: 'model-lookup-failed', field: 'model', failure: { operation: 'service', code: 'service-unavailable' } }],
  });
  assert.deepEqual(await models.validate(undefined), {
    status: 'invalid', issues: [{ code: 'missing-model', field: 'model' }],
  });
});
