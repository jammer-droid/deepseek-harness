/** Stop reaches an admitted creation before its queued input can be published. */
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import { ToolCallId, createUserMessage } from '@deepseek-ai/dsh-llm'
import { launchWebScaffold } from '@studio-test/scaffold'

const studio = fileURLToPath(new URL('..', import.meta.url))

it('aborts a pending same-child admission before waiting for its creation listener to finish', async () => {
  const scaffold = await launchWebScaffold({
    extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`,
    extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`),
    replayFixture: `${studio}/test/fixtures/delegation/session.v4.jsonl`,
    replayChildFixtures: [`${studio}/test/fixtures/delegation/session.1.v4.jsonl`], compareReplaySession: false,
  })
  const release = Promise.withResolvers<void>()
  const caller = new AbortController()
  let offCreation = () => {}
  let offRequest = () => {}
  let admission: Promise<unknown> | undefined
  let stopping: Promise<unknown> | undefined
  try {
    const ctx = scaffold.ctx
    const settings = { instructions: 'Stop pending admission without replacing it.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' }
    const current = ctx.studioRoles.describe()
    await ctx.studioRoles.apply({ expectedProcessId: current.processId, expectedRevision: current.revision, expectedSnapshotId: current.snapshotId, roles: { implementer: settings, reviewer: settings } })
    const parent = await ctx.agents.create({ sessionId: SessionId('stop-admission-root'), meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' }, agentOptions: settings, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) })
    try {
      parent.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Prepare.' }], source: { kind: 'user' } }))
      await parent.agent.whenIdle()
      const execute = (args: Record<string, unknown>, signal = new AbortController().signal) => ctx.tools.execute({ agent: parent.agent, signal, callId: ToolCallId('stop-admission'), name: 'studio_delegate', arguments: args })
      expect((await execute({ action: 'initial', role: 'implementer', prompt: 'Implement.' })).isError).toBe(false)
      await expect.poll(() => ctx.studioRoles.agents(parent.agent.id)[0]?.state).toBe('completed')
      const original = ctx.studioRoles.agents(parent.agent.id)[0]!
      await expect.poll(() => ctx.agents.get(original.childId)).toBeUndefined()
      let creationEntered = false
      let aborted = false
      let requests = 0
      offCreation = ctx.on('agent/created', async ({ agent, source, signal }) => {
        if (agent.id !== original.childId || source !== 'resume') return
        expect(signal).toBeDefined()
        signal!.addEventListener('abort', () => { aborted = true }, { once: true })
        if (signal!.aborted) aborted = true
        creationEntered = true
        await release.promise
      })
      offRequest = ctx.on('agent/request', async (payload, next) => {
        if (payload.agent.id === original.childId) requests++
        return next()
      })
      const rework = execute({ action: 'rework', cycleId: original.cycleId, prompt: 'Do not reach inbox acceptance.' }, caller.signal)
      admission = rework
      await expect.poll(() => creationEntered).toBe(true)
      let stopSettled = false
      const stopResult = execute({ action: 'stop', cycleId: original.cycleId }).then(response => { stopSettled = true; return response })
      stopping = stopResult
      await expect.poll(() => ctx.studioRoles.agents(parent.agent.id)[0]?.stop?.status).toBe('requested')
      await expect.poll(() => aborted, { timeout: 5_000 }).toBe(true)
      expect(stopSettled).toBe(false)
      expect(requests).toBe(0)
      release.resolve()
      const [reworkResponse, stopResponse] = await Promise.all([rework, stopResult])
      expect(reworkResponse.isError).toBe(true)
      expect(stopResponse.isError, JSON.stringify(stopResponse)).toBe(false)
      expect(requests).toBe(0)
      expect(ctx.studioRoles.agents(parent.agent.id)[0]).toMatchObject({ childId: original.childId, reworkCount: 1, state: 'unknown', messageId: null, stop: { status: 'unknown' } })
      expect(ctx.agents.get(original.childId)).toBeUndefined()
      await ctx.sessionPersistence.flush()
      await using stored = await ctx.sessionPersistence.open(original.childId, 'read')
      const { events } = await stored.read()
      const messages = events.filter(event => event.type === 'agent/inbox/spliced').flatMap(event => event.data.inserted)
      expect(messages.map(message => message.id)).toEqual([original.messageId])
      expect((await execute({ action: 'rework', cycleId: original.cycleId, prompt: 'No retry.' })).isError).toBe(true)
      expect(await ctx.subagents.listChildren(parent.agent.id)).toHaveLength(1)
    } finally {
      caller.abort()
      release.resolve()
      await Promise.allSettled([admission, stopping])
      offCreation()
      offRequest()
      await parent.dispose()
    }
  } finally { release.resolve(); await scaffold.close() }
})
