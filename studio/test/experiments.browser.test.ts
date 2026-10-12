/** Real Loader and browser acceptance in a private profile, not live deployment. */
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { expect, it } from 'vitest';
import { launchWebScaffold } from '@studio-test/scaffold';
const studio = fileURLToPath(new URL('..', import.meta.url));
it('persists per-feature populations and budgets across reload in light, dark and narrow layouts', async () => {
  const browser = await chromium.launch({ ...(process.env.DSH_TEST_BROWSER_CHANNEL ? { channel: process.env.DSH_TEST_BROWSER_CHANNEL } : {}) });
  try {
    const scaffold = await launchWebScaffold({
      extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`,
      extraInstallAnchors: ['bundle', 'shell', 'general', 'roles', 'workflows', 'experiments'].map(name => `${studio}/packages/${name}/package.json`),
      replayFixture: `${studio}/test/role-editor/session.v3.jsonl`, replayProvidersOnly: true,
    });
    try {
      const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1440, height: 1000 } });
      await page.goto(scaffold.authenticatedUrl);
      const open = async () => {
        await page.getByRole('button', { name: 'DSH Studio', exact: true }).click();
        await page.getByRole('navigation', { name: 'Studio services' }).getByRole('button', { name: 'Experiments', exact: true }).click();
        try { await page.getByLabel('Large text output offload', { exact: true }).waitFor(); }
        catch (error) { console.error(await page.locator('body').innerText()); throw error; }
      };
      await open();
      expect(await page.getByRole('navigation', { name: 'Agent optimizations', exact: true }).isVisible()).toBe(true);
      expect(await page.getByLabel('Optimized prompt assembly', { exact: true }).isVisible()).toBe(true);
      expect(await page.getByText('데모 타이머', { exact: true }).count()).toBe(0);
      expect(await page.getByText('Client 실행 영역', { exact: true }).count()).toBe(0);
      expect(await page.locator('[data-studio-scroller]:visible').count()).toBe(1);
      expect(await page.getByLabel('Large text output offload', { exact: true }).inputValue()).toBe('off');
      await page.getByLabel('Large text output offload', { exact: true }).selectOption('both');
      await page.getByLabel('Disable Goal/Todo and automatic goal continuation', { exact: true }).selectOption('sub');
      await page.getByLabel('Inline text budget (characters, ≥1024)', { exact: true }).fill('16384');
      await page.getByRole('button', { name: 'Save for future agents', exact: true }).click();
      await page.getByText('Saved. Running agents are unchanged.', { exact: true }).waitFor();
      await page.reload(); await open();
      expect(await page.getByLabel('Large text output offload', { exact: true }).inputValue()).toBe('both');
      expect(await page.getByLabel('Disable Goal/Todo and automatic goal continuation', { exact: true }).inputValue()).toBe('sub');
      expect(await page.getByLabel('Inline text budget (characters, ≥1024)', { exact: true }).inputValue()).toBe('16384');
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme });
        await page.setViewportSize({ width: 480, height: 844 });
        const select = page.getByLabel('Large text output offload', { exact: true });
        expect(await select.isVisible()).toBe(true);
        expect(await select.evaluate(node => node.getBoundingClientRect().right <= window.innerWidth)).toBe(true);
      }
    } finally { await scaffold.close(); }
  } finally { await browser.close(); }
});
