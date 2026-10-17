import { spawnSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const runtime = process.env.STUDIO_DSH_BIN || 'dsh';
const version = spawnSync(runtime, ['--version'], { encoding: 'utf8' });
if (version.error || version.status !== 0) throw version.error || new Error(version.stderr);
if (!['0.2.0-rc.2', '0.2.1-alpha.2', '0.2.1-rc.1'].includes(version.stdout.trim())) {
  throw new Error(`Unsupported preview runtime: ${version.stdout.trim()}`);
}
// Install the packed bundle so DSH resolves runtime peers from its own installation.
// Loading an absolute development entry instead captures workspace scope singletons.
const env = { ...process.env, DSH_HOME: path.join(root, '.dsh-home') };
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env });
  if (result.error || result.status !== 0) throw result.error || new Error(`${command} failed (${result.status})`);
}
if (!existsSync(path.join(root, '.dsh-home/profiles/lean-agent-web/package.json'))) {
  run(runtime, ['--profile', 'lean-agent-web', '--from-default-profile', 'web', '--dump-config']);
}
// Fresh file URLs prevent pnpm from reusing a previous same-version tarball.
const packDist = path.join(root, 'dist', `preview-${Date.now()}`);
env.STUDIO_PACK_DIST = packDist;
const archive = spawnSync(process.execPath, [path.join(root, 'pack.mjs')], { cwd: root, env, encoding: 'utf8' }).stdout.trim().split('\n').at(-1);
if (!archive || !existsSync(archive)) throw new Error('Studio pack failed');
run(runtime, ['plugin', '--profile', 'lean-agent-web', 'add', archive]);
const child = spawn(runtime, [
  '--profile', 'lean-agent-web',
  '--host', '127.0.0.1', '--port', process.env.STUDIO_WEB_PORT || '19388', '--no-open',
], { cwd: root, stdio: 'inherit', env: { ...process.env, DSH_HOME: path.join(root, '.dsh-home') } });
child.on('error', error => { console.error(error); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => { process.exitCode = code ?? 1; });
