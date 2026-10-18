/**
 * Bulk Jev judging for Korean DSH dictionaries (#30 S5). For each namespace it judges every `ko`
 * string whose current text has no recorded verdict, appends the attempt to
 * docs/research/ko-locale/judge/<ns>.json, and prints only the keys that still fail.
 *
 * Unchanged text is never re-sent. After MAX_ATTEMPTS failing attempts a key moves from `ko` to
 * `fallback` in src/dsh-ko/<ns>.ts. `--ledger <ns ...>` appends unresolved keys to judge/unresolved.md
 * (run it from one process only; parallel judging never writes that file).
 *
 * The questions and thresholds (`THRESHOLDS`) are defined here. The engine is Studio's
 * JevJudgeEngine (the one behind the `judge` tool). The key comes from $TYPESAFE_API_KEY, else from
 * `refs.TYPESAFE_API_KEY` in $DSH_HOME/.credentials.yaml (read only).
 *
 * Usage (from studio/): node --import tsx scripts/dsh-ko-judge.mjs <ns ...> [--dry-run] [--json]
 *        node --import tsx scripts/dsh-ko-judge.mjs --ledger <ns ...>
 *   Exit 0 when every given namespace has no failing key; 1 when some keys still fail; 2 on errors.
 */
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import { DEFAULT_JEV_MODEL, JevJudgeEngine } from '../src/host/jev-judge.ts';

export const THRESHOLDS = { natural: 1.5, meaning: 0.6, style: 0.5 };
export const MAX_ATTEMPTS = 4; // the first translation plus 3 rewrites
const BATCH = 20;
const research = fileURLToPath(new URL('../docs/research/ko-locale/', import.meta.url));
const dictDir = fileURLToPath(new URL('../src/dsh-ko/', import.meta.url));

/** The three questions for one id, exactly as in the translate skill. */
export function questionsFor(id) {
  return {
    [`${id}_natural`]: { type: 'score', instructions: `How natural and clear is \`${id}.ko\` as Korean UI text for a developer tool?`, criteria: ['awkward or unclear', 'understandable but stiff', 'natural and clear'] },
    [`${id}_meaning`]: { type: 'noul', instructions: `Does \`${id}.ko\` convey the same meaning as \`${id}.en\`, including conditions, numbers, and negations?` },
    [`${id}_style`]: { type: 'noul', instructions: `Does \`${id}.ko\` end sentences in the formal polite style (합쇼체, e.g. -습니다/-합니다) or use a short label/noun phrase?` },
  };
}

const round = value => Math.round(value * 100) / 100;

/** Read one id's answers into an attempt; a missing answer makes it unjudged. */
export function attemptFrom(ko, id, answers) {
  const natural = answers[`${id}_natural`]?.score;
  const meaning = answers[`${id}_meaning`]?.noul;
  const style = answers[`${id}_style`]?.noul;
  if (typeof natural !== 'number' || typeof meaning !== 'number' || typeof style !== 'number') return { ko, error: 'missing answer' };
  const pass = natural >= THRESHOLDS.natural && meaning >= THRESHOLDS.meaning && style >= THRESHOLDS.style;
  return { ko, natural: round(natural), meaning: round(meaning), style: round(style), pass };
}

/** English references for one namespace: alpha.2 first, rc.2 when it differs or is the only one. */
function englishOf(sources, ns) {
  const keys = new Map();
  for (const [id, source] of Object.entries(sources)) {
    for (const [key, { en }] of Object.entries(source.namespaces[ns]?.keys ?? {})) {
      if (en === undefined) continue;
      const entry = keys.get(key) ?? {};
      entry[id] = en;
      keys.set(key, entry);
    }
  }
  return new Map([...keys].map(([key, en]) => [key, [...new Set([en.alpha2, en.rc2].filter(text => text !== undefined))]]));
}

