/**
 * Check Studio's Korean DSH dictionaries against extracted DSH sources (every supported version by default).
 * Reports missing, extra, and placeholder-mismatched keys per namespace; exits 1 when any source fails.
 *
 * Usage: node --import tsx studio/scripts/check-dsh-ko-locale.mjs [source.json ...] [--json]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkDshKoSupport } from '../src/dsh-ko-locale.ts';
import { dshKo } from '../src/dsh-ko/index.ts';

const args = process.argv.slice(2);
const json = args.includes('--json');
const research = fileURLToPath(new URL('../docs/research/ko-locale/', import.meta.url));
const files = args.filter(arg => arg !== '--json');
const sources = (files.length > 0 ? files : ['source-rc2.json', 'source-alpha2.json', 'source-rc1-0.2.1.json', 'source-rc2-0.2.1.json'].map(name => `${research}${name}`))
  .map(file => JSON.parse(readFileSync(file, 'utf8')));
const result = checkDshKoSupport(dshKo, sources);

if (json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  for (const report of result.reports) {
    console.log(`${report.source}: ${report.ok ? 'ok' : 'FAIL'} (${report.namespaces.length} translated, ${report.untranslated.length} untranslated)`);
    for (const ns of report.unknownNamespaces) console.log(`  ${ns}: not in this version`);
    for (const { ns, missing, extra, placeholders } of report.namespaces) {
      if (missing.length) console.log(`  ${ns}: missing ${missing.length}: ${missing.join(', ')}`);
      if (extra.length) console.log(`  ${ns}: not in this version ${extra.length}: ${extra.join(', ')}`);
      if (placeholders.length) console.log(`  ${ns}: placeholder mismatch: ${placeholders.join(', ')}`);
    }
  }
  for (const ns of result.strayNamespaces) console.log(`stray namespace: ${ns}`);
  for (const key of result.strayKeys) console.log(`stray key: ${key}`);
  console.log(result.ok ? 'ok' : 'FAIL');
}
process.exitCode = result.ok ? 0 : 1;
