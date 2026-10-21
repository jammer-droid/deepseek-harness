#!/usr/bin/env node
/**
 * #39 L0: register `@matamt-dbg/dsh-web-fetch-exa` from Studio → Plugins, then pick `exa-contents` as the
 * fetch provider under Profile settings. Needs a fresh isolated profile with the package installed but not
 * registered (`server.mjs up --plugin <tgz>`). Mutates that profile.
 *
 *   node studio/scripts/e2e/plugins-exa-contents.mjs [--profile e39]
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { run, serverState } from './browser.mjs';

const args = process.argv.slice(2);
const value = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };

await run({ name: 'plugins-exa-contents', profile: value('--profile'), views: ['light'] }, async app => {
  const { page } = app;
  await app.step('Studio entry click', 'role=button[name="DSH Studio"]', { action: 'click', goal: 'The DSH Studio entry in the left sidebar' });
  await app.step('Plugins service tab', 'button:text-matches("^(플러그인|Plugins|插件)$")', { action: 'click', goal: 'The Plugins service tab at the top of the Studio panel' });
  await app.check('Package listed as profile-wide', async () => {
    const card = page.locator('.studio-settings-card:visible').filter({ hasText: /dsh-web-fetch-exa/ }).first();
    await card.waitFor({ timeout: 30000 });
    const text = await app.text(card);
    app.assert(/(프로필 공용|Profile-wide)/.test(text), text.slice(0, 300));
  });
  await app.step('Register button', '.studio-settings-card:visible:has-text("dsh-web-fetch-exa") button:text-matches("^(프로필에 등록하기|Register in profile)$")', { action: 'click', goal: 'The Register in profile button on the dsh-web-fetch-exa row' });
  await app.step('Confirm register', 'dialog[open] button:text-matches("^(등록|Register)$")', { action: 'click', goal: 'The primary Register button in the dialog footer' });
  await app.check('Registered and running', async () => {
    await page.locator('.studio-notice, [role=status]').filter({ hasText: /(프로필에 등록했습니다|Registered in the profile)/ }).first().waitFor({ timeout: 30000 });
    await page.locator('.studio-settings-card:visible').filter({ hasText: /dsh-web-fetch-exa/ }).filter({ hasText: /(프로필에서 실행 중|Running in profile)/ }).first().waitFor({ timeout: 30000 });
  });
  await app.shot('registered');
  await app.step('Profile settings page', '.studio-nav-item:visible:text-matches("^(프로필 설정|Profile settings)$")', { action: 'click', goal: 'The Profile settings item in the Plugins left menu' });
  await app.check('Provider row shows exa-contents and a masked apiKey', async () => {
    const card = page.locator('.studio-settings-card:visible').filter({ hasText: /dsh-web-fetch-exa/ }).first();
    await card.waitFor({ timeout: 30000 });
    const text = await app.text(card);
    app.assert(/exa-contents/.test(text), text.slice(0, 300));
    app.assert(/apiKey/.test(text), text.slice(0, 300));
  });
  await app.check('Fetch provider list offers exa-contents and saves it', async () => {
    const select = page.locator('select').filter({ has: page.locator('option[value="exa-contents"]') }).first();
    await select.waitFor({ timeout: 30000 });
    await select.selectOption('exa-contents');
    await page.waitForTimeout(1500);
    app.assert(await select.inputValue() === 'exa-contents', `selected ${await select.inputValue()}`);
  });
  await app.check('Saved to the profile patch and kept after reload', async () => {
    const state = serverState({ profile: value('--profile') ?? process.env.STUDIO_E2E_PROFILE });
    const patch = yaml.load(readFileSync(path.join(state.home, 'profiles', state.profile, 'cordis.patch.yml'), 'utf8'));
    const web = patch.find(entry => entry?.id === 'web');
    app.assert(web?.config?.fetchProvider === 'exa-contents', `patch fetchProvider ${web?.config?.fetchProvider}`);
    await page.reload();
    await app.step('Studio entry after reload', 'role=button[name="DSH Studio"]', { action: 'click', goal: 'The DSH Studio entry in the left sidebar' });
    await app.step('Plugins tab after reload', 'button:text-matches("^(플러그인|Plugins|插件)$")', { action: 'click', goal: 'The Plugins service tab' });
    await app.step('Profile settings after reload', '.studio-nav-item:visible:text-matches("^(프로필 설정|Profile settings)$")', { action: 'click', goal: 'The Profile settings item' });
    const select = page.locator('select').filter({ has: page.locator('option[value="exa-contents"]') }).first();
    await select.waitFor({ timeout: 30000 });
    app.assert(await select.inputValue() === 'exa-contents', `after reload ${await select.inputValue()}`);
  });
  await app.shot('fetch-provider-selected');
});
