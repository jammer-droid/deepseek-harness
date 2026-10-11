/** A failed stop-intent write must not leave accepted child execution running. */
import { fileURLToPath, pathToFileURL } from 'node:url'
import { expect, it, vi } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import { ToolCallId, createUserMessage } from '@deepseek-ai/dsh-llm'
import { launchWebScaffold } from '@studio-test/scaffold'

const studio = fileURLToPath(new URL('..', import.meta.url))

it('drains accepted work even when persisting the stop request fails', async () => {
  const scaffold = await launchWebScaffold({
    extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`,
    extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`),
    replayFixture: `${studio}/test/fixtures/delegation/session.v4.jsonl`,
    replayChildFixtures: [`${studio}/test/fixtures/delegation/session.1.v4.jsonl`], compareReplaySession: false,
  })
  const release = Promise.withResolvers<void>()
  const entered = Promise.withResolvers<void>()
  let off = () => {}
  let restoreStorage = () => {}
  let stopping: Promise<unknown> | undefined
  try {
    const ctx = scaffold.ctx
    const owner = [...ctx.loader.entries()].find(entry => entry.options.name === '@local/dsh-studio-roles')!
    await owner.fiber!.dispose()
    const kv = ctx.storage.backend.get('json').kv!
    const open = kv.open.bind(kv)
    let faults = 0
    const openSpy = vi.spyOn(kv, 'open').mockImplementation(async descriptor => {
      const unit = await open(descriptor)
      if (descriptor.name !== 'studio_delegation') return unit
      const put = unit.putRecord.bind(unit)
      vi.spyOn(unit, 'putRecord').mockImplementation(async (table, key, value) => {
        if (typeof value === 'object' && value !== null && 'stop' in value && typeof value.stop === 'object' && value.stop !== null && 'status' in value.stop && value.stop.status === 'requested') {
          faults++
          throw new Error('test-stop-request-storage-failed')
        }
        await put(table, key, value)
      })
      return unit
    })
    restoreStorage = () => openSpy.mockRestore()
    const entryId = await ctx.loader.create({ name: pathToFileURL(`${studio}/packages/roles/index.js`).href })
    await ctx.loader.await()
    await ctx.loader.resolve(entryId).fiber!.await()
    const settings = { instructions: 'Preserve the stopped operation.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' }
    const current = ctx.studioRoles.describe()
    await ctx.studioRoles.apply({ expectedProcessId: current.processId, expectedRevision: current.revision, expectedSnapshotId: current.snapshotId, roles: { implementer: settings, reviewer: settings } })
    const parent = await ctx.agents.create({ sessionId: SessionId('stop-storage-root'), meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' }, agentOptions: settings, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) })
    try {
      parent.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Prepare.' }], source: { kind: 'user' } }))
      await parent.agent.whenIdle()
      const execute = (args: Record<string, unknown>) => ctx.tools.execute({ agent: parent.agent, signal: new AbortController().signal, callId: ToolCallId('stop-storage'), name: 'studio_delegate', arguments: args })
      expect((await execute({ action: 'initial', role: 'implementer', prompt: 'Implement.' })).isError).toBe(false)
      await expect.poll(() => ctx.studioRoles.agents(parent.agent.id)[0]?.state).toBe('completed')
      const original = ctx.studioRoles.agents(parent.agent.id)[0]!
      let canceled = false
      off = ctx.on('agent/request', async (payload, next) => {
        const config = await next()
        if (payload.agent.id !== original.childId) return config
        entered.resolve()
        payload.signal.addEventListener('abort', () => { canceled = true }, { once: true })
        if (payload.signal.aborted) canceled = true
        await release.promise
        return config
      })
      expect((await execute({ action: 'rework', cycleId: original.cycleId, prompt: 'Accepted verification.' })).isError).toBe(false)
      await entered.promise
      const stopResult = execute({ action: 'stop', cycleId: original.cycleId })
      stopping = stopResult
      await expect.poll(() => faults).toBe(1)
      await expect.poll(() => canceled, { timeout: 5_000 }).toBe(true)
      release.resolve()
      const response = await stopResult
      expect(response.isError).toBe(true)
      expect(JSON.stringify(response)).toContain('test-stop-request-storage-failed')
      expect(ctx.studioRoles.agents(parent.agent.id)[0]).toMatchObject({ childId: original.childId, reworkCount: 1, stop: { status: 'unknown' }, state: 'unknown' })
      expect((await execute({ action: 'rework', cycleId: original.cycleId, prompt: 'Do not retry.' })).isError).toBe(true)
      expect(await ctx.subagents.listChildren(parent.agent.id)).toHaveLength(1)
    } finally { release.resolve(); off(); await parent.dispose(); await stopping }
  } finally { release.resolve(); restoreStorage(); await scaffold.close() }
})
