#!/usr/bin/env node
/**
 * Merge passed L1 selector repairs into a scenario's repairs.json so the next L0 run uses them.
 *
 *   node studio/scripts/e2e/apply-repairs.mjs <scenario-name> <pixie-loop-results.jsonl>
 *
 * Only `passed` items are applied. Escalated and error items are listed for the verifier (L2).
 * The scenario source keeps its original selectors; update it once the repaired L0 run passes.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repairsFrom, slug } from './browser-lib.mjs';

const studio = fileURLToPath(new URL('../..', import.meta.url));
const [name, resultsPath] = process.argv.slice(2);
if (!name || !resultsPath) { console.error('Usage: apply-repairs.mjs <scenario-name> <results.jsonl>'); process.exit(2); }
const dir = path.join(studio, 'dist/e2e/shots', slug(name));
const mapPath = path.join(dir, 'repair-map.json');
if (!existsSync(mapPath)) { console.error(`No repair map at ${mapPath}; run the scenario first`); process.exit(2); }

const map = JSON.parse(readFileSync(mapPath, 'utf8'));
const results = readFileSync(resultsPath, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
const repairs = repairsFrom(map, results);
const repairsPath = path.join(dir, 'repairs.json');
const merged = { ...(existsSync(repairsPath) ? JSON.parse(readFileSync(repairsPath, 'utf8')) : {}), ...repairs };
writeFileSync(repairsPath, JSON.stringify(merged, null, 2) + '\n');
const unresolved = results.filter(result => result.status !== 'passed').map(({ id, status }) => ({ id, status, selector: map[id] }));
console.log(JSON.stringify({ applied: repairs, unresolved, repairs: path.relative(path.resolve(studio, '..'), repairsPath) }, null, 2));
