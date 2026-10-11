/** Review admission through the shipped Loader and actual tool executor. */
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { ToolCallId, createUserMessage } from '@deepseek-ai/dsh-llm'
import { launchWebScaffold, readPersistedEvents } from '@studio-test/scaffold'
import { delegationSpec } from '../packages/roles/src/delegation-store.ts'
const studio = fileURLToPath(new URL('..', import.meta.url))
const evidence = { requirements: 'Required behavior', summary: 'Changes made', changedFiles: ['example.ts'], validations: [{ command: 'npm test', result: 'passed' }], failures: [], unrun: ['full suite'] }

it('captures a fresh structured pass without automatically completing its cycle', async () => {
  const scaffold = await launchWebScaffold({
    extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`,
    extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`),
    replayFixture: `${studio}/test/fixtures/delegation/session.v4.jsonl`,
    replayChildFixtures: [`${studio}/test/fixtures/delegation/session.1.v4.jsonl`, `${studio}/test/fixtures/delegation/review-pass.v4.jsonl`],
    compareReplaySession: false,
  })
  try {
    const ctx = scaffold.ctx
    const current = ctx.studioRoles.describe()
    const settings = { instructions: 'Perform the assigned role.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' }
    await ctx.studioRoles.apply({ expectedProcessId: current.processId, expectedRevision: current.revision, expectedSnapshotId: current.snapshotId, roles: { implementer: settings, reviewer: settings } })
    const handle = await ctx.agents.create({ sessionId: SessionId('review-pass-root'), agentOptions: { provider: settings.provider, model: settings.model }, meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' }, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) })
    try {
      handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Prepare implementation.' }], source: { kind: 'user' } }))
      await handle.agent.whenIdle()
      const execute = (args: Record<string, unknown>) => ctx.tools.execute({ agent: handle.agent, signal: new AbortController().signal, callId: ToolCallId(String(args.action)), name: 'studio_delegate', arguments: args })
      expect((await execute({ action: 'initial', role: 'implementer', prompt: 'Implement required behavior.' })).isError).toBe(false)
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id)[0]?.state).toBe('completed')
      const implementer = ctx.studioRoles.agents(handle.agent.id)[0]!
       expect(implementer.reworkCap).toBe(2)
      expect((await execute({ action: 'complete', cycleId: implementer.cycleId })).isError).toBe(true)
      const other = await ctx.agents.create({ sessionId: SessionId('other-orchestrator'), meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' }, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) })
      try {
        for (const action of ['review', 'complete']) {
          const denied = await ctx.tools.execute({ agent: other.agent, signal: new AbortController().signal, callId: ToolCallId('foreign'), name: 'studio_delegate', arguments: { action, cycleId: implementer.cycleId, ...(action === 'review' ? { evidence } : {}) } })
          expect(JSON.stringify(denied)).toContain('studio-cycle-not-found')
        }
        expect(ctx.studioRoles.agents(handle.agent.id)).toEqual([implementer])
        expect(ctx.studioRoles.agents(other.agent.id)).toEqual([])
      } finally { await other.dispose() }
      const applied = ctx.studioRoles.describe()
      const reviewerSettings = { ...settings, instructions: 'Review only; report structured evidence.' }
      await ctx.studioRoles.apply({ expectedProcessId: applied.processId, expectedRevision: applied.revision, expectedSnapshotId: applied.snapshotId, roles: { implementer: settings, reviewer: reviewerSettings } })
      const off = ctx.on('agent/created', async ({ agent }) => {
        if (!ctx.studioRoles.agents(handle.agent.id).some(row => row.childId === agent.id && row.role === 'reviewer')) return
        expect((await execute({ action: 'complete', cycleId: implementer.cycleId })).isError).toBe(true)
        expect((await execute({ action: 'review', cycleId: implementer.cycleId, evidence })).isError).toBe(true)
        const own = agent.ctx.tools.register(defineTool({ name: 'studio_review_bypass', description: 'Arbitrary own-tool probe', parameters: {}, output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] }, async execute() { return 'BYPASSED' } }))
        try {
          for (const name of ['studio_review_bypass', 'bash', 'write', 'edit', 'subagent', 'subagent_fork', 'workflow', 'run_code', 'plugin_manager', 'studio_delegate', 'todo_write']) {
            const denied = await ctx.tools.execute({ agent, signal: new AbortController().signal, callId: ToolCallId('review-denied'), name, arguments: {} })
            expect(JSON.stringify(denied)).toContain('studio-managed-tool-denied')
          }
          const allowed = await ctx.tools.execute({ agent, signal: new AbortController().signal, callId: ToolCallId('review-glob'), name: 'glob', arguments: { pattern: '*' } })
          expect(allowed.isError).toBe(false)
        } finally { own() }
      })
      let result
      try { result = await execute({ action: 'review', cycleId: implementer.cycleId, evidence }) } finally { off() }
      expect(result.isError, JSON.stringify(result)).toBe(false)
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id).find(row => String(row.role) === 'reviewer')?.state).toBe('completed')
      const reviewer = ctx.studioRoles.agents(handle.agent.id).find(row => String(row.role) === 'reviewer')!
      expect(reviewer.settings).toEqual(reviewerSettings)
      expect(reviewer.snapshotId).not.toBe(implementer.snapshotId)
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id).find(row => row.role === 'implementer')?.cyclePhase).toBe('judged')
      expect(ctx.studioRoles.agents(handle.agent.id).find(row => row.role === 'implementer')).toEqual({ ...implementer, cyclePhase: 'judged', cycleOperation: reviewer.operationId })
      expect((await execute({ action: 'review', cycleId: implementer.cycleId, evidence })).isError).toBe(true)
      expect(reviewer.cycleId).toBe(implementer.cycleId)
      expect(reviewer.childId).not.toBe(implementer.childId)
      const events = await readPersistedEvents(scaffold, reviewer.childId)
      expect(JSON.stringify(events.filter(event => event.type === 'user/message'))).toContain('npm test')
      const request = events.find(event => event.type === 'request/header')
      expect(request?.type === 'request/header' && request.data.header.tools).toMatchSnapshot('reviewer read/search and structured submission schema')
      const input = events.find(event => event.type === 'user/message')
      expect(input?.type === 'user/message' && input.data.content).toMatchSnapshot('logged review evidence and implementation output')
      expect(JSON.stringify(events.filter(event => event.type === 'tool/result'))).toContain('Structured output recorded.')
      expect(reviewer.judgment).toEqual({ judgment: 'pass', explanation: 'Requirements met', evidence: ['Reviewed example.ts'], additionalVerification: [] })
      expect(ctx.studioRoles.agents(handle.agent.id).find(row => row.role === 'implementer')?.cycleCompletedAt).toBeUndefined()
      expect((await execute({ action: 'complete', cycleId: implementer.cycleId })).isError).toBe(false)
      expect(ctx.studioRoles.agents(handle.agent.id).find(row => row.role === 'implementer')?.cycleCompletedAt).toEqual(expect.any(Number))
      const saved = ctx.studioRoles.agents(handle.agent.id)
      const plugin = [...ctx.registry.keys()].find(plugin => plugin.name === 'StudioDelegation')!
      const runtime = ctx.registry.get(plugin)!
      await Promise.all([...runtime.fibers].map(fiber => fiber.dispose()))
      const reopened = await ctx.storageDomain.open(delegationSpec)
      try {
        for (const row of saved) expect(reopened.table('children').get(row.childId)).toEqual(row)
      } finally { await reopened.close() }
    } finally { await handle.dispose() }
  } catch (error) { console.error('REVIEW_SCENARIO_FAILURE', error); throw error; }
  finally { await scaffold.close() }
})

