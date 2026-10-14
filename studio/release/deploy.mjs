#!/usr/bin/env node
/**
 * Two-stage Studio release driver for the policy in studio/docs/release.md.
 *
 *   node studio/release/deploy.mjs github [--dry-run]         # fork studio/       -> public repo branch
 *   node studio/release/deploy.mjs npm [--dry-run] [--otp=…]  # public repo branch -> npm
 *   node studio/release/deploy.mjs all   [--otp=…]            # github then npm
 *
 * Stage `github` delegates to release/sync.mjs, so the export allow-list, leak scan,
 * public-package install/test and the `release: <version>` snapshot commit stay in one place.
 * Stage `npm` clones the pushed branch into a fresh directory, proves that exact commit builds
 * from public packages alone, and publishes that tarball. Nothing here writes to the fork or
 * the public repo; only `npm publish` changes the outside world.
 *
 * Env: STUDIO_RELEASE_REPO, STUDIO_RELEASE_BRANCH, STUDIO_RELEASE_DIR (github work dir),
 *      STUDIO_RELEASE_PUBLISH_DIR (npm clone dir).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const studio = fileURLToPath(new URL('..', import.meta.url));
const monorepo = path.resolve(studio, '..');
const config = JSON.parse(readFileSync(path.join(studio, 'release/config.json'), 'utf8'));
const repo = process.env.STUDIO_RELEASE_REPO ?? 'https://github.com/matamt-dbg/dsh-studio.git';
const branch = process.env.STUDIO_RELEASE_BRANCH ?? 'main';
const args = process.argv.slice(2);
const stage = args.find(arg => !arg.startsWith('--'));
const dryRun = args.includes('--dry-run');
const otp = args.find(arg => arg.startsWith('--otp='))?.slice('--otp='.length);
const run = (command, argv, cwd) => execFileSync(command, argv, { cwd, stdio: 'inherit', env: process.env });
const capture = (command, argv, cwd) => execFileSync(command, argv, { cwd, stdio: 'pipe', encoding: 'utf8', env: process.env }).trim();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const usage = () => console.log(`Studio release driver (studio/docs/release.md)

  node studio/release/deploy.mjs github [--dry-run]         fork studio/ -> ${repo} ${branch}
  node studio/release/deploy.mjs npm [--dry-run] [--otp=…]  ${branch} -> npm ${config.publisher.npm}
  node studio/release/deploy.mjs all   [--otp=…]            both stages in order

  --dry-run  export/build/verify but do not push or publish
  --otp=…    npm one-time password, for non-interactive runs only

Without --otp the publish stage lets npm open its browser two-factor flow at the moment of the
publish and waits for approval, so nothing expires while the snapshot installs and tests.

Env: STUDIO_RELEASE_REPO, STUDIO_RELEASE_BRANCH, STUDIO_RELEASE_DIR, STUDIO_RELEASE_PUBLISH_DIR`);

/** Stage 1: fork studio/ -> public repo branch. sync.mjs owns the snapshot rules and the push. */
function stageGithub() {
  console.log(`\n== github: fork studio/ -> ${repo} ${branch}${dryRun ? ' (dry run)' : ''} ==`);
  const argv = [path.join(studio, 'release/sync.mjs')];
  if (!dryRun) argv.push('--push');
  run(process.execPath, argv, monorepo);
}

/** Query the registry for one version. Missing versions are a normal answer, not a failure. */
function queryPublished(name, version) {
  try {
    return JSON.parse(execFileSync('npm', ['view', `${name}@${version}`, '--json'], { cwd: monorepo, stdio: 'pipe', encoding: 'utf8', env: process.env }));
  } catch {
    return undefined;
  }
}

const sha1 = async file => createHash('sha1').update(await readFile(file)).digest('hex');

/**
 * Re-query until the registry serves the version. A publish exit code alone is not proof:
 * propagation lags, and a mismatched shasum means the wrong tarball reached npm.
 */
async function verifyPublished(name, version, shasum) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const found = queryPublished(name, version);
    if (found) {
      if (found.dist?.shasum && found.dist.shasum !== shasum) {
        throw new Error(`Registry shasum mismatch for ${name}@${version}: npm has ${found.dist.shasum}, packed ${shasum}.`);
      }
      console.log(`Verified ${name}@${version} dist.shasum=${found.dist?.shasum ?? 'pending'}.`);
      return;
    }
    if (attempt < 6) await sleep(10_000);
  }
  console.warn(`Registry has not served ${name}@${version} yet; propagation may be delayed. Re-check: npm view ${name} version dist.shasum`);
}

/** Stage 2: public repo branch -> npm, built only from what the branch actually contains. */
async function stageNpm() {
  console.log(`\n== npm: ${repo} ${branch} -> ${config.publisher.npm}${dryRun ? ' (dry run)' : ''} ==`);
  const who = (() => {
    try { return capture('npm', ['whoami'], monorepo); }
    catch { throw new Error(`npm is not logged in; run npm login as ${config.publisher.npm}.`); }
  })();
  if (who !== config.publisher.npm) throw new Error(`npm is logged in as ${who}; run npm login as ${config.publisher.npm}.`);

  const work = process.env.STUDIO_RELEASE_PUBLISH_DIR ?? await mkdtemp(path.join(tmpdir(), 'dsh-studio-publish-'));
  await rm(work, { recursive: true, force: true });
  run('git', ['clone', '--quiet', '--depth', '1', '--branch', branch, repo, work], monorepo);
  const commit = capture('git', ['rev-parse', '--short=10', 'HEAD'], work);
  const manifest = JSON.parse(await readFile(path.join(work, 'packages/shell/package.json'), 'utf8'));
  const { name, version } = manifest;

  // npm rejects a second publish of the same version, so fail before installing anything.
  const published = queryPublished(name, version);
  if (published) throw new Error(`${name}@${version} is already on npm (dist.shasum=${published.dist?.shasum ?? 'unknown'}); bump the version and sync again.`);

  run('pnpm', ['install', '--no-frozen-lockfile'], work);
  run('pnpm', ['test'], work);
  const tarball = path.resolve(work, capture(process.execPath, ['pack.mjs'], work).split('\n').at(-1));
  const shasum = await sha1(tarball);
  console.log(`\nSnapshot ${branch}@${commit} -> ${name}@${version}\nPackage: ${tarball}\nsha1: ${shasum}`);
  if (dryRun) {
    console.log('Dry run: not published.');
    return;
  }
  // An absolute path: npm reads a bare relative path like dist/x.tgz as a GitHub shorthand.
  // Without --otp, npm's web 2FA flow opens the browser here and waits for approval, so the
  // second factor is consumed at publish time instead of expiring during install and test.
  if (!otp) console.log('No --otp given: npm will open the browser two-factor flow (needs an interactive terminal).');
  run('npm', ['publish', tarball, '--access', 'public', ...(otp ? ['--otp', otp] : [])], work);
  await verifyPublished(name, version, shasum);
}

if (!stage || stage === 'help' || args.includes('--help')) usage();
else if (stage === 'github') stageGithub();
else if (stage === 'npm') await stageNpm();
else if (stage === 'all') { stageGithub(); await stageNpm(); }
else { usage(); throw new Error(`Unknown stage: ${stage}`); }
