#!/usr/bin/env node
/**
 * Build, pack and publish one separately versioned plugin under studio/plugins/<name>.
 *
 *   node studio/plugins/release.mjs <name> build          # typecheck, test, bundle into <name>/dist/index.js
 *   node studio/plugins/release.mjs <name> pack           # build, then npm pack into <name>/dist and print the tarball
 *   node studio/plugins/release.mjs <name> publish [--dry-run] [--otp=…]
 *
 * publish: refuses a dirty studio/plugins/<name>, a missing CHANGELOG section for the version, a wrong npm
 * account, or a version already on npm; then packs, publishes, re-reads dist.shasum from the registry and tags
 * the fork commit `dsh-plugin-<name>-v<version>`. Without --otp npm opens its browser two-factor flow.
 * Plugins are independent of the Studio package and its release (studio/release/).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const plugins = fileURLToPath(new URL('.', import.meta.url));
const studio = path.resolve(plugins, '..');
const monorepo = path.resolve(studio, '..');
const args = process.argv.slice(2);
const [name, command = 'build'] = args.filter(arg => !arg.startsWith('--'));
const dryRun = args.includes('--dry-run');
const otp = args.find(arg => arg.startsWith('--otp='))?.slice('--otp='.length);
if (!name || !/^[a-z0-9-]+$/.test(name) || !existsSync(path.join(plugins, name, 'package.json'))) {
  console.log('usage: node studio/plugins/release.mjs <name> build|pack|publish [--dry-run] [--otp=…]');
  process.exit(name ? 1 : 0);
}
const dir = path.join(plugins, name);
const dist = path.join(dir, 'dist');
const manifest = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
const run = (cmd, argv, cwd = dir, capture = false) => execFileSync(cmd, argv, { cwd, stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8', env: process.env });
const npmPublisher = JSON.parse(await readFile(path.join(studio, 'release/config.json'), 'utf8')).publisher.npm;

async function buildPlugin() {
  // Type-check and test against the workspace DSH sources the Studio development package links.
  run(path.join(studio, 'node_modules/.bin/tsc'), ['-p', path.join(dir, 'tsconfig.json')]);
  run(process.execPath, ['--import', 'tsx', '--test', ...['test'].map(sub => path.join(dir, sub, '*.test.mjs'))], studio);
  await rm(dist, { recursive: true, force: true });
  await build({ absWorkingDir: dir, entryPoints: ['src/index.ts'], outfile: 'dist/index.js', bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external', logLevel: 'warning' });
}

async function packPlugin() {
  await buildPlugin();
  const staging = path.join(dist, 'package');
  await mkdir(staging, { recursive: true });
  await cp(path.join(dist, 'index.js'), path.join(staging, 'index.js'));
  for (const file of ['README.md', 'CHANGELOG.md']) if (existsSync(path.join(dir, file))) await cp(path.join(dir, file), path.join(staging, file));
  await cp(path.join(studio, 'LICENSE'), path.join(staging, 'LICENSE'));
  await writeFile(path.join(staging, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
  const output = run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', dist], staging, true);
  await rm(staging, { recursive: true, force: true });
  return path.join(dist, JSON.parse(output)[0].filename);
}

const sha1 = async file => createHash('sha1').update(await readFile(file)).digest('hex');
function published(version) {
  try { return JSON.parse(run('npm', ['view', `${manifest.name}@${version}`, '--json'], monorepo, true) || 'null'); } catch { return undefined; }
}

async function publishPlugin() {
  if (run('git', ['status', '--porcelain', '--', dir], monorepo, true).trim()) throw new Error(`${path.relative(monorepo, dir)} has uncommitted changes; commit before publishing.`);
  const changelog = existsSync(path.join(dir, 'CHANGELOG.md')) ? await readFile(path.join(dir, 'CHANGELOG.md'), 'utf8') : '';
  if (!new RegExp(`^## ${manifest.version.replace(/\./g, '\\.')}( |$)`, 'm').test(changelog)) throw new Error(`CHANGELOG.md has no "## ${manifest.version}" section.`);
  let who;
  try { who = run('npm', ['whoami'], monorepo, true).trim(); } catch { throw new Error(`npm is not logged in; run npm login as ${npmPublisher}.`); }
  if (who !== npmPublisher) throw new Error(`npm is logged in as ${who}; run npm login as ${npmPublisher}.`);
  const existing = published(manifest.version);
  if (existing) throw new Error(`${manifest.name}@${manifest.version} is already on npm (dist.shasum=${existing.dist?.shasum ?? 'unknown'}); bump the version.`);
  const tarball = await packPlugin();
  const shasum = await sha1(tarball);
  console.log(`\n${manifest.name}@${manifest.version}\nPackage: ${tarball}\nsha1: ${shasum}`);
  if (dryRun) { console.log('Dry run: not published.'); return; }
  if (!otp) console.log('No --otp given: npm will open the browser two-factor flow (needs an interactive terminal).');
  run('npm', ['publish', tarball, '--access', 'public', ...(otp ? ['--otp', otp] : [])], dist);
  for (let attempt = 1; attempt <= 6; attempt++) {
    const found = published(manifest.version);
    if (found) {
      if (found.dist?.shasum && found.dist.shasum !== shasum) throw new Error(`Registry shasum mismatch: npm has ${found.dist.shasum}, packed ${shasum}.`);
      console.log(`Verified ${manifest.name}@${manifest.version} dist.shasum=${found.dist?.shasum ?? 'pending'}.`);
      break;
    }
    if (attempt === 6) console.warn(`Registry has not served ${manifest.name}@${manifest.version} yet; re-check with npm view.`);
    else await new Promise(resolve => setTimeout(resolve, 10_000));
  }
  const tag = `dsh-plugin-${name}-v${manifest.version}`;
  run('git', ['tag', tag, 'HEAD'], monorepo);
  console.log(`Tagged ${tag}.`);
}

if (command === 'build') { await buildPlugin(); console.log(path.join(dist, 'index.js')); }
else if (command === 'pack') console.log(await packPlugin());
else if (command === 'publish') await publishPlugin();
else throw new Error(`Unknown command: ${command}`);
