import { runtimeCheckTarget } from './runtime-check-target.mjs';
// Packaged, unmodified-runtime smoke check; no LLM calls or persistent test drafts.
import assert from 'node:assert/strict';
const url = runtimeCheckTarget(process.argv[2]);
const auth = await fetch(url, { redirect: 'manual' });
const cookie = auth.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
async function rpc(method, args = {}) {
  const response = await fetch(new URL(`/api/${method}`, url), { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method, payload: { args } }), signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200);
  const body = await response.json(); assert.equal(body.result.ok, true, JSON.stringify(body)); return body.result.value;
}
const roles = [
  { name: 'Researcher', role: 'Research', model: 'inherit', reasoning: 'inherit', spawn: 'fresh', persona: 'Cite sources.' },
  { name: 'Reviewer', role: 'Review', model: 'inherit', reasoning: 'inherit', spawn: 'fork', persona: 'Review only.' },
];
const saved = await rpc('studioCatalog/savePreset', { payload: JSON.stringify({ name: '__role_runtime_check__', description: 'temporary smoke check', request: { preset: 'studio-master', providers: [], tools: ['read'], prompt: '', model: 'testLLM' }, agents: roles }) });
try {
  assert.equal(saved.agents.length, 2);
  const applied = await rpc('studioCatalog/applyPreset', { id: saved.id });
  assert.equal(applied.status, 'applied');
  const stored = (await rpc('studioCatalog/listPresets')).find(item => item.id === saved.id);
  assert.equal(stored.agents[1].spawn, 'fork');
  assert.equal(stored.agents[0].persona, 'Cite sources.');
  const models = await rpc('studioCatalog/roleModels'); assert.ok(Array.isArray(models.groups));
  const modified = await rpc('studioCatalog/savePreset', { payload: JSON.stringify({ ...saved, name: '__updated_role_check__' }) });
  assert.equal(modified.status, 'modified');
  assert.equal((await rpc('studioCatalog/applyPreset', { id: saved.id })).status, 'applied');
  assert.equal((await rpc('studioCatalog/unapplyPreset', { id: saved.id })).status, 'draft');
  const retained = (await rpc('studioCatalog/listPresets')).find(item => item.id === saved.id);
  assert.equal(retained.name, '__updated_role_check__'); assert.equal(retained.agents.length, 2);
  assert.equal((await rpc('studioCatalog/applyPreset', { id: saved.id })).status, 'applied');
  console.log(`Role save/edit/reapply/unapply/restore passed; model catalog: ${models.groups.length} providers, ${models.groups.reduce((n, g) => n + g.models.length, 0)} models. No LLM child was started.`);
} finally { await rpc('studioCatalog/deletePreset', { id: saved.id }); }
