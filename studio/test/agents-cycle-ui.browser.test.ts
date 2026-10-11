/** Cycle guidance rendered in Chrome through the matching runtime and shipped Loader. */
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { expect, it } from 'vitest';
import { ToolCallId } from '@deepseek-ai/dsh-llm';
import { launchWebScaffold } from '@studio-test/scaffold';
import { connectFreshWorkspace } from '@studio-test/support';
import type {} from '../packages/roles/src/roles-remote.ts';
import type { DelegationRecord } from '../packages/roles/src/delegation-store.ts';
const studio = fileURLToPath(new URL('..', import.meta.url));
it('separates cycle phase and activation, counts reused work, and localizes next actions', async () => {
  const browser = await chromium.launch({ ...(process.env.DSH_TEST_BROWSER_CHANNEL ? { channel: process.env.DSH_TEST_BROWSER_CHANNEL } : {}) });
  try {
    const scaffold = await launchWebScaffold({ extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`, extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`), replayFixture: `${studio}/test/fixtures/delegation/session.v4.jsonl`, replayChildFixtures: [`${studio}/test/fixtures/delegation/rework-implementer.v4.jsonl`, `${studio}/test/fixtures/delegation/rework-reviewer.v4.jsonl`], compareReplaySession: false });
    try {
      const ctx = scaffold.ctx;
      const settings = { instructions: 'Captured UI instructions.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' };
      const state = ctx.studioRoles.describe();
      await ctx.studioRoles.apply({ expectedProcessId: state.processId, expectedRevision: state.revision, expectedSnapshotId: state.snapshotId, roles: { implementer: settings, reviewer: settings } });
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
      if (!parent) throw new Error('Managed parent missing');
      const input = page.locator('[data-composer-input][contenteditable="true"]').first();
      const settled = scaffold.whenTurnSettled();
      await input.fill('Prepare.'); await input.press('Enter'); await settled; await parent.whenIdle();
      const execute = (args: Record<string, unknown>) => ctx.tools.execute({ agent: parent, signal: new AbortController().signal, callId: ToolCallId('cycle-ui'), name: 'studio_delegate', arguments: args });
      expect((await execute({ action: 'initial', role: 'implementer', prompt: 'Implement.' })).isError).toBe(false);
      await expect.poll(() => ctx.studioRoles.agents(parent.id)[0]?.cyclePhase).toBe('review-ready');
      const original = ctx.studioRoles.agents(parent.id)[0]!;
      await page.getByRole('tab', { name: 'Agents', exact: true }).click();
      const panel = page.getByRole('region', { name: 'Agents', exact: true });
      await expect.poll(() => panel.innerText()).toContain('Cycle phase');
      expect(await panel.innerText()).toContain('Child activation');
      expect(await panel.innerText()).toContain('0 / 2');
      expect(await panel.innerText()).toContain('Request review');
      const evidence = { requirements: 'UI task', summary: 'Done', changedFiles: [], validations: [], failures: [], unrun: [] };
      expect((await execute({ action: 'review', cycleId: original.cycleId, evidence })).isError).toBe(false);
      await expect.poll(() => ctx.studioRoles.agents(parent.id)[0]?.cyclePhase).toBe('judged');
      expect((await execute({ action: 'rework', cycleId: original.cycleId, prompt: 'Run verification only.' })).isError).toBe(false);
      await expect.poll(() => ctx.studioRoles.agents(parent.id)[0]?.cyclePhase).toBe('review-ready');
      await panel.getByRole('button', { name: 'Reload', exact: true }).click();
      await expect.poll(() => panel.innerText()).toContain('1 / 2');
      const cards = panel.locator('article');
      expect(await cards.count()).toBe(2);
      for (const card of await cards.all()) {
        expect(await card.innerText()).toContain('1 / 2');
        expect(await card.innerText()).toContain('Request review');
        expect(await card.innerText()).not.toContain('Explicitly complete');
      }
      expect(await panel.getByRole('region', { name: 'Cycle status', exact: true }).allTextContents()).toMatchSnapshot('rework awaiting review EN');
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'English', exact: true }).click();
      await page.getByRole('menuitem', { name: '中文', exact: true }).click();
      await page.getByRole('dialog', { name: '设置' }).waitFor(); await page.keyboard.press('Escape');
      await page.getByRole('tab', { name: '代理', exact: true }).click();
      const translated = page.getByRole('region', { name: '代理', exact: true });
      await expect.poll(() => translated.innerText()).toContain('请求审查');
      expect(await translated.getByRole('region', { name: '周期状态', exact: true }).allTextContents()).toMatchSnapshot('rework awaiting review ZH');
      expect(ctx.studioRoles.agents(parent.id)[0]?.childId).toBe(original.childId);
      expect(ctx.studioRoles.agents(parent.id)[0]?.reworkCount).toBe(1);
      expect((await execute({ action: 'review', cycleId: original.cycleId, evidence })).isError).toBe(false);
      await expect.poll(() => ctx.studioRoles.agents(parent.id)[0]?.cyclePhase).toBe('judged');
      await translated.getByRole('button', { name: '重新加载', exact: true }).click();
      await expect.poll(() => translated.innerText()).toContain('通过协调者显式完成，或在剩余次数内请求返工。');
      expect((await execute({ action: 'rework', cycleId: original.cycleId, prompt: 'Second verification.' })).isError).toBe(false);
      await expect.poll(() => ctx.studioRoles.agents(parent.id)[0]?.cyclePhase).toBe('review-ready');
      expect((await execute({ action: 'review', cycleId: original.cycleId, evidence })).isError).toBe(false);
      await expect.poll(() => ctx.studioRoles.agents(parent.id)[0]?.cyclePhase).toBe('judged');
      await translated.getByRole('button', { name: '重新加载', exact: true }).click();
      await expect.poll(() => translated.innerText()).toContain('已达到返工上限；进一步返工需要人工处理。');
      expect(await translated.getByRole('region', { name: '周期状态', exact: true }).allTextContents()).toMatchSnapshot('current pass at cap ZH');
      expect((await execute({ action: 'complete', cycleId: original.cycleId })).isError).toBe(false);
      await translated.getByRole('button', { name: '重新加载', exact: true }).click();
      await expect.poll(() => translated.innerText()).toContain('此周期已完成，不再执行工作。');
      // Only these rendering cases replace the public response; no Host authorization claim.
      const actual = ctx.studioRoles.agents(parent.id);
      const showFixture = async (rows: DelegationRecord[]) => {
        await page.route('**/api/studioRoles/agents', async route => {
          const response = await route.fetch();
          const envelope = await response.json();
          await route.fulfill({ response, json: { ...envelope, result: { ok: true, value: rows } } });
        }, { times: 1 });
        await translated.getByRole('button', { name: '重新加载', exact: true }).click();
      };
      await showFixture(actual.map(row => row.role === 'implementer' ? { ...row, cyclePhase: 'judged', state: 'unknown', cycleCompletedAt: undefined } : row));
      await expect.poll(() => translated.innerText()).toContain('停止并向人工报告未知或未解决的结果。');
      expect(await translated.innerText()).not.toContain('通过协调者显式完成。');
      await showFixture(actual.map(row => row.role === 'implementer' ? { ...row, reworkCap: undefined, cyclePhase: undefined, cycleOperation: undefined, cycleCompletedAt: undefined } : row));
      await expect.poll(() => translated.innerText()).toContain('2 / 未记录上限');
      expect(await translated.innerText()).toContain('未记录周期策略或阶段。');
      expect(await translated.innerText()).not.toContain('2 / 2');
      await showFixture(actual.filter(row => row.role === 'reviewer'));
      await expect.poll(() => translated.locator('article').count()).toBe(1);
      expect(await translated.innerText()).toContain('未记录周期策略或阶段。');
      expect(await translated.innerText()).not.toContain('0 /');
      await showFixture(actual.map(row => row.role === 'implementer' ? { ...row, cyclePhase: 'judged', cycleOperation: row.operationId, cycleCompletedAt: undefined } : row));
      await expect.poll(() => translated.innerText()).toContain('停止并向人工报告未知或未解决的结果。');
      for (const judgment of ['needs-changes', 'unable-to-judge', 'pass'] as const) {
        await showFixture(actual.map(row => row.role === 'implementer' ? { ...row, cyclePhase: 'judged', cycleCompletedAt: undefined } : { ...row, judgment: { judgment, explanation: 'Unresolved verification', evidence: ['Pending verification'], additionalVerification: ['Run verification'] } }));
        await expect.poll(() => translated.innerText()).toContain('停止：已达到返工上限，审查结论或验证仍未解决。');
        expect(await translated.innerText()).not.toContain('通过协调者显式完成。');
      }
    } catch (error) { console.error('CYCLE_UI_PRIMARY_FAILURE', error); throw error; } finally { await scaffold.close(); }
  } finally { await browser.close(); }
});
