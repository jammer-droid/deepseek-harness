#!/usr/bin/env node
/**
 * #38 L0: register a profile-wide plugin from Studio → Plugins and see it under Profile settings.
 * Needs a fresh isolated profile with the Exa package installed but not registered. Mutates that profile.
 *
 *   node studio/scripts/e2e/plugins-register.mjs [--profile p38]
 */
import { run } from './browser.mjs';

const args = process.argv.slice(2);
const value = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };

await run({ name: 'plugins-register', profile: value('--profile'), views: ['light'] }, async app => {
  const { page } = app;
  await app.step('Studio entry click', 'role=button[name="DSH Studio"]', { action: 'click', goal: 'The DSH Studio entry in the left sidebar' });
  await app.step('Plugins service tab', 'button:text-matches("^(플러그인|Plugins|插件)$")', { action: 'click', goal: 'The Plugins service tab at the top of the Studio panel' });
  await app.step('Register button', '.studio-settings-card:visible button:text-matches("^(프로필에 등록하기|Register in profile)$")', { action: 'click', goal: 'The Register in profile button on the Exa row' });
  await app.shot('register-dialog');
  await app.step('Confirm register', 'dialog[open] button:text-matches("^(등록|Register)$")', { action: 'click', goal: 'The primary Register button in the dialog footer' });
  await app.check('Registered notice and row becomes running', async () => {
    await page.locator('.studio-notice, [role=status]').filter({ hasText: /(프로필에 등록했습니다|Registered in the profile)/ }).first().waitFor({ timeout: 30000 });
    await page.locator('.studio-settings-card:visible').first().filter({ hasText: /(프로필에서 실행 중|Running in profile)/ }).waitFor({ timeout: 30000 });
  });
  await app.shot('registered');
  await app.step('Profile settings page', '.studio-nav-item:visible:text-matches("^(프로필 설정|Profile settings)$")', { action: 'click', goal: 'The Profile settings item in the Plugins left menu' });
  await app.check('Exa and web rows listed', async () => {
    const card = page.locator('.studio-settings-card:visible').filter({ hasText: /web-search-exa/ }).first();
    await card.waitFor({ timeout: 30000 });
    const text = await app.text(card);
    app.assert(/dsh-web\b/.test(text), text.slice(0, 200));
  });
});
