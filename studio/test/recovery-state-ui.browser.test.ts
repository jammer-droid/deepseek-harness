/** Real stop observations and storage-read failure rendered through the shipped Client. */
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { expect, it, vi } from 'vitest';
import { ToolCallId } from '@deepseek-ai/dsh-llm';
import { launchWebScaffold, readPersistedEvents } from '@studio-test/scaffold';
import { connectFreshWorkspace } from '@studio-test/support';
import type {} from '../packages/roles/src/roles-remote.ts';
const studio = fileURLToPath(new URL('..', import.meta.url));

it.each(['confirmed', 'unknown'] as const)('shows %s stop evidence without authorizing or waking work', async outcome => {
  const scaffold = await launchWebScaffold({
    extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`,
    extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`),
    replayFixture: `${studio}/test/fixtures/delegation/session.v4.jsonl`,
    replayChildFixtures: [`${studio}/test/fixtures/delegation/session.1.v4.jsonl`], compareReplaySession: false,
  });
  const release = Promise.withResolvers<void>();
  let restore = () => {};
  let off = () => {};
  try {
    const ctx = scaffold.ctx;
    const settings = { instructions: 'Preserve stop evidence.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' };
    const state = ctx.studioRoles.describe();
    await ctx.studioRoles.apply({ expectedProcessId: state.processId, expectedRevision: state.revision, expectedSnapshotId: state.snapshotId, roles: { implementer: settings, reviewer: settings } });
    const browser = await chromium.launch({ ...(process.env.DSH_TEST_BROWSER_CHANNEL ? { channel: process.env.DSH_TEST_BROWSER_CHANNEL } : {}) });
    try {
      const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1440, height: 1200 } });
      await page.goto(scaffold.authenticatedUrl);
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Settings' });
      await dialog.getByRole('button', { name: 'Agent presets', exact: true }).click();
      await dialog.getByRole('button', { name: 'Set as new task default: Studio', exact: true }).click();
      await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
      await connectFreshWorkspace(page, scaffold.workspaceCwd);
      await expect.poll(() => ctx.agents.roots().find(agent => ctx.agentPresets.composedPreset(agent.ctx) === 'studio-managed')).toBeDefined();
      const parent = ctx.agents.roots().find(agent => ctx.agentPresets.composedPreset(agent.ctx) === 'studio-managed');
      if (!parent) throw new Error('Missing managed parent');
      const settled = scaffold.whenTurnSettled();
      const input = page.locator('[data-composer-input][contenteditable="true"]');
      await input.fill('Prepare stop status evidence.'); await input.press('Enter'); await settled; await parent.whenIdle();
      const execute = (args: Record<string, unknown>) => ctx.tools.execute({ agent: parent, signal: new AbortController().signal, callId: ToolCallId('recovery-ui'), name: 'studio_delegate', arguments: args });
      expect((await execute({ action: 'initial', role: 'implementer', prompt: 'Implement once.' })).isError).toBe(false);
      await expect.poll(() => ctx.studioRoles.agents(parent.id)[0]?.state).toBe('completed');
      const original = ctx.studioRoles.agents(parent.id)[0]!;
      const before = await readPersistedEvents(scaffold, original.childId);
      let admissions = 0;
      off = ctx.on('agent/created', ({ agent }) => { if (agent.id === original.childId) admissions++; });
      const reading = Promise.withResolvers<void>();
      let held = false;
      const actualOpen = ctx.sessionPersistence.open.bind(ctx.sessionPersistence);
      const storage = vi.spyOn(ctx.sessionPersistence, 'open').mockImplementation(async (...args) => {
        if (!held && args[0] === original.childId && args[1] === 'read') {
          held = true; reading.resolve(); await release.promise;
          if (outcome === 'unknown') throw new Error('fixture-stop-evidence-unreadable');
        }
        return actualOpen(...args);
      });
      restore = () => storage.mockRestore();
      let stopSettled = false;
      const stopping = execute({ action: 'stop', cycleId: original.cycleId }).then(result => { stopSettled = true; return result; });
      await reading.promise;
      const requested = ctx.studioRoles.agents(parent.id)[0]!;
      expect(requested.stop?.status).toBe('requested');
      if (!requested.stop) throw new Error('Missing stop request');
      const normalize = (value: string) => value.replaceAll(original.parentId, '<parent>').replaceAll(original.childId, '<child>').replaceAll(original.messageId!, '<message>').replaceAll(new Date(requested.stop!.requestedAt).toISOString(), '<requested-at>');
      await page.getByRole('tab', { name: 'Agents', exact: true }).click();
      const panel = page.getByRole('region', { name: 'Agents', exact: true });
      const recovery = panel.getByRole('region', { name: 'Recovery details', exact: true });
      await expect.poll(() => recovery.innerText()).toContain('stopping is not yet confirmed');
      expect(stopSettled).toBe(false);
      expect(await recovery.innerText()).toContain(original.childId);
      expect(await recovery.innerText()).toContain(original.messageId);
      if (outcome === 'confirmed') expect(normalize(await recovery.innerText())).toMatchSnapshot('stop requested EN');
      release.resolve();
      expect((await stopping).isError).toBe(outcome === 'unknown');
      restore();
      await panel.getByRole('button', { name: 'Reload', exact: true }).click();
      await expect.poll(() => recovery.innerText()).toContain(outcome === 'confirmed' ? 'Execution was observed stopped or finished' : 'The stop outcome could not be confirmed');
      if (outcome === 'confirmed') {
        expect(await recovery.innerText()).toContain('does not undo changes or complete the cycle');
        expect(ctx.studioRoles.agents(parent.id)[0]?.state).toBe('completed');
      } else {
        expect(await recovery.innerText()).toContain('Last confirmed activation state');
        expect(await recovery.innerText()).toContain('Completed');
        expect(await recovery.innerText()).toContain('studio-stop-unknown');
        expect(ctx.studioRoles.agents(parent.id)[0]).toMatchObject({ state: 'unknown', lastConfirmedState: 'completed' });
      }
      expect(await panel.innerText()).not.toContain('Request review through the orchestrator.');
      expect(normalize(await recovery.innerText())).toMatchSnapshot('stop outcome EN');
      await panel.getByRole('button', { name: 'Open implementer', exact: true }).click();
      await page.locator(`[data-conversation-session="${original.childId}"]`).waitFor();
      await page.getByRole('tab', { name: 'Agents', exact: true }).click();
      await panel.getByRole('button', { name: 'Open orchestrator', exact: true }).click();
      await page.locator(`[data-conversation-session="${parent.id}"]`).waitFor();
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'English', exact: true }).click();
      await page.getByRole('menuitem', { name: '中文', exact: true }).click();
      await page.getByRole('dialog', { name: '设置' }).waitFor(); await page.keyboard.press('Escape');
      await page.getByRole('tab', { name: '代理', exact: true }).click();
      const translated = page.getByRole('region', { name: '恢复详情', exact: true });
      await expect.poll(() => translated.innerText()).toContain(outcome === 'confirmed' ? '已观察到执行停止或结束' : '无法确认停止结果');
      expect(normalize(await translated.innerText())).toMatchSnapshot('stop outcome ZH');
      expect(admissions).toBe(0);
      expect(await ctx.subagents.listChildren(parent.id)).toHaveLength(1);
      expect(await readPersistedEvents(scaffold, original.childId)).toEqual(before);
      if (outcome === 'unknown') await page.screenshot({ path: '/tmp/studio-recovery-state-ui.png', fullPage: true });
    } finally { release.resolve(); restore(); off(); await browser.close(); }
  } finally { release.resolve(); restore(); off(); await scaffold.close(); }
});
