/** Isolated full-app compatibility probe; never touches an existing profile. */
import { mkdtemp, mkdir, cp, symlink, writeFile, readFile, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';

const runtime = process.env.STUDIO_PRESET_RUNTIME;
if (!runtime) throw new Error('Set STUDIO_PRESET_RUNTIME to the unmodified npm runtime.');
const launcher = resolve(runtime, 'node_modules/.bin/dsh');
const version = execFileSync(launcher, ['--version'], { encoding: 'utf8' }).trim();
const home = await mkdtemp(join(tmpdir(), 'studio-workflow-app-'));
const env = { ...process.env, DSH_HOME: home, STUDIO_PROBE_WORKSPACE: join(home, 'workspace'), STUDIO_PROBE_RESULT: join(home, 'result.json'), STUDIO_PROBE_START: join(home, 'start') };
if (process.env.STUDIO_WORKFLOW_BUNDLE) execFileSync(launcher, ['plugin', '--profile', 'web', 'add', resolve(process.env.STUDIO_WORKFLOW_BUNDLE)], { env, stdio: 'inherit' });
const probe = join(home, 'probe');
await mkdir(probe);
await mkdir(join(home, 'workspace'));
await cp(new URL(process.env.STUDIO_WORKFLOW_BUNDLE ? './workflow-applied-smoke.mjs' : './workflow-app-smoke.mjs', import.meta.url), join(probe, 'index.mjs'));
await symlink(resolve(runtime, 'node_modules'), join(probe, 'node_modules'));
const overlay = join(home, 'probe.yml');
await writeFile(overlay, `- id: agent-default-model\n  config:\n    provider: studio-probe\n    model: probe\n- id: session-title-llm\n  disabled: true\n- insert:\n    - name: ${JSON.stringify(join(probe, 'index.mjs'))}\n`);
const log = await open(join(home, 'runtime.log'), 'w');
let child = spawn(launcher, ['web', '--patch', overlay, '--no-open', '--port', '0'], { env, stdio: ['ignore', log.fd, log.fd] });
let exited = once(child, 'exit');
try {
  const deadline = Date.now() + 90000;
  let started = false;
  while (true) {
    if (!started && (await readFile(join(home, 'runtime.log'), 'utf8')).includes('dsh web: http://')) {
      await writeFile(env.STUDIO_PROBE_START, 'ready');
      started = true;
    }
    let result;
    try { result = JSON.parse(await readFile(env.STUDIO_PROBE_RESULT, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (result) {
      if (!result.ok) throw new Error(result.error);
      console.log(JSON.stringify({ version, home, ...result }, null, 2));
      if (process.env.STUDIO_WORKFLOW_BROWSER_TOOLS && !env.STUDIO_PROBE_RESTART) {
        const { verifyBrowser } = await import('./workflow-browser.mjs');
        const output = await readFile(join(home, 'runtime.log'), 'utf8');
        const url = output.match(/dsh web: (http:\/\/[^\s]+)/)?.[1];
        if (!url) throw new Error('Runtime did not report its exact Web URL');
        await verifyBrowser(url, home);
      }
      if (process.env.STUDIO_WORKFLOW_BUNDLE && !env.STUDIO_PROBE_RESTART) {
        child.kill('SIGTERM'); await exited;
        env.STUDIO_PROBE_RESTART = '1'; env.STUDIO_PROBE_RESULT = join(home, 'restart-result.json');
        child = spawn(launcher, ['web', '--patch', overlay, '--no-open', '--port', '0'], { env, stdio: ['ignore', log.fd, log.fd] });
        exited = once(child, 'exit');
        continue;
      }
      break;
    }
    if (child.exitCode !== null || child.signalCode !== null || Date.now() > deadline) throw new Error(`Probe failed or timed out: ${home}`);
    await setTimeout(50);
  }
} finally {
  child.kill('SIGTERM');
  const timer = globalThis.setTimeout(() => child.kill('SIGKILL'), 10000);
  try { await exited; } finally { clearTimeout(timer); await log.close(); }
}
