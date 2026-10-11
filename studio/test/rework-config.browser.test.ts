/** Operator limits through the actual Loader; reopening preserves data, not live authority. */
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';
import { SessionId } from '@deepseek-ai/dsh-session';
import { ToolCallId, createUserMessage } from '@deepseek-ai/dsh-llm';
import { launchWebScaffold, readPersistedEvents } from '@studio-test/scaffold';
import type {} from '../packages/roles/src/roles-remote.ts';
const studio = fileURLToPath(new URL('..', import.meta.url));
it('rejects every postinitial wake at cap zero and freezes old limits when the Loader configuration changes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'studio-rework-config-'));
  expect(resolve(directory)).toBe(directory);
  try {
    const patch = join(directory, 'cap.patch.yml');
    await writeFile(patch, '- id: local-dsh-studio-roles\n  config:\n    reworkCap: 0\n');
    const scaffold = await launchWebScaffold({ extraOverlayPath: [`${studio}/packages/bundle/cordis.patch.yml`, patch], extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`), replayFixture: `${studio}/test/fixtures/delegation/session.v4.jsonl`, replayChildFixtures: [`${studio}/test/fixtures/delegation/session.1.v4.jsonl`, `${studio}/test/fixtures/delegation/rework-once.v4.jsonl`], compareReplaySession: false });
    try {
      const ctx = scaffold.ctx;
      const settings = { instructions: 'Frozen role settings.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' };
      const state = ctx.studioRoles.describe();
      await ctx.studioRoles.apply({ expectedProcessId: state.processId, expectedRevision: state.revision, expectedSnapshotId: state.snapshotId, roles: { implementer: settings, reviewer: settings } });
      const handle = await ctx.agents.create({ sessionId: SessionId('config-cap-root'), agentOptions: { provider: settings.provider, model: settings.model }, meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' }, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) });
      try {
        handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Prepare.' }], source: { kind: 'user' } }));
        await handle.agent.whenIdle();
        const execute = (args: Record<string, unknown>) => ctx.tools.execute({ agent: handle.agent, signal: new AbortController().signal, callId: ToolCallId('operator-cap'), name: 'studio_delegate', arguments: args });
        expect((await execute({ action: 'initial', role: 'implementer', prompt: 'Implement at cap zero.' })).isError).toBe(false);
        await expect.poll(() => ctx.studioRoles.agents(handle.agent.id)[0]?.cyclePhase).toBe('review-ready');
        const original = ctx.studioRoles.agents(handle.agent.id)[0]!;
        expect(original).toMatchObject({ reworkCount: 0, reworkCap: 0, state: 'completed' });
        const events = await readPersistedEvents(scaffold, original.childId);
        let activations = 0;
        const off = ctx.on('agent/created', ({ agent }) => { if (agent.id === original.childId) activations++; });
        try {
          const result = await execute({ action: 'rework', cycleId: original.cycleId, prompt: 'Verification only.' });
          expect(result.isError).toBe(true);
          expect(JSON.stringify(result)).toContain('studio-rework-cap-or-conflict');
          expect(ctx.studioRoles.agents(handle.agent.id)).toEqual([original]);
          expect(await readPersistedEvents(scaffold, original.childId)).toEqual(events);
          expect(activations).toBe(0);
        } finally { off(); }
        const entry = [...ctx.loader.entries()].find(item => item.options.name === '@local/dsh-studio-roles');
        if (!entry?.fiber) throw new Error('Missing Studio Loader entry');
        await entry.fiber.dispose();
        await ctx.loader.create({ name: pathToFileURL(`${studio}/packages/roles/index.js`).href, config: { reworkCap: 3 } });
        await ctx.loader.await();
        for (const item of ctx.loader.entries()) await item.fiber?.await();
        expect(ctx.studioRoles.agents(handle.agent.id)).toEqual([original]);
        expect((await execute({ action: 'rework', cycleId: original.cycleId, prompt: 'Do not restore old execution authority.' })).isError).toBe(true);
        expect(ctx.studioRoles.agents(handle.agent.id)).toEqual([original]);
        const laterRoot = await ctx.agents.create({ sessionId: SessionId('changed-config-root'), agentOptions: { provider: settings.provider, model: settings.model }, meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' }, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) });
        try {
          const receipt = await ctx.tools.execute({ agent: laterRoot.agent, signal: new AbortController().signal, callId: ToolCallId('changed-operator-cap'), name: 'studio_delegate', arguments: { action: 'initial', role: 'implementer', prompt: 'Independent cycle after operator change.' } });
          expect(receipt.isError, JSON.stringify(receipt)).toBe(false);
          await expect.poll(() => ctx.studioRoles.agents(laterRoot.agent.id)[0]?.cyclePhase).toBe('review-ready');
          const rows = ctx.studioRoles.agents(laterRoot.agent.id);
          expect(rows).toHaveLength(1);
          const later = rows[0]!;
          expect(later).toMatchObject({ reworkCap: 3, reworkCount: 0, state: 'completed', settings });
          expect(later.childId).not.toBe(original.childId);
          expect(later.cycleId).not.toBe(original.cycleId);
          const reworked = await ctx.tools.execute({ agent: laterRoot.agent, signal: new AbortController().signal, callId: ToolCallId('independent-count'), name: 'studio_delegate', arguments: { action: 'rework', cycleId: later.cycleId, prompt: 'Count only this cycle verification.' } });
          expect(reworked.isError, JSON.stringify(reworked)).toBe(false);
          await expect.poll(() => ctx.studioRoles.agents(laterRoot.agent.id)[0]?.cyclePhase).toBe('review-ready');
          expect(ctx.studioRoles.agents(laterRoot.agent.id)[0]).toMatchObject({ childId: later.childId, cycleId: later.cycleId, reworkCount: 1, reworkCap: 3 });
          expect(ctx.studioRoles.agents(handle.agent.id)).toEqual([original]);
          expect(await readPersistedEvents(scaffold, original.childId)).toEqual(events);
        } finally { await laterRoot.dispose(); }
      } finally { await handle.dispose(); }
    } catch (error) { console.error('REWORK_CONFIG_SCENARIO', error); throw error; } finally { await scaffold.close(); }
  } finally {
    expect(resolve(directory)).toBe(directory);
    expect(directory.startsWith(join(tmpdir(), 'studio-rework-config-'))).toBe(true);
    await rm(directory, { recursive: true, force: true });
  }
});
