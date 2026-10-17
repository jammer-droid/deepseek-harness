#!/usr/bin/env node
/**
 * L0 smoke for an isolated server started by server.mjs: the shell loads without plugin activation
 * failures or pageerrors, Studio's Client entry is present and its panel opens, in light, dark and narrow.
 *
 *   node studio/scripts/e2e/smoke.mjs [--profile e2e] [--views light,dark,light@480]
 */
import { run } from './browser.mjs';

const args = process.argv.slice(2);
const value = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const views = (value('--views') ?? 'light,dark,light@480').split(',');

await run({ name: 'smoke', profile: value('--profile'), views }, async app => {
  const { page } = app;
  const studioButton = page.getByRole('button', { name: 'DSH Studio' }).first();
  // Narrow layouts may collapse the sidebar; open it before looking for the entry.
  if (!(await studioButton.isVisible().catch(() => false))) {
    const toggle = page.getByRole('button', { name: /사이드바 (열기|펼치기)|Open sidebar|Expand sidebar/ }).first();
    if (await toggle.count()) await toggle.click();
  }
  await app.check('Studio entry visible', () => studioButton.waitFor({ timeout: 10_000 }));
  await app.check('Studio panel opens', async () => {
    await studioButton.click();
    // Studio's own sidebar shows the package version (e.g. "v0.6.1"); DSH chrome does not.
    await page.getByText(/^v\d+\.\d+\.\d+/).first().waitFor({ timeout: 10_000 });
  });
  await app.shot('studio');
});
