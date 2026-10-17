import { runtimeCheckTarget } from './runtime-check-target.mjs';
import assert from 'node:assert/strict';
const url = runtimeCheckTarget(process.argv[2]);
const auth = await fetch(url, { redirect: 'manual' });
const cookie = auth.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
async function rpc(method, args = {}, ok = true) {
 const response = await fetch(new URL(`/api/${method}`, url), { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method, payload: { args } }), signal: AbortSignal.timeout(30000) });
 assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.result.ok, ok, JSON.stringify(body)); return body.result.value;
}
const catalog = await rpc('studioCatalog/read');
assert.deepEqual(catalog.presets.map(p => p.id), ['studio-master', 'standard', 'ptc', 'minimal', 'cordis']);
assert.ok(catalog.tools.some(t => t.name === 'read_batch'));
assert.ok(!catalog.tools.some(t => t.name === 'task_run'));
assert.ok(catalog.tools.some(t => t.name === 'read'));
const master = (await rpc('studioCatalog/listPresets')).find(p => p.id === 'studio-master'); assert.equal(master.readOnly, true);
for (const method of ['deletePreset', 'applyPreset']) await rpc(`studioCatalog/${method}`, { id: master.id }, false);
assert.ok(catalog.plugins.some(p => p.id === 'tool-fs' && p.schema));
assert.ok(catalog.plugins.every(p => !p.error), JSON.stringify(catalog.plugins.filter(p => p.error)));
const request = { configOverrides: { 'tool-fs-search': { sampleOverCapGlobResults: true } }, preset: master.id, providers: ['@deepseek-ai/dsh-persona'], tools: ['read'], prompt: 'MASTER_DERIVED_SENTINEL', model: 'testLLM', toolOverrides: { read: { description: 'DERIVED_READ_SENTINEL' } } };
await rpc('studioCatalog/savePreset', { payload: JSON.stringify({ id: master.id, name: 'forbidden', description: '', request }) }, false);
const preview = await rpc('studioCatalog/preview', { request });
assert.deepEqual(preview.tools.map(t => t.name), ['read']);
assert.equal(preview.tools[0].description, 'DERIVED_READ_SENTINEL');
assert.ok(preview.prompt.includes('MASTER_DERIVED_SENTINEL'));
const saved = await rpc('studioCatalog/savePreset', { payload: JSON.stringify({ name: '__master_runtime_check__', description: '', request }) });
try {
 assert.equal(saved.request.preset, master.id);
 const applied = await rpc('studioCatalog/applyPreset', { id: saved.id }); assert.equal(applied.status, 'applied');
 assert.deepEqual(await rpc('studioCatalog/read'), catalog);
} finally { await rpc('studioCatalog/deletePreset', { id: saved.id }); }
const prefix = 'CONFIG_PREFIX_SENTINEL';
const configPreview = await rpc('studioCatalog/preview', { request: { ...request, configOverrides: { persona: { prefix } } } });
assert.ok(configPreview.prompt.includes(prefix), 'Config override must affect assembled prompt');
await rpc('studioCatalog/preview', { request: { ...request, configOverrides: { 'tool-fs': { readLimit: -1 } } } }, false);
const originalExtensions = await rpc('studioCatalog/readExtensions');
try {
  await rpc('studioCatalog/saveExtensions', { payload: JSON.stringify([{ id: 'missing', name: '@studio-test/nonexistent-provider' }]) }, false);
  assert.deepEqual(await rpc('studioCatalog/read'), catalog);
  const expanded = await rpc('studioCatalog/saveExtensions', { payload: JSON.stringify([{ id: 'extra-agent', name: '@deepseek-ai/dsh-tool-subagent', config: { provider: 'spawn', toolName: 'studio_extra_agent' } }]) });
  assert.ok(expanded.tools.some(t => t.name === 'studio_extra_agent'));
  assert.ok(expanded.plugins.some(p => p.id === 'studio-added/extra-agent'));
  const extra = await rpc('studioCatalog/preview', { request: { ...request, tools: ['studio_extra_agent'], toolOverrides: {} } });
  assert.deepEqual(extra.tools.map(t => t.name), ['studio_extra_agent']);
} finally { await rpc('studioCatalog/saveExtensions', { payload: JSON.stringify(originalExtensions) }); }
assert.deepEqual(await rpc('studioCatalog/read'), catalog);
console.log(`Master read-only guards, ${catalog.tools.length} scoped tools, derived preview overrides, apply and cleanup passed.`);
