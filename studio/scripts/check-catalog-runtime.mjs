import assert from 'node:assert/strict';
const url = new URL(process.argv[2]);
assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '19388');
const auth = await fetch(url, { redirect: 'manual' });
const cookie = auth.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
async function read() {
 const method = 'studioCatalog/read';
 const response = await fetch(new URL(`/api/${method}`, url), { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method, payload: { args: {} } }), signal: AbortSignal.timeout(30000) });
 assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.result.ok, true, JSON.stringify(body)); return body.result.value;
}
const first = await read();
assert.ok(first.plugins.length > 0, 'Expected actual Loader entries');
assert.ok(first.plugins.some(row => row.schema), 'Expected actual exported Config schema');
assert.ok(first.plugins.every(row => !Object.hasOwn(row, 'config')), 'Raw config may contain secrets');
assert.deepEqual(await read(), first, 'Catalog should be stable across RPC reads');
console.log(JSON.stringify({ plugins: first.plugins.length, schemas: first.plugins.filter(row => row.schema).length, errors: first.plugins.filter(row => row.error), tools: first.tools.length }, null, 2));