it.each(['needs-changes', 'unable-to-judge', 'verification', 'invalid', 'missing', 'start-failure'])('blocks completion after reviewer outcome %s', async outcome => {
  const scaffold = await launchWebScaffold({ extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`, extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`), replayFixture: `${studio}/test/fixtures/delegation/session.v4.jsonl`, replayChildFixtures: [`${studio}/test/fixtures/delegation/session.1.v4.jsonl`, ...(outcome === 'start-failure' ? [] : [`${studio}/test/fixtures/delegation/${outcome === 'missing' ? 'session.1' : `review-${outcome}`}.v4.jsonl`])], compareReplaySession: false })
  try {
    const ctx = scaffold.ctx
    const current = ctx.studioRoles.describe()
    const settings = { instructions: 'Review submitted evidence.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' }
    await ctx.studioRoles.apply({ expectedProcessId: current.processId, expectedRevision: current.revision, expectedSnapshotId: current.snapshotId, roles: { implementer: settings, reviewer: settings } })
    const handle = await ctx.agents.create({ sessionId: SessionId(`outcome-${outcome}`), meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' }, agentOptions: { provider: settings.provider, model: settings.model }, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) })
    try {
      handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Prepare.' }], source: { kind: 'user' } }))
      await handle.agent.whenIdle()
      const execute = (args: Record<string, unknown>) => ctx.tools.execute({ agent: handle.agent, signal: new AbortController().signal, callId: ToolCallId('outcome'), name: 'studio_delegate', arguments: args })
      expect((await execute({ action: 'initial', role: 'implementer', prompt: 'Implement.' })).isError).toBe(false)
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id)[0]?.state).toBe('completed')
      const cycleId = ctx.studioRoles.agents(handle.agent.id)[0]!.cycleId
      if (outcome === 'start-failure') {
        const off = ctx.on('agent/created', ({ agent }) => { if (agent.session.header.parentSession === handle.agent.id) throw new Error('reviewer-start-failure') })
        try {
          expect((await execute({ action: 'review', cycleId, evidence })).isError).toBe(true)
          expect(ctx.studioRoles.agents(handle.agent.id).find(row => row.role === 'reviewer')?.state).toBe('unknown')
          expect((await execute({ action: 'review', cycleId, evidence })).isError).toBe(true)
          expect((await execute({ action: 'complete', cycleId })).isError).toBe(true)
          expect(ctx.studioRoles.agents(handle.agent.id)).toHaveLength(2)
        } finally { off() }
        return
      }
      expect((await execute({ action: 'review', cycleId, evidence })).isError).toBe(false)
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id).find(row => row.role === 'reviewer')?.state).toBe(outcome === 'missing' ? 'failed' : 'completed')
      const reviewer = ctx.studioRoles.agents(handle.agent.id).find(row => row.role === 'reviewer')!
      if (outcome === 'invalid' || outcome === 'missing') {
        expect(reviewer.judgment).toBeUndefined()
        if (outcome === 'invalid') expect(reviewer.diagnostic).toBe('studio-review-invalid-result')
        else expect(reviewer.state).toBe('failed')
      } else {
        expect(reviewer.judgment?.judgment).toBe(outcome === 'verification' ? 'pass' : outcome)
        expect(reviewer.judgment?.additionalVerification).toEqual(outcome === 'verification' ? ['Run full suite'] : [])
      }
      expect((await execute({ action: 'complete', cycleId })).isError).toBe(true)
      expect((await execute({ action: 'review', cycleId, evidence })).isError).toBe(true)
      // Failed native reviews remain fenced; judged outcomes may request bounded rework (covered by rework-cycle).
      if (outcome === 'missing') expect((await execute({ action: 'rework', cycleId, prompt: 'Do more.' })).isError).toBe(true)
      expect(ctx.studioRoles.agents(handle.agent.id)).toHaveLength(2)
      expect(ctx.studioRoles.agents(handle.agent.id)[0]?.cycleCompletedAt).toBeUndefined()
    } finally { await handle.dispose() }
  } catch (error) { console.error('OUTCOME_SCENARIO_FAILURE', error); throw error; } finally { await scaffold.close() }
})

it('rejects review and completion for a missing cycle', async () => {
  const scaffold = await launchWebScaffold({
    extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`,
    extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`),
    replayFixture: `${studio}/test/role-editor/session.v3.jsonl`,
    replayProvidersOnly: true,
  })
  try {
    const ctx = scaffold.ctx
    const handle = await ctx.agents.create({ sessionId: SessionId('review-owner'), meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' }, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) })
    try {
      for (const action of ['review', 'complete']) {
        const result = await ctx.tools.execute({ agent: handle.agent, signal: new AbortController().signal, callId: ToolCallId(action), name: 'studio_delegate', arguments: { action, cycleId: '00000000-0000-4000-8000-000000000000', ...(action === 'review' ? { evidence: { requirements: 'Required behavior', summary: 'Changes made', changedFiles: ['example.ts'], validations: [], failures: [], unrun: ['tests'] } } : {}) } })
        expect(result.isError).toBe(true)
        expect(JSON.stringify(result)).toContain('studio-cycle-not-found')
      }
      expect(ctx.studioRoles.agents(handle.agent.id)).toEqual([])
    } finally { await handle.dispose() }
  } catch (error) { console.error('REVIEW_SCENARIO_FAILURE', error); throw error; }
  finally { await scaffold.close() }
})
