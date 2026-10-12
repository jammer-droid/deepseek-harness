/** General settings mounts without Studio role storage or orchestration. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import Loader from '@deepseek-ai/cordis-plugin-loader';
import TypertRegistry from '@deepseek-ai/dsh-typert-registry';
import Gateway from '@deepseek-ai/dsh-api-gateway';
import * as General from '../packages/general/index.js';
import { TYPERT } from '../packages/general/lib/typert.host.js';

test('general settings Remote mounts without role services', async () => {
  const ctx = new Context();
  try {
    ctx.provide('configEditor', { configuration: () => [], entries: () => [] });
    await ctx.plugin(TypertRegistry);
    await ctx.plugin(Gateway);
    const unregister = ctx.typert.register(TYPERT);
    ctx.effect(() => unregister);
    await ctx.plugin(Loader);
    ctx.loader.internal = { version: 'v2', async import(name) { assert.equal(name, '@local/dsh-studio-general'); return General; } };
    const entry = await ctx.loader.create({ name: '@local/dsh-studio-general' });
    await ctx.loader.await();
    await entry.fiber?.await();
    assert.equal(ctx.get('studioRoles'), undefined);
    assert.equal(ctx.get('studioDelegation'), undefined);
    const invoke = () => ctx.typertGateway.invoke({ namespace: 'studioGeneral', method: 'presets', args: {} });
    assert.deepEqual(await invoke(), []);
    const mounted = [...ctx.loader.entries()].find(row => row.options.name === '@local/dsh-studio-general');
    await mounted.fiber.dispose();
    await assert.rejects(invoke(), /unavailable/);
  } finally {
    await ctx.fiber.dispose();
  }
});
