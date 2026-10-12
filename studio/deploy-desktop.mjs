/** Deploy Studio to the installed macOS Desktop, without forcibly stopping active work. */
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, access } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const app = '/Applications/DeepSeek Harness.app';
const version = '0.2.0-rc.2';
const args = process.argv.slice(2).filter(arg => arg !== '--');
try {
  if (args.includes('--help')) {
    console.log('Usage: npm --prefix studio run deploy:desktop [-- --dry-run]\nTargets /Applications/DeepSeek Harness.app and the default ~/.dsh Desktop profile.\nFully quit Desktop first (Cmd+Q). Builds compatible Studio, installs, then opens Desktop.\nDoes not force quit, approve build scripts, or grant version exemptions.');
  } else {
    if (args.some(arg => arg !== '--dry-run') || args.length > 1) throw new Error('Only --dry-run or --help is supported.');
    if (process.platform !== 'darwin') throw new Error('This deployment supports the installed macOS Desktop only.');
    await access(app);
    const actual = execFileSync('dsh', ['--version'], { encoding: 'utf8' }).trim();
    if (actual !== version) throw new Error(`Expected installed dsh ${version}; received ${actual}. No installation performed.`);
    const home = path.join(homedir(), '.dsh');
    await access(path.join(home, 'profiles/desktop/package.json'));
    const manifest = JSON.parse(await readFile(path.join(root, 'packages/bundle/package.json'), 'utf8'));
    console.log(`Target: ${app}\nRuntime: ${actual}\nHome: ${home}`);
    if (args.includes('--dry-run')) {
      console.log('Plan: require Desktop stopped → compatible build → require Desktop stopped → dsh plugin --profile desktop add <unique-release> → open Desktop. No changes made.');
    } else {
      const requireStopped = () => {
        const processes = execFileSync('ps', ['-axo', 'command='], { encoding: 'utf8' });
        if (processes.split('\n').some(line => line.includes(`${app}/Contents/MacOS/`))) {
          throw new Error('Desktop is running. Save your work, fully quit with Cmd+Q, and rerun this command from an external terminal.');
        }
      };
      requireStopped();
      const base = path.join(root, 'dist', `desktop-${version}`);
      await mkdir(base, { recursive: true });
      const dist = await mkdtemp(path.join(base, 'deploy-'));
      const env = { ...process.env, DSH_HOME: home, STUDIO_DESKTOP_PACK_DIST: dist };
      delete env.STUDIO_DESKTOP_BUILD_ROOT;
      delete env.DSH_PROFILE;
      delete env.DSH_PROFILE_DIR;
      execFileSync(process.execPath, [path.join(root, 'build-desktop.mjs')], { cwd: root, env, stdio: 'inherit' });
      requireStopped();
      const archive = path.join(dist, `${manifest.name.replace(/^@/, '').replace('/', '-')}-${manifest.version}.tgz`);
      execFileSync('dsh', ['plugin', '--profile', 'desktop', 'add', archive], { env, stdio: 'inherit' });
      execFileSync('open', [app], { stdio: 'inherit' });
      console.log(`Installed and requested Desktop launch. Check DSH Studio in the app. Keep release files: ${dist}`);
    }
  }
} catch (error) {
  console.error(`Desktop deployment stopped: ${error.message}`);
  process.exitCode = 1;
}
