#!/usr/bin/env node
/**
 * Wait inside this script until an isolated E2E result is final, then print one JSON summary.
 * The verifier calls it once (or as a background job) instead of sleeping and re-checking.
 *
 *   node studio/scripts/e2e/wait.mjs session [--session <id>] [--turns 1] [--since <ms>] [--timeout 10m]
 *   node studio/scripts/e2e/wait.mjs loop    [--session <id>] [--count 1] [--since <ms>] [--timeout 10m]
 *   node studio/scripts/e2e/wait.mjs gate    [--session <id>] [--count 1] [--since <ms>] [--timeout 5m]
 *   common: [--profile e2e] [--home <dir>] [--interval 3s]
 *
 * session: the newest session log (or --session) has --turns ended turns and no open turn.
 * loop/gate: --count Pixie loop / gate runs started after --since (default: this call) are final.
 * Exit 0 when final, 1 on timeout (with the last observed state), 2 on bad input.
 * Message texts, gate texts and loop outputs are not printed.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GATE_FINAL, LOOP_FINAL, gateSummary, loopSummary, runsSince, sessionDone, sessionSummary } from './wait-lib.mjs';
import { DEFAULT_PROFILE, parseDuration } from './server-lib.mjs';

const studio = fileURLToPath(new URL('../..', import.meta.url));
const [kind, ...rest] = process.argv.slice(2);
const out = (summary, code) => { console.log(JSON.stringify(summary, null, 2)); process.exit(code); };
const KNOWN = ['session', 'turns', 'count', 'since', 'timeout', 'interval', 'profile', 'home'];
const opts = {};
for (let index = 0; index < rest.length; index++) {
  const [flag, inline] = rest[index].split(/=(.*)/s, 2);
  const key = flag.replace(/^--/, '');
  if (!flag.startsWith('--') || !KNOWN.includes(key)) out({ ok: false, error: `Unknown option: ${rest[index]}` }, 2);
  const value = inline ?? rest[++index];
  if (value === undefined) out({ ok: false, error: `Missing value for ${flag}` }, 2);
  opts[key] = value;
}
if (!['session', 'loop', 'gate'].includes(kind)) out({ ok: false, error: 'Usage: wait.mjs <session|loop|gate> [options]' }, 2);
for (const key of ['turns', 'count']) if (opts[key] !== undefined && !/^[1-9]\d*$/.test(opts[key])) out({ ok: false, error: `--${key} must be a positive integer` }, 2);
if (opts.since !== undefined && !/^\d+$/.test(opts.since)) out({ ok: false, error: '--since must be epoch milliseconds' }, 2);
const duration = (raw, fallback) => { try { return parseDuration(raw ?? fallback); } catch (error) { out({ ok: false, error: error.message }, 2); } };

const started = Date.now();
const home = path.resolve(opts.home ?? process.env.STUDIO_E2E_HOME ?? path.join(studio, 'dist/e2e/home'));
const profile = opts.profile ?? process.env.STUDIO_E2E_PROFILE ?? DEFAULT_PROFILE;
const timeoutMs = duration(opts.timeout, '10m');
const intervalMs = duration(opts.interval, '3s');
const since = opts.since !== undefined ? Number(opts.since) : started;
const count = Number(opts.count ?? 1);
const turns = Number(opts.turns ?? 1);

/** Newest file matching `name` under dir (depth-first, small trees only). */
function newest(dir, match) {
  let best;
  const walk = current => {
    if (!existsSync(current)) return;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (match(full)) {
        const mtime = statSync(full).mtimeMs;
        if (!best || mtime > best.mtime) best = { file: full, mtime };
      }
    }
  };
  walk(dir);
  return best?.file;
}

function readSession() {
  const file = newest(path.join(home, 'sessions'), full => full.endsWith('session.v4.jsonl.zstd') && (!opts.session || full.includes(opts.session)));
  if (!file) return { state: { found: false } };
  const decoded = spawnSync('zstd', ['-dc', file], { encoding: 'utf8', maxBuffer: 256 << 20 });
  if (decoded.error?.code === 'ENOENT') out({ ok: false, kind, error: 'zstd not found on PATH: environment blocked' }, 2);
  if (decoded.status !== 0) return { state: { found: true, error: 'zstd failed' } };
  const summary = sessionSummary(decoded.stdout);
  const sessionId = path.basename(path.dirname(file));
  return { state: { found: true, sessionId, ...summary }, final: sessionDone(summary, turns) };
}

function readRuns(folder, summarize, finalSet) {
  const dir = path.join(home, 'profiles', profile, 'studio-data/pixie', folder);
  const file = opts.session ? path.join(dir, `${opts.session}.json`) : newest(dir, full => full.endsWith('.json'));
  if (!file || !existsSync(file)) return { state: { found: false } };
  let record;
  try { record = JSON.parse(readFileSync(file, 'utf8')); } catch { return { state: { found: true, error: 'record not readable yet' } }; }
  const runs = runsSince(record.runs, since).map(summarize);
  const final = runs.length >= count && runs.slice(0, count).every(run => finalSet.has(run.status));
  return { state: { found: true, sessionId: path.basename(file, '.json'), runs }, final };
}

const read = { session: readSession, loop: () => readRuns('loops', loopSummary, LOOP_FINAL), gate: () => readRuns('gates', gateSummary, GATE_FINAL) }[kind];
let last;
while (Date.now() - started < timeoutMs) {
  last = read();
  if (last.final) out({ ok: true, kind, waitedMs: Date.now() - started, ...last.state }, 0);
  await new Promise(resolve => setTimeout(resolve, intervalMs));
}
out({ ok: false, kind, timeout: true, waitedMs: Date.now() - started, ...(last?.state ?? {}) }, 1);
