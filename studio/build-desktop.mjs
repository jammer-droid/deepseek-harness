/** Build and package against Desktop 0.2.0-rc.2's published declarations. */
import { cp, mkdir, mkdtemp, readFile, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('.', import.meta.url));
const version = '0.2.0-rc.2';
const workspace = process.env.STUDIO_DESKTOP_BUILD_ROOT ?? await mkdtemp(join(tmpdir(), 'studio-desktop-build-'));
const stage = join(workspace, 'studio');
const dist = process.env.STUDIO_DESKTOP_PACK_DIST ?? join(root, 'dist', `desktop-${version}`);
const dependencies = {};
for (const file of ['package.json', 'packages/roles/package.json', 'packages/general/package.json', 'packages/workflows/package.json', 'packages/experiments/package.json', 'packages/sub-agent-catalog/package.json']) {
  const manifest = JSON.parse(await readFile(join(root, file), 'utf8'));
  for (const [name, spec] of Object.entries(manifest.devDependencies)) {
    if (name.startsWith('@local/')) continue;
    // Loader fixtures are workspace-only tests, not Desktop build inputs.
    if (name === '@deepseek-ai/cordis-plugin-loader' || name === '@deepseek-ai/cordis-plugin-include') continue;
    dependencies[name] = name.startsWith('@deepseek-ai/dsh') ? version : name === '@deepseek-ai/cordis' ? '4.0.4' : spec;
  }
}
await mkdir(workspace, { recursive: true });
await writeFile(join(workspace, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies }, null, 2) + '\n');
execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: workspace, stdio: 'inherit' });
for (const entry of ['src', 'packages', 'build.mjs', 'generate-roles.mjs', 'pack.mjs', 'tsconfig.host.json', 'tsconfig.client.json', 'tsconfig.typert.host.json']) {
  await cp(join(root, entry), join(stage, entry), { recursive: true, filter: source => !['node_modules', 'dist'].includes(source.split('/').at(-1)) });
}
for (const name of ['tsconfig.base.json', 'tsconfig.base.client.json']) await cp(join(root, '..', name), join(workspace, name));
await cp(join(root, '../scripts/types'), join(workspace, 'scripts/types'), { recursive: true });
await writeFile(join(stage, 'package.json'), JSON.stringify({ private: true, type: 'module' }) + '\n');
await cp(join(root, 'compat/desktop-0.2.0/child-runtime.ts.template'), join(stage, 'packages/roles/src/child-runtime.ts'));
for (const part of ['roles', 'general', 'workflows', 'experiments', 'sub-agent-catalog', 'shell', 'bundle']) {
  const path = join(stage, 'packages', part, 'package.json');
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  for (const name of Object.keys(manifest.peerDependencies ?? {})) {
    if (name.startsWith('@deepseek-ai/dsh')) manifest.peerDependencies[name] = version;
    if (name === '@deepseek-ai/cordis') manifest.peerDependencies[name] = '4.0.4';
  }
  await writeFile(path, JSON.stringify(manifest, null, 2) + '\n');
}
for (const part of ['roles', 'general', 'workflows', 'experiments', 'sub-agent-catalog']) {
  const local = join(workspace, `node_modules/@local/dsh-studio-${part}`);
  await mkdir(dirname(local), { recursive: true });
  try { await symlink(join(stage, 'packages', part), local); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
}
const run = (file, args = []) => execFileSync(process.execPath, [file, ...args], { cwd: stage, stdio: 'inherit' });
run(join(stage, 'generate-roles.mjs'));
run(join(stage, 'generate-roles.mjs'), ['general']);
run(join(stage, 'generate-roles.mjs'), ['workflows']);
run(join(stage, 'generate-roles.mjs'), ['experiments']);
run(join(stage, 'generate-roles.mjs'), ['sub-agent-catalog']);
for (const config of ['tsconfig.host.json', 'packages/roles/tsconfig.host.json', 'packages/general/tsconfig.host.json', 'packages/workflows/tsconfig.host.json', 'packages/experiments/tsconfig.host.json', 'packages/sub-agent-catalog/tsconfig.host.json', 'tsconfig.client.json']) run(join(workspace, 'node_modules/typescript/bin/tsc'), ['-p', config]);
run(join(stage, 'build.mjs'));
execFileSync(process.execPath, [join(stage, 'pack.mjs')], { cwd: stage, stdio: 'inherit', env: { ...process.env, STUDIO_RUNTIME_VERSION: version, STUDIO_PACK_DIST: dist } });
console.log(`Desktop ${version} build: ${dist}\nBuild workspace: ${workspace}`);
