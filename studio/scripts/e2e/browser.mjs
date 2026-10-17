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
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PLUGIN_FAILURE, errorLine, parseView, pickPlaywright, repairItem, shotName, slug, summarize, viewName } from './browser-lib.mjs';
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
  const url = options.url ?? process.env.STUDIO_E2E_URL ?? serverState({ profile: options.profile ?? process.env.STUDIO_E2E_PROFILE }).url;
  const outDir = path.join(studio, 'dist/e2e/shots', slug(options.name));
  mkdirSync(outDir, { recursive: true });
  // Repaired selectors from a previous L1 run (apply-repairs.mjs); originals stay in the scenario source.
  const repairsPath = path.join(outDir, 'repairs.json');
  const repairs = existsSync(repairsPath) ? JSON.parse(readFileSync(repairsPath, 'utf8')) : {};
  const failDir = path.join(outDir, 'fail');
  rmSync(failDir, { recursive: true, force: true });
  const repairItems = new Map();
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
      const app = new App({ page, view, checks, shots, outDir, repairs, failDir, repairItems });
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
  const itemsPath = path.join(outDir, 'repair-items.jsonl');
  rmSync(itemsPath, { force: true });
  const mapPath = path.join(outDir, 'repair-map.json');
  rmSync(mapPath, { force: true });
  if (repairItems.size) {
    // pixie_loop items carry only id and input; the id → original selector map stays beside them.
    writeFileSync(itemsPath, [...repairItems.values()].map(({ id, input }) => JSON.stringify({ id, input })).join('\n') + '\n');
    writeFileSync(mapPath, JSON.stringify(Object.fromEntries([...repairItems.values()].map(({ id, selector }) => [id, selector])), null, 2));
  }
  const repair = repairItems.size ? { items: path.relative(repo, itemsPath), failDir: path.relative(repo, failDir), count: repairItems.size } : undefined;
  const applied = Object.keys(repairs).length || undefined;
  console.log(JSON.stringify({ name: options.name, ...summary, repairedSelectors: applied, repair, shotDir: outDir }, null, 2));
  process.exitCode = summary.ok ? 0 : 1;
  return summary;
}

export class App {
  constructor({ page, view, checks, shots, outDir, repairs = {}, failDir, repairItems = new Map() }) {
    Object.assign(this, { page, view, checks, shots, outDir, repairs, failDir, repairItems });
  }

  /** Locator for a Playwright selector string, honouring an L1 repair of that exact selector. */
  locator(selector) {
    return this.page.locator(this.repairs[selector] ?? selector);
  }

  /**
   * A check bound to one selector, so a failure can be handed to L1 selector repair.
   * action: 'visible' (default) waits for it, 'click' clicks it, or a function (locator) => Promise.
   * goal: what the element is, in words; it becomes the repair instruction.
   */
  async step(name, selector, { action = 'visible', goal = name } = {}) {
    const locator = this.locator(selector);
    const ok = await this.check(name, () => (action === 'click' ? locator.first().click()
      : action === 'visible' ? locator.first().waitFor() : action(locator)));
    if (!ok && this.failDir) await this.captureForRepair({ name, selector, goal });
    return ok;
  }

  /** Save the DOM at the failure and queue one repair item per selector (first failing view wins). */
  async captureForRepair({ name, selector, goal }) {
    if (this.repairItems.has(selector)) return;
    mkdirSync(this.failDir, { recursive: true });
    const id = `${slug(name)}.${viewName(this.view)}`;
    const html = await this.page.content().catch(() => '');
    writeFileSync(path.join(this.failDir, `${id}.html`), html);
    const aria = await this.page.locator('body').ariaSnapshot().catch(() => '');
    const record = this.checks.at(-1);
    record.selector = selector;
    this.repairItems.set(selector, repairItem({ id, name, goal, selector, view: viewName(this.view), error: record.error, aria }));
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

  /** Record a named pass/fail fact: fn throws or returns false to fail. Returns true on pass; never throws. */
  async check(name, fn) {
    try {
      // Same contract as agent.mjs t.check: throwing or returning false fails.
      if ((await fn()) === false) throw new Error('check returned false');
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
