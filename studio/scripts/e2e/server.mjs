#!/usr/bin/env node
/**
 * Isolated E2E Web server for agent verification. One call returns only when the result is known.
 *
 *   node studio/scripts/e2e/server.mjs up [--profile e2e] [--port N] [--archive <tgz>] [--skip-build]
 *        [--plugin <spec>]... [--with-desktop-plugins] [--reuse-profile] [--timeout 90s]
 *   node studio/scripts/e2e/server.mjs status [--profile e2e]
 *   node studio/scripts/e2e/server.mjs down [--profile e2e] [--timeout 20s]
 *
 * up: build and pack Studio (or use --archive), recreate the profile from the shipped `web` template,
 * install the package (and optional extra plugins) into an isolated DSH_HOME, start the unmodified
 * `dsh` detached, wait inside this script until the authenticated URL answers, then print one JSON
 * summary. The home survives between runs (logins kept); the profile is fresh unless --reuse-profile.
 * The user's ~/.dsh profiles are only read (for --with-desktop-plugins), never written.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PROFILE, PORT_RANGE, findServerUrl, parseArgs, pluginSpecs, redactUrl, supportedVersions } from './server-lib.mjs';

const studio = fileURLToPath(new URL('../..', import.meta.url));
const runtime = process.env.STUDIO_DSH_BIN || 'dsh';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

let options;
try { options = parseArgs(process.argv.slice(2)); } catch (error) { finish({ ok: false, error: error.message }, 2); }
const profile = options.profile ?? DEFAULT_PROFILE;
const home = path.resolve(options.home ?? process.env.STUDIO_E2E_HOME ?? path.join(studio, 'dist/e2e/home'));
const runDir = path.join(home, 'e2e-runs', profile);
const statePath = path.join(runDir, 'state.json');
const logPath = path.join(runDir, 'server.log');
const userHome = path.resolve(process.env.DSH_HOME_USER ?? path.join(homedir(), '.dsh'));
if (home === userHome || home.startsWith(userHome + path.sep)) finish({ ok: false, error: `Refusing to use the user DSH home ${userHome}` }, 2);

function finish(summary, code = summary.ok ? 0 : 1) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(code);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const readState = () => (existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : undefined);
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const tail = (text, lines = 20) => String(text).trim().split('\n').slice(-lines).join('\n');

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, { cwd: studio, encoding: 'utf8', env: { ...process.env, ...extraEnv }, maxBuffer: 64 << 20 });
  return { ok: !result.error && result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? `\n${result.error.message}` : ''}` };
}

function portFree(port) {
  return new Promise(resolve => {
    const server = createServer().once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}

async function pickPort() {
  if (options.port) return (await portFree(options.port)) ? options.port : undefined;
  for (let port = PORT_RANGE[0]; port <= PORT_RANGE[1]; port++) if (await portFree(port)) return port;
  return undefined;
}

async function up() {
  const previous = readState();
  if (previous && alive(previous.pid)) finish({ ok: false, error: `Profile ${profile} already has a running server (pid ${previous.pid}, port ${previous.port}); run down first` });

  const versionRun = run(runtime, ['--version']);
  const version = versionRun.output.trim().split('\n').at(-1);
  const manifest = JSON.parse(readFileSync(path.join(studio, 'packages/shell/package.json'), 'utf8'));
  const supported = supportedVersions(manifest.peerDependencies?.['@deepseek-ai/dsh']);
  if (!versionRun.ok || !supported.includes(version)) finish({ ok: false, step: 'runtime', runtime, version, supported });

  let archive = options.archive && path.resolve(options.archive);
  if (!archive) {
    if (!options.skipBuild) {
      const built = run(npm, ['run', 'build']);
      if (!built.ok) finish({ ok: false, step: 'build', output: tail(built.output) });
    }
    const packed = run(process.execPath, [path.join(studio, 'pack.mjs')], { STUDIO_PACK_DIST: path.join(studio, 'dist/e2e/packs', `${Date.now()}`) });
    archive = packed.output.trim().split('\n').at(-1);
    if (!packed.ok || !existsSync(archive)) finish({ ok: false, step: 'pack', output: tail(packed.output) });
  }
  if (!existsSync(archive)) finish({ ok: false, step: 'pack', error: `Archive not found: ${archive}` });
  const sha256 = createHash('sha256').update(readFileSync(archive)).digest('hex');

  const port = await pickPort();
  if (!port) finish({ ok: false, step: 'port', error: options.port ? `Port ${options.port} is in use` : `No free port in ${PORT_RANGE.join('-')}` });

  mkdirSync(runDir, { recursive: true });
  const env = { DSH_HOME: home };
  if (!options.reuseProfile || !existsSync(path.join(home, 'profiles', profile))) {
    const created = run(runtime, ['--profile', profile, '--from-default-profile', 'web', '--dump-config'], env);
    if (!created.ok) finish({ ok: false, step: 'profile', output: tail(created.output) });
  }

  const extra = [...options.plugins];
  if (options.desktopPlugins) {
    const desktop = path.join(userHome, 'profiles/desktop/package.json');
    if (!existsSync(desktop)) finish({ ok: false, step: 'plugins', error: `No desktop profile manifest at ${desktop}` });
    extra.push(...pluginSpecs(JSON.parse(readFileSync(desktop, 'utf8'))));
  }
  const installed = [];
  const warnings = [];
  for (const spec of [archive, ...extra]) {
    const added = run(runtime, ['plugin', '--profile', profile, 'add', spec], env);
    if (!added.ok) finish({ ok: false, step: 'install', spec, output: tail(added.output) });
    installed.push(spec === archive ? path.basename(archive) : spec);
    if (/WARN/.test(added.output)) warnings.push(`${path.basename(spec)}: ${added.output.match(/.*WARN.*/)[0].trim()}`);
  }

  const log = openSync(logPath, 'w');
  chmodSync(logPath, 0o600);
  const child = spawn(runtime, ['--profile', profile, '--host', '127.0.0.1', '--port', String(port), '--no-open'], {
    cwd: studio, detached: true, stdio: ['ignore', log, log], env: { ...process.env, ...env },
  });
  closeSync(log);
  child.unref();

  const timeoutMs = options.timeoutMs ?? 90_000;
  const deadline = Date.now() + timeoutMs;
  let url;
  let ready = false;
  while (Date.now() < deadline && alive(child.pid)) {
    url ??= findServerUrl(readFileSync(logPath, 'utf8'), port);
    if (url) {
      // The token URL answers 303 with a session cookie; following it without the cookie gives 401.
      try {
        const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
        if (response.status >= 200 && response.status < 400) { ready = alive(child.pid); break; }
      } catch { /* not ready yet */ }
    }
    await sleep(1000);
  }
  const state = { pid: child.pid, port, profile, home, log: logPath, url, archive, sha256, runtime, version, startedAt: new Date().toISOString() };
  writeFileSync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
  if (!ready) {
    if (alive(child.pid)) { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ } }
    rmSync(statePath, { force: true });
    finish({ ok: false, step: 'start', error: alive(child.pid) ? `Not ready within ${timeoutMs}ms` : 'Server exited', log: logPath, output: redactUrl(tail(readFileSync(logPath, 'utf8'))) });
  }
  finish({ ok: true, url, port, pid: child.pid, profile, home, version, package: path.basename(archive), sha256, installed, warnings, log: logPath, state: statePath });
}

async function down() {
  const state = readState();
  if (!state) finish({ ok: true, profile, stopped: false, note: 'No state file; nothing started by this script' });
  if (alive(state.pid)) {
    try { process.kill(-state.pid, 'SIGTERM'); } catch { try { process.kill(state.pid, 'SIGTERM'); } catch { /* gone */ } }
  }
  const deadline = Date.now() + (options.timeoutMs ?? 20_000);
  while (Date.now() < deadline && (alive(state.pid) || !(await portFree(state.port)))) await sleep(500);
  if (alive(state.pid)) { try { process.kill(-state.pid, 'SIGKILL'); } catch { /* gone */ } await sleep(500); }
  const free = await portFree(state.port);
  if (!alive(state.pid)) rmSync(statePath, { force: true });
  finish({ ok: !alive(state.pid) && free, profile, stopped: !alive(state.pid), port: state.port, portFree: free });
}

async function status() {
  const state = readState();
  if (!state) finish({ ok: true, profile, running: false });
  finish({ ok: true, ...state, running: alive(state.pid), portInUse: !(await portFree(state.port)) });
}

await { up, down, status }[options.command]();
