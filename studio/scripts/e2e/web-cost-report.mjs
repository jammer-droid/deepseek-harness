/**
 * Build the web search cost report from a run directory: probe.jsonl (web-cost-probe.mjs),
 * sessions-<provider>.json (web-cost-session.mjs) and the L1 pixie_loop results (l1-results.jsonl,
 * mapped back through l1-map.json). Missing parts are reported as not run.
 *
 *   node studio/scripts/e2e/web-cost-report.mjs [--job <pixie job id>]
 *
 * Env: WEB_COST_RUN. Writes dist/e2e/web-cost/<run>/report.md and prints a JSON summary.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRICES, aggregateProbe, conversationCost, renderReport } from './web-cost-lib.mjs';

const studio = fileURLToPath(new URL('../..', import.meta.url));
const run = process.env.WEB_COST_RUN ?? new Date().toISOString().slice(0, 10);
const dir = path.join(studio, 'dist/e2e/web-cost', run);
const jobIndex = process.argv.indexOf('--job');
const job = jobIndex > 0 ? process.argv[jobIndex + 1] : undefined;
const read = name => (existsSync(path.join(dir, name)) ? readFileSync(path.join(dir, name), 'utf8') : undefined);
const jsonl = text => (text ?? '').split('\n').filter(Boolean).map(line => JSON.parse(line));

const probeRecords = jsonl(read('probe.jsonl'));
const probe = probeRecords.length ? aggregateProbe(probeRecords) : undefined;
const legacyPerSearch = probe?.['search:legacy']?.ok ? probe['search:legacy'].cost.afterBilling.offPeak / probe['search:legacy'].ok : undefined;

const sessions = [];
let meta = {};
for (const provider of ['legacy', 'api']) {
  const text = read(`sessions-${provider}.json`);
  if (!text) continue;
  const data = JSON.parse(text);
  meta = { runtime: data.runtime, sha256: data.sha256 };
  const total = { usage: { inputTokens: 0, cacheHitTokens: 0, cacheWriteTokens: 0, outputTokens: 0 }, tools: {}, webResultChars: 0, legacySearchRequests: 0 };
  for (const item of data.runs) {
    for (const key of Object.keys(total.usage)) total.usage[key] += item.usage?.[key] ?? 0;
    for (const [name, count] of Object.entries(item.tools ?? {})) total.tools[name] = (total.tools[name] ?? 0) + count;
    total.webResultChars += item.webResultChars ?? 0;
    total.legacySearchRequests += item.legacySearchRequests ?? 0;
  }
  const model = data.runs.find(item => item.model)?.model;
  const webCostEstimate = provider === 'legacy'
    ? (legacyPerSearch === undefined ? undefined : total.legacySearchRequests * legacyPerSearch)
    : ((total.tools.web_search_queries ?? 0) + (total.tools.web_fetch ?? 0)) * PRICES.perRequest;
  sessions.push({ provider, model, sessions: data.runs.length, turnsCompleted: data.runs.filter(item => item.turns?.at(-1) === 'completed').length, total, conversationCost: conversationCost({ model, usage: total.usage }), webCostEstimate });
}

let quality;
const results = jsonl(read('l1-results.jsonl'));
const map = read('l1-map.json') && JSON.parse(read('l1-map.json'));
if (results.length && map) {
  const counts = { legacy: 0, api: 0, tie: 0 };
  const unresolved = [];
  for (const result of results) {
    const pick = typeof result.output === 'string' ? result.output.trim() : undefined;
    const winner = result.status === 'passed' && pick ? map[result.id]?.[pick] : undefined;
    if (winner) counts[winner]++; else unresolved.push(`${result.id}(${result.status})`);
  }
  quality = { job, total: results.length, decided: counts.legacy + counts.api + counts.tie, escalated: results.filter(r => r.status === 'escalated').length, errors: results.filter(r => r.status === 'error').length, ...counts, unresolved };
}

const report = renderReport({ meta: { date: new Date().toISOString(), ...meta }, probe, sessions, quality });
writeFileSync(path.join(dir, 'report.md'), report);
console.log(JSON.stringify({ ok: true, report: path.relative(path.resolve(studio, '..'), path.join(dir, 'report.md')), parts: { probe: !!probe, sessions: sessions.map(s => s.provider), quality: !!quality } }, null, 2));
