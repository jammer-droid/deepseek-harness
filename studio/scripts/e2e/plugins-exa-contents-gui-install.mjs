#!/usr/bin/env node
/**
 * #39 L0 (0.1.1): install `@matamt-dbg/dsh-web-fetch-exa` from the DSH Plugins page (**Add plugin**), then check
 * Studio shows its provider row running with no registration step, and that `fetchProvider` stays unchanged
 * until chosen. Needs a fresh isolated profile without the plugin (`server.mjs up`). Mutates that profile.
 *
 *   node studio/scripts/e2e/plugins-exa-contents-gui-install.mjs --spec <tgz path or package spec> [--profile e39]
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { run, serverState } from './browser.mjs';

const args = process.argv.slice(2);
const value = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const spec = value('--spec') ?? '@matamt-dbg/dsh-web-fetch-exa';
const profile = value('--profile');

await run({ name: 'plugins-exa-contents-gui-install', profile, views: ['light'], actionTimeout: 180000 }, async app => {
  const { page } = app;
  await app.step('DSH Plugins page', 'nav >> text=/^(플러그인|Plugins)$/', { action: 'click', goal: 'The Plugins item in the DSH sidebar (not Studio)' });
  await app.step('Add plugin', 'button:text-matches("^(플러그인 추가|Add plugin)$")', { action: 'click', goal: 'The Add plugin button at the top right of the Plugins page' });
  await app.check('Enter the package spec', async () => {
    const input = page.locator('dialog[open] input, [role=dialog] input').first();
    await input.waitFor({ timeout: 30000 });
    await input.fill(spec);
  });
  await app.check('No "declares no dsh.bundle" refusal', async () => {
    await page.waitForTimeout(3000);
    const text = await app.text(page.locator('dialog[open], [role=dialog]').first());
    app.assert(!/dsh\.bundle|번들이 선언되어 있지 않아|declares no bundle/.test(text), text.slice(0, 300));
  });
  await app.shot('add-dialog');
  await app.step('Install', '[role=dialog] button:text-matches("^(설치|Install)$"), dialog[open] button:text-matches("^(설치|Install)$")', { action: 'click', goal: 'The Install button in the Add plugin dialog' });
  await app.check('Installed', async () => {
    await page.locator('text=/(설치됨|설치했습니다|Installed)/').first().waitFor({ timeout: 180000 });
  });
  await app.shot('installed');
  await app.step('Activate now', '[role=dialog] button:text-matches("^(지금 활성화|Activate now|Enable now)$"), dialog[open] button:text-matches("^(지금 활성화|Activate now|Enable now)$")', { action: 'click', goal: 'The Activate now button after installing' });
  await page.waitForTimeout(5000);
  await page.keyboard.press('Escape');
  await app.check('Patch file: bundle listed, fetchProvider not changed', async () => {
    const state = serverState({ profile: profile ?? process.env.STUDIO_E2E_PROFILE });
    const dir = path.join(state.home, 'profiles', state.profile);
    const manifest = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
    app.assert(manifest.dsh?.profile?.bundles?.includes('@matamt-dbg/dsh-web-fetch-exa'), `bundles ${JSON.stringify(manifest.dsh?.profile?.bundles)}`);
    const patch = yaml.load(readFileSync(path.join(dir, 'cordis.patch.yml'), 'utf8')) ?? [];
    const web = patch.find(entry => entry?.id === 'web');
    app.assert(web?.config?.fetchProvider === undefined, `fetchProvider was changed to ${web?.config?.fetchProvider}`);
  });
  await page.goto(page.url());
  await app.step('Studio entry', 'role=button[name="DSH Studio"]', { action: 'click', goal: 'The DSH Studio entry in the left sidebar' });
  await app.step('Studio Plugins tab', 'button:text-matches("^(플러그인|Plugins|插件)$")', { action: 'click', goal: 'The Plugins service tab at the top of the Studio panel' });
  await app.check('Studio: running in profile, no Register button', async () => {
    const card = page.locator('.studio-settings-card:visible').filter({ hasText: /dsh-web-fetch-exa/ }).first();
    await card.waitFor({ timeout: 30000 });
    const text = await app.text(card);
    app.assert(/(프로필에서 실행 중|Running in profile)/.test(text), text.slice(0, 300));
    app.assert(!/(프로필에 등록하기|Register in profile)/.test(text), `register still offered: ${text.slice(0, 300)}`);
  });
  await app.step('Profile settings page', '.studio-nav-item:visible:text-matches("^(프로필 설정|Profile settings)$")', { action: 'click', goal: 'The Profile settings item in the Plugins left menu' });
  await app.check('Fetch provider list offers exa-contents', async () => {
    const select = page.locator('select').filter({ has: page.locator('option[value="exa-contents"]') }).first();
    await select.waitFor({ timeout: 30000 });
  });
  await app.shot('profile-settings');
});
