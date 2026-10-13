import { spawnSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const runtime = process.env.STUDIO_DSH_BIN || 'dsh';
const version = spawnSync(runtime, ['--version'], { encoding: 'utf8' });
if (version.error || version.status !== 0) throw version.error || new Error(version.stderr);
if (!['0.2.0-rc.2', '0.2.1-alpha.2'].includes(version.stdout.trim())) {
  throw new Error(`Unsupported preview runtime: ${version.stdout.trim()}`);
}
mkdirSync(path.join(root, 'dist'), { recursive: true });
const patch = path.join(root, 'dist', 'web-preview.patch.yml');
writeFileSync(patch, `- insert:\n    - id: local-dsh-studio-shell\n      name: ${JSON.stringify(path.join(root, 'packages/shell/index.js'))}\n`);
const child = spawn(runtime, [
  '--profile', 'lean-agent-web',
  ...(existsSync(path.join(root, '.dsh-home/profiles/lean-agent-web/package.json')) ? [] : ['--from-default-profile', 'web']),
  '--patch', patch,
  '--host', '127.0.0.1', '--port', process.env.STUDIO_WEB_PORT || '19388', '--no-open',
], { cwd: root, stdio: 'inherit', env: { ...process.env, DSH_HOME: path.join(root, '.dsh-home') } });
child.on('error', error => { console.error(error); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => { process.exitCode = code ?? 1; });
