/**
 * Generate Studio's roles Remote before Client typechecking and bundling.
 * Run `node studio/generate-roles.mjs` after installing Studio dependencies
 * and building their public declarations. Generation resolves dependencies as
 * installed packages, not through the enclosing Harness source path aliases.
 * Uses only the public Typert analyzer/emitter; the normal Studio Host config
 * remains a compilation project rather than a generation aggregate.
 */
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { WorkspaceAnalyzer, FaceModelEmitter } from '@deepseek-ai/dsh-typert-generator';

const root = fileURLToPath(new URL('.', import.meta.url));
const part = process.argv[2] ?? 'roles';
if (!['roles', 'general', 'workflows', 'experiments', 'catalog'].includes(part)) throw new Error('Unknown Studio package');
const packageRoot = new URL(`./packages/${part}/`, import.meta.url);
const manifest = JSON.parse(await readFile(new URL('package.json', packageRoot), 'utf8'));
const outputs = [
  ['./typert', 'typert.host'],
  ['./remote', 'typert.remote-client'],
];
for (const [subpath, basename] of outputs) {
  for (const [condition, extension] of [['types', 'd.ts'], ['default', 'js']]) {
    const file = `lib/${basename}.${extension}`;
    if (manifest.exports?.[subpath]?.[condition] !== `./${file}` || !manifest.files?.includes(file)) {
      throw new Error(`Studio roles must export ${subpath} (${condition}) as ./${file} and publish ${file}`);
    }
  }
}

// The analyzer identifies decorators by registered package ownership. Stage
// exact installed declarations as a package, without changing the public API.
const require = createRequire(new URL('package.json', packageRoot));
const protocolRoot = dirname(require.resolve('@deepseek-ai/dsh-typert-protocol/package.json'));
const protocol = JSON.parse(await readFile(join(protocolRoot, 'package.json'), 'utf8'));
const staging = await mkdtemp(join(root, 'packages/.typert-roles-'));
let artifact;
try {
  await cp(join(protocolRoot, 'lib/types'), join(staging, 'declarations'), { recursive: true });
  await mkdir(join(staging, 'node_modules/@deepseek-ai'), { recursive: true });
  const cordisRoot = dirname(require.resolve('@deepseek-ai/cordis/package.json'));
  await symlink(cordisRoot, join(staging, 'node_modules/@deepseek-ai/cordis'), 'junction');
  await writeFile(join(staging, 'package.json'), JSON.stringify({
    name: protocol.name, type: 'module', exports: { '.': './declarations/index.d.ts' },
  }));
  await writeFile(join(staging, 'tsconfig.json'), JSON.stringify({
    extends: '../../tsconfig.typert.host.json', include: ['declarations/**/*.d.ts'], references: [],
  }));
  await writeFile(join(staging, 'aggregate.json'), JSON.stringify({
    extends: '../../tsconfig.typert.host.json',
    compilerOptions: { paths: { '@deepseek-ai/dsh-typert-protocol': [join(staging, 'declarations/index.d.ts')] } },
    references: [{ path: `../${part}/tsconfig.host.json` }, { path: './tsconfig.json' }],
  }));
  const workspace = new WorkspaceAnalyzer({
    root,
    hostConfig: relative(root, join(staging, 'aggregate.json')),
    faces: ['host'],
    packages: [manifest.name],
  }).analyze();
  const host = workspace.faces.find(face => face.face === 'host');
  if (!host) throw new Error('Studio roles Host generation produced no Host model');
  artifact = new FaceModelEmitter(host).emit(manifest.name);
} finally {
  const target = await realpath(staging);
  if (dirname(target) !== resolve(root, 'packages') || !target.startsWith(join(root, 'packages/.typert-roles-'))) {
    throw new Error(`Refusing to remove unexpected generation directory: ${target}`);
  }
  await rm(target, { recursive: true, force: true });
}
if (!artifact.remote) {
  throw new Error('Studio roles has no package-local @Remote methods; generation requires the actual Host source');
}

await mkdir(new URL('lib/', packageRoot), { recursive: true });
await Promise.all([
  ['typert.host.js', artifact.js],
  ['typert.host.d.ts', artifact.dts],
  ['typert.remote-client.js', artifact.remote.js],
  ['typert.remote-client.d.ts', artifact.remote.dts],
  ['typert.remote-client.d.ts.map', artifact.remote.dtsMap],
].map(([file, content]) => writeFile(new URL(`lib/${file}`, packageRoot), content)));
console.log(`Generated ${manifest.name} Host reflection and Remote JS/DTS`);
