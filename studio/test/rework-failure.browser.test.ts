/** Same-ID admission uncertainty and shutdown through public native lifecycle events. */
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import { ToolCallId, createUserMessage } from '@deepseek-ai/dsh-llm'
import { launchWebScaffold } from '@studio-test/scaffold'
import { delegationSpec } from '../packages/roles/src/delegation-store.ts'
const studio = fileURLToPath(new URL('..', import.meta.url))

it.each([false, true])('keeps counted rework uncertain when resume admission fails; shutdown %s', async shutdown => {
  const scaffold = await launchWebScaffold({ extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`, extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`), replayFixture: `${studio}/test/fixtures/delegation/session.v4.jsonl`, replayChildFixtures: [`${studio}/test/fixtures/delegation/session.1.v4.jsonl`], compareReplaySession: false })
  try {
    const ctx = scaffold.ctx
    const settings = { instructions: 'Fixed implementer.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' }
    const current = ctx.studioRoles.describe()
    await ctx.studioRoles.apply({ expectedProcessId: current.processId, expectedRevision: current.revision, expectedSnapshotId: current.snapshotId, roles: { implementer: settings, reviewer: settings } })
    const handle = await ctx.agents.create({ sessionId: SessionId(`rework-failure-${shutdown}`), agentOptions: { provider: settings.provider, model: settings.model }, meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' }, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) })
    const release = Promise.withResolvers<void>()
    let off = () => {}
    try {
      handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Prepare.' }], source: { kind: 'user' } }))
      await handle.agent.whenIdle()
      const execute = (args: Record<string, unknown>) => ctx.tools.execute({ agent: handle.agent, signal: new AbortController().signal, callId: ToolCallId('failure'), name: 'studio_delegate', arguments: args })
      expect((await execute({ action: 'initial', role: 'implementer', prompt: 'Implement.' })).isError).toBe(false)
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id)[0]?.state).toBe('completed')
      const original = ctx.studioRoles.agents(handle.agent.id)[0]!
      const entered = Promise.withResolvers<void>()
      let resumes = 0
      off = ctx.on('agent/created', async ({ agent, source }) => {
        if (agent.id !== original.childId) return
        expect(source).toBe('resume')
        resumes++
        expect(ctx.studioRoles.agents(handle.agent.id)[0]).toMatchObject({ childId: original.childId, reworkCount: 1, state: 'reserved', settings })
        entered.resolve()
        if (shutdown) await release.promise
        throw new Error('test-resume-admission-failure')
      })
      const args = { action: 'rework', cycleId: original.cycleId, prompt: 'Verify.' }
      const pending = execute(args)
      await entered.promise
      if (shutdown) {
        const plugin = [...ctx.registry.keys()].find(plugin => plugin.name === 'StudioDelegation')!
        const runtime = ctx.registry.get(plugin)!
        const disposed = Promise.all([...runtime.fibers].map(fiber => fiber.dispose()))
        release.resolve()
        expect((await pending).isError).toBe(true)
        await disposed
        const domain = await ctx.storageDomain.open(delegationSpec)
        try { expect(domain.table('children').get(original.childId)).toMatchObject({ state: 'unknown', reworkCount: 1 }) } finally { await domain.close() }
      } else {
        expect((await pending).isError).toBe(true)
        expect(ctx.studioRoles.agents(handle.agent.id)[0]).toMatchObject({ state: 'unknown', reworkCount: 1 })
        expect((await execute(args)).isError).toBe(true)
        expect(resumes).toBe(1)
      }
    } catch (error) { console.error('REWORK_FAILURE_SCENARIO', error); throw error } finally { release.resolve(); off(); await handle.dispose() }
  } finally { await scaffold.close() }
})
