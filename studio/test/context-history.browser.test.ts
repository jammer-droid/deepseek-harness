/** Actual browser navigation and actual child activation share the shipped Loader. */
import { fileURLToPath } from 'node:url';
import { chromium, type WebSocketRoute } from 'playwright';
import { it, expect } from 'vitest';
import { CompactionId, compactCheckpointSource } from '@deepseek-ai/dsh-compaction';
import type {} from '@deepseek-ai/dsh-token-meter';
import { ToolCallId, createUserMessage } from '@deepseek-ai/dsh-llm';
import { launchWebScaffold, readPersistedEvents } from '@studio-test/scaffold';
import { connectFreshWorkspace } from '@studio-test/support';
import type {} from '../packages/roles/src/roles-remote.ts';
const studio = fileURLToPath(new URL('..', import.meta.url));
it.each(['fresh', 'fork'] as const)('browses %s context evidence without child admission', async context => {
  const browser = await chromium.launch({ ...(process.env.DSH_TEST_BROWSER_CHANNEL ? { channel: process.env.DSH_TEST_BROWSER_CHANNEL } : {}) });
  try {
    const scaffold = await launchWebScaffold({
      extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`,
      extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`),
      replayFixture: `${studio}/test/fixtures/delegation/session.v4.jsonl`,
      replayChildFixtures: [`${studio}/test/fixtures/delegation/session.1.v4.jsonl`], compareReplaySession: false,
    });
    try {
      const ctx = scaffold.ctx;
      const settings = { instructions: 'Browser captured implementer instructions.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' };
      const state = ctx.studioRoles.describe();
      await ctx.studioRoles.apply({ expectedProcessId: state.processId, expectedRevision: state.revision, expectedSnapshotId: state.snapshotId, roles: { implementer: settings, reviewer: settings } });
      const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1440, height: 1200 } });
      let targetChild = '';
      let fault: 'none' | 'missing' | 'denied' | 'hold' = 'none';
      let held: (() => void) | undefined;
      let readyFrames = 0;
      let childBaselines = 0;
      const sockets: { client: WebSocketRoute; server: WebSocketRoute }[] = [];
      await page.routeWebSocket('**/api/remote.mux', client => {
        const server = client.connectToServer();
        sockets.push({ client, server });
        const children = new Set<string>();
        client.onMessage(message => {
          const frame = JSON.parse(String(message)) as { type: string; streamId: string; endpoint?: string; payload?: { args: { request: { address: { kind: string; childSessionId?: string; parentSessionId?: string }; maxMessages?: number; turnWindow?: object } } } };
          if (frame.type === 'open' && frame.endpoint === 'session/follow' && frame.payload?.args.request.address.childSessionId === targetChild) {
            children.add(frame.streamId);
            const request = frame.payload.args.request;
            request.maxMessages = 1;
            delete request.turnWindow;
            if (fault === 'missing') request.address.childSessionId = 'studio-absent-history';
            if (fault === 'denied') request.address.parentSessionId = targetChild;
            server.send(JSON.stringify(frame));
          } else server.send(message);
        });
        server.onMessage(message => {
          const frame = JSON.parse(String(message)) as { type: string; streamId: string; value?: { type: string } };
          if (frame.type === 'item' && frame.value?.type === 'ready') readyFrames++;
          if (frame.type === 'item' && frame.value?.type === 'snapshot' && children.has(frame.streamId)) {
            childBaselines++;
            if (fault === 'hold') { fault = 'none'; held = () => client.send(message); return; }
          }
          client.send(message);
        });
      });
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
      if (context === 'fork') {
        const original = parent.session.snapshotEvents().find(event => event.type === 'user/message');
        if (!original || original.type !== 'user/message') throw new Error('Missing original user evidence');
        parent.session.append('turn/start', { turn: 2 });
        const compactionId = CompactionId('context-browser-compaction');
        const start = parent.session.append('compaction/start', { compactionId, turn: 2 });
        const summary = [{ type: 'text' as const, text: 'Retained compacted context evidence.' }];
        const result = parent.session.append('compaction/summary', {
          compactionId, summary, shadowedRange: { start: original.seq, end: original.seq }, shadowedSeqs: [original.seq],
          shadowedTokenCount: ctx.tokenMeter.estimateMessage(original.data), provider: 'snapshot', model: 'snapshot-compactor',
          rawOutput: [{ type: 'text', text: 'PRIVATE_COMPACTION_PROVIDER_OUTPUT' }],
        });
        parent.session.append('user/message', createUserMessage({ content: summary, source: compactCheckpointSource(compactionId) }), {
          surfaceOp: { op: 'replace', startSeq: original.seq, endSeq: original.seq }, sourceEventSeqs: [start.seq, result.seq, original.seq],
        });
        parent.session.append('compaction/end', { compactionId, turn: 2 });
        parent.session.append('turn/end', { turn: 2, reason: { kind: 'completed' } });
      }
      const receipt = await ctx.tools.execute({ agent: parent, signal: new AbortController().signal, name: 'studio_delegate', callId: ToolCallId('browser-initial'), arguments: { action: 'initial', role: 'implementer', context, prompt: context === 'fresh' ? `Implement the browser task.\n${'LARGE_CONTEXT_EVIDENCE_'.repeat(10000)}` : 'Implement the browser task.' } });
      expect(receipt.isError, JSON.stringify(receipt)).toBe(false);
      await expect.poll(() => ctx.studioRoles.agents(parent.id)[0]?.state).toBe('completed');
      const row = ctx.studioRoles.agents(parent.id)[0]; if (!row) throw new Error('Missing child row');
      targetChild = row.childId;
      const before = await readPersistedEvents(scaffold, row.childId);
      await page.getByRole('tab', { name: 'Agents', exact: true }).click();
      const panel = page.getByRole('region', { name: 'Agents', exact: true });
      await panel.getByRole('button', { name: 'Show context history', exact: true }).waitFor();
      expect(await panel.getByRole('region', { name: 'Context history', exact: true }).count()).toBe(0);
      expect(await panel.innerText()).not.toContain('LARGE_CONTEXT_EVIDENCE_');
      expect(await panel.innerText()).toContain(context === 'fork' ? 'Forked parent context' : 'Fresh context');
      await panel.getByRole('button', { name: 'Show context history', exact: true }).click();
      const history = panel.getByRole('region', { name: 'Context history', exact: true });
      await expect.poll(() => history.locator('[data-context-event]').count()).toBe(1);
      expect(await history.innerText()).toContain('not included in ordinary Session exports');
      expect(await history.locator('pre').count()).toBe(0);
      expect(await history.innerText()).toContain('Only part of the history is loaded.');
      const labels: string[] = [];
      const contents: string[] = [];
      for (let count = 0; count < before.length; count++) {
        labels.push(await history.innerText());
        expect(await history.locator('[data-context-event]').count()).toBe(1);
        await history.getByRole('button', { name: 'Show event content', exact: true }).click();
        contents.push(await history.locator('pre').innerText());
        if (await history.getByRole('button', { name: 'Older events', exact: true }).isDisabled()) break;
        const seq = await history.locator('[data-context-event]').getAttribute('data-context-event');
        await history.getByRole('button', { name: 'Older events', exact: true }).click();
        await expect.poll(() => history.locator('[data-context-event]').getAttribute('data-context-event')).not.toBe(seq);
      }
      expect(labels.join('\n')).toContain('Captured additional input');
      expect(labels.join('\n')).toContain('Final response');
      expect(contents.join('\n')).toContain('IMPLEMENTER_DONE');
      expect(contents.join('\n')).not.toContain('replayState');
      if (context === 'fresh') expect(contents.join('\n')).toContain('LARGE_CONTEXT_EVIDENCE_');
      if (context === 'fork') {
        expect(labels.join('\n')).toContain('Inherited parent history');
        expect(contents.join('\n')).toContain('Prepare the implementation.');
        expect(labels.join('\n')).toContain('compaction/summary');
        expect(contents.join('\n')).toContain('Retained compacted context evidence.');
        expect(contents.join('\n')).not.toContain('PRIVATE_COMPACTION_PROVIDER_OUTPUT');
      }
      await history.getByRole('button', { name: 'Latest events', exact: true }).click();
      expect(await history.locator('pre').count()).toBe(0);
      await panel.getByRole('button', { name: 'Hide context history', exact: true }).click();
      expect(await history.count()).toBe(0);
      await panel.getByRole('button', { name: 'Show context history', exact: true }).click();
      await expect.poll(() => history.locator('[data-context-event]').count()).toBe(1);
      if (context === 'fresh') {
        for (const mode of ['missing', 'denied'] as const) {
          await panel.getByRole('button', { name: 'Hide context history', exact: true }).click();
          fault = mode;
          await panel.getByRole('button', { name: 'Show context history', exact: true }).click();
          await expect.poll(() => history.innerText()).toContain(mode === 'missing' ? 'does not confirm deletion' : 'Access to this history was denied');
          expect(await history.innerText()).not.toContain('This Session was deleted.');
          fault = 'none';
          await history.getByRole('button', { name: 'Retry history', exact: true }).click();
          await expect.poll(() => history.locator('[data-context-event]').count()).toBe(1);
        }
        const readyBefore = readyFrames;
        const baselineBefore = childBaselines;
        const socket = sockets.at(-1)!;
        await Promise.all([socket.client.close({ code: 1012, reason: 'context history recovery' }), socket.server.close({ code: 1012, reason: 'context history recovery' })]);
        await expect.poll(() => readyFrames).toBeGreaterThan(readyBefore);
        await expect.poll(() => childBaselines).toBeGreaterThan(baselineBefore);
        await expect.poll(() => history.locator('[data-context-event]').count()).toBe(1);
        await panel.getByRole('button', { name: 'Hide context history', exact: true }).click();
        fault = 'hold';
        await panel.getByRole('button', { name: 'Show context history', exact: true }).click();
        await expect.poll(() => held).toBeDefined();
        expect(await history.innerText()).toContain('Loading history');
        await panel.getByRole('button', { name: 'Hide context history', exact: true }).click();
        await page.getByRole('tab', { name: 'Trajectory', exact: true }).click();
        held!(); held = undefined;
        await page.getByRole('tab', { name: 'Agents', exact: true }).click();
        expect(await history.count()).toBe(0);
        await panel.getByRole('button', { name: 'Show context history', exact: true }).click();
        await expect.poll(() => history.locator('[data-context-event]').count()).toBe(1);
      }
      if (context === 'fork') await page.screenshot({ path: '/tmp/studio-context-history.png', fullPage: true });
      await panel.getByRole('button', { name: 'Open implementer', exact: true }).click();
      await page.locator(`[data-conversation-session="${row.childId}"]`).waitFor();
      await page.getByRole('tab', { name: 'Agents', exact: true }).click();
      await panel.getByRole('button', { name: 'Open orchestrator', exact: true }).click();
      await page.locator(`[data-conversation-session="${parent.id}"]`).waitFor();
      expect(await readPersistedEvents(scaffold, row.childId)).toEqual(before);
      expect(await ctx.subagents.listChildren(parent.id)).toHaveLength(1);
    } catch (error) { console.error('Browser primary failure', error); throw error; } finally { await scaffold.close(); }
  } finally { await browser.close(); }
});
