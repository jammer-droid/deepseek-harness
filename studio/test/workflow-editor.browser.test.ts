/** Keyless browser acceptance against a private scaffold, not the installed user profile. */
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { expect, it } from 'vitest';
import { launchWebScaffold } from '@studio-test/scaffold';
const studio = fileURLToPath(new URL('..', import.meta.url));
it('saves two independent drafts and restores their contents after page reload', async () => {
  const browser = await chromium.launch({ ...(process.env.DSH_TEST_BROWSER_CHANNEL ? { channel: process.env.DSH_TEST_BROWSER_CHANNEL } : {}) });
  try {
    const scaffold = await launchWebScaffold({
      extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`,
      extraInstallAnchors: ['bundle', 'shell', 'general', 'roles', 'workflows', 'demo'].map(name => `${studio}/packages/${name}/package.json`),
      replayFixture: fileURLToPath(new URL('./role-editor/session.v3.jsonl', import.meta.url)),
      replayProvidersOnly: true,
    });
    try {
      const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1440, height: 1200 } });
      await page.goto(scaffold.authenticatedUrl);
      await page.getByRole('button', { name: 'DSH Studio', exact: true }).click();
      const editor = page.getByRole('heading', { name: 'Workflow drafts', exact: true }).locator('..');
      await editor.getByRole('button', { name: 'New draft', exact: true }).waitFor({ timeout: 30_000 });
      for (const name of ['First draft', 'Second draft']) {
        await editor.getByRole('button', { name: 'New draft', exact: true }).click();
        await editor.getByLabel('Draft name', { exact: true }).fill(name);
        await editor.getByLabel('Role name', { exact: true }).fill('Main');
        await editor.getByRole('button', { name: 'Add instructions', exact: true }).click();
        await editor.getByLabel('Instructions', { exact: true }).fill(`${name} instructions`);
        await editor.getByRole('button', { name: 'Save draft', exact: true }).click();
        await expect.poll(() => editor.getByRole('status').textContent()).toBe('Saved');
      }
      await page.reload();
      await page.getByRole('button', { name: 'DSH Studio', exact: true }).waitFor();
      await page.getByRole('button', { name: 'DSH Studio', exact: true }).click();
      await editor.getByRole('combobox').waitFor();
      for (const name of ['First draft', 'Second draft']) {
        await editor.getByRole('combobox').selectOption({ label: name });
        expect(await editor.getByLabel('Instructions', { exact: true }).inputValue()).toBe(`${name} instructions`);
      }
      expect(await editor.getByRole('button', { name: 'Apply', exact: true }).count()).toBe(0);
    } finally { await scaffold.close(); }
  } finally { await browser.close(); }
});
