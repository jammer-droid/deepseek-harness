import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const dist = path.join(root, 'dist');
const staging = path.join(dist, 'bundle');
await mkdir(staging, { recursive: true });
const dependencies = {};
for (const part of ['shell', 'demo', 'roles']) {
  const output = execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', dist], { cwd: path.join(root, 'packages', part), encoding: 'utf8' });
  dependencies[`@local/dsh-studio-${part}`] = `file:${path.join(dist, JSON.parse(output)[0].filename)}`;
}
const manifest = JSON.parse(await readFile(path.join(root, 'packages/bundle/package.json'), 'utf8'));
await writeFile(path.join(staging, 'package.json'), JSON.stringify({ ...manifest, dependencies }, null, 2) + '\n');
await copyFile(path.join(root, 'packages/bundle/cordis.patch.yml'), path.join(staging, 'cordis.patch.yml'));
const output = execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', dist], { cwd: staging, encoding: 'utf8' });
console.log(path.join(dist, JSON.parse(output)[0].filename));
