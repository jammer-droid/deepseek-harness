#!/usr/bin/env node
/**
 * L0 check for an isolated server started with `--with-desktop-plugins --with-secrets subscriptions`:
 * the subscription plugin's settings page loads and lists logged-in accounts. No model is called.
 *
 *   node studio/scripts/e2e/subscriptions.mjs [--profile e2e] [--providers Codex,Claude]
 *
 * Only account counts and provider names are printed; e-mail addresses on the page are not.
 */
import { run } from './browser.mjs';

const args = process.argv.slice(2);
const value = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };

await run({ name: 'subscriptions', profile: value('--profile'), views: ['light'] }, async app => {
  const { page } = app;
  await app.step('Account menu opens', 'role=button[name="계정 메뉴"]', { action: 'click', goal: 'The account menu button at the bottom of the left sidebar' });
  await app.step('Settings opens', 'role=menuitem[name="설정"]', { action: 'click', goal: 'The 설정 (Settings) item in the account menu' });
  await app.step('Subscriptions page opens', 'role=dialog >> text=/^(Subscriptions|구독)$/', { action: 'click', goal: 'The Subscriptions entry in the settings dialog navigation' });
  const dialog = page.getByRole('dialog').first();
  // Account status loads after the page mounts.
  await dialog.getByText(/account\(s\) connected|Not logged in/).first().waitFor().catch(() => {});
  // Each provider block is "<Provider> … N account(s) connected" or "<Provider> … Not logged in".
  for (const provider of (value('--providers') ?? 'Codex,Claude').split(',')) {
    await app.check(`${provider} connected`, async () => {
      const text = await app.text(dialog);
      const block = text.split(/\n(?=(?:Codex|Claude|Grok|GitHub Copilot|Google Antigravity)\b)/).find(part => part.startsWith(provider));
      app.assert(block, `${provider} section not found`);
      app.assert(/[1-9]\d* account\(s\) connected/.test(block), `${provider}: ${/Not logged in/.test(block) ? 'not logged in' : 'no connected account'}`);
    });
  }
  await app.shot('subscriptions');
});
