#!/usr/bin/env node
/**
 * One-way snapshot export of studio/ into the public dsh-studio repository.
 *
 *   node studio/release/sync.mjs                 # dry run: export, install, typecheck, test, pack; never pushes
 *   node studio/release/sync.mjs --push          # same, then commit and push the snapshot
 *   node studio/release/sync.mjs --push --publish [--otp=123456]  # also publish the packed package to npm
 *
 * Commits are authored as config.author; the push uses config.publisher.github's gh token and
 * npm publish requires `npm whoami` to equal config.publisher.npm, whatever account is active locally.
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
const publish = process.argv.includes('--publish');
const push = process.argv.includes('--push') || publish;
const otp = process.argv.find(arg => arg.startsWith('--otp='))?.slice('--otp='.length);
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
// Fail before any work when the publishing identities are not available.
const ghToken = () => run('gh', ['auth', 'token', '--user', config.publisher.github], monorepo, { capture: true }).trim();
if (push) ghToken();
if (publish) {
  const who = run('npm', ['whoami'], monorepo, { capture: true }).trim();
  if (who !== config.publisher.npm) throw new Error(`npm is logged in as ${who}; run npm login as ${config.publisher.npm}.`);
}
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
    scripts: { ...manifest.scripts, ...config.scripts }, devDependencies: { ...resolveWorkspace(manifest.devDependencies), ...config.devDependencies } };
  for (const key of config.dropScripts) delete out.scripts[key];
  // Development and release scripts stay in the fork. A kept script that runs a file the
  // snapshot does not carry would be broken in public and names private tooling.
  const dangling = Object.entries(out.scripts).flatMap(([key, command]) => [...String(command).matchAll(/(?:^|\s)([\w./-]+\.m?[jt]s)\b/g)]
    .map(match => match[1]).filter(file => !existsSync(path.join(work, file))).map(file => `${key}: ${file}`));
  if (dangling.length) throw new Error(`Exported scripts reference files outside the snapshot; add them to dropScripts:\n${dangling.join('\n')}`);
  return JSON.stringify(out, null, 2) + '\n';
});
await transform('packages/shell/package.json', text => {
  const manifest = JSON.parse(text);
  return JSON.stringify({ ...manifest, devDependencies: resolveWorkspace(manifest.devDependencies) }, null, 2) + '\n';
});
// Studio builds with esbuild only; DSH runtime natives pulled in as type sources never need their scripts here.
await writeFile(path.join(work, 'pnpm-workspace.yaml'), `packages:\n  - packages/*\nallowBuilds:\n${Object.entries(config.allowBuilds).map(([name, allow]) => `  '${name}': ${allow}`).join('\n')}\n`);
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
const version = JSON.parse(await readFile(path.join(studio, 'packages/shell/package.json'), 'utf8')).version;
// The public tree must not name the private source, its authors, branches or local machines.
const leaks = [];
for (const file of (await readdir(work, { recursive: true })).filter(file => file !== '.git' && !file.startsWith(`.git${path.sep}`) && !file.startsWith('node_modules'))) {
  const full = path.join(work, file);
  let text; try { text = await readFile(full, 'utf8'); } catch { continue; }
  for (const pattern of config.forbidden) for (const line of text.split('\n')) if (new RegExp(pattern, 'i').test(line)) leaks.push(`${file}: /${pattern}/ ${line.trim().slice(0, 100)}`);
}
if (leaks.length) throw new Error(`Snapshot contains private references:\n${leaks.join('\n')}`);

// 5. Prove the snapshot builds from public packages alone, then pack it.
run('pnpm', ['install', '--no-frozen-lockfile'], work);
run('pnpm', ['test'], work);
const tarball = run('node', ['pack.mjs'], work, { capture: true }).trim().split('\n').at(-1);
console.log(`\nExported ${exported.length} files from ${marker} into ${work}\nPackage: ${tarball}`);

// 6. Commit; push only when asked.
run('git', ['add', '-A'], work);
const unchanged = !git(['status', '--porcelain'], work);
if (unchanged && !publish) { console.log('No changes relative to the published snapshot.'); process.exit(0); }
// Snapshots are authored by the publishing account, never the fork's local git identity.
const identity = { GIT_AUTHOR_NAME: config.author.name, GIT_AUTHOR_EMAIL: config.author.email, GIT_COMMITTER_NAME: config.author.name, GIT_COMMITTER_EMAIL: config.author.email };
if (!unchanged) run('git', ['commit', '--quiet', '-m', `release: ${version}`], work, { env: identity });
console.log(git(['show', '--stat', '--oneline', 'HEAD'], work).split('\n').slice(0, 1).join('\n'));
if (!push) { console.log(`Dry run: not pushed. Inspect ${work}; re-run with --push to publish the snapshot.`); process.exit(0); }
// Push with the publisher's token so the active gh account and local git credentials never matter.
const auth = Buffer.from(`x-access-token:${ghToken()}`).toString('base64');
run('git', ['-c', `http.https://github.com/.extraheader=AUTHORIZATION: basic ${auth}`, '-c', 'credential.helper=', 'push', 'origin', `HEAD:${branch}`], work);
// Traceability stays in the private source: a local tag maps this source commit to the public snapshot.
const snapshot = git(['rev-parse', '--short=10', 'HEAD'], work);
run('git', ['tag', '-f', `dsh-studio-snapshot/${snapshot}`, 'HEAD'], monorepo);
console.log(`Pushed ${marker} to ${repo} ${branch} as ${config.publisher.github}; tagged dsh-studio-snapshot/${snapshot} locally.`);
if (!publish) process.exit(0);
if (!existsSync(tarball)) throw new Error('Packed tarball missing');
// An absolute path: npm reads a bare relative path like dist/x.tgz as a GitHub shorthand.
run('npm', ['publish', path.resolve(work, tarball), '--access', 'public', ...(otp ? ['--otp', otp] : [])], work);
console.log(`Published @${version} as ${config.publisher.npm}.`);
