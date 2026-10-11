/** Public resumed-root admission preserves a completed child's identity and policy. */
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { SessionId } from '@deepseek-ai/dsh-session';
import { ToolCallId, createUserMessage } from '@deepseek-ai/dsh-llm';
import { launchWebScaffold } from '@studio-test/scaffold';
const studio = fileURLToPath(new URL('..', import.meta.url));
it('restores an owner before admitting a counted wake of its completed child', async () => {
  const scaffold = await launchWebScaffold({ extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`, extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`), replayFixture: `${studio}/test/fixtures/delegation/session.v4.jsonl`, replayChildFixtures: [`${studio}/test/fixtures/delegation/rework-once.v4.jsonl`], compareReplaySession: false });
  try {
    const ctx = scaffold.ctx;
    const settings = { instructions: 'Preserved instructions.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' };
    const current = ctx.studioRoles.describe();
    await ctx.studioRoles.apply({ expectedProcessId: current.processId, expectedRevision: current.revision, expectedSnapshotId: current.snapshotId, roles: { implementer: settings, reviewer: settings } });
    const parent = await ctx.agents.create({ sessionId: SessionId('recover-owner'), agentOptions: settings, meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' }, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) });
    parent.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Prepare.' }], source: { kind: 'user' } }));
    await parent.agent.whenIdle();
    const execute = (agent: typeof parent.agent, args: Record<string, unknown>) => ctx.tools.execute({ agent, signal: new AbortController().signal, callId: ToolCallId('recover'), name: 'studio_delegate', arguments: args });
    expect((await execute(parent.agent, { action: 'initial', role: 'implementer', prompt: 'Implement.' })).isError).toBe(false);
    await expect.poll(() => ctx.studioRoles.agents(parent.agent.id)[0]?.state).toBe('completed');
    const original = ctx.studioRoles.agents(parent.agent.id)[0]!;
    await parent.dispose();
    const resumed = await ctx.agents.resume({ resumeSessionId: parent.agent.id, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) });
    const flushing = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let completed = false;
    const offEvent = ctx.on('session/event', (session, event) => { if (session.id === original.childId && event.type === 'turn/end' && event.data.turn === 2) completed = true; });
    const off = ctx.on('session/flush', async session => {
      if (session.id !== original.childId || !completed) return;
      flushing.resolve();
      await release.promise;
    });
    try {
      const result = await execute(resumed.agent, { action: 'rework', cycleId: original.cycleId, prompt: 'Verify.' });
      expect(result.isError, JSON.stringify(result)).toBe(false);
      await expect.poll(() => ctx.studioRoles.agents(parent.agent.id)[0]?.state).toBe('completed');
      expect(ctx.studioRoles.agents(parent.agent.id)[0]).toMatchObject({ childId: original.childId, settings, snapshotId: original.snapshotId, reworkCap: 2, reworkCount: 1 });
      await flushing.promise;
      let stopped = false;
      const stop = execute(resumed.agent, { action: 'stop', cycleId: original.cycleId }).then(value => { stopped = true; return value; });
      await expect.poll(() => ctx.studioRoles.agents(parent.agent.id)[0]?.stop?.status).toBe('requested');
      expect(stopped).toBe(false);
      release.resolve();
      expect((await stop).isError).toBe(false);
      expect(ctx.studioRoles.agents(parent.agent.id)[0]).toMatchObject({ state: 'completed', stop: { status: 'confirmed' }, reworkCount: 1 });
    } finally { release.resolve(); off(); offEvent(); await resumed.dispose(); }
  } catch (error) { console.error("RECOVERY_RESUME_FAILURE", error); throw error; } finally { await scaffold.close(); }
});
