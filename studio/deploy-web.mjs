/** Build and install Studio into an explicitly selected Web home, never Desktop. */
import { execFileSync } from 'node:child_process';
import { readFile, mkdtemp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const repo = path.resolve(root, '..');
const help = `Usage: npm --prefix studio run deploy:web -- --home /absolute/DSH_HOME [--dry-run]

Build, pack, and install Studio into DSH_HOME/profiles/web using this checkout's DSH CLI.
Use the same DSH_HOME and checkout as your Web server. Desktop is not a target.
--dry-run prints the steps without building, writing files, or installing.
This command does not start, stop, or verify a running Web server.
After installation, restart the existing Web server if needed and refresh the page.
`;

/** Parse explicit deployment authority; inherited DSH_HOME is never a default.
 * @param args CLI arguments.
 * @returns Absolute target home and preview mode.
 */
export function parseOptions(args) {
  let home;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--') continue;
    if (args[i] === '--help' && args.length === 1) return { help: true };
    if (args[i] === '--home' && home === undefined) home = args[++i];
    else if (args[i] === '--dry-run' && !dryRun) dryRun = true;
    else throw new Error(`Unknown or duplicate argument: ${args[i]}`);
  }
  if (!home || !path.isAbsolute(home)) throw new Error('--home must be an explicit absolute DSH_HOME path.');
  return { home: path.resolve(home), dryRun };
}

/** Stop at the first failed subprocess and retain installer diagnostics.
 * @param command Executable path or PATH command.
 * @param args Literal argument list, never shell text.
 * @param options Child working directory and environment.
 */
function execute(command, args, options) {
  console.log(`> ${[command, ...args].map(value => JSON.stringify(value)).join(' ')}`);
  execFileSync(command, args, { ...options, stdio: 'inherit' });
}

/** Execute ordered build, pack, and profile install steps.
 * @param options Parsed target and dry-run selection.
 * @param run Subprocess runner; tests use a recorder instead of modifying a profile.
 */
export async function deploy(options, run = execute) {
  const manifest = JSON.parse(await readFile(path.join(root, 'packages/bundle/package.json'), 'utf8'));
  const runtime = JSON.parse(await readFile(path.join(repo, 'package.json'), 'utf8'));
  console.log(`Runtime: checkout DSH ${runtime.version}\nTarget: ${path.join(options.home, 'profiles/web')}`);
  const base = path.join(root, 'dist/web');
  let dist = path.join(base, '<deployment>');
  if (!options.dryRun) {
    await mkdir(base, { recursive: true });
    dist = await mkdtemp(path.join(base, 'deploy-'));
  }
  // Each release keeps distinct tarball paths so same-version updates cannot reuse old file resolutions.
  const env = { ...process.env, DSH_HOME: options.home, STUDIO_PACK_DIST: dist };
  delete env.STUDIO_RUNTIME_VERSION;
  delete env.DSH_PROFILE;
  delete env.DSH_PROFILE_DIR;
  const archive = path.join(dist, `${manifest.name.replace(/^@/, '').replace('/', '-')}-${manifest.version}.tgz`);
  const steps = [
    ['npm', ['run', 'build'], root],
    [process.execPath, [path.join(root, 'pack.mjs')], root],
    [process.execPath, ['--import', 'tsx/esm', 'apps/cli/src/bin.ts', 'plugin', '--profile', 'web', 'add', archive], repo],
  ];
  for (const [command, args, cwd] of steps) {
    if (options.dryRun) console.log(JSON.stringify({ command, args, cwd }));
    else await run(command, args, { cwd, env });
  }
  console.log(options.dryRun ? 'Dry run: no files or profiles changed.' : `Installation command completed. Keep release files: ${dist}\nLive application is not verified. Review installer warnings, restart the existing Web server if needed, then refresh its page.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) console.log(help);
    else await deploy(options);
  } catch (error) {
    console.error(`Studio Web deployment stopped: ${error.message}`);
    process.exitCode = 1;
  }
}
