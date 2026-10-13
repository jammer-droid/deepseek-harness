import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';
import { globSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const dist = path.resolve(root, process.env.STUDIO_PACK_DIST ?? 'dist');
const runtimeVersion = process.env.STUDIO_RUNTIME_VERSION;
const staging = path.join(dist, 'bundle');
await mkdir(staging, { recursive: true });
const dependencies = {};
for (const part of ['shell']) {
  const output = execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', dist], { cwd: path.join(root, 'packages', part), encoding: 'utf8' });
  dependencies[`@local/dsh-studio-${part}`] = `file:${path.join(dist, JSON.parse(output)[0].filename)}`;
}
const manifest = JSON.parse(await readFile(path.join(root, 'packages/bundle/package.json'), 'utf8'));
const versions = new Map();
for (const file of globSync('packages/*/*/package.json', { cwd: path.resolve(root, '..') })) {
  const pkg = JSON.parse(await readFile(path.resolve(root, '..', file), 'utf8'));
  versions.set(pkg.name, pkg.version);
}
for (const [name, spec] of Object.entries(manifest.dependencies)) {
  if (name in dependencies) continue;
  if (spec !== 'workspace:*' || (!runtimeVersion && !versions.has(name))) throw new Error(`Unresolved bundle dependency: ${name}`);
  dependencies[name] = runtimeVersion ?? versions.get(name);
}
await writeFile(path.join(staging, 'package.json'), JSON.stringify({ ...manifest, dependencies }, null, 2) + '\n');
await copyFile(path.join(root, 'packages/bundle/cordis.patch.yml'), path.join(staging, 'cordis.patch.yml'));
const output = execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', dist], { cwd: staging, encoding: 'utf8' });
console.log(path.join(dist, JSON.parse(output)[0].filename));
