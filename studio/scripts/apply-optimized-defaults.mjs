// Explicit one-shot update of the isolated preview, never the user's main profile.
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { optimizedTemplate } from '../src/optimized-preset.ts';
const url = new URL(process.argv[2]);
assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '19388');
const auth = await fetch(url, { redirect: 'manual' });
const cookie = auth.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
async function rpc(method, args = {}) {
  const response = await fetch(new URL(`/api/studioCatalog/${method}`, url), { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method: `studioCatalog/${method}`, payload: { args } }), signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.result.ok, true, JSON.stringify(body)); return body.result.value;
}
const current = (await rpc('listPresets')).find(row => row.id === 'studio-optimized'); assert.ok(current);
const desired = optimizedTemplate(current.request.tools).request;
const oldPrompt = `Use glob to discover paths, grep to search contents, and read to inspect files before editing. Prefer targeted edits.
When read_batch is available, batch independent read-only inspections; keep dependent reads sequential.
Use bash for a single command. When task_run is available, use its explicit success dependencies for dependent commands.
Wait in the foreground when the next step needs the result. Use background execution only for independent work or intentionally long-lived services.
Track every job you start. Collect relevant results before claiming success; cancel work that is no longer needed. Do not busy-poll or duplicate running work.
Delegate self-contained independent work when useful and collect the result before relying on it.
Keep changes within the requested scope, preserve user work, and verify according to risk. Report failures and unverified behavior honestly.`;
let prompt = current.request.prompt;
if (prompt.includes(oldPrompt)) prompt = prompt.replace(oldPrompt, desired.prompt);
else if (!prompt.includes(desired.prompt)) prompt = `${prompt}\n\n${desired.prompt}`.trim();
// Preserve custom text unless it mentions the excluded tool; stop for manual review rather than delete user prose.
assert.ok(!prompt.includes('task_run'), 'Custom task_run instruction requires explicit manual review');
const keep = entries => Object.fromEntries(Object.entries(entries ?? {}).filter(([name]) => desired.tools.includes(name)));
const toolOverrides = keep(current.request.toolOverrides);
for (const [name, patch] of Object.entries(desired.toolOverrides)) toolOverrides[name] = { ...patch, ...toolOverrides[name], parameters: { ...patch.parameters, ...toolOverrides[name]?.parameters } };
const defaults = keep(current.request.execution?.defaults);
for (const [name, values] of Object.entries(desired.execution.defaults)) defaults[name] = { ...values, ...defaults[name] };
const request = { ...current.request, tools: desired.tools, prompt, toolOverrides,
  configOverrides: { ...current.request.configOverrides, 'spill-policy': { ...current.request.configOverrides?.['spill-policy'], maxInlineTokens: 2500 } },
  execution: { ...current.request.execution, defaults, ...(current.request.execution?.batch && !desired.tools.includes(current.request.execution.batch.tool) ? { batch: undefined } : {}) },
};
const before = await rpc('preview', { request: current.request });
const after = await rpc('preview', { request });
for (const name of ['task_run', 'get_goal', 'create_goal', 'update_goal', 'todo_write']) assert.ok(!after.tools.some(tool => tool.name === name));
assert.ok(!after.prompt.includes('task_run'), 'Assembled prompt retains an excluded tool instruction');
assert.equal(after.tools.find(t => t.name === 'bash')?.parameters.properties.timeoutMs.default, 600000);
assert.equal(after.tools.find(t => t.name === 'job_output')?.parameters.properties.timeout_ms.default, 120000);
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
const backup = new URL(`../dist/optimized-before-${Date.now()}.json`, import.meta.url);
await writeFile(backup, JSON.stringify(current, null, 2), { flag: 'wx', mode: 0o600 });
await rpc('savePreset', { payload: JSON.stringify({ ...current, request }) });
await rpc('applyPreset', { id: current.id });
console.log(JSON.stringify({ backup: backup.pathname, beforePromptChars: before.prompt.length, afterPromptChars: after.prompt.length, beforeToolSchemaChars: JSON.stringify(before.tools).length, afterToolSchemaChars: JSON.stringify(after.tools).length, tools: after.tools.map(t => t.name), spillTokens: 2500 }, null, 2));
