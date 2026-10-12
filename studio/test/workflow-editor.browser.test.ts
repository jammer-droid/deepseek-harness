/** Keyless browser acceptance against a private scaffold, not the installed user profile. */
import { fileURLToPath } from 'node:url';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { expect, it } from 'vitest';
import { launchWebScaffold } from '@studio-test/scaffold';
const studio = fileURLToPath(new URL('..', import.meta.url));
it('saves two independent drafts and restores their contents after page reload', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'studio-workflow-browser-'));
  const overlay = join(temporary, 'provider.yml');
  await writeFile(overlay, `- insert:\n    - id: workflow-browser-provider\n      name: ${JSON.stringify(`${studio}/test/workflow-browser-provider.mjs`)}\n`);
  const browser = await chromium.launch({ ...(process.env.DSH_TEST_BROWSER_CHANNEL ? { channel: process.env.DSH_TEST_BROWSER_CHANNEL } : {}) });
  try {
    const scaffold = await launchWebScaffold({
      extraOverlayPath: [`${studio}/packages/bundle/cordis.patch.yml`, overlay],
      extraInstallAnchors: ['bundle', 'shell', 'general', 'roles', 'workflows'].map(name => `${studio}/packages/${name}/package.json`),
      replayFixture: fileURLToPath(new URL('./role-editor/session.v3.jsonl', import.meta.url)),
      replayProvidersOnly: true,
    });
    try {
      const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1440, height: 1200 } });
      await page.goto(scaffold.authenticatedUrl);
      await page.getByRole('button', { name: 'DSH Studio', exact: true }).click();
      const editor = page.getByRole('heading', { name: 'Workflow drafts', exact: true }).locator('..');
      await editor.getByRole('button', { name: 'New draft', exact: true }).waitFor({ timeout: 30_000 });
      const navigation = page.getByRole('navigation', { name: 'Studio services', exact: true });
      expect(await navigation.getByRole('button').allTextContents()).toEqual(['Preset Builder', 'DSH settings', 'Role settings', 'Design preview', 'Experiments']);
      expect(await navigation.getByRole('button', { name: 'Preset Builder', exact: true }).getAttribute('aria-current')).toBe('page');
      const builderMenu = page.getByRole('navigation', { name: 'Preset Builder', exact: true });
      await builderMenu.getByRole('button', { name: 'Workflow', exact: true }).click();
      for (const name of ['First draft', 'Second draft']) {
        await editor.getByRole('button', { name: 'New draft', exact: true }).click();
        await editor.getByLabel('Draft name', { exact: true }).fill(name);
        await editor.getByLabel('Role name', { exact: true }).fill('Main');
        const initialModel = editor.getByLabel('Initial model', { exact: true });
        await expect.poll(() => initialModel.locator('option:not([disabled])').count()).toBeGreaterThan(0);
        await initialModel.selectOption(await initialModel.locator('option:not([disabled])').first().getAttribute('value') ?? '');
        await editor.getByRole('button', { name: 'Copy initial model to roles', exact: true }).click();
        const copiedModel = await editor.getByLabel('Role model', { exact: true }).inputValue();
        await editor.getByRole('button', { name: 'Add role', exact: true }).click();
        await editor.getByLabel('Role name', { exact: true }).fill('Helper');
        expect(await editor.getByLabel('Role model', { exact: true }).inputValue()).toBe(copiedModel);
        await editor.getByLabel('Select role', { exact: true }).selectOption({ label: 'Main' });
        await editor.getByRole('button', { name: 'Add instructions', exact: true }).click();
        await editor.getByLabel('Instructions', { exact: true }).fill(`${name} instructions`);
        await page.getByRole('button', { name: 'Design preview', exact: true }).click();
        await navigation.getByRole('button', { name: 'Preset Builder', exact: true }).click();
        await builderMenu.getByRole('button', { name: 'Workflow', exact: true }).click();
        expect(await editor.getByLabel('Instructions', { exact: true }).inputValue()).toBe(`${name} instructions`);
        await editor.getByRole('button', { name: 'Save draft', exact: true }).click();
        await expect.poll(() => editor.getByRole('status').textContent()).toBe('Saved');
      }
      await page.reload();
      await page.getByRole('button', { name: 'DSH Studio', exact: true }).waitFor();
      await page.getByRole('button', { name: 'DSH Studio', exact: true }).click();
      await builderMenu.getByRole('button', { name: 'Workflow', exact: true }).click();
      await editor.getByLabel('Select draft', { exact: true }).waitFor();
      for (const name of ['First draft', 'Second draft']) {
        await editor.getByLabel('Select draft', { exact: true }).selectOption({ label: name });
        expect(await editor.getByLabel('Instructions', { exact: true }).inputValue()).toBe(`${name} instructions`);
      }
      await editor.getByRole('button', { name: 'Add component: test.sender', exact: true }).click();
      await editor.getByLabel('message', { exact: true }).fill('Retained provider text');
      await expect.poll(() => editor.textContent()).toContain('Add the required system and version.');
      await editor.getByRole('button', { name: 'Save draft', exact: true }).click();
      await expect.poll(() => editor.getByRole('status').textContent()).toBe('Saved');
      await editor.getByRole('button', { name: 'Add system: test.receiver', exact: true }).click();
      await editor.getByRole('button', { name: 'Add connection', exact: true }).click();
      await expect.poll(() => editor.textContent()).toContain('Configuration validated — execution support not verified.');
      await editor.getByLabel('message', { exact: true }).fill('Unsaved provider text');
      const provider = [...scaffold.ctx.loader.entries()].find(entry => entry.options.id === 'workflow-browser-provider');
      if (!provider?.fiber) throw new Error('Browser provider did not mount');
      await provider.fiber.dispose();
      await expect.poll(() => editor.getByLabel('message', { exact: true }).count()).toBe(0);
      await expect.poll(() => editor.textContent()).toContain('Unavailable component configuration is preserved.');
      await scaffold.ctx.loader.create({ name: `${studio}/test/workflow-browser-provider.mjs` });
      await scaffold.ctx.loader.await();
      await expect.poll(() => editor.getByLabel('message', { exact: true }).inputValue()).toBe('Unsaved provider text');
      await editor.getByRole('button', { name: 'Save draft', exact: true }).click();
      await expect.poll(() => editor.getByRole('status').textContent()).toBe('Saved');
      await page.reload();
      await page.getByRole('button', { name: 'DSH Studio', exact: true }).click();
      await builderMenu.getByRole('button', { name: 'Workflow', exact: true }).click();
      await editor.getByLabel('Select draft', { exact: true }).selectOption({ label: 'Second draft' });
      await expect.poll(() => editor.getByLabel('message', { exact: true }).inputValue()).toBe('Unsaved provider text');
      expect(await editor.getByRole('button', { name: 'Delete connection', exact: true }).count()).toBe(1);
      await editor.getByRole('button', { name: 'Delete system: test.receiver', exact: true }).click();
      await expect.poll(() => editor.textContent()).toContain('The connected item is missing.');
      expect(await editor.getByRole('button', { name: 'Delete connection', exact: true }).count()).toBe(1);
      await editor.getByRole('button', { name: 'Add system: test.receiver', exact: true }).click();
      const inputPort = editor.getByLabel('Input port', { exact: true });
      const replacement = await inputPort.locator('option').last().getAttribute('value');
      await inputPort.selectOption(replacement!);
      await expect.poll(() => editor.textContent()).toContain('Configuration validated — execution support not verified.');
      expect(await editor.getByRole('button', { name: 'Apply', exact: true }).count()).toBe(0);
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await page.setViewportSize({ width: 720, height: 844 });
        for (const label of ['DSH settings', 'Role settings', 'Design preview', 'Experiments', 'Preset Builder']) {
          const button = navigation.getByRole('button', { name: label, exact: true });
          await button.click();
          expect(await button.getAttribute('aria-current')).toBe('page');
          expect(await page.locator('.studio-service-panel:not([hidden])').count()).toBe(1);
        }
        await builderMenu.getByRole('button', { name: 'Workflow', exact: true }).click();
        const geometry = await navigation.evaluate(element => ({
          width: element.clientWidth, parent: element.parentElement!.clientWidth,
          overflow: getComputedStyle(element).overflowX,
        }));
        expect(geometry.width).toBeLessThanOrEqual(geometry.parent);
        expect(geometry.overflow).toBe('auto');
        const contentGeometry = await editor.evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth }));
        expect(contentGeometry.scroll).toBeLessThanOrEqual(contentGeometry.width + 1);
        const controlColors = await editor.getByLabel('message', { exact: true }).evaluate(element => ({ ink: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor }));
        expect(controlColors.ink).not.toBe(controlColors.background);
        if (process.env.DSH_WORKFLOW_SCREENSHOT_DIR) {
          await editor.getByLabel('Connections', { exact: true }).scrollIntoViewIfNeeded();
          await page.screenshot({ path: join(process.env.DSH_WORKFLOW_SCREENSHOT_DIR, `workflow-${colorScheme}.png`) });
        }
      }
    } finally { await scaffold.close(); }
  } finally {
    await browser.close();
    if (resolve(temporary) !== temporary || !temporary.startsWith(join(tmpdir(), 'studio-workflow-browser-'))) throw new Error('Unexpected browser fixture directory');
    await rm(temporary, { recursive: true, force: true });
  }
});
