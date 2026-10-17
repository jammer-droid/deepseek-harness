#!/usr/bin/env node
/**
 * One-shot development loop for the Studio shell.
 *
 *   node studio/dev.mjs [--port 19388] [--skip-test] [--build-only]
 *   node studio/dev.mjs --desktop [--force] [--skip-test]
 *   node studio/dev.mjs --profile <name> [--force] [--skip-test]
 *
 * Default: verify the shell (typecheck + build + tests), pack it, install the tarball into the
 * isolated studio/.dsh-home `lean-agent-web` profile and start the unmodified dsh runtime for a
 * browser check. Installation alone does not establish UI or runtime compatibility.
 *
 * --desktop (or --profile <name>): instead install the same packed build into a real profile.
 * `desktop` is the DSH app. This changes a user profile, so it refuses while the DSH app is
 * running unless --force is given, and it never starts a server: restart the app to load it.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const args = process.argv.slice(2);
const has = name => args.includes(name);
const value = name => {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  return args.find(arg => arg.startsWith(`${name}=`))?.slice(name.length + 1);
};

const supported = ['0.2.0-rc.2', '0.2.1-alpha.2', '0.2.1-rc.1'];
const port = value('--port') ?? process.env.STUDIO_WEB_PORT;
const skipTest = has('--skip-test');
const buildOnly = has('--build-only');
const force = has('--force');
const profile = has('--desktop') ? 'desktop' : value('--profile');
const runtime = process.env.STUDIO_DSH_BIN || 'dsh';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const fail = message => { console.error(message); process.exit(1); };

// 1. Verify the current sources before anything reaches a profile or a browser.
const step = skipTest ? 'build' : 'test';
const prepared = spawnSync(npm, ['run', step], { cwd: root, stdio: 'inherit' });
if (prepared.error || prepared.status !== 0) fail(`\nnpm run ${step} failed; nothing was installed.`);
if (buildOnly) {
  console.log('\nBuild finished (--build-only); no profile touched and Web preview not started.');
  process.exit(0);
}

// 2. A shared pack helper: a fresh directory stops pnpm reusing a same-version tarball.
function pack(label) {
  const dist = path.join(root, 'dist', `${label}-${Date.now()}`);
  const packed = spawnSync(process.execPath, [path.join(root, 'pack.mjs')], {
    cwd: root, env: { ...process.env, STUDIO_PACK_DIST: dist }, encoding: 'utf8',
  });
  const archive = packed.stdout.trim().split('\n').at(-1);
  if (packed.error || packed.status !== 0 || !archive || !existsSync(archive)) fail('Studio pack failed.');
  return archive;
}

const runtimeVersion = () => {
  const result = spawnSync(runtime, ['--version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) fail(`Cannot run ${runtime}: ${result.error ?? result.stderr}`);
  return result.stdout.trim();
};

const appRunning = () => spawnSync('pgrep', ['-f', 'DeepSeek Harness.app'], { stdio: 'ignore' }).status === 0;

/** Install the local build into a real profile instead of the isolated Web preview. */
function applyProfile(name) {
  const version = runtimeVersion();
  if (!supported.includes(version)) fail(`Unsupported runtime ${version} (expected ${supported.join(' or ')}); refusing to change the ${name} profile.`);
  if (name === 'desktop' && process.platform === 'darwin' && !force && appRunning()) {
    fail('The DeepSeek Harness app appears to be running. Quit it (this Web GUI closes with it), '
      + 'then re-run; use --force only if you accept modifying a live profile.');
  }
  const home = process.env.DSH_HOME ?? path.join(homedir(), '.dsh');
  const manifestPath = path.join(home, 'profiles', name, 'package.json');
  if (!existsSync(manifestPath)) fail(`Profile ${name} not found at ${manifestPath}.`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.dependencies?.['@local/dsh-studio']) {
    fail(`Profile ${name} still has @local/dsh-studio; remove it first (two Studios in one profile conflict):\n`
      + `  ${runtime} plugin --profile ${name} remove @local/dsh-studio`);
  }

  console.log(`Target runtime: ${runtime} (${version}); profile: ${manifestPath}`);
  console.log('This changes a real profile. Back it up first; stop the app on every OS. --force is not a safety check.');
  const archive = pack(name);
  console.log(`\nInstalling the local build into the real ${name} profile:\n  ${manifestPath}\n  ${archive}`);
  const added = spawnSync(runtime, ['plugin', '--profile', name, 'add', archive], { cwd: root, stdio: 'inherit' });
  if (added.error || added.status !== 0) fail(`Installing into ${name} failed.`);
  console.log(`\nInstalled the local build into the ${name} profile. Restart the DSH app to load it.`);
  console.log(`Presets stay in ${path.join(home, 'profiles', name, 'studio-data')}.`);
  console.log(`Recovery: reinstall the exact previously verified Studio version, not @latest. Restore data from your backup if needed.`);
}

/** Default: isolated Web preview through start-web.mjs (packs and installs lean-agent-web itself). */
function startWeb() {
  runtimeVersion();
  const env = { ...process.env };
  if (port) env.STUDIO_WEB_PORT = String(port);
  const child = spawn(process.execPath, [path.join(root, 'start-web.mjs')], { cwd: root, stdio: 'inherit', env });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('error', error => { console.error(error); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
}

if (profile) applyProfile(profile);
else startWeb();
