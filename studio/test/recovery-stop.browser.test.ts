/** Explicit Studio stop drains an accepted child request before confirming its durable outcome. */
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { SessionId } from '@deepseek-ai/dsh-session';
import { ToolCallId, createUserMessage } from '@deepseek-ai/dsh-llm';
import { launchWebScaffold, readPersistedEvents } from '@studio-test/scaffold';
import { delegationSpec } from '../packages/roles/src/delegation-store.ts';
const studio = fileURLToPath(new URL('..', import.meta.url));

it('keeps stop requested until an accepted rework request has drained', async () => {
  const scaffold = await launchWebScaffold({
    extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`,
    extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`),
    replayFixture: `${studio}/test/fixtures/delegation/session.v4.jsonl`,
    replayChildFixtures: [`${studio}/test/fixtures/delegation/session.1.v4.jsonl`], compareReplaySession: false,
  });
  const release = Promise.withResolvers<void>();
  let off = () => {};
  try {
    const ctx = scaffold.ctx;
    const settings = { instructions: 'Retain accepted rework evidence.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' };
    const current = ctx.studioRoles.describe();
    await ctx.studioRoles.apply({ expectedProcessId: current.processId, expectedRevision: current.revision, expectedSnapshotId: current.snapshotId, roles: { implementer: settings, reviewer: settings } });
    const handle = await ctx.agents.create({ sessionId: SessionId('studio-recovery-stop'), agentOptions: { provider: settings.provider, model: settings.model }, meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' }, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) });
    try {
      handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Prepare stop evidence.' }], source: { kind: 'user' } }));
      await handle.agent.whenIdle();
      const execute = (args: Record<string, unknown>) => ctx.tools.execute({ agent: handle.agent, signal: new AbortController().signal, callId: ToolCallId('recovery-stop'), name: 'studio_delegate', arguments: args });
      expect((await execute({ action: 'initial', role: 'implementer', prompt: 'Implement.' })).isError).toBe(false);
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id)[0]?.cyclePhase).toBe('review-ready');
      const initial = ctx.studioRoles.agents(handle.agent.id)[0]!;
      const entered = Promise.withResolvers<void>();
      const canceled = Promise.withResolvers<void>();
      let exited = false;
      off = ctx.on('agent/request', async (payload, next) => {
        const config = await next();
        if (payload.agent.id !== initial.childId) return config;
        entered.resolve();
        payload.signal.addEventListener('abort', () => canceled.resolve(), { once: true });
        if (payload.signal.aborted) canceled.resolve();
        try { await release.promise; return config; } finally { exited = true; }
      });
      expect((await execute({ action: 'rework', cycleId: initial.cycleId, prompt: 'Accepted verification.' })).isError).toBe(false);
      await entered.promise;
      let stopSettled = false;
      const stopping = execute({ action: 'stop', cycleId: initial.cycleId }).then(result => { stopSettled = true; return result; });
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id)[0]).toMatchObject({ reworkCount: 1, stop: { status: 'requested', requestedAt: expect.any(Number) } });
      await canceled.promise;
      expect(exited).toBe(false);
      expect(stopSettled).toBe(false);
      const refused = [
        { action: 'initial', role: 'implementer', prompt: 'Do not create a replacement.' },
        { action: 'rework', cycleId: initial.cycleId, prompt: 'Do not retry.' },
        { action: 'review', cycleId: initial.cycleId, evidence: { requirements: 'Stopped cycle', summary: 'No review admission', changedFiles: [], validations: [], failures: [], unrun: [] } },
        { action: 'complete', cycleId: initial.cycleId },
      ];
      for (const request of refused) expect((await execute(request)).isError).toBe(true);
      expect(await ctx.subagents.listChildren(handle.agent.id)).toHaveLength(1);
      release.resolve();
      const result = await stopping;
      expect(result.isError, JSON.stringify(result)).toBe(false);
      expect(exited).toBe(true);
      expect(ctx.studioRoles.agents(handle.agent.id)[0]).toMatchObject({ childId: initial.childId, reworkCount: 1, state: 'interrupted', stop: { status: 'confirmed' } });
      const events = await readPersistedEvents(scaffold, initial.childId);
      const terminal = events.findLast(event => event.type === 'turn/end');
      expect(terminal?.type === 'turn/end' && terminal.data.reason.kind).toBe('aborted');
      for (const request of refused) expect((await execute(request)).isError).toBe(true);
      expect((await execute({ action: 'status' })).isError).toBe(false);
      expect(await readPersistedEvents(scaffold, initial.childId)).toEqual(events);
      const entry = [...ctx.loader.entries()].find(item => item.options.name === '@local/dsh-studio-roles');
      if (!entry?.fiber) throw new Error('Missing Studio roles entry');
      await entry.fiber.dispose();
      const reopened = await ctx.storageDomain.open(delegationSpec);
      try {
        expect(reopened.table('children').get(initial.childId)).toMatchObject({ reworkCount: 1, state: 'interrupted', stop: { status: 'confirmed', requestedAt: expect.any(Number) } });
      } finally { await reopened.close(); }
    } finally { release.resolve(); off(); await handle.dispose(); }
  } finally { release.resolve(); await scaffold.close(); }
});
