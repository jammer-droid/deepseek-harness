/** Same-ID counted operations through the shipped Loader and native executor. */
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import { ToolCallId, ReasoningEffortId, createUserMessage } from '@deepseek-ai/dsh-llm'
import { launchWebScaffold } from '@studio-test/scaffold'
const studio = fileURLToPath(new URL('..', import.meta.url))
const evidence = { requirements: 'Required behavior', summary: 'Changes made', changedFiles: ['example.ts'], validations: [], failures: [], unrun: ['verification'] }

it('counts a verification-only wake after natural unload without replacing its child or settings', async () => {
  const scaffold = await launchWebScaffold({ extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`, extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`), replayFixture: `${studio}/test/fixtures/delegation/session.v4.jsonl`, replayChildFixtures: [`${studio}/test/fixtures/delegation/rework-implementer.v4.jsonl`, `${studio}/test/fixtures/delegation/rework-reviewer.v4.jsonl`], compareReplaySession: false })
  try {
    const ctx = scaffold.ctx
    const settings = { instructions: 'Original implementer instructions.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' }
    const current = ctx.studioRoles.describe()
    await ctx.studioRoles.apply({ expectedProcessId: current.processId, expectedRevision: current.revision, expectedSnapshotId: current.snapshotId, roles: { implementer: settings, reviewer: settings } })
    const handle = await ctx.agents.create({ sessionId: SessionId('rework-root'), agentOptions: { provider: settings.provider, model: settings.model, reasoningEffort: ReasoningEffortId('max') }, meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' }, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) })
    try {
      handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Prepare.' }], source: { kind: 'user' } }))
      await handle.agent.whenIdle()
      const execute = (args: Record<string, unknown>) => ctx.tools.execute({ agent: handle.agent, signal: new AbortController().signal, callId: ToolCallId('rework'), name: 'studio_delegate', arguments: args })
      expect((await execute({ action: 'initial', role: 'implementer', prompt: 'Implement.' })).isError).toBe(false)
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id)[0]?.state).toBe('completed')
      const original = ctx.studioRoles.agents(handle.agent.id)[0]!
      expect(original.reworkCount).toBe(0)
      expect((await execute({ action: 'review', cycleId: original.cycleId, evidence })).isError).toBe(false)
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id).find(row => row.role === 'reviewer')?.state).toBe('completed')
      const applied = ctx.studioRoles.describe()
      await ctx.studioRoles.apply({ expectedProcessId: applied.processId, expectedRevision: applied.revision, expectedSnapshotId: applied.snapshotId, roles: { implementer: { ...settings, instructions: 'New instructions must not replace existing child.' }, reviewer: settings } })
      let resumed = false
      let liveImplementer: import('@deepseek-ai/dsh-agent').Agent | undefined
      let implementerCreations = 0
      const releaseImplementerFlush = Promise.withResolvers<void>()
      const implementerFlushing = Promise.withResolvers<void>()
      const offImplementerFlush = ctx.on('session/flush', async session => {
        if (session.id !== original.childId || !session.snapshotEvents().some(event => event.type === 'turn/end' && event.data.turn === 2)) return
        implementerFlushing.resolve()
        await releaseImplementerFlush.promise
      })
      const off = ctx.on('agent/created', ({ agent, source }) => { if (agent.id === original.childId) { expect(source).toBe('resume'); resumed = true; liveImplementer = agent; implementerCreations++ } })
      try {
        const simultaneous = await Promise.all([
          execute({ action: 'rework', cycleId: original.cycleId, prompt: 'Run verification only.' }),
          execute({ action: 'rework', cycleId: original.cycleId, prompt: 'Duplicate must not send.' }),
        ])
        expect(simultaneous[0]?.isError, JSON.stringify(simultaneous)).toBe(false)
        expect(simultaneous[1]?.isError).toBe(true)
        await expect.poll(() => ctx.studioRoles.agents(handle.agent.id)[0]?.state).toBe('completed')
        expect(resumed).toBe(true)
        const updated = ctx.studioRoles.agents(handle.agent.id)[0]!
        expect(updated.childId).toBe(original.childId)
        expect(updated.settings).toEqual(original.settings)
        expect(updated.snapshotId).toBe(original.snapshotId)
        expect(updated.reworkCount).toBe(1)
        expect(updated.reworkCap).toBe(2)
        expect(updated.output).toBe('VERIFICATION_DONE')
        expect(ctx.studioRoles.agents(handle.agent.id)).toHaveLength(2)
        await implementerFlushing.promise
        const residentImplementer = liveImplementer
        expect(residentImplementer).toBeDefined()
        const denied = await ctx.tools.execute({ agent: residentImplementer!, signal: new AbortController().signal, callId: ToolCallId('resumed-implementer-denied'), name: 'studio_delegate', arguments: { action: 'initial', role: 'implementer', prompt: 'Nested delegation forbidden.' } })
        expect(denied.isError).toBe(true)
        const events = residentImplementer!.session.snapshotEvents()
        expect(events.filter(event => event.type === 'request/header')).toHaveLength(2)
        const headers = events.filter(event => event.type === 'request/header')
        for (const header of headers) if (header.type === 'request/header') {
          expect(header.data.header.config.provider).toBe(settings.provider)
          expect(header.data.header.config.model).toBe(settings.model)
          expect(header.data.header.config.reasoningEffort).toBe('high') // Adapter default, not a later role override.
        }
        expect(JSON.stringify(events.filter(event => event.type === 'system/message'))).toContain('Original implementer instructions.')
        expect(JSON.stringify(events.filter(event => event.type === 'system/message'))).not.toContain('New instructions must not replace existing child.')
        expect((await execute({ action: 'status' })).isError).toBe(false)
        expect((await execute({ action: 'rework', cycleId: original.cycleId, prompt: 'Change context forbidden.', context: 'fork' })).isError).toBe(true)
        expect(JSON.stringify(events.filter(event => event.type === 'user/message'))).toContain('Run verification only.')
        expect((await execute({ action: 'complete', cycleId: original.cycleId })).isError).toBe(true)
        const priorReview = ctx.studioRoles.agents(handle.agent.id).find(row => row.role === 'reviewer')!
        const releaseReviewFlush = Promise.withResolvers<void>()
        const reviewFlushing = Promise.withResolvers<void>()
        let liveReviewer: import('@deepseek-ai/dsh-agent').Agent | undefined
        let reviewerCreations = 0
        const offReviewer = ctx.on('agent/created', ({ agent }) => { if (agent.id === priorReview.childId) { liveReviewer = agent; reviewerCreations++ } })
        const offFlush = ctx.on('session/flush', async session => {
          if (session.id !== priorReview.childId || !session.snapshotEvents().some(event => event.type === 'turn/end' && event.data.turn === 2)) return
          reviewFlushing.resolve()
          await releaseReviewFlush.promise
        })
        try {
          const rereview = await execute({ action: 'review', cycleId: original.cycleId, evidence })
          expect(rereview.isError, JSON.stringify(rereview)).toBe(false)
          await expect.poll(() => ctx.studioRoles.agents(handle.agent.id).find(row => row.role === 'reviewer')?.judgment?.judgment).toBe('pass')
          const reviewed = ctx.studioRoles.agents(handle.agent.id).find(row => row.role === 'reviewer')!
          expect(reviewed.childId).toBe(priorReview.childId)
          expect(reviewed.snapshotId).toBe(priorReview.snapshotId)
          expect(reviewed.settings).toEqual(priorReview.settings)
          expect(reviewed.operationId).not.toBe(priorReview.operationId)
          await reviewFlushing.promise
          const residentReviewer = liveReviewer
          expect(residentReviewer).toBeDefined()
          const rejectedCapture = await ctx.tools.execute({ agent: residentReviewer!, signal: new AbortController().signal, callId: ToolCallId('stale-review-submit'), name: 'studio_review_submit', arguments: { judgment: 'pass', explanation: 'Not an operation claim.', evidence: ['Existing review evidence'], additionalVerification: [] } })
          expect(rejectedCapture.isError).toBe(true)
          const reviewEvents = residentReviewer!.session.snapshotEvents()
          const reviewHeaders = reviewEvents.filter(event => event.type === 'request/header')
          expect(reviewHeaders).toHaveLength(2)
          for (const header of reviewHeaders) if (header.type === 'request/header') {
            expect(header.data.header.config.provider).toBe(settings.provider)
            expect(header.data.header.config.model).toBe(settings.model)
            expect(header.data.header.config.reasoningEffort).toBe('high')
          }
          expect(JSON.stringify(reviewEvents.filter(event => event.type === 'system/message'))).toContain(settings.instructions)
          expect(ctx.studioRoles.agents(handle.agent.id)[0]?.reworkCount).toBe(1)
          await expect.poll(() => ctx.studioRoles.agents(handle.agent.id)[0]?.cyclePhase).toBe('judged')
          const second = await execute({ action: 'rework', cycleId: original.cycleId, prompt: 'Second verification.' })
          expect(second.isError, JSON.stringify(second)).toBe(false)
          expect(liveImplementer).toBe(residentImplementer)
          expect(implementerCreations).toBe(1)
          releaseImplementerFlush.resolve()
          await expect.poll(() => ctx.studioRoles.agents(handle.agent.id)[0]?.state).toBe('completed')
          expect(ctx.studioRoles.agents(handle.agent.id)[0]?.reworkCount).toBe(2)
          expect((await execute({ action: 'complete', cycleId: original.cycleId })).isError).toBe(true)
          expect((await execute({ action: 'rework', cycleId: original.cycleId, prompt: 'Third forbidden wake.' })).isError).toBe(true)
          expect(ctx.studioRoles.agents(handle.agent.id)[0]?.reworkCount).toBe(2)
          expect((await execute({ action: 'review', cycleId: original.cycleId, evidence })).isError).toBe(false)
          expect(liveReviewer).toBe(residentReviewer)
          expect(reviewerCreations).toBe(1)
          releaseReviewFlush.resolve()
          await expect.poll(() => ctx.studioRoles.agents(handle.agent.id)[0]?.cyclePhase).toBe('judged')
          expect((await execute({ action: 'complete', cycleId: original.cycleId })).isError).toBe(false)
        } finally { offReviewer(); offFlush(); releaseReviewFlush.resolve() }
      } finally { off(); offImplementerFlush(); releaseImplementerFlush.resolve() }
    } finally { await handle.dispose() }
  } catch (error) { console.error('REWORK_SCENARIO_FAILURE', error); throw error }
  finally { await scaffold.close() }
})
