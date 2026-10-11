/** Real predecessor Loader writes are reopened by the current plugin without execution authority. */
import { fileURLToPath, pathToFileURL } from 'node:url'
import { expect, it } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import { ToolCallId, createUserMessage } from '@deepseek-ai/dsh-llm'
import { launchWebScaffold } from '@studio-test/scaffold'
import type {} from '../packages/roles/src/roles-remote.ts'
const studio = fileURLToPath(new URL('..', import.meta.url))
const predecessor = process.env.DSH_TEST_PREDECESSOR_STUDIO
it.skipIf(!predecessor)('reopens exact predecessor Loader sidecars with unchanged identities and captured settings', async () => {
  if (!predecessor) throw new Error('Set DSH_TEST_PREDECESSOR_STUDIO to the built ticket8 Studio directory')
  const scaffold = await launchWebScaffold({ extraOverlayPath: `${predecessor}/packages/bundle/cordis.patch.yml`, extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${predecessor}/packages/${name}/package.json`), replayFixture: `${studio}/test/fixtures/delegation/session.v4.jsonl`, replayChildFixtures: [`${studio}/test/fixtures/delegation/session.1.v4.jsonl`], compareReplaySession: false })
  try {
    const ctx = scaffold.ctx
    const current = ctx.studioRoles.describe()
    const settings = { instructions: 'Predecessor capture must remain unchanged.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' }
    await ctx.studioRoles.apply({ expectedProcessId: current.processId, expectedRevision: current.revision, expectedSnapshotId: current.snapshotId, roles: { implementer: settings, reviewer: settings } })
    const handle = await ctx.agents.create({ sessionId: SessionId('predecessor-parent'), meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' }, agentOptions: { provider: settings.provider, model: settings.model }, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) })
    let rows
    try {
      handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Prepare.' }], source: { kind: 'user' } }))
      await handle.agent.whenIdle()
      const result = await ctx.tools.execute({ agent: handle.agent, signal: new AbortController().signal, callId: ToolCallId('predecessor-initial'), name: 'studio_delegate', arguments: { action: 'initial', role: 'implementer', prompt: 'Predecessor implementation.' } })
      expect(result.isError).toBe(false)
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id)[0]?.state).toBe('completed')
      rows = ctx.studioRoles.agents(handle.agent.id)
      expect(rows).toHaveLength(1)
      expect(rows[0]).not.toHaveProperty('judgment')
      expect(rows[0]).not.toHaveProperty('cycleCompletedAt')
      const unsupported = await ctx.tools.execute({ agent: handle.agent, signal: new AbortController().signal, callId: ToolCallId('predecessor-review-refused'), name: 'studio_delegate', arguments: { action: 'review', cycleId: rows[0]!.cycleId, evidence: { requirements: 'Old action refusal', summary: 'Settled implementation', changedFiles: [], validations: [], failures: [], unrun: [] } } })
      expect(unsupported.isError).toBe(true)
      expect(ctx.studioRoles.agents(handle.agent.id)).toEqual(rows)
    } finally { await handle.dispose() }
    const old = [...ctx.loader.entries()].find(entry => entry.options.name === '@local/dsh-studio-roles')
    if (!old?.fiber) throw new Error('Missing predecessor Loader entry')
    await old.fiber.dispose()
    await ctx.loader.create({ name: pathToFileURL(`${studio}/packages/roles/index.js`).href })
    await ctx.loader.await()
    for (const entry of ctx.loader.entries()) await entry.fiber?.await()
    expect(ctx.studioRoles.agents(SessionId('predecessor-parent'))).toEqual(rows)
    expect(ctx.studioRoles.capture('implementer').settings).toEqual(settings)
    expect(ctx.studioRoles.agents(SessionId('predecessor-parent'))).toHaveLength(1)
  } finally { await scaffold.close() }
})
