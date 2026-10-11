/** Public Loader acceptance for explicit role context inheritance. */
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import { ToolCallId, ReasoningEffortId, createUserMessage } from '@deepseek-ai/dsh-llm'
import { launchWebScaffold, readPersistedEvents } from '@studio-test/scaffold'
import type {} from '../packages/roles/src/roles-remote.ts'
const studio = fileURLToPath(new URL('..', import.meta.url))

it('forks only the completed parent prefix with explicit role settings', async () => {
  const scaffold = await launchWebScaffold({
    extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`,
    extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`),
    replayFixture: `${studio}/test/fixtures/delegation/session.v4.jsonl`,
    replayChildFixtures: [`${studio}/test/fixtures/delegation/session.1.v4.jsonl`], compareReplaySession: false,
  })
  try {
    const ctx = scaffold.ctx
    const current = ctx.studioRoles.describe()
    const settings = { instructions: 'Explicit fork implementer.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' }
    await ctx.studioRoles.apply({ expectedProcessId: current.processId, expectedRevision: current.revision, expectedSnapshotId: current.snapshotId, roles: { implementer: settings, reviewer: settings } })
    const handle = await ctx.agents.create({ sessionId: SessionId('studio-fork-parent'), meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' }, agentOptions: { provider: settings.provider, model: settings.model, reasoningEffort: ReasoningEffortId('max') }, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) })
    try {
      handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Completed parent evidence.' }], source: { kind: 'user' } }))
      await handle.agent.whenIdle()
      const parent = await readPersistedEvents(scaffold, handle.agent.id)
      const end = parent.findLast(event => event.type === 'turn/end')
      if (!end) throw new Error('Missing completed parent turn')
      const result = await ctx.tools.execute({ agent: handle.agent, signal: new AbortController().signal, callId: ToolCallId('explicit-fork'), name: 'studio_delegate', arguments: { action: 'initial', role: 'implementer', context: 'fork', prompt: 'Additional task evidence.' } })
      expect(result.isError).toBe(false)
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id)[0]?.state).toBe('completed')
      const row = ctx.studioRoles.agents(handle.agent.id)[0]!
      expect(row.context).toBe('fork')
      expect(row.inheritedEventCount).toBe(end.seq + 1)
      const events = await readPersistedEvents(scaffold, row.childId)
      expect(events.slice(0, end.seq + 1)).toEqual(parent.slice(0, end.seq + 1))
      expect(events[end.seq + 1]).toMatchObject({ type: 'session/end-seed', data: { inherited: true } })
      expect(JSON.stringify(events.slice(end.seq + 1))).toContain('Additional task evidence.')
      expect(await ctx.subagents.listChildren(row.childId)).toEqual([])
      const request = events.findLast(event => event.type === 'request/header')
      expect(request?.type === 'request/header' && request.data.header.config).toMatchObject({ provider: settings.provider, model: settings.model, reasoningEffort: 'high' })
    } finally { await handle.dispose() }
  } finally { await scaffold.close() }
})

it('logs first-turn evidence separately and excludes inherited catalogs from reviewer ownership', async () => {
  const scaffold = await launchWebScaffold({
    extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`,
    extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`),
    replayFixture: `${studio}/test/fixtures/delegation/fork-model.v4.jsonl`,
    replayChildFixtures: [`${studio}/test/fixtures/delegation/session.1.v4.jsonl`, `${studio}/test/fixtures/delegation/review-pass.v4.jsonl`], compareReplaySession: false,
  })
  try {
    const ctx = scaffold.ctx
    const current = ctx.studioRoles.describe()
    const settings = { instructions: 'Implement with explicit context.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' }
    await ctx.studioRoles.apply({ expectedProcessId: current.processId, expectedRevision: current.revision, expectedSnapshotId: current.snapshotId, roles: { implementer: settings, reviewer: { ...settings, instructions: 'Review captured context independently.', reasoningEffort: 'max' } } })
    const handle = await ctx.agents.create({ sessionId: SessionId('studio-first-turn-fork'), meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' }, agentOptions: { provider: settings.provider, model: settings.model }, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) })
    try {
      handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Current unfinished parent evidence.' }], source: { kind: 'user' } }))
      await handle.agent.whenIdle()
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id)[0]?.state).toBe('completed')
      const implementer = ctx.studioRoles.agents(handle.agent.id)[0]!
      expect(implementer.context).toBe('fork')
      expect(implementer.inheritedEventCount).toBe(0)
      const implementationEvents = await readPersistedEvents(scaffold, implementer.childId)
      expect(implementationEvents.some(event => event.type === 'session/end-seed' && event.data.inherited)).toBe(false)
      const input = implementationEvents.find(event => event.type === 'user/message')
      expect(JSON.stringify(input)).toContain('Current unfinished parent evidence.')
      expect(JSON.stringify(input)).toContain('parentEvidence')
      expect(JSON.stringify(input)).toContain('Visible current-turn evidence.')
      expect(JSON.stringify(input)).not.toContain('PRIVATE_REASONING_FIXTURE')
      expect(JSON.stringify(input)).not.toContain('PRIVATE_ADAPTER_FIXTURE')
      expect(input?.type === 'user/message' && input.data.content.map(block => block.type === 'text' ? { ...block, text: block.text.replaceAll(scaffold.workspaceCwd, '<workspace>') } : block)).toMatchSnapshot('logged additional task and visible current-turn evidence')
      expect(JSON.stringify(input)).toContain('additionalTask')
      const parent = await readPersistedEvents(scaffold, handle.agent.id)
      expect(JSON.stringify(parent)).toContain('PRIVATE_REASONING_FIXTURE')
      expect(JSON.stringify(parent)).toContain('PRIVATE_ADAPTER_FIXTURE')
      const end = parent.findLast(event => event.type === 'turn/end')!
      expect(parent.slice(0, end.seq + 1).some(event => event.type === 'subagent/catalog')).toBe(true)
      const reviewed = await ctx.tools.execute({ agent: handle.agent, signal: new AbortController().signal, callId: ToolCallId('fork-review'), name: 'studio_delegate', arguments: { action: 'review', cycleId: implementer.cycleId, context: 'fork', evidence: { requirements: 'Review explicit context', summary: 'Implementation done', changedFiles: [], validations: [], failures: [], unrun: ['live provider'] } } })
      expect(reviewed.isError, JSON.stringify(reviewed)).toBe(false)
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id).find(row => row.role === 'reviewer')?.state).toBe('completed')
      const reviewer = ctx.studioRoles.agents(handle.agent.id).find(row => row.role === 'reviewer')!
      expect(reviewer.context).toBe('fork')
      expect(reviewer.inheritedEventCount).toBe(end.seq + 1)
      expect(reviewer.settings.instructions).toBe('Review captured context independently.')
      expect(reviewer.judgment?.judgment).toBe('pass')
      expect(await ctx.subagents.listChildren(reviewer.childId)).toEqual([])
      const events = await readPersistedEvents(scaffold, reviewer.childId)
      expect(events.slice(0, end.seq + 1)).toEqual(parent.slice(0, end.seq + 1))
      const request = events.findLast(event => event.type === 'request/header')
      expect(request?.type === 'request/header' && request.data.header.tools?.map(tool => tool.name).sort()).toEqual(['glob', 'grep', 'read', 'structured_output'])
      expect(request?.type === 'request/header' && request.data.header.config.reasoningEffort).toBe('max')
    } finally { await handle.dispose() }
  } finally { await scaffold.close() }
})

