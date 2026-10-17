// Packaged, unmodified-runtime check of session roles (#29). No LLM calls; the temporary preset is removed afterwards.
// Usage: node studio/scripts/check-session-roles-runtime.mjs '<isolated preview URL with token>' [--keep]
import assert from 'node:assert/strict';
const url = new URL(process.argv[2]);
const keep = process.argv.includes('--keep');
assert.equal(url.hostname, '127.0.0.1');
assert.notEqual(url.port, '19387', 'never the user GUI');
const auth = await fetch(url, { redirect: 'manual' });
const cookie = auth.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
async function rpc(method, args = {}) {
  const response = await fetch(new URL(`/api/${method}`, url), { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method, payload: { args } }), signal: AbortSignal.timeout(30000) });
  const body = await response.json();
  if (!body.result?.ok) throw new Error(`${method}: ${JSON.stringify(body)}`);
  return body.result.value;
}
const roles = [{ name: 'Reviewer', role: 'review', model: 'inherit', reasoning: 'inherit', spawn: 'fork', persona: 'Preset persona.' }];
const saved = await rpc('studioCatalog/savePreset', { payload: JSON.stringify({ name: '__session_roles_check__', description: 'temporary #29 check', request: { preset: 'studio-master', providers: [], tools: ['read', 'subagent_role'], prompt: '', model: 'testLLM' }, agents: roles }) });
try {
  assert.equal((await rpc('studioCatalog/applyPreset', { id: saved.id })).status, 'applied');
  const { sessionId } = await rpc('session/create', { request: { agentPreset: saved.id } });
  let view = await rpc('studioSessionRoles/view', { sessionId });
  assert.deepEqual([view.available, view.readOnly, view.presetId, view.roles.map(r => [r.role, r.source])], [true, false, saved.id, [['review', 'preset']]]);
  view = await rpc('studioSessionRoles/editRole', { sessionId, payload: JSON.stringify({ role: 'review', persona: 'Session persona.' }) });
  assert.deepEqual([view.roles[0].source, view.roles[0].persona, view.roles[0].spawn], ['session', 'Session persona.', 'fork']);
  view = await rpc('studioSessionRoles/addRole', { sessionId, payload: JSON.stringify({ name: 'Scout', role: 'scout' }) });
  assert.deepEqual(view.roles.map(r => [r.role, r.source, r.spawn]), [['review', 'session', 'fork'], ['scout', 'session', 'fresh']]);
  // The preset itself is unchanged.
  const stored = (await rpc('studioCatalog/listPresets')).find(item => item.id === saved.id);
  assert.equal(stored.agents[0].persona, 'Preset persona.');
  // A second session of the same preset does not see the first session's roles.
  const other = await rpc('session/create', { request: { agentPreset: saved.id } });
  assert.deepEqual((await rpc('studioSessionRoles/view', { sessionId: other.sessionId })).roles.map(r => [r.role, r.source]), [['review', 'preset']]);
  console.log(JSON.stringify({ sessionId, otherSessionId: other.sessionId, presetId: saved.id, roles: view.roles.map(r => [r.role, r.source]) }));
  console.log('Session roles: view/edit/add on an applied Studio preset passed; preset unchanged; sessions isolated. No LLM child was started.');
} finally {
  if (!keep) await rpc('studioCatalog/deletePreset', { id: saved.id });
}
