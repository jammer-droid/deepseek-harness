import assert from 'node:assert/strict';
const url = new URL(process.argv[2]);
assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '19388');
const auth = await fetch(url, { redirect: 'manual' });
const cookie = auth.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
async function rpc(method, args = {}) {
  const response = await fetch(new URL(`/api/${method}`, url), { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method, payload: { args } }) });
  assert.equal(response.status, 200);
  const result = (await response.json()).result;
  assert.equal(result.ok, true, JSON.stringify(result)); return result.value;
}
const name = '__studio_preset_runtime_check__';
const mode = process.argv[3] ?? 'create';
if (mode === 'create') {
  const saved = await rpc('studioCatalog/savePreset', { payload: JSON.stringify({ name, description: 'Disposable runtime check', request: { preset: 'minimal', providers: ['@deepseek-ai/dsh-persona'], tools: ['read'], prompt: 'PERSISTED_STUDIO_SENTINEL', model: 'testLLM' }, conveniences: { batch: 8 }, agents: [] }) });
  assert.equal(saved.status, 'draft');
  const applied = await rpc('studioCatalog/applyPreset', { id: saved.id }); assert.equal(applied.status, 'applied');
  assert.ok(JSON.stringify(await rpc('agentPresets/list')).includes(saved.id));
  console.log('Saved and applied actual DSH preset:', saved.id, 'Restart and run with verify.');
} else {
  const saved = (await rpc('studioCatalog/listPresets')).find(p => p.name === name); assert.ok(saved); assert.equal(saved.status, 'applied');
  assert.ok(JSON.stringify(await rpc('agentPresets/list')).includes(saved.id));
  await rpc('studioCatalog/deletePreset', { id: saved.id });
  assert.ok(!JSON.stringify(await rpc('agentPresets/list')).includes(saved.id));
  assert.ok(!(await rpc('studioCatalog/listPresets')).some(p => p.id === saved.id));
  console.log('Restart persistence, DSH registration restoration and deletion passed.');
}
