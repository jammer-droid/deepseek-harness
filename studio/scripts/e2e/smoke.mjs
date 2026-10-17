#!/usr/bin/env node
/**
 * L0 smoke for an isolated server started by server.mjs: the shell loads without plugin activation
 * failures or pageerrors, Studio's Client entry is present and its panel opens, in light, dark and narrow.
 *
 *   node studio/scripts/e2e/smoke.mjs [--profile e2e] [--views light,dark,light@480] [--name smoke]
 *
 * Selector steps use app.step(), so a failure writes an L1 repair item (see scripts/agents/README.md).
 * STUDIO_E2E_STALE=1 swaps in an outdated selector to rehearse that repair path.
 */
import { run } from './browser.mjs';

const args = process.argv.slice(2);
const value = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const views = (value('--views') ?? 'light,dark,light@480').split(',');
const panelSelector = process.env.STUDIO_E2E_STALE === '1'
  ? '[role="tab"]:has-text("프리셋")' // outdated: Studio tabs are buttons, not ARIA tabs
  : 'text=/^v\\d+\\.\\d+\\.\\d+/';

await run({ name: value('--name') ?? 'smoke', profile: value('--profile'), views }, async app => {
  const { page } = app;
  const entry = 'role=button[name="DSH Studio"]';
  // Narrow layouts may collapse the sidebar; open it before looking for the entry.
  if (!(await app.locator(entry).first().isVisible().catch(() => false))) {
    const toggle = page.getByRole('button', { name: /사이드바 (열기|펼치기)|Open sidebar|Expand sidebar/ }).first();
    if (await toggle.count()) await toggle.click();
  }
  await app.step('Studio entry visible', entry, { goal: 'The DSH Studio entry in the left sidebar' });
  await app.step('Studio entry click', entry, { action: 'click', goal: 'The DSH Studio entry in the left sidebar' });
  await app.step('Studio panel opens', panelSelector, {
    goal: 'Proof that the Studio panel is open: the 프리셋 (Presets) tab button at the top of the Studio panel',
  });
  await app.shot('studio');
});
