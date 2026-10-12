/** Receipt-write uncertainty stays visible even when its fallback cannot persist. */
import { fileURLToPath, pathToFileURL } from 'node:url'
import { expect, it, vi } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import { ToolCallId, createUserMessage } from '@deepseek-ai/dsh-llm'
import { launchWebScaffold } from '@studio-test/scaffold'
const studio = fileURLToPath(new URL('..', import.meta.url))
it.each(['rework', 'review', 'settlement'] as const)('exposes unknown after %s writes and fallback fail without resending', async action => {
  const scaffold = await launchWebScaffold({ extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`, extraInstallAnchors: ['bundle', 'shell', 'roles'].map(name => `${studio}/packages/${name}/package.json`), replayFixture: `${studio}/test/fixtures/delegation/session.v4.jsonl`, replayChildFixtures: [`${studio}/test/fixtures/delegation/${action !== 'review' ? 'rework-once' : 'session.1'}.v4.jsonl`], compareReplaySession: false })
  try {
    const ctx = scaffold.ctx
    let faults = 0
    let closed = 0
    let resumed: import('@deepseek-ai/dsh-agent').Agent | undefined
    const off = ctx.on('agent/created', ({ agent, source }) => { if (source === 'resume') resumed = agent })
    const entry = [...ctx.loader.entries()].find(entry => entry.options.name === '@local/dsh-studio-roles')!
    await entry.fiber!.dispose()
    const kv = ctx.storage.backend.get('json').kv!
    const open = kv.open.bind(kv)
    vi.spyOn(kv, 'open').mockImplementation(async descriptor => {
      const unit = await open(descriptor)
      if (descriptor.name !== 'studio_delegation') return unit
      const close = unit.close.bind(unit)
      vi.spyOn(unit, 'close').mockImplementation(async () => { closed++; await close() })
      let failed = false
      const put = unit.putRecord.bind(unit)
      vi.spyOn(unit, 'putRecord').mockImplementation(async (table, key, value) => {
        if (action === 'settlement') {
          if (typeof value === 'object' && value !== null && 'reworkCount' in value && value.reworkCount === 1 && 'state' in value && value.state === 'completed') { faults++; throw new Error('test-terminal-write-failure') }
          await put(table, key, value)
          return
        }
        if (typeof value === 'object' && value !== null && (action === 'rework' ? 'reworkCount' in value && value.reworkCount === 1 && 'state' in value && value.state === 'running' : 'role' in value && value.role === 'reviewer')) failed = true
        if (failed) { faults++; throw new Error('test-receipt-and-fallback-write-failure') }
        await put(table, key, value)
      })
      return unit
    })
    await ctx.loader.create({ name: pathToFileURL(`${studio}/packages/roles/index.js`).href })
    await ctx.loader.await()
    for (const entry of ctx.loader.entries()) await entry.fiber?.await()
    const settings = { instructions: 'Fixed implementer.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' }
    const current = ctx.studioRoles.describe()
    await ctx.studioRoles.apply({ expectedProcessId: current.processId, expectedRevision: current.revision, expectedSnapshotId: current.snapshotId, roles: { implementer: settings, reviewer: settings } })
    const handle = await ctx.agents.create({ sessionId: SessionId('receipt-failure'), agentOptions: settings, meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' }, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) })
    try {
      handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Prepare.' }], source: { kind: 'user' } }))
      await handle.agent.whenIdle()
      const execute = (args: Record<string, unknown>) => ctx.tools.execute({ agent: handle.agent, signal: new AbortController().signal, callId: ToolCallId('storage-failure'), name: 'studio_delegate', arguments: args })
      expect((await execute({ action: 'initial', role: 'implementer', prompt: 'Implement.' })).isError).toBe(false)
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id)[0]?.state).toBe('completed')
      const original = ctx.studioRoles.agents(handle.agent.id)[0]!
      const args = action !== 'review' ? { action: 'rework', cycleId: original.cycleId, prompt: 'Verify.' } : { action, cycleId: original.cycleId, evidence: { requirements: 'Verify.', summary: 'Done.', changedFiles: [], validations: [], failures: [], unrun: [] } }
      const result = await execute(args)
      if (action === 'settlement') {
        expect(result.isError).toBe(false)
        await expect.poll(() => ctx.studioRoles.agents(handle.agent.id)[0]?.diagnostic).toBe('studio-settlement-unknown')
        expect(resumed).toBeDefined()
        await resumed!.whenIdle()
        expect(faults).toBe(1)
        expect(ctx.studioRoles.agents(handle.agent.id)[0]).toMatchObject({ childId: original.childId, state: 'unknown', reworkCount: 1 })
        const replacement = await execute({ action: 'initial', role: 'implementer', prompt: 'Must not bypass unresolved settlement.' })
        expect(replacement.isError).toBe(true)
        expect(JSON.stringify(replacement)).toContain('studio-admission-unknown')
        expect(ctx.studioRoles.agents(handle.agent.id)).toHaveLength(1)
        expect((await execute(args)).isError).toBe(true)
        return
      }
      expect(result.isError).toBe(true)
      expect(ctx.studioRoles.agents(handle.agent.id)[0]).toMatchObject({ childId: original.childId, state: 'unknown', reworkCount: action === 'rework' ? 1 : 0 })
      expect(faults).toBeGreaterThanOrEqual(2)
      if (action === 'rework') { expect(resumed).toBeDefined(); await resumed!.whenIdle() }
      else expect(resumed).toBeUndefined()
      expect((await execute(args)).isError).toBe(true)
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id)[0]?.state).toBe('unknown')
      const plugin = [...ctx.registry.keys()].find(plugin => plugin.name === 'StudioDelegation')!
      const runtime = ctx.registry.get(plugin)!
      await Promise.all([...runtime.fibers].map(fiber => fiber.dispose()))
      expect(closed).toBe(1)
      expect(faults).toBeGreaterThanOrEqual(action === 'rework' ? 3 : 2)
    } finally { off(); await handle.dispose() }
  } finally { try { await scaffold.close() } finally { vi.restoreAllMocks() } }
})
