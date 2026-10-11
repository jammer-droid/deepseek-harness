/** Model-authored delegation repairs real fixture files through the shipped tools and Client. */
import { mkdtemp, mkdir, readFile, writeFile, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { expect, it } from 'vitest';
import { launchWebScaffold } from '@studio-test/scaffold';
import { connectFreshWorkspace } from '@studio-test/support';
import type {} from '../packages/roles/src/roles-remote.ts';
const studio = fileURLToPath(new URL('..', import.meta.url));
const fixtures = `${studio}/test/fixtures/full-cycle`;

it('repairs feedback files with one counted rework, an independent rereview, and explicit completion', async () => {
  const preview = await mkdtemp(join(tmpdir(), 'studio-feedback-preview-'));
  const browser = await chromium.launch({ ...(process.env.DSH_TEST_BROWSER_CHANNEL ? { channel: process.env.DSH_TEST_BROWSER_CHANNEL } : {}) });
  try {
    await writeFile(join(preview, 'package.json'), JSON.stringify({ name: '@fixture/studio-feedback-preview', version: '0.0.1', private: true, type: 'module', main: 'index.js', exports: { '.': './index.js', './client': './client.js' }, dsh: { client: { platform: 'web' } } }));
    await writeFile(join(preview, 'index.js'), 'export function apply() {}\n');
    await writeFile(join(preview, 'client.js'), '');
    const scaffold = await launchWebScaffold({
      extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`,
      extraInstallAnchors: [...['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`), join(preview, 'package.json')],
      replayFixture: `${fixtures}/root.v4.jsonl`, replayChildFixtures: [`${fixtures}/implementer.v4.jsonl`, `${fixtures}/reviewer.v4.jsonl`], compareReplaySession: false,
    });
    try {
      const ctx = scaffold.ctx;
      const settings = { instructions: 'Inspect and repair only role-feedback/roles-locales.ts. Preserve the editor and all unrelated text.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' };
      const state = ctx.studioRoles.describe();
      await ctx.studioRoles.apply({ expectedProcessId: state.processId, expectedRevision: state.revision, expectedSnapshotId: state.snapshotId, roles: { implementer: settings, reviewer: { ...settings, instructions: 'Read the real changed file. Report each unresolved requirement; do not edit files.' } } });
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
      if (!parent?.session.header.cwd) throw new Error('Managed fixture workspace missing');
      const workspace = join(parent.session.header.cwd, 'role-feedback');
      await mkdir(workspace, { recursive: true });
      const originalLocale = await readFile(`${studio}/src/roles-locales.ts`, 'utf8');
      const originalEditor = await readFile(`${studio}/src/roles-editor.tsx`, 'utf8');
      const expected: { dirty: string; applied: string } = JSON.parse(await readFile(`${fixtures}/expected-feedback.json`, 'utf8'));
      const defective = originalLocale.replace(expected.dirty, 'Changes saved.').replace(expected.applied, 'Settings edited.');
      expect(defective).not.toBe(originalLocale);
      await writeFile(join(workspace, 'roles-locales.ts'), defective);
      await writeFile(join(workspace, 'roles-editor.tsx'), originalEditor);
      const turn = async (prompt: string) => {
        const settled = scaffold.whenTurnSettled();
        const input = page.locator('[data-composer-input][contenteditable="true"]').first();
        await input.fill(prompt); await input.press('Enter'); await settled; await parent.whenIdle();
        using log = await ctx.sessionQuery.observeSession(parent.id, { projectionMode: 'none' });
        const errors = log.events.filter(event => event.type === 'tool/result').filter(event => event.data.message.isError);
        expect(errors, JSON.stringify(errors)).toEqual([]);
      };
      const waitNotice = async (childId: string) => {
        await expect.poll(async () => {
          using log = await ctx.sessionQuery.observeSession(parent.id, { projectionMode: 'none' });
          return log.events.some(event => event.type === 'user/message' && event.data.source.kind === 'subagent-settled' && event.data.source.senderSessionId === childId);
        }).toBe(true);
        await parent.whenIdle();
      };
      const rows = () => ctx.studioRoles.agents(parent.id);
      await turn('Prepare role feedback verification.');
      await turn('Repair the isolated role feedback fixture.');
      await expect.poll(() => rows().find(row => row.role === 'implementer')?.cyclePhase).toBe('review-ready');
      const implementer = rows().find(row => row.role === 'implementer')!;
      expect(implementer).toMatchObject({ context: 'fork', reworkCount: 0, reworkCap: 2, state: 'completed' });
      expect(implementer.inheritedEventCount).toBeGreaterThan(0);
      const partial = await readFile(join(workspace, 'roles-locales.ts'), 'utf8');
      expect(partial).toContain(expected.dirty);
      expect(partial).toContain("applied: 'Settings edited.'");
      expect(partial).not.toBe(originalLocale);
      await turn('Review both required feedback messages against the actual file.');
      await expect.poll(() => rows().find(row => row.role === 'implementer')?.cyclePhase).toBe('judged');
      const reviewer = rows().find(row => row.role === 'reviewer')!;
      expect(reviewer).toMatchObject({ context: 'fork', state: 'completed', judgment: { judgment: 'needs-changes' } });
      expect(reviewer.inheritedEventCount).toBeGreaterThan(0);
      expect(rows()[0]?.cycleCompletedAt).toBeUndefined();
      await page.getByRole('tab', { name: 'Agents', exact: true }).click();
      const panel = page.getByRole('region', { name: 'Agents', exact: true });
      await expect.poll(() => panel.innerText()).toContain('Needs changes');
      expect(await panel.getByRole('region', { name: 'Cycle status', exact: true }).allTextContents()).toMatchSnapshot('first review requires rework');
      const applied = ctx.studioRoles.describe();
      await ctx.studioRoles.apply({ expectedProcessId: applied.processId, expectedRevision: applied.revision, expectedSnapshotId: applied.snapshotId, roles: { implementer: { ...settings, instructions: 'New children only: changed settings.' }, reviewer: { ...settings, instructions: 'New reviewers only: changed settings.' } } });
      await turn('Fix the remaining Apply feedback in the existing implementer.');
      await expect.poll(() => rows().find(row => row.role === 'implementer')?.cyclePhase).toBe('review-ready');
      expect(await readFile(join(workspace, 'roles-locales.ts'), 'utf8')).toBe(originalLocale);
      expect(await readFile(join(workspace, 'roles-editor.tsx'), 'utf8')).toBe(originalEditor);
      expect(rows().find(row => row.role === 'implementer')).toMatchObject({ childId: implementer.childId, settings: implementer.settings, snapshotId: implementer.snapshotId, inheritedEventCount: implementer.inheritedEventCount, reworkCount: 1, reworkCap: 2 });
      await waitNotice(implementer.childId);
      await turn('Rereview the repaired file with the existing reviewer.');
      await expect.poll(() => rows().find(row => row.role === 'reviewer')?.judgment?.judgment).toBe('pass');
      await expect.poll(() => rows().find(row => row.role === 'implementer')?.cyclePhase).toBe('judged');
      expect(rows().find(row => row.role === 'reviewer')).toMatchObject({ childId: reviewer.childId, settings: reviewer.settings, snapshotId: reviewer.snapshotId, inheritedEventCount: reviewer.inheritedEventCount, judgment: { additionalVerification: [] } });
      expect(rows().find(row => row.role === 'implementer')?.cycleCompletedAt).toBeUndefined();
      await panel.getByRole('button', { name: 'Reload', exact: true }).click();
      await expect.poll(() => panel.innerText()).toContain('1 / 2');
      expect(await panel.getByRole('region', { name: 'Cycle status', exact: true }).allTextContents()).toMatchSnapshot('pass still requires explicit completion');
      await waitNotice(reviewer.childId);
      await turn('Explicitly complete the verified cycle.');
      await expect.poll(() => rows().find(row => row.role === 'implementer')?.cyclePhase).toBe('complete');
      expect(rows()).toHaveLength(2);
      await panel.getByRole('button', { name: 'Reload', exact: true }).click();
      await expect.poll(() => panel.innerText()).toContain('Cycle explicitly completed');
      expect(await panel.getByRole('region', { name: 'Cycle status', exact: true }).allTextContents()).toMatchSnapshot('explicitly completed fixture cycle');
      using parentLog = await ctx.sessionQuery.observeSession(parent.id, { projectionMode: 'none' });
      const calls = parentLog.events.filter(event => event.type === 'tool/call').filter(event => event.data.name === 'studio_delegate');
      expect(calls.map(event => JSON.parse(event.data.arguments).action)).toEqual(['initial', 'review', 'rework', 'review', 'complete']);
      const receipts = parentLog.events.filter(event => event.type === 'tool/result').filter(event => calls.some(call => call.data.callId === event.data.message.toolCallId));
      expect(receipts).toHaveLength(5);
      expect(receipts.every(event => !event.data.message.isError)).toBe(true);
      const childEvidence = [];
      for (const row of rows()) {
        await using stored = await ctx.sessionPersistence.open(row.childId, 'read');
        const { events } = await stored.read(row.inheritedEventCount);
        const tools = events.filter(event => event.type === 'tool/call').map(event => event.data.name);
        expect(tools).toEqual(row.role === 'implementer' ? ['read', 'write', 'read', 'write'] : ['read', 'structured_output', 'read', 'studio_review_submit']);
        expect(events.filter(event => event.type === 'tool/result').every(event => !event.data.message.isError)).toBe(true);
        childEvidence.push({ role: row.role, context: row.context, count: row.reworkCount, phase: row.cyclePhase, tools, judgment: row.judgment?.judgment ?? null });
      }
      expect(childEvidence).toMatchSnapshot('actual tool and cycle evidence');
      await copyFile(`${studio}/src/roles-store.ts`, join(preview, 'roles-store.ts'));
      await writeFile(join(preview, 'preview.tsx'), `
import React from 'react';
import { RoleEditor } from ${JSON.stringify(join(workspace, 'roles-editor.tsx'))};
import { createRoleStore } from './roles-store.ts';
export const inject = ['remote', 'slots'];
export function apply(ctx) {
  ctx.inject(['remote.studioRoles'], ctx => {
    const unwrap = response => { if (!response.ok) throw response.error; return response.value; };
    const store = createRoleStore({ describe: async () => unwrap(await ctx.remote.studioRoles.describe()), apply: async request => unwrap(await ctx.remote.studioRoles.apply(request)) }, 'en');
    ctx.effect(() => () => store.dispose());
    void store.reload();
    function View() {
      const view = React.useSyncExternalStore(store.subscribe, store.getSnapshot);
      return <section aria-label="Verified fixture">{view.state && <RoleEditor key={view.generation} locale="en" state={view.state} onApply={store.apply} onReload={store.reload} />}</section>;
    }
    ctx.slots.inject('local.dsh-studio.features', () => ctx.slots.register({ name: 'local.dsh-studio.features', id: 'verified-feedback-fixture', order: -20 }, View));
  });
}
`);
      await build({ entryPoints: [join(preview, 'preview.tsx')], outfile: join(preview, 'client.js'), bundle: true, platform: 'browser', format: 'cjs', target: 'es2022', external: ['react', 'react/jsx-runtime'], banner: { js: "window.__ModuleLoader__.load({id: '@fixture/studio-feedback-preview', factory: (require) => { const module = { exports: {} }; const exports = module.exports;" }, footer: { js: 'return module.exports; }});' } });
      const entry = await ctx.loader.create({ name: '@fixture/studio-feedback-preview' });
      await ctx.loader.resolve(entry).fiber?.await();
      await page.reload();
      await page.getByRole('button', { name: 'DSH Studio', exact: true }).click();
      const verified = page.getByRole('region', { name: 'Verified fixture', exact: true });
      await verified.waitFor({ timeout: 30_000 });
      await expect.poll(() => verified.getByRole('status').allTextContents()).toContain(expected.applied);
      await verified.getByRole('textbox', { name: 'Implementer Instructions', exact: true }).fill('Verified draft is not active until Apply.');
      expect(await verified.getByRole('status').allTextContents()).toContain(expected.dirty);
      const beforeApply = ctx.studioRoles.describe();
      expect(beforeApply.roles?.implementer.instructions).toBe('New children only: changed settings.');
      await verified.getByRole('button', { name: 'Apply', exact: true }).click();
      await expect.poll(() => verified.getByRole('status').allTextContents()).toEqual([expected.applied, 'No unsaved changes.']);
      expect(ctx.studioRoles.describe().roles?.implementer.instructions).toBe('Verified draft is not active until Apply.');
      expect(rows().find(row => row.role === 'implementer')?.settings).toEqual(implementer.settings);
      expect(await verified.getByRole('status').allTextContents()).toMatchSnapshot('repaired editor Apply feedback');
      if (process.env.DSH_TEST_SCREENSHOT) await page.screenshot({ path: process.env.DSH_TEST_SCREENSHOT, fullPage: true });
    } catch (error) { console.error('FULL_CYCLE_FAILURE', error); throw error; }
    finally { await scaffold.close(); }
  } finally { await browser.close(); await rm(preview, { recursive: true, force: true }); }
});
