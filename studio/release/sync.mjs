#!/usr/bin/env node
/**
 * One-way snapshot export of studio/ into the public dsh-studio repository.
 *
 *   node studio/release/sync.mjs                 # dry run: export, install, typecheck, test, pack; never pushes
 *   node studio/release/sync.mjs --push          # same, then commit and push the snapshot
 *
 * The fork's studio/ is the only source of truth. The exported tree replaces workspace
 * links with public npm versions, inherits no monorepo tsconfig, and carries only public docs.
 * Env: STUDIO_RELEASE_REPO (git URL), STUDIO_RELEASE_BRANCH (default main), STUDIO_RELEASE_DIR (work dir).
 */
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const studio = fileURLToPath(new URL('..', import.meta.url));
const monorepo = path.resolve(studio, '..');
const push = process.argv.includes('--push');
const repo = process.env.STUDIO_RELEASE_REPO ?? 'https://github.com/matamt-dbg/dsh-studio.git';
const branch = process.env.STUDIO_RELEASE_BRANCH ?? 'main';
const config = JSON.parse(await readFile(path.join(studio, 'release/config.json'), 'utf8'));
const run = (command, args, cwd, options = {}) => execFileSync(command, args, { cwd, stdio: options.capture ? 'pipe' : 'inherit', encoding: 'utf8', env: { ...process.env, ...options.env } });
const git = (args, cwd = monorepo) => run('git', args, cwd, { capture: true }).trim();

// 1. The snapshot must name an exact committed source.
if (git(['status', '--porcelain', '--', 'studio'])) throw new Error('studio/ has uncommitted changes; commit before syncing.');
const source = git(['rev-parse', '--short=10', 'HEAD']);
const sourceBranch = git(['rev-parse', '--abbrev-ref', 'HEAD']);

// 2. Check out the target (an empty repository starts an orphan branch).
const work = process.env.STUDIO_RELEASE_DIR ?? await mkdtemp(path.join(tmpdir(), 'dsh-studio-release-'));
await rm(work, { recursive: true, force: true });
run('git', ['clone', '--quiet', repo, work], monorepo);
const remoteHasBranch = git(['ls-remote', '--heads', 'origin', branch], work) !== '';
if (remoteHasBranch) run('git', ['checkout', '--quiet', branch], work); else run('git', ['checkout', '--quiet', '--orphan', branch], work);

// 3. Replace every tracked file with the allowed export set.
for (const entry of await readdir(work)) if (entry !== '.git') await rm(path.join(work, entry), { recursive: true, force: true });
const tracked = git(['ls-files', '-z', '--', 'studio']).split('\0').filter(Boolean).map(file => file.slice('studio/'.length));
const allowed = file => config.include.some(prefix => file === prefix || file.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`))
  && !config.exclude.some(prefix => file === prefix || file.startsWith(`${prefix}/`));
const exported = tracked.filter(allowed);
for (const file of exported) {
  await mkdir(path.dirname(path.join(work, file)), { recursive: true });
  await cp(path.join(studio, file), path.join(work, file));
}
for (const [from, to] of Object.entries(config.copy)) {
  await mkdir(path.dirname(path.join(work, to)), { recursive: true });
  await cp(path.join(studio, from), path.join(work, to), { recursive: true });
}

// 4. Standalone build configuration: public npm versions and a self-contained tsconfig base.
const transform = async (file, change) => {
  const target = path.join(work, file);
  await writeFile(target, change(await readFile(target, 'utf8')));
};
const pin = name => config.versions[name] ?? config.versions['@deepseek-ai/*'];
const resolveWorkspace = deps => Object.fromEntries(Object.entries(deps ?? {}).map(([name, spec]) => [name, String(spec).startsWith('workspace:') ? pin(name) : spec]));
await transform('package.json', text => {
  const manifest = JSON.parse(text);
  const out = { ...manifest, name: 'dsh-studio-development', private: true, packageManager: config.packageManager,
    scripts: { ...manifest.scripts, ...config.scripts }, devDependencies: resolveWorkspace(manifest.devDependencies) };
  for (const key of config.dropScripts) delete out.scripts[key];
  return JSON.stringify(out, null, 2) + '\n';
});
await transform('packages/shell/package.json', text => {
  const manifest = JSON.parse(text);
  return JSON.stringify({ ...manifest, devDependencies: resolveWorkspace(manifest.devDependencies) }, null, 2) + '\n';
});
await writeFile(path.join(work, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
for (const file of ['tsconfig.host.json', 'tsconfig.client.json']) {
  await transform(file, text => text.replace('"../tsconfig.base.client.json"', '"./tsconfig.base.client.json"').replace('"../tsconfig.base.json"', '"./tsconfig.base.json"'));
}
// Internal-only docs stay in the fork: keep the link text, drop the dead target.
for (const file of exported.filter(file => file.endsWith('.md'))) {
  await transform(file, text => text.replace(/\[([^\]]+)\]\(<?([^)>#\s]+)(#[^)>]*)?>?\)/g, (link, label, target) => {
    if (/^[a-z]+:/i.test(target)) return link;
    const resolved = path.normalize(path.join(path.dirname(file), target));
    return exported.includes(resolved) || existsSync(path.join(work, resolved)) ? link : label;
  }));
}
const marker = `${sourceBranch}@${source}`;
await writeFile(path.join(work, 'SOURCE'), `Snapshot of deepseek-harness studio/ at ${marker}.\nDo not edit here; change the source and re-sync.\n`);

// 5. Prove the snapshot builds from public packages alone, then pack it.
run('pnpm', ['install', '--no-frozen-lockfile'], work);
run('pnpm', ['test'], work);
const tarball = run('node', ['pack.mjs'], work, { capture: true }).trim().split('\n').at(-1);
console.log(`\nExported ${exported.length} files from ${marker} into ${work}\nPackage: ${tarball}`);

// 6. Commit; push only when asked.
run('git', ['add', '-A'], work);
if (!git(['status', '--porcelain'], work)) { console.log('No changes relative to the published snapshot.'); process.exit(0); }
run('git', ['-c', 'user.name=' + git(['config', 'user.name']), '-c', 'user.email=' + git(['config', 'user.email']), 'commit', '--quiet', '-m', `sync: deepseek-harness ${marker}`], work);
console.log(git(['show', '--stat', '--oneline', 'HEAD'], work).split('\n').slice(0, 1).join('\n'));
if (!push) { console.log(`Dry run: not pushed. Inspect ${work}; re-run with --push to publish the snapshot.`); process.exit(0); }
run('git', ['push', 'origin', `HEAD:${branch}`], work);
if (!existsSync(tarball)) throw new Error('Packed tarball missing after push');
console.log(`Pushed ${marker} to ${repo} ${branch}.`);
