// #38 S1: reproduce the shared-provider failure on an isolated server started by server.mjs.
// Usage: node studio/scripts/e2e/s38-repro.mjs  (reads <home>/e2e-runs/<profile>/state.json)
// Mutates only the isolated profile: Master extensions and one test preset, restored at the end.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const home = process.env.STUDIO_E2E_HOME ?? fileURLToPath(new URL('../../dist/e2e/home', import.meta.url));
const profile = process.env.STUDIO_E2E_PROFILE ?? 'p38';
const state = JSON.parse(readFileSync(join(home, 'e2e-runs', profile, 'state.json'), 'utf8'));
const profileDir = join(home, 'profiles', profile);
const url = state.url;
const auth = await fetch(url, { redirect: 'manual' });
const cookie = auth.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
const redact = text => String(text).replace(/token=[\w-]+/g, 'token=<redacted>');
async function rpc(method, args = {}) {
  const response = await fetch(new URL(`/api/${method}`, url), { method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method, payload: { args } }), signal: AbortSignal.timeout(60000) });
  const body = await response.json();
  return body.result?.ok ? { ok: true, value: body.result.value } : { ok: false, error: redact(JSON.stringify(body.result?.error ?? body)).slice(0, 1200) };
}
const files = () => {
  const read = name => { try { return JSON.parse(readFileSync(join(profileDir, 'studio-data', name), 'utf8')); } catch { return null; } };
  const presets = read('presets.json');
  return { extensions: read('master-extensions.json')?.extensions?.map(r => r.id) ?? null,
    presets: presets?.presets?.map(p => ({ id: p.id.slice(0, 24), status: p.status, exaInApplied: (p.applied?.plugins ?? '').includes('web-search-exa'), warn: p.applyWarning?.slice(0, 300) })) ?? null };
};
const log = [];
const record = (step, result) => { log.push({ step, ...result, files: files() }); };
const EXA = '@deepseek-ai/dsh-web-search-exa';
const original = await rpc('studioCatalog/readExtensions');
let presetId;
try {
  record('initial', { ok: true });
  // State A: Exa nowhere -> add.
  const add = await rpc('studioCatalog/addMasterPlugin', { payload: EXA });
  record('A.add', { ok: add.ok, error: add.error, configEntry: add.ok ? add.value.plugins.some(p => p.id.endsWith('web-search-exa')) : undefined });
  // Key save as a preset Config override, then apply.
  const catalog = await rpc('studioCatalog/read');
  const exaId = catalog.value?.plugins.find(p => p.name === EXA)?.id;
  const optimized = (await rpc('studioCatalog/listPresets')).value?.find(p => p.id === 'studio-optimized');
  const request = { ...optimized.request, configOverrides: { ...(optimized.request.configOverrides ?? {}), ...(exaId ? { [exaId]: { apiKey: 'test-key-not-real' } } : {}) } };
  const saved = await rpc('studioCatalog/savePreset', { payload: JSON.stringify({ name: '__s38_repro__', description: '', request, agents: optimized.agents }) });
  presetId = saved.value?.id;
  record('A.saveKey', { ok: saved.ok, error: saved.error, exaId });
  const apply = await rpc('studioCatalog/applyPreset', { id: presetId });
  record('A.apply', { ok: apply.ok, error: apply.error });
  // State B: Exa already in Master -> add another (probe would carry a second Exa).
  const addOther = await rpc('studioCatalog/saveExtensions', { payload: JSON.stringify([...(await rpc('studioCatalog/readExtensions')).value, { id: 'extra-agent', name: '@deepseek-ai/dsh-tool-subagent', config: { provider: 'spawn', toolName: 'studio_extra_agent' } }]) });
  record('B.addOther', { ok: addOther.ok, error: addOther.error });
  // Optimized startup alignment path (the Desktop observation).
  const optApply = await rpc('studioCatalog/applyPreset', { id: 'studio-optimized' });
  record('B.applyOptimized', { ok: optApply.ok, error: optApply.error });
} finally {
  if (presetId) await rpc('studioCatalog/deletePreset', { id: presetId });
  const restore = await rpc('studioCatalog/saveExtensions', { payload: JSON.stringify(original.value ?? []) });
  record('restore', { ok: restore.ok, error: restore.error });
  console.log(JSON.stringify(log, null, 2));
}