it('retains both fork identities and creation contexts through rework and re-review', async () => {
  const scaffold = await launchWebScaffold({
    extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`,
    extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`),
    replayFixture: `${studio}/test/fixtures/delegation/session.v4.jsonl`,
    replayChildFixtures: [`${studio}/test/fixtures/delegation/rework-implementer.v4.jsonl`, `${studio}/test/fixtures/delegation/rework-reviewer.v4.jsonl`], compareReplaySession: false,
  })
  try {
    const ctx = scaffold.ctx
    const current = ctx.studioRoles.describe()
    const settings = { instructions: 'Keep captured fork settings.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' }
    await ctx.studioRoles.apply({ expectedProcessId: current.processId, expectedRevision: current.revision, expectedSnapshotId: current.snapshotId, roles: { implementer: settings, reviewer: settings } })
    const handle = await ctx.agents.create({ sessionId: SessionId('studio-fork-rework'), meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' }, agentOptions: { provider: settings.provider, model: settings.model }, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) })
    try {
      handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Completed evidence.' }], source: { kind: 'user' } }))
      await handle.agent.whenIdle()
      const execute = (args: Record<string, unknown>) => ctx.tools.execute({ agent: handle.agent, signal: new AbortController().signal, callId: ToolCallId('fork-cycle'), name: 'studio_delegate', arguments: args })
      const evidence = { requirements: 'Keep identities', summary: 'Verify captured settings', changedFiles: [], validations: [], failures: [], unrun: ['live model'] }
      expect((await execute({ action: 'initial', role: 'implementer', context: 'fork', prompt: 'Implement.' })).isError).toBe(false)
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id)[0]?.state).toBe('completed')
      const original = ctx.studioRoles.agents(handle.agent.id)[0]!
      expect((await execute({ action: 'review', cycleId: original.cycleId, context: 'fork', evidence })).isError).toBe(false)
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id).find(row => row.role === 'implementer')?.cyclePhase).toBe('judged')
      const reviewer = ctx.studioRoles.agents(handle.agent.id).find(row => row.role === 'reviewer')!
      expect((await execute({ action: 'rework', cycleId: original.cycleId, prompt: 'Verify only.' })).isError).toBe(false)
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id).find(row => row.role === 'implementer')?.state).toBe('completed')
      expect((await execute({ action: 'review', cycleId: original.cycleId, context: 'fresh', evidence })).isError).toBe(true)
      expect((await execute({ action: 'review', cycleId: original.cycleId, evidence })).isError).toBe(false)
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id).find(row => row.role === 'implementer')?.cyclePhase).toBe('judged')
      for (const before of [original, reviewer]) {
        const after = ctx.studioRoles.agents(handle.agent.id).find(row => row.childId === before.childId)!
        expect(after.context).toBe('fork')
        expect(after.inheritedEventCount).toBe(before.inheritedEventCount)
        expect(after.inputCapturedThroughSeq).toBe(before.inputCapturedThroughSeq)
        expect(after.settings).toEqual(before.settings)
        expect(after.snapshotId).toBe(before.snapshotId)
      }
      expect(ctx.studioRoles.agents(handle.agent.id).find(row => row.role === 'implementer')?.reworkCount).toBe(1)
      expect((await execute({ action: 'rework', cycleId: original.cycleId, prompt: 'Second verification.' })).isError).toBe(false)
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id).find(row => row.role === 'implementer')?.state).toBe('completed')
      expect((await execute({ action: 'review', cycleId: original.cycleId, evidence })).isError).toBe(false)
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id).find(row => row.role === 'implementer')?.cyclePhase).toBe('judged')
      expect(ctx.studioRoles.agents(handle.agent.id).find(row => row.role === 'implementer')?.reworkCount).toBe(2)
      expect((await execute({ action: 'complete', cycleId: original.cycleId })).isError).toBe(false)
    } finally { await handle.dispose() }
  } finally { await scaffold.close() }
})
