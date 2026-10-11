/** Public composer-block ownership limits in the real Loader and browser. */
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { expect, it } from 'vitest';
import { launchWebScaffold } from '@studio-test/scaffold';
import { connectFreshWorkspace } from '@studio-test/support';
import type {} from '@deepseek-ai/dsh-api-session-controller';

const fixture = fileURLToPath(new URL('./fixtures/blocker-conflict/package.json', import.meta.url));
it('cannot isolate independent composer blockers or safely restore their ownership', async () => {
  const scaffold = await launchWebScaffold({ extraInstallAnchors: [fixture], replayFixture: fileURLToPath(new URL('./fixtures/delegation/session.v4.jsonl', import.meta.url)), compareReplaySession: false });
  try {
    const browser = await chromium.launch({ ...(process.env.DSH_TEST_BROWSER_CHANNEL ? { channel: process.env.DSH_TEST_BROWSER_CHANNEL } : {}) });
    try {
      const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1440, height: 1000 } });
      await page.goto(scaffold.authenticatedUrl);
      await connectFreshWorkspace(page, scaffold.workspaceCwd);
      const seed = page.locator('[data-composer-input][contenteditable="true"]');
      const settled = scaffold.whenTurnSettled();
      await seed.fill('Prepare blocker ownership evidence.');
      await seed.press('Enter');
      const sessionId = await settled;
      await scaffold.ctx.sessionController.rename({ sessionId, title: 'Blocked test session' });
      const entry = await scaffold.ctx.loader.create({ name: '@fixture/studio-blocker-conflict' });
      await page.getByRole('tab', { name: 'Block ownership fixture', exact: true }).click();
      const panel = page.getByRole('region', { name: 'Block ownership fixture', exact: true });
      const observation = async () => JSON.parse(await panel.locator('[data-block-observation]').innerText()) as {
        sessionId: string; notifications: number; identity: string; reason: string | null; bIntent: string | null;
      };
      const input = page.locator('[data-composer-input]');
      const send = page.getByRole('button', { name: 'Send message', exact: true });
      await input.fill('Draft retained under composer blocks.');
      expect(await send.isEnabled()).toBe(true);
      await panel.getByRole('button', { name: 'A blocks input', exact: true }).click();
      await expect.poll(() => input.getAttribute('contenteditable')).toBe('false');
      expect(await send.isDisabled()).toBe(true);
      expect(await input.getAttribute('data-placeholder')).toBe('Producer A blocks input');
      const owned = await observation();
      expect(owned.identity).toBe('A');
      await panel.getByRole('button', { name: 'Open ordinary session', exact: true }).click();
      await expect.poll(() => input.getAttribute('contenteditable')).toBe('true');
      await input.fill('Ordinary session remains editable.');
      expect(await send.isEnabled()).toBe(true);
      await page.getByRole('treeitem').filter({ has: page.getByText('Blocked test session', { exact: true }) }).click();
      await page.getByRole('tab', { name: 'Block ownership fixture', exact: true }).click();
      await expect.poll(() => input.getAttribute('contenteditable')).toBe('false');

      await panel.getByRole('button', { name: 'B writes same reason', exact: true }).click();
      const same = await observation();
      expect(same).toMatchObject({ identity: 'A', notifications: owned.notifications, bIntent: 'Producer A blocks input' });
      await panel.getByRole('button', { name: 'A clears by identity', exact: true }).click();
      expect(await observation()).toMatchObject({ identity: 'none', bIntent: 'Producer A blocks input' });
      await expect.poll(() => input.getAttribute('contenteditable')).toBe('true');
      expect(await send.isEnabled()).toBe(true);

      await panel.getByRole('button', { name: 'A blocks input', exact: true }).click();
      await panel.getByRole('button', { name: 'B writes different reason', exact: true }).click();
      expect(await observation()).toMatchObject({ identity: 'B', reason: 'Producer B blocks input' });
      expect(await input.getAttribute('data-placeholder')).toBe('Producer B blocks input');
      await panel.getByRole('button', { name: 'A clears by identity', exact: true }).click();
      expect(await observation()).toMatchObject({ identity: 'B' });
      expect(await send.isDisabled()).toBe(true);

      await panel.getByRole('button', { name: 'Seed original block', exact: true }).click();
      await panel.getByRole('button', { name: 'A blocks input', exact: true }).click();
      await panel.getByRole('button', { name: 'B writes different reason', exact: true }).click();
      await panel.getByRole('button', { name: 'A restores previous block', exact: true }).click();
      expect(await observation()).toMatchObject({ identity: 'original', reason: 'Original producer blocks input', bIntent: 'Producer B blocks input' });
      expect(await input.getAttribute('data-placeholder')).toBe('Original producer blocks input');

      await panel.getByRole('button', { name: 'A blocks input', exact: true }).click();
      await panel.getByRole('button', { name: 'B writes same reason', exact: true }).click();
      expect(await observation()).toMatchObject({ identity: 'A', bIntent: 'Producer A blocks input' });
      await scaffold.ctx.loader.remove(entry);
      await panel.waitFor({ state: 'hidden' });
      await expect.poll(() => input.getAttribute('data-placeholder')).toBe('Original producer blocks input');
      expect(await send.isDisabled()).toBe(true);
      expect(scaffold.ctx.agents.roots().every(root => root.status !== 'running')).toBe(true);
    } finally { await browser.close(); }
  } finally { await scaffold.close(); }
});
