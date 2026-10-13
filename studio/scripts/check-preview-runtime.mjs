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
const catalog = await rpc('studioCatalog/read', {});
assert.equal(catalog.ok, true);
const providers = new Map(catalog.value.presets.filter(p => ['minimal','standard','ptc','cordis'].includes(p.id)).flatMap(p => p.promptProviders ?? []).map(p => [p.name,p]));
console.log('Installed builtin contributors:', [...providers.keys()]);
assert.ok(providers.size >= 6);
for (const name of providers.keys()) {
  const result = await rpc('studioCatalog/preview', { request: { ...request, providers: [name], tools: [], ...(name.endsWith('agent-tool-presentation') ? { providerConfigs: { [name]: { mode: 'native' } } } : {}) } });
  assert.equal(result.ok, true, `${name}: ${JSON.stringify(result)}`);
}

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
const edited = { ...request, preset: 'minimal', providers: ['@deepseek-ai/dsh-persona'], persona: 'STUDIO_PERSONA', toolOverrides: { read: { description: 'STUDIO_READ_DESCRIPTION', parameters: { file_path: 'STUDIO_PATH_DESCRIPTION' } } }, sections: { 'tool:jobs': 'STUDIO_JOB_RULES' } };
const preview = await rpc('studioCatalog/preview', { request: edited });
assert.equal(preview.ok, true, JSON.stringify(preview));
assert.ok(preview.value.prompt.includes('STUDIO_PERSONA'));
assert.ok(preview.value.prompt.includes('STUDIO_JOB_RULES'));
assert.equal(preview.value.sections.at(-1).name, 'studio:additional');
const read = preview.value.tools.find(t => t.name === 'read');
assert.equal(read.description, 'STUDIO_READ_DESCRIPTION');
assert.equal(read.parameters.properties.file_path.description, 'STUDIO_PATH_DESCRIPTION');
const original = await rpc('studioCatalog/preview', { request });
assert.notEqual(original.value.tools.find(t => t.name === 'read').description, read.description);
assert.deepEqual(await rpc('agentPresets/list', {}), before);
console.log('Packaged runtime passed: preview, persona, description/parameter/section overlays, original restoration, exact selection and cleanup.');
