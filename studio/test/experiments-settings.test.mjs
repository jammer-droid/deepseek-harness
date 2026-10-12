import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain';
import { MemoryStorageBackend, MemoryMediaPool } from '../../packages/storage/storage-domain/tests/helpers/memory-backend.ts';
import { ExperimentStore } from '../packages/experiments/src/store.ts';
import { initialSettings, settingsSchema, targetsAgent } from '../packages/experiments/src/settings.ts';

async function fixture(t, pool = new MemoryMediaPool()) {
  const ctx = new Context();
  t.after(() => ctx.fiber.dispose());
  await ctx.plugin(Storage);
  ctx.storage.backend.register('memory', new MemoryStorageBackend(pool));
  const domain = new DomainFacility(ctx, { backend: 'memory', routes: {} });
  const owner = await ExperimentStore.open(domain, 'web');
  t.after(() => owner.close());
  return { owner, pool };
}

test('Each experiment defaults off and independently selects agent populations', () => {
  assert.deepEqual(new Set(Object.values(initialSettings.targets)), new Set(['off']));
  assert.deepEqual(['off', 'main', 'sub', 'both'].map(target => [targetsAgent(target, false), targetsAgent(target, true)]), [[false, false], [true, false], [false, true], [true, true]]);
  for (const value of [{ inlineChars: 1023 }, { previewChars: 4097 }, { batchMaxCalls: 9 }, { readMaxLines: 201 }, { jobWaitMs: 600001 }, { jobWaitCapMs: 1 }]) {
    assert.equal(settingsSchema.safeParse({ ...initialSettings, ...value }).success, false);
  }
});

test('Serialized stale edits cannot replace a saved snapshot; captured agents remain unchanged', async t => {
  const { owner } = await fixture(t);
  const before = owner.describe();
  const captured = owner.capture();
  const settings = { ...initialSettings, targets: { ...initialSettings.targets, goals: 'sub' } };
  const request = { expectedRevision: before.revision, settings };
  const results = await Promise.allSettled([owner.apply(request), owner.apply(request)]);
  assert.deepEqual(results.map(result => result.status), ['fulfilled', 'rejected']);
  assert.equal(results[1].reason.reason, 'revision-conflict');
  assert.equal(owner.capture().targets.goals, 'sub');
  assert.equal(captured.targets.goals, 'off');
  settings.targets.goals = 'both';
  assert.equal(owner.capture().targets.goals, 'sub');
  const snapshot = owner.describe();
  await assert.rejects(owner.apply({ expectedRevision: snapshot.revision, settings: { ...initialSettings, previewChars: 5000 } }));
  assert.deepEqual(owner.describe(), snapshot);
});

test('Saved settings survive reopening the same profile', async t => {
  const pool = new MemoryMediaPool();
  const first = await fixture(t, pool);
  await first.owner.apply({ expectedRevision: first.owner.describe().revision, settings: { ...initialSettings, inlineChars: 16384 } });
  const second = await fixture(t, pool);
  assert.equal(second.owner.capture().inlineChars, 16384);
});
