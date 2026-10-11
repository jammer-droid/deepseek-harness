/** Run the built compatibility bundle through an isolated installed-runtime profile. */
import { cp, mkdir, mkdtemp, readFile, symlink, writeFile, open } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';

const studio = fileURLToPath(new URL('../..', import.meta.url));
const buildRoot = process.env.STUDIO_DESKTOP_BUILD_ROOT;
if (!buildRoot) throw new Error('Set STUDIO_DESKTOP_BUILD_ROOT to the workspace printed by build:desktop.');
const launcher = process.env.STUDIO_DESKTOP_DSH ?? 'dsh';
const version = execFileSync(launcher, ['--version'], { encoding: 'utf8' }).trim();
if (version !== '0.2.0-rc.2') throw new Error(`Expected dsh 0.2.0-rc.2; received ${version}`);
const home = await mkdtemp(join(tmpdir(), 'studio-desktop-probe-'));
const env = { ...process.env, DSH_HOME: home, STUDIO_PROBE_WORKSPACE: join(home, 'workspace'), STUDIO_PROBE_RESULT: join(home, 'result.json'), STUDIO_PROBE_START: join(home, 'start') };
await mkdir(env.STUDIO_PROBE_WORKSPACE);
const log = await open(join(home, 'runtime.log'), 'w');
let child;
let exited;
try {
  execFileSync(launcher, ['plugin', '--profile', 'web', 'add', join(studio, 'dist/desktop-0.2.0-rc.2/local-dsh-studio-0.1.1.tgz')], { env, stdio: ['ignore', log.fd, log.fd] });
  const probe = join(home, 'probe');
  await mkdir(probe);
  await cp(new URL('./smoke.mjs', import.meta.url), join(probe, 'index.mjs'));
  await symlink(join(buildRoot, 'node_modules'), join(probe, 'node_modules'), 'junction');
  const overlay = join(home, 'probe.yml');
  await writeFile(overlay, `- insert:\n    - name: ${JSON.stringify(join(probe, 'index.mjs'))}\n`);
  child = spawn(launcher, ['web', '--patch', overlay, '--no-open', '--port', '0'], { env, stdio: ['ignore', log.fd, log.fd] });
  exited = once(child, 'exit');
  const deadline = Date.now() + 90_000;
  let result;
  let started = false;
  while (!result) {
    if (!started && (await readFile(join(home, 'runtime.log'), 'utf8')).includes('dsh web: http://')) {
      await writeFile(env.STUDIO_PROBE_START, 'ready\n');
      started = true;
    }
    try { result = JSON.parse(await readFile(env.STUDIO_PROBE_RESULT, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Runtime exited before probe completion; see ${home}`);
    if (Date.now() > deadline) throw new Error(`Probe timed out; see ${home}`);
    if (!result) await setTimeout(50);
  }
  if (!result.ok) throw new Error(result.error);
  console.log(`Desktop ${version}: fork, initial review, same-child rework, rereview, completion and stop passed.\nEvidence: ${home}`);
} finally {
  if (child && exited) {
    child.kill('SIGTERM');
    const killTimer = globalThis.setTimeout(() => child.kill('SIGKILL'), 10_000);
    try { await exited; } finally { clearTimeout(killTimer); }
  }
  await log.close();
}
