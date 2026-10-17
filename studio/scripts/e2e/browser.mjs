/**
 * Shared Playwright harness for agent E2E (L0). A scenario only states what to check:
 *
 *   import { run } from './browser.mjs';
 *   await run({ name: 'pixie-tab', views: ['light', 'dark', 'light@480'] }, async app => {
 *     await app.check('Studio panel opens', async () => {
 *       await app.page.getByRole('button', { name: 'DSH Studio' }).click();
 *     });
 *     await app.shot('studio');
 *   });
 *
 * run() reads the authenticated URL from the server state written by server.mjs, opens each view in a
 * fresh headless context, waits for the DSH shell, dismisses the preview notice, records pageerrors and
 * plugin activation failures, and prints one JSON summary (exit 1 on any failure). Screenshots go to
 * studio/dist/e2e/shots/<name>/ and are listed, not shown. The URL token is never printed.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PLUGIN_FAILURE, errorLine, parseView, pickPlaywright, shotName, summarize, viewName } from './browser-lib.mjs';
import { DEFAULT_PROFILE } from './server-lib.mjs';

const studio = fileURLToPath(new URL('../..', import.meta.url));
const repo = path.resolve(studio, '..');

/** Resolve Playwright without adding a dependency: env override, the repo pnpm store, then normal resolution. */
export async function loadPlaywright() {
  if (process.env.STUDIO_PLAYWRIGHT) return import(pathToFileURL(path.resolve(process.env.STUDIO_PLAYWRIGHT)).href);
  const store = path.join(repo, 'node_modules/.pnpm');
  const picked = existsSync(store) && pickPlaywright(readdirSync(store));
  if (picked) return import(pathToFileURL(path.join(store, picked, 'node_modules/playwright/index.mjs')).href);
  try { return createRequire(import.meta.url)('playwright'); } catch {
    throw new Error('Playwright not found. Set STUDIO_PLAYWRIGHT to a playwright/index.mjs path.');
  }
}

/** Server state written by `server.mjs up`. */
export function serverState({ profile = DEFAULT_PROFILE, home } = {}) {
  const base = path.resolve(home ?? process.env.STUDIO_E2E_HOME ?? path.join(studio, 'dist/e2e/home'));
  const file = path.join(base, 'e2e-runs', profile, 'state.json');
  if (!existsSync(file)) throw new Error(`No server state at ${file}; run server.mjs up first`);
  return JSON.parse(readFileSync(file, 'utf8'));
}

async function launch(chromium) {
  // The installed Chrome channel is preferred: the bundled Chromium download is usually absent here.
  try { return await chromium.launch({ channel: 'chrome', headless: true }); } catch { return chromium.launch({ headless: true }); }
}

/**
 * Run a scenario once per view and print a single summary.
 * @param {{ name: string, views?: string[], profile?: string, url?: string, locale?: string, readyTimeout?: number, actionTimeout?: number }} options
 * @param {(app: App) => Promise<void>} scenario
 */
export async function run(options, scenario) {
  const { chromium } = await loadPlaywright();
  const url = options.url ?? process.env.STUDIO_E2E_URL ?? serverState({ profile: options.profile }).url;
  const outDir = path.join(studio, 'dist/e2e/shots', options.name.replace(/[^\w.-]+/g, '-'));
  mkdirSync(outDir, { recursive: true });
  const views = (options.views ?? ['light']).map(view => parseView(view));
  const checks = [];
  const pageErrors = [];
  const pluginFailures = [];
  const shots = [];
  const browser = await launch(chromium);
  try {
    for (const view of views) {
      const context = await browser.newContext({
        viewport: { width: view.width, height: view.height },
        colorScheme: view.theme,
        locale: options.locale ?? 'ko-KR',
      });
      const page = await context.newPage();
      // A failing step should cost seconds, not Playwright's 30 s default.
      page.setDefaultTimeout(options.actionTimeout ?? 10_000);
      page.on('pageerror', error => pageErrors.push(`[${viewName(view)}] ${errorLine(error)}`));
      const app = new App({ page, view, checks, shots, outDir });
      const opened = await app.check('DSH shell ready', () => app.open(url, options.readyTimeout ?? 30_000));
      if (opened) {
        try { await scenario(app); } catch (error) { checks.push({ name: 'scenario', view: viewName(view), ok: false, error: errorLine(error) }); }
      }
      const body = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
      for (const line of body.split('\n')) if (PLUGIN_FAILURE.test(line)) pluginFailures.push(line.trim());
      await context.close();
    }
  } finally {
    await browser.close();
  }
  const summary = summarize({ checks, pageErrors, pluginFailures, shots, views: views.map(viewName) });
  console.log(JSON.stringify({ name: options.name, ...summary, shotDir: outDir }, null, 2));
  process.exitCode = summary.ok ? 0 : 1;
  return summary;
}

export class App {
  constructor({ page, view, checks, shots, outDir }) {
    Object.assign(this, { page, view, checks, shots, outDir });
  }

  /** Open the shell, wait for the composer slot, dismiss the preview notice. */
  async open(url, timeout) {
    await this.page.goto(url, { timeout });
    await this.page.locator('[data-slot="conversation.input.dock"], [data-slot="main"]').first().waitFor({ timeout });
    await this.dismissDialogs();
  }

  /** Close first-run notices ("계속"/"Continue") and any dialog with a close button. */
  async dismissDialogs({ appearWithin = 3000 } = {}) {
    for (let round = 0; round < 3; round++) {
      const dialog = this.page.getByRole('dialog').first();
      // First-run notices mount after the shell; give them a short window to appear.
      const shown = await dialog.waitFor({ state: 'visible', timeout: round === 0 ? appearWithin : 500 }).then(() => true, () => false);
      if (!shown) return;
      const button = dialog.getByRole('button', { name: /^(계속|Continue|닫기|Close)$/ }).first();
      if (await button.count()) await button.click(); else await this.page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    }
  }

  /** Record a named pass/fail fact. Returns true on pass; never throws. */
  async check(name, fn) {
    try {
      await fn();
      this.checks.push({ name, view: viewName(this.view), ok: true });
      return true;
    } catch (error) {
      this.checks.push({ name, view: viewName(this.view), ok: false, error: errorLine(error) });
      return false;
    }
  }

  /** Screenshot into the run directory; only the path is reported. */
  async shot(name, options = {}) {
    const file = path.join(this.outDir, shotName(name, this.view));
    await this.page.screenshot({ path: file, ...options });
    this.shots.push(path.relative(repo, file));
    return file;
  }

  /** Visible text of a locator (default: the whole page), for assertions or L1 hand-off. */
  async text(locator = this.page.locator('body')) {
    return (await locator.innerText()).trim();
  }

  /** Throwing assertion helper for use inside check(). */
  assert(condition, message) {
    if (!condition) throw new Error(message);
  }
}
