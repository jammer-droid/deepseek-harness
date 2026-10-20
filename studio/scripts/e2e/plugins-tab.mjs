#!/usr/bin/env node
/**
 * #38 L0: the Studio Plugins service lists installed plugins by scope and opens profile settings,
 * in light, dark and narrow. Run against an isolated server whose profile has a profile-wide plugin.
 *
 *   node studio/scripts/e2e/plugins-tab.mjs [--profile p38] [--views light,dark,light@480]
 */
import { run } from './browser.mjs';

const args = process.argv.slice(2);
const value = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const views = (value('--views') ?? 'light,dark,light@480').split(',');

await run({ name: 'plugins-tab', profile: value('--profile'), views }, async app => {
  const { page } = app;
  const entry = 'role=button[name="DSH Studio"]';
  if (!(await app.locator(entry).first().isVisible().catch(() => false))) {
    const toggle = page.getByRole('button', { name: /사이드바 (열기|펼치기)|Open sidebar|Expand sidebar/ }).first();
    if (await toggle.count()) await toggle.click();
  }
  await app.step('Studio entry click', entry, { action: 'click', goal: 'The DSH Studio entry in the left sidebar' });
  await app.step('Plugins service tab', 'button:text-matches("^(플러그인|Plugins|插件)$")', { action: 'click', goal: 'The Plugins service tab at the top of the Studio panel, next to Presets' });
  await app.step('Installed list shows a scope badge', '.studio-settings-card .studio-badge, .studio-settings-card [class*=badge]', { goal: 'A scope badge (Profile-wide / 프로필 공용) on an installed plugin row' });
  await app.check('Exa row is profile-wide', async () => {
    const text = await app.text(page.locator('.studio-settings-card').first());
    app.assert(/web-search-exa/.test(text), 'Exa row missing');
    app.assert(/(프로필 공용|Profile-wide)/.test(text), 'profile-wide badge missing');
  });
  await app.shot('installed');
  await app.step('Profile settings page', '.studio-nav-item:text-matches("^(프로필 설정|Profile settings)$")', { action: 'click', goal: 'The Profile settings item in the Plugins left menu' });
  await app.check('Profile rows listed with masked secret', async () => {
    const card = page.locator('.studio-settings-card').filter({ hasText: /web-search-exa/ }).last();
    const text = await app.text(card);
    app.assert(/apiKey: (설정됨|Set)/.test(text), `secret presence not shown: ${text.slice(0, 200)}`);
    app.assert(!/fake-s38-key/.test(await page.content()), 'secret value leaked into the page');
  });
  await app.step('Open Exa settings', '.studio-settings-card:visible:has-text("web-search-exa") button:text-matches("^(설정|Settings)$") >> nth=0', { action: 'click', goal: 'The Settings button on the web-search-exa row of the visible profile settings card' });
  await app.check('Dialog says it applies to every session and hides the key', async () => {
    const dialog = page.locator('dialog[open]');
    const text = await app.text(dialog);
    app.assert(/(모든 세션에 적용|Applies to every session)/.test(text), 'all-sessions notice missing');
    app.assert(await dialog.locator('input[type=password]').count() === 0, 'secret input shown before choosing Replace');
  });
  await app.shot('profile-dialog');
});
