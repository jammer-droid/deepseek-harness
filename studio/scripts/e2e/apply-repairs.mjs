#!/usr/bin/env node
/**
 * Merge passed L1 selector repairs into a scenario's repairs.json so the next L0 run uses them.
 *
 *   node studio/scripts/e2e/apply-repairs.mjs <scenario-name> <pixie-loop-results.jsonl>
 *
 * Only `passed` items are applied. Escalated and error items are listed for the verifier (L2).
 * Every queued item must be in the results. Exit 0: every queued item got a new selector.
 * 1: some unresolved (missing, not passed, unchanged, unknown id); passed ones are still applied. 2: unreadable input.
 * The scenario source keeps its original selectors; update it once the repaired L0 run passes.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyRepairs, slug } from './browser-lib.mjs';

const studio = fileURLToPath(new URL('../..', import.meta.url));
const [name, resultsPath] = process.argv.slice(2);
if (!name || !resultsPath) { console.error('Usage: apply-repairs.mjs <scenario-name> <results.jsonl>'); process.exit(2); }
const dir = path.join(studio, 'dist/e2e/shots', slug(name));
const mapPath = path.join(dir, 'repair-map.json');
if (!existsSync(mapPath)) { console.error(`No repair map at ${mapPath}; run the scenario first`); process.exit(2); }

if (!existsSync(resultsPath)) { console.error(`No results file at ${resultsPath}; use the outputPath the pixie_loop summary printed. If it wrote none (all skipped or write failed), record environment blocked.`); process.exit(2); }
let map;
let results;
try {
  map = JSON.parse(readFileSync(mapPath, 'utf8'));
  results = readFileSync(resultsPath, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
} catch (error) { console.error(`Unreadable repair map or results: ${error.message}`); process.exit(2); }
const { repairs, unresolved } = classifyRepairs(map, results);
const repairsPath = path.join(dir, 'repairs.json');
let previous = {};
try { previous = existsSync(repairsPath) ? JSON.parse(readFileSync(repairsPath, 'utf8')) : {}; } catch (error) {
  console.error(`Unreadable ${repairsPath}: ${error.message}. Move it aside and run apply-repairs again.`); process.exit(2);
}
const merged = { ...previous, ...repairs };
writeFileSync(repairsPath, JSON.stringify(merged, null, 2) + '\n');
console.log(JSON.stringify({ applied: repairs, unresolved, repairs: path.relative(path.resolve(studio, '..'), repairsPath) }, null, 2));
// Exit 1 while any item is unresolved, so a partial repair is never read as success.
process.exitCode = unresolved.length ? 1 : 0;
