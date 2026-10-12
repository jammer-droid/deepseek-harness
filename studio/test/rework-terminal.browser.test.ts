/** Accepted rework faults and live shutdown through the public request waterfall. */
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { SessionId } from '@deepseek-ai/dsh-session';
import { ToolCallId, createUserMessage } from '@deepseek-ai/dsh-llm';
import { launchWebScaffold, readPersistedEvents } from '@studio-test/scaffold';
import { delegationSpec } from '../packages/roles/src/delegation-store.ts';
const studio = fileURLToPath(new URL('..', import.meta.url));
it.each(['error', 'shutdown'] as const)('retains counted accepted rework and terminal details after %s', async mode => {
  const scaffold = await launchWebScaffold({ extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`, extraInstallAnchors: ['bundle', 'shell', 'roles'].map(name => `${studio}/packages/${name}/package.json`), replayFixture: `${studio}/test/fixtures/delegation/session.v4.jsonl`, replayChildFixtures: [`${studio}/test/fixtures/delegation/session.1.v4.jsonl`], compareReplaySession: false });
  const release = Promise.withResolvers<void>();
  let off = () => {};
  try {
    const ctx = scaffold.ctx;
    const settings = { instructions: 'Fixed implementer.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' };
    const current = ctx.studioRoles.describe();
    await ctx.studioRoles.apply({ expectedProcessId: current.processId, expectedRevision: current.revision, expectedSnapshotId: current.snapshotId, roles: { implementer: settings, reviewer: settings } });
    const handle = await ctx.agents.create({ sessionId: SessionId(`terminal-${mode}`), agentOptions: { provider: settings.provider, model: settings.model }, meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' }, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) });
    try {
      handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Prepare.' }], source: { kind: 'user' } }));
      await handle.agent.whenIdle();
      const execute = (args: Record<string, unknown>) => ctx.tools.execute({ agent: handle.agent, signal: new AbortController().signal, callId: ToolCallId('terminal'), name: 'studio_delegate', arguments: args });
      expect((await execute({ action: 'initial', role: 'implementer', prompt: 'Implement.' })).isError).toBe(false);
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id)[0]?.cyclePhase).toBe('review-ready');
      const original = ctx.studioRoles.agents(handle.agent.id)[0]!;
      const entered = Promise.withResolvers<void>();
      const canceled = Promise.withResolvers<void>();
      let exited = false;
      off = ctx.on('agent/request', async (payload, next) => {
        const config = await next();
        if (payload.agent.id !== original.childId) return config;
        entered.resolve();
        if (mode === 'error') throw new Error('accepted-rework-request-fault');
        payload.signal.addEventListener('abort', () => canceled.resolve(), { once: true });
        if (payload.signal.aborted) canceled.resolve();
        try { await release.promise; return config; } finally { exited = true; }
      });
      expect((await execute({ action: 'rework', cycleId: original.cycleId, prompt: 'Count this verification.' })).isError).toBe(false);
      await entered.promise;
      if (mode === 'shutdown') {
        expect(ctx.studioRoles.agents(handle.agent.id)[0]).toMatchObject({ reworkCount: 1, state: 'running' });
        const entry = [...ctx.loader.entries()].find(item => item.options.name === '@local/dsh-studio-roles');
        if (!entry?.fiber) throw new Error('Missing Studio Loader entry');
        let disposed = false;
        const disposal = entry.fiber.dispose().then(() => { disposed = true; });
        await canceled.promise;
        expect(exited).toBe(false);
        expect(disposed).toBe(false);
        release.resolve();
        await disposal;
        expect(exited).toBe(true);
        const events = await readPersistedEvents(scaffold, original.childId);
        const terminal = events.filter(event => event.type === 'turn/end').at(-1)!;
        if (terminal.type !== 'turn/end') throw new Error('Missing canceled terminal event');
        expect(terminal.data.reason.kind).toBe('aborted');
        expect(JSON.stringify(terminal.data.reason)).toContain('parent');
        const reopened = await ctx.storageDomain.open(delegationSpec);
        try { expect(reopened.table('children').get(original.childId)).toMatchObject({ reworkCount: 1, cyclePhase: 'unknown' }); } finally { await reopened.close(); }
      } else {
        await expect.poll(() => ctx.studioRoles.agents(handle.agent.id)[0]?.state).toBe('failed');
        const row = ctx.studioRoles.agents(handle.agent.id)[0]!;
        expect(row).toMatchObject({ reworkCount: 1, cyclePhase: 'unknown' });
        expect(row.diagnostic).toContain('accepted-rework-request-fault');
        const events = await readPersistedEvents(scaffold, original.childId);
        const ends = events.filter(event => event.type === 'turn/end');
        const terminal = ends.at(-1)!;
        if (terminal.type !== 'turn/end') throw new Error('Missing terminal event');
        expect(terminal.data.reason.kind).toBe('error');
        expect(row.diagnostic).toBe(`studio-operation-error: ${JSON.stringify(terminal.data.reason)}`);
        expect((await execute({ action: 'rework', cycleId: original.cycleId, prompt: 'Do not refund failure.' })).isError).toBe(true);
        expect(ctx.studioRoles.agents(handle.agent.id)[0]?.reworkCount).toBe(1);
      }
    } finally { release.resolve(); off(); await handle.dispose(); }
  } catch (error) { console.error('REWORK_TERMINAL_SCENARIO', error); throw error; } finally { release.resolve(); await scaffold.close(); }
});
