/**
 * Select the web providers of an isolated E2E profile by writing the same `web` patch row the
 * Web search settings switch writes. Refuses any home under ~/.dsh. Restart the server afterwards
 * (`server.mjs down` → `server.mjs up --reuse-profile --archive <tgz>`).
 *
 *   node studio/scripts/e2e/web-cost-select.mjs <legacy|api>
 *
 * Env: STUDIO_E2E_HOME, STUDIO_E2E_PROFILE. Prints one JSON summary.
 */
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const finish = (summary, code = summary.ok ? 0 : 1) => { console.log(JSON.stringify(summary, null, 2)); process.exit(code); };
const choice = process.argv[2];
if (!['legacy', 'api'].includes(choice)) finish({ ok: false, error: 'Usage: web-cost-select.mjs <legacy|api>' }, 2);
const studio = fileURLToPath(new URL('../..', import.meta.url));
const home = path.resolve(process.env.STUDIO_E2E_HOME ?? path.join(studio, 'dist/e2e/home'));
const profile = process.env.STUDIO_E2E_PROFILE ?? 'e2e';
const userHome = path.join(homedir(), '.dsh');
const real = target => { try { return realpathSync(target); } catch { return path.resolve(target); } };
if ((real(home) + path.sep).startsWith(real(userHome) + path.sep) || real(home) === real(userHome)) finish({ ok: false, error: `Refusing to edit ${home}` }, 2);
const file = path.join(home, 'profiles', profile, 'cordis.patch.yml');
if (!existsSync(file)) finish({ ok: false, error: `No ${file}; run server.mjs up first` }, 2);

const text = readFileSync(file, 'utf8');
const rows = yaml.load(text) ?? [];
const kept = rows.filter(row => row?.id !== 'web');
if (choice === 'api') kept.push({ id: 'web', name: '@deepseek-ai/dsh-web', config: { searchProvider: 'deepseek-search-api', fetchProvider: 'deepseek-fetch-api' } });
const header = text.split('\n').filter(line => line.startsWith('#')).join('\n');
writeFileSync(file, `${header ? `${header}\n` : ''}${kept.length ? yaml.dump(kept) : '[]\n'}`);
finish({ ok: true, profile, file, selection: choice === 'api' ? { searchProvider: 'deepseek-search-api', fetchProvider: 'deepseek-fetch-api' } : 'shipped default (deepseek-official search, local HTTP fetch)' });
