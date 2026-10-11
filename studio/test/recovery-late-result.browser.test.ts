/** A completed native activation can deliver its result after Studio records stop intent. */
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import { ToolCallId, createUserMessage } from '@deepseek-ai/dsh-llm'
import { launchWebScaffold } from '@studio-test/scaffold'

const studio = fileURLToPath(new URL('..', import.meta.url))

it('preserves a completed initial result delivered after stop intent instead of relabeling it canceled', async () => {
  const scaffold = await launchWebScaffold({
    extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`,
    extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`),
    replayFixture: `${studio}/test/fixtures/delegation/session.v4.jsonl`,
    replayChildFixtures: [`${studio}/test/fixtures/delegation/session.1.v4.jsonl`], compareReplaySession: false,
  })
  const release = Promise.withResolvers<void>()
  let offEvent = () => {}
  let offFlush = () => {}
  let stopping: Promise<unknown> | undefined
  try {
    const ctx = scaffold.ctx
    const settings = { instructions: 'Retain completed results during stop.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' }
    const current = ctx.studioRoles.describe()
    await ctx.studioRoles.apply({ expectedProcessId: current.processId, expectedRevision: current.revision, expectedSnapshotId: current.snapshotId, roles: { implementer: settings, reviewer: settings } })
    const parent = await ctx.agents.create({ sessionId: SessionId('late-result-root'), meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' }, agentOptions: settings, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) })
    try {
      parent.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Prepare.' }], source: { kind: 'user' } }))
      await parent.agent.whenIdle()
      const execute = (args: Record<string, unknown>) => ctx.tools.execute({ agent: parent.agent, signal: new AbortController().signal, callId: ToolCallId('late-result'), name: 'studio_delegate', arguments: args })
      let nativeCompleted = false
      let flushing = false
      offEvent = ctx.on('session/event', (session, event) => {
        if (session.header.parentSession === parent.agent.id && event.type === 'turn/end' && event.data.reason.kind === 'completed') nativeCompleted = true
      })
      offFlush = ctx.on('session/flush', async session => {
        if (session.header.parentSession !== parent.agent.id || !nativeCompleted) return
        flushing = true
        await release.promise
      })
      expect((await execute({ action: 'initial', role: 'implementer', prompt: 'Complete before the result receipt is released.' })).isError).toBe(false)
      await expect.poll(() => flushing).toBe(true)
      const before = ctx.studioRoles.agents(parent.agent.id)[0]!
      expect(before).toMatchObject({ state: 'running', output: null, reworkCount: 0 })
      expect(nativeCompleted).toBe(true)
      let stopSettled = false
      const stopResult = execute({ action: 'stop', cycleId: before.cycleId }).then(response => { stopSettled = true; return response })
      stopping = stopResult
      await expect.poll(() => ctx.studioRoles.agents(parent.agent.id)[0]).toMatchObject({ state: 'running', stop: { status: 'requested' } })
      expect(stopSettled).toBe(false)
      release.resolve()
      expect((await stopResult).isError).toBe(false)
      const after = ctx.studioRoles.agents(parent.agent.id)[0]!
      expect(after).toMatchObject({ childId: before.childId, operationId: before.operationId, messageId: before.messageId, state: 'completed', output: 'IMPLEMENTER_DONE', reworkCount: 0, stop: { status: 'confirmed' } })
      expect(after.cycleCompletedAt).toBeUndefined()
      expect((await execute({ action: 'initial', role: 'implementer', prompt: 'No replacement.' })).isError).toBe(true)
      expect(await ctx.subagents.listChildren(parent.agent.id)).toHaveLength(1)
      await ctx.sessionPersistence.flush()
      await using stored = await ctx.sessionPersistence.open(after.childId, 'read')
      const { events } = await stored.read()
      expect(events.filter(event => event.type === 'turn/end').map(event => event.data.reason.kind)).toEqual(['completed'])
      expect(events.filter(event => event.type === 'agent/inbox/spliced').flatMap(event => event.data.inserted).map(message => message.id)).toEqual([before.messageId])
    } finally { release.resolve(); await stopping; offEvent(); offFlush(); await parent.dispose() }
  } finally { release.resolve(); await scaffold.close() }
})
