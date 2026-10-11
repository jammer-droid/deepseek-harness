/** Actual browser navigation and actual child activation share the shipped Loader. */
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { it, expect } from 'vitest';
import { ToolCallId } from '@deepseek-ai/dsh-llm';
import { launchWebScaffold, readPersistedEvents } from '@studio-test/scaffold';
import { connectFreshWorkspace } from '@studio-test/support';
import type {} from '../packages/roles/src/roles-remote.ts';
const studio = fileURLToPath(new URL('..', import.meta.url));
it.each(['pass', 'needs-changes', 'unable-to-judge', 'invalid'])('shows review outcome %s and browses both children without reactivation', async outcome => {
  const browser = await chromium.launch({ ...(process.env.DSH_TEST_BROWSER_CHANNEL ? { channel: process.env.DSH_TEST_BROWSER_CHANNEL } : {}) });
  try {
    const scaffold = await launchWebScaffold({
      extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`,
      extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`),
      replayFixture: `${studio}/test/fixtures/delegation/session.v4.jsonl`,
      replayChildFixtures: [`${studio}/test/fixtures/delegation/session.1.v4.jsonl`, `${studio}/test/fixtures/delegation/review-${outcome}.v4.jsonl`], compareReplaySession: false,
    });
    try {
      const ctx = scaffold.ctx;
      const settings = { instructions: 'Browser captured implementer instructions.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' };
      const state = ctx.studioRoles.describe();
      await ctx.studioRoles.apply({ expectedProcessId: state.processId, expectedRevision: state.revision, expectedSnapshotId: state.snapshotId, roles: { implementer: settings, reviewer: settings } });
      const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1440, height: 1200 } });
      await page.goto(scaffold.authenticatedUrl);
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      const settingsDialog = page.getByRole('dialog', { name: 'Settings' });
      await settingsDialog.getByRole('button', { name: 'Agent presets', exact: true }).click();
      await settingsDialog.getByRole('button', { name: 'Set as new task default: Studio', exact: true }).click();
      await settingsDialog.getByRole('button', { name: 'Close', exact: true }).last().click();
      await connectFreshWorkspace(page, scaffold.workspaceCwd);
      await expect.poll(() => ctx.agents.roots().find(agent => ctx.agentPresets.composedPreset(agent.ctx) === 'studio-managed')).toBeDefined();
      const parent = ctx.agents.roots().find(agent => ctx.agentPresets.composedPreset(agent.ctx) === 'studio-managed');
      if (!parent) throw new Error('Managed parent missing');
      const input = page.locator('[data-composer-input][contenteditable="true"]').first();
      const settled = scaffold.whenTurnSettled();
      await input.fill('Prepare the implementation.'); await input.press('Enter');
      expect(await settled).toBe(parent.id);
      await parent.whenIdle();
      const receipt = await ctx.tools.execute({ agent: parent, signal: new AbortController().signal, name: 'studio_delegate', callId: ToolCallId('browser-initial'), arguments: { action: 'initial', role: 'implementer', prompt: 'Implement the browser task.' } });
      expect(receipt.isError, JSON.stringify(receipt)).toBe(false);
      await expect.poll(() => ctx.studioRoles.agents(parent.id)[0]?.state).toBe('completed');
      const row = ctx.studioRoles.agents(parent.id)[0]; if (!row) throw new Error('Missing child row');
      const review = await ctx.tools.execute({ agent: parent, signal: new AbortController().signal, name: 'studio_delegate', callId: ToolCallId('browser-review'), arguments: { action: 'review', cycleId: row.cycleId, evidence: { requirements: 'Browser task', summary: 'Implementation complete', changedFiles: [], validations: [], failures: [], unrun: ['full suite'] } } });
      expect(review.isError, JSON.stringify(review)).toBe(false);
      await expect.poll(() => ctx.studioRoles.agents(parent.id).find(item => item.role === 'reviewer')?.state).toBe('completed');
      const reviewer = ctx.studioRoles.agents(parent.id).find(item => item.role === 'reviewer')!;
      const reviewerEvents = await readPersistedEvents(scaffold, reviewer.childId);
      const beforeNavigation = await readPersistedEvents(scaffold, row.childId);
      await page.getByRole('tab', { name: 'Agents', exact: true }).click();
      const panel = page.getByRole('region', { name: 'Agents', exact: true });
      await panel.getByRole('button', { name: 'Show captured details', exact: true }).first().click();
      await expect.poll(() => panel.innerText()).toContain('IMPLEMENTER_DONE');
      expect(await panel.innerText()).toContain(settings.instructions);
      expect(await page.getByRole('tab', { name: 'Trajectory', exact: true }).count()).toBe(1);
      expect(await panel.innerText()).toContain('Fresh context');
      expect(await panel.getByRole('region', { name: 'Review judgment', exact: true }).innerText()).toContain(outcome === 'invalid' ? 'No validated review judgment' : 'Requirements met');
      if (outcome === 'invalid') expect(await panel.getByRole('alert').innerText()).toContain('Cycle completion is blocked');
      expect(await panel.innerText()).toContain('Cycle open — explicit completion required');
      const completion = await ctx.tools.execute({ agent: parent, signal: new AbortController().signal, name: 'studio_delegate', callId: ToolCallId('browser-complete'), arguments: { action: 'complete', cycleId: row.cycleId } });
      expect(completion.isError).toBe(outcome !== 'pass');
      await panel.getByRole('button', { name: 'Reload', exact: true }).click();
      await expect.poll(() => panel.innerText()).toContain(outcome === 'pass' ? 'Cycle explicitly completed' : 'Cycle open — explicit completion required');
      const loading = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      await page.route('**/api/studioRoles/agents', async route => { loading.resolve(); await release.promise; await route.fulfill({ status: 503, body: 'Test unavailable' }); }, { times: 1 });
      await panel.getByRole('button', { name: 'Reload', exact: true }).click();
      await loading.promise;
      expect(await panel.getByRole('status').innerText()).toBe('Loading agent status…');
      expect(await panel.innerText()).not.toContain('IMPLEMENTER_DONE');
      release.resolve();
      await panel.getByRole('alert').waitFor();
      expect(await panel.innerText()).toContain('Agent status is unavailable. Reload to retry.');
      await panel.getByRole('button', { name: 'Reload', exact: true }).click();
      await panel.getByRole('button', { name: 'Open implementer', exact: true }).click();
      await page.locator(`[data-conversation-session="${row.childId}"]`).waitFor();
      await page.getByRole('tab', { name: 'Agents', exact: true }).click();
      await panel.getByRole('button', { name: 'Open orchestrator', exact: true }).click();
      await page.locator(`[data-conversation-session="${parent.id}"]`).waitFor();
      await page.getByRole('tab', { name: 'Agents', exact: true }).click();
      await panel.getByRole('button', { name: 'Open reviewer', exact: true }).click();
      await page.locator(`[data-conversation-session="${reviewer.childId}"]`).waitFor();
      await page.getByRole('tab', { name: 'Agents', exact: true }).click();
      await panel.getByRole('button', { name: 'Open orchestrator', exact: true }).click();
      await page.locator(`[data-conversation-session="${parent.id}"]`).waitFor();
      expect(await ctx.subagents.listChildren(parent.id)).toHaveLength(2);
      expect(await readPersistedEvents(scaffold, reviewer.childId)).toEqual(reviewerEvents);
      expect(await readPersistedEvents(scaffold, row.childId)).toEqual(beforeNavigation);
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'English', exact: true }).click();
      await page.getByRole('menuitem', { name: '中文', exact: true }).click();
      await page.getByRole('dialog', { name: '设置' }).waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('tab', { name: '代理', exact: true }).click();
      const translated = page.getByRole('region', { name: '代理', exact: true });
      await expect.poll(() => translated.innerText()).toContain('全新上下文');
      await translated.getByRole('button', { name: '显示捕获详情', exact: true }).first().click();
      expect(await translated.innerText()).toContain(settings.instructions);
      expect(await translated.innerText()).toContain(outcome === 'pass' ? '周期已显式完成' : '周期未完成');
      expect(await translated.getByRole('region', { name: '审查结论', exact: true }).innerText()).toContain(outcome === 'pass' ? '通过' : outcome === 'needs-changes' ? '需要修改' : outcome === 'unable-to-judge' ? '无法判断' : '没有经过验证的审查结论');
      if (outcome === 'invalid') expect(await translated.getByRole('alert').innerText()).toContain('周期无法完成');
      expect(await readPersistedEvents(scaffold, row.childId)).toEqual(beforeNavigation);
    } catch (error) { console.error('Browser primary failure', error); throw error; } finally { await scaffold.close(); }
  } finally { await browser.close(); }
});
