import assert from 'node:assert/strict';
const url = new URL(process.argv[2]);
assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '19388');
const auth = await fetch(url, { redirect: 'manual' });
const cookie = auth.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
async function rpc(method, args = {}, ok = true) {
 const response = await fetch(new URL(`/api/${method}`, url), { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method, payload: { args } }), signal: AbortSignal.timeout(30000) });
 assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.result.ok, ok, JSON.stringify(body)); return body.result.value;
}
const catalog = await rpc('studioCatalog/read');
assert.deepEqual(catalog.presets.map(p => p.id), ['studio-master']);
assert.ok(catalog.tools.some(t => t.name === 'read'));
const master = (await rpc('studioCatalog/listPresets')).find(p => p.id === 'studio-master'); assert.equal(master.readOnly, true);
for (const method of ['deletePreset', 'applyPreset']) await rpc(`studioCatalog/${method}`, { id: master.id }, false);
const request = { preset: master.id, providers: ['@deepseek-ai/dsh-persona'], tools: ['read'], prompt: 'MASTER_DERIVED_SENTINEL', model: 'testLLM', toolOverrides: { read: { description: 'DERIVED_READ_SENTINEL' } } };
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
console.log(`Master read-only guards, ${catalog.tools.length} scoped tools, derived preview overrides, apply and cleanup passed.`);