/**
 * Plan one namespace: which keys need a judgment now. A key is judged against every distinct
 * English text (alpha.2, rc.2) and passes only when all pass.
 */
export function planNamespace(dictionary, record, english) {
  const rows = new Map((record?.rows ?? []).map(row => [row.key, row]));
  const items = [];
  const skipped = [];
  for (const [key, ko] of Object.entries(dictionary.ko ?? {})) {
    const row = rows.get(key);
    if (row && ['verbatim', 'locale'].includes(row.kind)) continue;
    if (row?.result === 'approved' && row.approval?.ko === ko) continue; // approved text is final until it changes
    const ens = english.get(key);
    if (!ens || ens.length === 0) { skipped.push(key); continue; }
    if (ko === ens[0] && !/[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(ens[0])) continue; // verbatim token, nothing to judge
    if (/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(ens[0]) && /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(ko)) continue; // Intl locale value
    const last = row?.attempts?.at(-1);
    // This text already has a verdict, unless the row is approved for other text (then re-judge the change).
    if (last && last.ko === ko && last.error === undefined && row.result !== 'approved') continue;
    ens.forEach((en, index) => items.push({ key, ko, en, part: index }));
  }
  return { items, skipped };
}

/** Merge judged items into the record; returns the per-key outcome for this run. */
export function mergeRecord(record, ns, judged, today) {
  const next = record ?? { namespace: ns, date: today, engine: 'jev', thresholds: THRESHOLDS, rows: [] };
  const rowsByKey = new Map(next.rows.map(row => [row.key, row]));
  const byKey = new Map();
  for (const item of judged) {
    const list = byKey.get(item.key) ?? [];
    list.push(item);
    byKey.set(item.key, list);
  }
  const outcomes = [];
  for (const [key, parts] of byKey) {
    const ko = parts[0].ko;
    const error = parts.find(part => part.attempt.error)?.attempt.error;
    const worst = { natural: Math.min(...parts.map(part => part.attempt.natural ?? 0)), meaning: Math.min(...parts.map(part => part.attempt.meaning ?? 0)), style: Math.min(...parts.map(part => part.attempt.style ?? 0)) };
    const attempt = error ? { ko, error } : { ko, ...worst, pass: parts.every(part => part.attempt.pass), ...(parts.length > 1 ? { versions: parts.length } : {}) };
    let row = rowsByKey.get(key);
    if (!row) { row = { key, en: parts[0].en, kind: 'normal', attempts: [], result: 'pending' }; next.rows.push(row); rowsByKey.set(key, row); }
    row.attempts.push(attempt);
    const judgedAttempts = row.attempts.filter(entry => entry.error === undefined);
    if (attempt.pass) row.result = judgedAttempts.length === 1 ? 'pass' : 'fixed';
    else if (judgedAttempts.length >= MAX_ATTEMPTS) row.result = 'unresolved';
    else row.result = error ? 'unjudged' : 'pending';
    outcomes.push({ key, row, attempt });
  }
  next.date = today;
  return { record: next, outcomes };
}

/** Rows whose key is still in `ko` and whose result awaits a rewrite or a retry. */
export function openRows(record, dictionary) {
  return (record?.rows ?? []).filter(row => row.key in (dictionary.ko ?? {}) && (['pending', 'unjudged'].includes(row.result)
    || (row.result === 'approved' && row.approval?.ko !== dictionary.ko[row.key] && row.attempts?.at(-1)?.ko === dictionary.ko[row.key] && !row.attempts.at(-1).pass)));
}

/** Rewrite a dictionary file: move `keys` from ko into fallback, keeping key order. */
export function renderDictionary(dictionary, moveToFallback) {
  const ko = Object.entries(dictionary.ko ?? {}).filter(([key]) => !moveToFallback.includes(key));
  const fallback = [...new Set([...(dictionary.fallback ?? []), ...moveToFallback])];
  const quote = text => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
  const keyOf = key => /^[A-Za-z_$][\w$]*$/.test(key) ? key : quote(key);
  return [
    "import type { DshKoNamespace } from '../dsh-ko-locale.ts';",
    '',
    'export default {',
    '  ko: {',
    ...ko.map(([key, text]) => `    ${keyOf(key)}: ${quote(text)},`),
    '  },',
    ...fallback.length ? [`  fallback: [${fallback.map(quote).join(', ')}],`] : [],
    '} satisfies DshKoNamespace;',
    '',
  ].join('\n');
}

function apiKey() {
  if (process.env.TYPESAFE_API_KEY) return process.env.TYPESAFE_API_KEY;
  const file = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), '.credentials.yaml');
  if (!existsSync(file)) return undefined;
  const value = yaml.load(readFileSync(file, 'utf8'))?.refs?.TYPESAFE_API_KEY;
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** Append unresolved rows of the given namespaces to judge/unresolved.md, once per key. Single writer: the orchestrator. */
function writeLedger(namespaces) {
  const ledger = `${research}judge/unresolved.md`;
  if (!existsSync(ledger)) writeFileSync(ledger, '# 미해결 키와 용어집 제안 (#30 S5)\n\n판정에서 통과하지 못해 영어 fallback으로 남긴 키와 용어집 제안을 기록한다.\n\n| 네임스페이스 | 키 | 영어 | 최선 후보 | 점수(자연/의미/문체) | 메모 |\n| --- | --- | --- | --- | --- | --- |\n');
  const cell = text => String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const present = readFileSync(ledger, 'utf8');
  let added = 0;
  for (const ns of namespaces) {
    const file = `${research}judge/${ns}.json`;
    if (!existsSync(file)) continue;
    for (const row of JSON.parse(readFileSync(file, 'utf8')).rows) {
      if (row.result !== 'unresolved' || present.includes(`| ${ns} | ${cell(row.key)} |`)) continue;
      const best = row.attempts.filter(entry => entry.error === undefined).sort((a, b) => (b.natural + b.meaning + b.style) - (a.natural + a.meaning + a.style))[0];
      appendFileSync(ledger, best
        ? `| ${ns} | ${cell(row.key)} | ${cell(row.en)} | ${cell(best.ko)} | ${best.natural}/${best.meaning}/${best.style} | ${MAX_ATTEMPTS}회 미통과 |\n`
        : `| ${ns} | ${cell(row.key)} | ${cell(row.en)} | — | — | 판정 기록 없음 |\n`);
      added++;
    }
  }
  console.log(`unresolved.md: ${added} rows added`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const json = args.includes('--json');
  const namespaces = args.filter(arg => !arg.startsWith('--'));
  if (namespaces.length === 0) throw new Error('usage: dsh-ko-judge.mjs <ns ...> [--dry-run] [--json]');
  if (args.includes('--ledger')) { writeLedger(namespaces); return; }
  const sources = { rc2: JSON.parse(readFileSync(`${research}source-rc2.json`, 'utf8')), alpha2: JSON.parse(readFileSync(`${research}source-alpha2.json`, 'utf8')) };
  const key = dryRun ? undefined : apiKey();
  if (!dryRun && !key) throw new Error('Jev API key not found: set TYPESAFE_API_KEY or save it in DSH credentials');
  const engine = new JevJudgeEngine({ credentials: { resolve: async () => ({ value: key }) }, model: process.env.JEV_MODEL ?? DEFAULT_JEV_MODEL });
  const today = new Date().toISOString().slice(0, 10);
  const report = [];
  let failing = 0;
  let consecutiveErrors = 0;

  for (const ns of namespaces) {
    const dictFile = `${dictDir}${ns}.ts`;
    if (!existsSync(dictFile)) throw new Error(`${ns}: src/dsh-ko/${ns}.ts does not exist`);
    if (!Object.values(sources).some(source => ns in source.namespaces)) throw new Error(`${ns}: not in either source`);
    const dictionary = (await import(`${pathToFileURL(dictFile).href}?t=${Date.now()}`)).default;
    const recordFile = `${research}judge/${ns}.json`;
    const record = existsSync(recordFile) ? JSON.parse(readFileSync(recordFile, 'utf8')) : undefined;
    const { items, skipped } = planNamespace(dictionary, record, englishOf(sources, ns));
    if (dryRun) { report.push({ ns, toJudge: [...new Set(items.map(item => item.key))].length, requests: Math.ceil(items.length / BATCH), open: openRows(record, dictionary).filter(row => !items.some(item => item.key === row.key)).map(row => row.key), skipped }); continue; }

    const judged = [];
    for (let start = 0; start < items.length; start += BATCH) {
      const batch = items.slice(start, start + BATCH);
      const ids = batch.map((_, index) => `k${String(index + 1).padStart(2, '0')}`);
      const state = Object.fromEntries(batch.map((item, index) => [ids[index], { ko: item.ko, en: item.en }]));
      const questions = Object.assign({}, ...ids.map(questionsFor));
      const result = await engine.judge({ state, questions }, AbortSignal.timeout(120_000));
      if (!result.ok) {
        consecutiveErrors++;
        batch.forEach(item => judged.push({ ...item, attempt: { ko: item.ko, error: result.error } }));
        if (consecutiveErrors >= 3) { console.error(`stopping: 3 consecutive Jev errors (last: ${result.error})`); break; }
        continue;
      }
      consecutiveErrors = 0;
      batch.forEach((item, index) => judged.push({ ...item, attempt: attemptFrom(item.ko, ids[index], result.answers) }));
    }

    const { record: nextRecord, outcomes } = mergeRecord(record, ns, judged, today);
    const unresolved = outcomes.filter(outcome => outcome.row.result === 'unresolved').map(outcome => outcome.row);
    writeFileSync(recordFile, `${JSON.stringify(nextRecord, null, 2)}\n`);
    if (unresolved.length) writeFileSync(dictFile, renderDictionary(dictionary, unresolved.map(row => row.key)));
    // Report every key still waiting on a rewrite, including ones judged in earlier runs and left unchanged.
    const fails = openRows(nextRecord, dictionary).map(row => {
      const attempt = row.attempts.at(-1);
      return { key: row.key, en: row.en, ko: attempt.ko, scores: attempt.error ? attempt.error : `${attempt.natural}/${attempt.meaning}/${attempt.style}`,
        attemptsLeft: MAX_ATTEMPTS - row.attempts.filter(entry => entry.error === undefined).length };
    });
    failing += fails.length;
    report.push({ ns, judged: outcomes.length, passed: outcomes.filter(outcome => ['pass', 'fixed'].includes(outcome.row.result)).length, fallback: unresolved.map(row => row.key), failing: fails, skipped });
    if (consecutiveErrors >= 3) break;
  }

  if (json) console.log(JSON.stringify(report, null, 2));
  else for (const entry of report) {
    if (dryRun) { console.log(`${entry.ns}: ${entry.toJudge} keys to judge in ${entry.requests} requests${entry.open.length ? `; awaiting rewrite: ${entry.open.join(', ')}` : ''}${entry.skipped.length ? `; not in source: ${entry.skipped.join(', ')}` : ''}`); continue; }
    console.log(`${entry.ns}: judged ${entry.judged}, passed ${entry.passed}, moved to fallback ${entry.fallback.length}, failing ${entry.failing.length}`);
    for (const fail of entry.failing) console.log(`  FAIL ${fail.key} (${fail.attemptsLeft} left) ${fail.scores} | en: ${JSON.stringify(fail.en)} | ko: ${JSON.stringify(fail.ko)}`);
    if (entry.skipped.length) console.log(`  not in source: ${entry.skipped.join(', ')}`);
  }
  process.exitCode = consecutiveErrors >= 3 ? 2 : failing > 0 ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 2; });
}
