/**
 * Web search cost probe (L0). Sends the same queries through the request each DSH provider sends
 * (legacy Messages + native web_search, and the Search API), plus the same URLs through a plain HTTP
 * GET and the Fetch API, and records usage, latency, result size and billability. No answer text
 * is printed; sources are kept under the run directory for the L1 quality comparison.
 *
 *   node studio/scripts/e2e/web-cost-probe.mjs [--queries N] [--skip-fetch] [--l1-only]
 *
 * --l1-only rebuilds l1-items.jsonl / l1-map.json from the stored sources.json without API calls.
 *
 * The API key is read from the isolated home's .credentials.yaml (copied by
 * `server.mjs up --with-secrets keys`), never from ~/.dsh. Env: STUDIO_E2E_HOME, WEB_COST_RUN
 * (run directory name, default today's date). Prints one JSON summary; exit 1 if any call failed
 * for a reason other than an empty result, 2 on bad input or a missing key.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { FETCH_URLS, QUERIES, aggregateProbe, apiCost, apiSearchBody, apiSources, flipFor, legacyBody, legacyCost, legacySources, legacyUsage, pairItem, toolText } from './web-cost-lib.mjs';

const studio = fileURLToPath(new URL('../..', import.meta.url));
const home = path.resolve(process.env.STUDIO_E2E_HOME ?? path.join(studio, 'dist/e2e/home'));
const runName = process.env.WEB_COST_RUN ?? new Date().toISOString().slice(0, 10);
const outDir = path.join(studio, 'dist/e2e/web-cost', runName);

const args = process.argv.slice(2);
const fail = (code, error) => { console.log(JSON.stringify({ ok: false, error }, null, 2)); process.exit(code); };
let limit = QUERIES.length;
let skipFetch = false;
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--queries') { limit = Number(args[++index]); if (!Number.isInteger(limit) || limit < 1) fail(2, 'Invalid --queries'); }
  else if (args[index] === '--skip-fetch') skipFetch = true;
  else if (args[index] === '--l1-only') { /* handled below */ }
  else fail(2, `Unknown option: ${args[index]}`);
}

/** L1 items and their A/B map from the stored sources (no API calls). */
function writeL1(sourcesOut) {
  const l1 = [];
  const map = {};
  for (const { id, query, legacy, api } of sourcesOut) {
    if (!legacy.length && !api.length) continue;
    const pair = pairItem(id, query, legacy, api, flipFor(id));
    l1.push(pair.item);
    map[id] = pair.map;
  }
  writeFileSync(path.join(outDir, 'l1-items.jsonl'), l1.map(item => JSON.stringify(item)).join('\n') + '\n');
  writeFileSync(path.join(outDir, 'l1-map.json'), JSON.stringify(map, null, 2));
  return l1.length;
}

if (args.includes('--l1-only')) {
  const file = path.join(outDir, 'sources.json');
  if (!existsSync(file)) fail(2, `No ${file}; run the probe first`);
  console.log(JSON.stringify({ ok: true, run: runName, l1: { items: writeL1(JSON.parse(readFileSync(file, 'utf8'))) } }, null, 2));
  process.exit(0);
}

const credentials = path.join(home, '.credentials.yaml');
if (!existsSync(credentials)) fail(2, `No ${credentials}; run server.mjs up --with-secrets keys first (environment blocked)`);
const key = yaml.load(readFileSync(credentials, 'utf8'))?.refs?.DEEPSEEK_API_KEY;
if (typeof key !== 'string' || !key) fail(2, 'DEEPSEEK_API_KEY not in the isolated credentials (environment blocked)');

const LEGACY = 'https://api.deepseek.com/anthropic/v1/messages';
const API = 'https://api.deepseek.com/v1/tools';
const TIMEOUT = 120_000;

async function post(url, body, headers) {
  const started = performance.now();
  try {
    const response = await fetch(url, { method: 'POST', redirect: 'error', headers: { 'content-type': 'application/json', accept: 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT) });
    const text = await response.text();
    let json;
    try { json = JSON.parse(text); } catch { /* non-JSON error body */ }
    return { status: response.status, json, latencyMs: Math.round(performance.now() - started), error: response.ok ? undefined : (json?.error?.message ?? json?.message ?? text.slice(0, 200)) };
  } catch (error) {
    return { status: 0, latencyMs: Math.round(performance.now() - started), error: String(error?.message ?? error).slice(0, 200) };
  }
}

