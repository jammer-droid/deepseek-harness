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
const exported = await rpc('studioCatalog/exportPreset', { request: edited });
assert.equal(exported.ok, true, JSON.stringify(exported));
assert.ok(exported.value.files['cordis.patch.yml'].includes('@local/dsh-studio-shell/policy'));
assert.equal(JSON.parse(exported.value.files['package.json']).dsh.bundle.patch, './cordis.patch.yml');
if (process.argv[3]) {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const directory = path.resolve(process.argv[3]);
  assert.ok(directory.startsWith(path.resolve('dist') + path.sep), 'Export verification output must stay in Studio dist');
  await mkdir(directory, { recursive: true });
  for (const [name, content] of Object.entries(exported.value.files)) { assert.equal(path.basename(name), name); await writeFile(path.join(directory, name), content); }
}
assert.deepEqual(await rpc('agentPresets/list', {}), before);
console.log('Packaged runtime passed: preview, persona, description/parameter/section overlays, original restoration, exact selection, export and cleanup.');
