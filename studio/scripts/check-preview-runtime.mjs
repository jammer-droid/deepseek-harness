// Run against the isolated packaged preview, with its token-bearing URL.
import assert from 'node:assert/strict';
const url = new URL(process.argv[2]);
assert.equal(url.hostname, '127.0.0.1');
assert.equal(url.port, '19388');
const auth = await fetch(url, { redirect: 'manual' });
const cookie = auth.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
async function rpc(method, args) {
  const response = await fetch(new URL(`/api/${method}`, url), {
    method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method, payload: { args } }),
  });
  assert.equal(response.status, 200);
  return (await response.json()).result;
}
const request = { preset: 'standard', providers: [], tools: ['read', 'grep', 'glob'], prompt: 'STUDIO_PREVIEW_SENTINEL', model: 'Preview Model' };
const before = await rpc('agentPresets/list', {});
const failed = await rpc('studioCatalog/preview', { request: { ...request, model: '' } });
assert.equal(failed.ok, false);
assert.match(failed.error.message, /model/);
for (const tools of [request.tools, []]) {
  const result = await rpc('studioCatalog/preview', { request: { ...request, tools } });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.ok(result.value.prompt.includes(request.prompt));
  assert.ok(result.value.sections.some(section => section.name === 'studio:additional'));
  assert.deepEqual(result.value.tools.map(tool => tool.name).sort(), [...tools].sort());
}
assert.deepEqual(await rpc('agentPresets/list', {}), before, 'Temporary preset must be removed after success and failure');
console.log('Packaged runtime preview passed: assembly, tool restrictions, empty selection, failure cleanup.');
