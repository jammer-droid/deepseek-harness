import assert from 'node:assert/strict';
const url = new URL(process.argv[2]); assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '19388');
const auth = await fetch(url, { redirect: 'manual' });
const cookie = auth.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
async function rpc(method, args = {}, ok = true) {
  const response = await fetch(new URL(`/api/studioCatalog/${method}`, url), { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method: `studioCatalog/${method}`, payload: { args } }), signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.result.ok, ok, JSON.stringify(body)); return body.result.value;
}
const catalog = await rpc('read');
for (const id of ['standard', 'ptc', 'minimal', 'cordis']) { const row = catalog.presets.find(p => p.id === id); assert.ok(row, id); assert.equal(row.error, undefined, `${id}: ${row.error}`); console.log(id, row.tools.length); }
const presets = await rpc('listPresets');
assert.equal(presets[0].id, 'studio-master'); assert.equal(presets[0].readOnly, true);
const template = presets[1]; assert.equal(template.id, 'studio-optimized');
assert.equal(template.template, true); assert.equal(template.nonDeletable, true); assert.ok(!template.readOnly);
await rpc('deletePreset', { id: template.id }, false);
assert.equal(template.request.configOverrides?.['spill-policy']?.maxInlineTokens, 2500);
const preview = await rpc('preview', { request: template.request });
for (const name of ['task_run', 'get_goal', 'create_goal', 'update_goal', 'todo_write']) assert.ok(!preview.tools.some(tool => tool.name === name), name);
assert.doesNotMatch(preview.prompt, /task_run/);
assert.equal(preview.tools.find(tool => tool.name === 'bash').parameters.properties.timeoutMs.default, 600000);
assert.equal(preview.tools.find(tool => tool.name === 'job_output').parameters.properties.timeout_ms.default, 120000);
// Avoid rewriting an existing user's modified/applied snapshot during this smoke test.
// Persistent edit/apply/unapply/restart behavior is covered by optimized-preset.test.mjs.
const { id, ...copy } = template;
const saved = await rpc('savePreset', { payload: JSON.stringify({ ...copy, name: '__optimized_copy_check__' }) });
try { assert.equal((await rpc('applyPreset', { id: saved.id })).status, 'applied'); } finally { await rpc('deletePreset', { id: saved.id }); }
console.log('Master-first ordering, non-deletable editable Optimized, copy activation, and four built-in tool catalogs passed.');
console.log(template.applyWarning ?? 'Optional tool providers available.');