async function legacySearch(query) {
  const result = await post(LEGACY, legacyBody(query), { 'x-api-key': key, authorization: `Bearer ${key}`, 'anthropic-version': '2023-06-01' });
  const base = { kind: 'search', provider: 'legacy', query, status: result.status, latencyMs: result.latencyMs };
  if (result.status !== 200) return { record: { ...base, ok: false, error: result.error }, sources: [] };
  const usage = legacyUsage(result.json?.usage);
  const { sources, resultBlocks } = legacySources(result.json);
  // The provider throws when no web_search_tool_result block arrives; the tokens are spent anyway.
  return { record: { ...base, ok: resultBlocks > 0, ...(resultBlocks ? {} : { error: 'no web_search_tool_result block' }), billable: true, usage, sources: sources.length, resultChars: toolText(sources).length, cost: legacyCost(usage), stopReason: result.json?.stop_reason }, sources };
}

async function apiSearch(query) {
  const result = await post(`${API}/search`, apiSearchBody(query), { authorization: `Bearer ${key}` });
  const base = { kind: 'search', provider: 'api', query, status: result.status, latencyMs: result.latencyMs };
  if (result.status !== 200) return { record: { ...base, ok: false, error: result.error, billable: false, cost: apiCost(false) }, sources: [] };
  const sources = apiSources(result.json);
  const billable = sources.length > 0;
  return { record: { ...base, ok: true, billable, sources: sources.length, resultChars: toolText(sources).length, cost: apiCost(billable) }, sources };
}

async function plainFetch(url) {
  const started = performance.now();
  try {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30_000), headers: { 'user-agent': 'deepseek-harness/0.0.1' } });
    const body = await response.text();
    return { kind: 'fetch', provider: 'legacy', url, status: response.status, ok: response.ok, billable: false, latencyMs: Math.round(performance.now() - started), resultChars: body.length, cost: apiCost(false) };
  } catch (error) {
    return { kind: 'fetch', provider: 'legacy', url, status: 0, ok: false, latencyMs: Math.round(performance.now() - started), error: String(error?.message ?? error).slice(0, 200), cost: apiCost(false) };
  }
}

async function apiFetch(url) {
  const result = await post(`${API}/fetch`, { url }, { authorization: `Bearer ${key}` });
  const content = typeof result.json?.content === 'string' ? result.json.content : '';
  const ok = result.status === 200 && content.length > 0;
  return { kind: 'fetch', provider: 'api', url, status: result.status, ok, billable: ok, latencyMs: result.latencyMs, resultChars: content.length, cost: apiCost(ok), ...(ok ? {} : { error: result.error ?? 'empty content' }) };
}

mkdirSync(outDir, { recursive: true });
const records = [];
const sourcesOut = [];
const queries = QUERIES.slice(0, limit);
// Both providers run each query together; queries run three at a time (Search API QPS limit is 5).
for (let index = 0; index < queries.length; index += 3) {
  await Promise.all(queries.slice(index, index + 3).map(async (query, offset) => {
    const [legacy, api] = await Promise.all([legacySearch(query), apiSearch(query)]);
    records.push(legacy.record, api.record);
    const id = `q${String(index + offset + 1).padStart(2, '0')}`;
    sourcesOut.push({ id, query, legacy: legacy.sources, api: api.sources });
  }));
}
if (!skipFetch) {
  for (const url of FETCH_URLS) {
    const [plain, api] = await Promise.all([plainFetch(url), apiFetch(url)]);
    records.push(plain, api);
  }
}

writeFileSync(path.join(outDir, 'probe.jsonl'), records.map(record => JSON.stringify(record)).join('\n') + '\n');
sourcesOut.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(path.join(outDir, 'sources.json'), JSON.stringify(sourcesOut, null, 2));
const l1Count = writeL1(sourcesOut);

const failures = records.filter(record => !record.ok).map(({ kind, provider, query, url, status, error }) => ({ kind, provider, target: query ?? url, status, error }));
const summary = { ok: failures.length === 0, level: 'L0', run: runName, out: path.relative(path.resolve(studio, '..'), outDir), aggregate: aggregateProbe(records), failures, l1: { items: l1Count } };
console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.ok ? 0 : 1;
