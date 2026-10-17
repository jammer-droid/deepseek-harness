/**
 * Print Korean DSH translation progress and the next namespace to work on.
 * Progress lives only in studio/src/dsh-ko: a namespace is done when index.ts registers it, and
 * in progress when its <ns>.ts exists but is not registered yet. The next namespace is the
 * in-progress one, else the smallest untranslated one (by union key count of rc.2 and alpha.2).
 *
 * Usage (from studio/): node --import tsx scripts/dsh-ko-next.mjs [--ns <namespace>] [--json]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dshKo } from '../src/dsh-ko/index.ts';

const args = process.argv.slice(2);
const json = args.includes('--json');
const nsArg = args.includes('--ns') ? args[args.indexOf('--ns') + 1] : undefined;
const research = fileURLToPath(new URL('../docs/research/ko-locale/', import.meta.url));
const dictDir = fileURLToPath(new URL('../src/dsh-ko/', import.meta.url));
const sources = { rc2: 'source-rc2.json', alpha2: 'source-alpha2.json' };
const loaded = Object.fromEntries(Object.entries(sources).map(([id, file]) => [id, JSON.parse(readFileSync(research + file, 'utf8'))]));

/** ns → { key → { en: { rc2?, alpha2? } } } over the union of both sources. */
const union = new Map();
for (const [id, source] of Object.entries(loaded)) {
  for (const [ns, { keys }] of Object.entries(source.namespaces)) {
    if (!union.has(ns)) union.set(ns, new Map());
    for (const [key, { en }] of Object.entries(keys)) {
      const entry = union.get(ns).get(key) ?? {};
      entry[id] = en;
      union.get(ns).set(key, entry);
    }
  }
}

const files = readdirSync(dictDir).filter(name => name.endsWith('.ts') && name !== 'index.ts').map(name => name.slice(0, -3));
const registered = new Set(Object.keys(dshKo));
const inProgress = files.filter(ns => !registered.has(ns));
const dictionaryOf = async ns => registered.has(ns) ? dshKo[ns] : (await import(pathToFileURL(`${dictDir}${ns}.ts`).href)).default;

const size = ns => union.get(ns)?.size ?? 0;
const ordered = [...union.keys()].sort((a, b) => size(a) - size(b) || a.localeCompare(b));
const done = ordered.filter(ns => registered.has(ns));
const next = nsArg ?? inProgress.find(ns => union.has(ns)) ?? ordered.find(ns => !registered.has(ns));

let detail;
if (next !== undefined) {
  if (!union.has(next)) throw new Error(`namespace ${next} is in neither source`);
  const existing = files.includes(next) ? await dictionaryOf(next) : { ko: {}, fallback: [] };
  const covered = new Set([...Object.keys(existing.ko ?? {}), ...(existing.fallback ?? [])]);
  const keys = [...union.get(next)];
  const remaining = keys.filter(([key]) => !covered.has(key)).map(([key, en]) => ({
    key,
    en: en.alpha2 ?? en.rc2,
    ...en.rc2 !== undefined && en.alpha2 !== undefined && en.rc2 !== en.alpha2 ? { enRc2: en.rc2 } : {},
    ...en.rc2 === undefined ? { only: 'alpha2' } : en.alpha2 === undefined ? { only: 'rc2' } : {},
  }));
  detail = {
    namespace: next,
    state: registered.has(next) ? 'registered' : files.includes(next) ? 'in-progress' : 'new',
    versions: Object.keys(loaded).filter(id => next in loaded[id].namespaces),
    keys: keys.length,
    translated: Object.keys(existing.ko ?? {}).length,
    fallback: (existing.fallback ?? []).length,
    remaining,
  };
}

const summary = {
  namespaces: { done: done.length, total: ordered.length },
  keys: { done: done.reduce((sum, ns) => sum + size(ns), 0), total: ordered.reduce((sum, ns) => sum + size(ns), 0) },
  inProgress,
  queue: ordered.filter(ns => !registered.has(ns)).map(ns => `${ns}:${size(ns)}`),
  next: detail ?? null,
};

if (json) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(`done ${summary.namespaces.done}/${summary.namespaces.total} namespaces, ${summary.keys.done}/${summary.keys.total} keys`);
  if (inProgress.length) console.log(`in progress: ${inProgress.join(', ')}`);
  if (!detail) console.log('next: none — every namespace is registered');
  else {
    console.log(`next: ${detail.namespace} (${detail.state}; ${detail.versions.join('+')}; ${detail.keys} keys, ${detail.translated} translated, ${detail.fallback} fallback, ${detail.remaining.length} remaining)`);
    for (const row of detail.remaining) console.log(`  ${row.key}${row.only ? ` [${row.only} only]` : ''}: ${JSON.stringify(row.en)}${row.enRc2 ? ` (rc2: ${JSON.stringify(row.enRc2)})` : ''}`);
  }
}
