/** Keyless shipped Loader tests for Studio's managed delegation. */
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { ToolCallId, ReasoningEffortId, createUserMessage } from '@deepseek-ai/dsh-llm'
import { launchWebScaffold, readPersistedEvents } from '@studio-test/scaffold'

import type {} from '../packages/roles/src/roles-remote.ts'
import { delegationSpec } from '../packages/roles/src/delegation-store.ts'
const studio = fileURLToPath(new URL('..', import.meta.url))

it('admits a fresh real implementer from captured applied settings', async () => {
  const scaffold = await launchWebScaffold({
    extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`,
    extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`),
    replayFixture: `${studio}/test/fixtures/delegation/session.v4.jsonl`,
    replayChildFixtures: [`${studio}/test/fixtures/delegation/session.1.v4.jsonl`, `${studio}/test/fixtures/delegation/session.1.v4.jsonl`],
    compareReplaySession: false,
  })
  try {
    const ctx = scaffold.ctx
    const observed = ctx.studioRoles.describe()
    const settings = { instructions: 'Implement exactly the delegated task.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' }
    await ctx.studioRoles.apply({ expectedProcessId: observed.processId, expectedRevision: observed.revision, expectedSnapshotId: observed.snapshotId, roles: { implementer: settings, reviewer: settings } })
    const handle = await ctx.agents.create({
      sessionId: SessionId('studio-applied-parent'),
      meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' },
      agentOptions: { provider: settings.provider, model: settings.model, reasoningEffort: ReasoningEffortId('max') },
      setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined),
    })
    try {
      handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Prepare the implementation.' }], source: { kind: 'user' } }))
      await handle.agent.whenIdle()
      const result = await ctx.tools.execute({
        agent: handle.agent, signal: new AbortController().signal,
        callId: ToolCallId('initial-configured'), name: 'studio_delegate',
        arguments: { action: 'initial', role: 'implementer', prompt: 'Implement the task.' },
      })
      expect(result.isError).toBe(false)
      expect(JSON.stringify(result)).toContain('childId')
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id)[0]?.state).toBe('completed')
      expect(ctx.studioRoles.agents(handle.agent.id)[0]?.output).toBe('IMPLEMENTER_DONE')
      const children = await ctx.subagents.listChildren(handle.agent.id)
      expect(children).toHaveLength(1)
      const child = children[0]
      if (!child) throw new Error('Missing admitted child')
      const events = await readPersistedEvents(scaffold, child.id)
      const request = events.find(event => event.type === 'request/header')
      expect(request?.type === 'request/header' && request.data.header.config.reasoningEffort).toBe('high')
      expect(request?.type === 'request/header' && request.data.header.tools?.map(tool => tool.name).sort()).toEqual(['bash', 'edit', 'glob', 'grep', 'read', 'todo_write', 'write'])
      expect(JSON.stringify(events.filter(event => event.type === 'user/message'))).not.toContain('Prepare the implementation.')
      const first = ctx.studioRoles.agents(handle.agent.id)[0]
      const current = ctx.studioRoles.describe()
      await ctx.studioRoles.apply({ expectedProcessId: current.processId, expectedRevision: current.revision, expectedSnapshotId: current.snapshotId, roles: { implementer: { ...settings, instructions: 'Second cycle instructions.' }, reviewer: settings } })
      expect(ctx.studioRoles.agents(handle.agent.id)[0]).toEqual(first)
      const second = await ctx.tools.execute({ agent: handle.agent, signal: new AbortController().signal, callId: ToolCallId('second-cycle'), name: 'studio_delegate', arguments: { action: 'initial', role: 'implementer', prompt: 'Second independent task.' } })
      expect(second.isError).toBe(false)
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id).filter(row => row.state === 'completed').length).toBe(2)
      const rows = ctx.studioRoles.agents(handle.agent.id)
      expect(new Set(rows.map(row => row.cycleId)).size).toBe(2)
      expect(new Set(rows.map(row => row.childId)).size).toBe(2)
      expect(rows.map(row => row.settings.instructions)).toContain('Second cycle instructions.')
    } finally { await handle.dispose() }
  } finally { await scaffold.close() }
})

it('logs a model-origin delegation receipt in the parent transcript', async () => {
  const scaffold = await launchWebScaffold({
    extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`,
    extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`),
    replayFixture: `${studio}/test/fixtures/delegation/model-session.v4.jsonl`,
    replayChildFixtures: [`${studio}/test/fixtures/delegation/session.1.v4.jsonl`], compareReplaySession: false,
  })
  try {
    const ctx = scaffold.ctx
    const observed = ctx.studioRoles.describe()
    const settings = { instructions: 'Model delegated implementation.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' }
    await ctx.studioRoles.apply({ expectedProcessId: observed.processId, expectedRevision: observed.revision, expectedSnapshotId: observed.snapshotId, roles: { implementer: settings, reviewer: settings } })
    const handle = await ctx.agents.create({ sessionId: SessionId('studio-model-parent'), meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' }, agentOptions: { provider: settings.provider, model: settings.model }, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) })
    try {
      handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Delegate implementation.' }], source: { kind: 'user' } }))
      await handle.agent.whenIdle()
      await expect.poll(() => ctx.studioRoles.agents(handle.agent.id)[0]?.state).toBe('completed')
      const events = await readPersistedEvents(scaffold, handle.agent.id)
      const result = events.find(event => event.type === 'tool/result')
      expect(JSON.stringify(result)).toContain('childId')
      expect(JSON.stringify(result)).toContain('messageId')
      expect(JSON.stringify(result)).not.toContain('IMPLEMENTER_DONE')
      const header = events.find(event => event.type === 'request/header')
      expect(header?.type === 'request/header' && header.data.header.tools?.find(tool => tool.name === 'studio_delegate')).toMatchSnapshot('model-visible delegation schema')
      if (result?.type !== 'tool/result') throw new Error('Missing logged tool receipt')
      const text = result.data.message.content.find(block => block.type === 'text')
      if (text?.type !== 'text') throw new Error('Missing receipt text')
      const receipt: Record<string, string> = JSON.parse(text.text)
      expect(Object.fromEntries(Object.entries(receipt).map(([key, value]) => [key, key.endsWith('Id') ? `<${key}>` : value]))).toMatchSnapshot('logged initial receipt')
    } finally { await handle.dispose() }
  } finally { await scaffold.close() }
})

it.each([false, true])('persists admission and fences failure, dispose while pending: %s', async disposePending => {
  const scaffold = await launchWebScaffold({ extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`, extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`), replayFixture: `${studio}/test/role-editor/session.v3.jsonl`, replayProvidersOnly: true })
  try {
    const ctx = scaffold.ctx
    const current = ctx.studioRoles.describe()
    const settings = { instructions: 'Admission failure probe.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' }
    await ctx.studioRoles.apply({ expectedProcessId: current.processId, expectedRevision: current.revision, expectedSnapshotId: current.snapshotId, roles: { implementer: settings, reviewer: settings } })
    const handle = await ctx.agents.create({ sessionId: SessionId('studio-failing-parent'), meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' }, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) })
    let reservations = 0
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const off = ctx.on('agent/created', async ({ agent }) => {
      if (agent.session.header.parentSession !== handle.agent.id) return
      const own = agent.ctx.tools.register(defineTool({ name: 'studio_child_bypass', description: 'Child capability probe', parameters: {}, output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] }, async execute() { return 'BYPASSED' } }))
      try {
        for (const name of ['studio_child_bypass', 'subagent', 'workflow', 'plugin_manager', 'create_goal', 'run_code', 'studio_delegate']) {
          const denied = await ctx.tools.execute({ agent, signal: new AbortController().signal, callId: ToolCallId('child-denied'), name, arguments: {} })
          expect(JSON.stringify(denied)).toContain('studio-managed-tool-denied')
        }
      } finally { own() }
      const rows = ctx.studioRoles.agents(handle.agent.id)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ state: 'reserved', childId: agent.id, settings })
      reservations++
      entered.resolve()
      if (disposePending) await release.promise
      throw new Error('test-provider-admission-failure')
    })
    try {
      const execute = () => ctx.tools.execute({ agent: handle.agent, signal: new AbortController().signal, callId: ToolCallId('uncertain-initial'), name: 'studio_delegate', arguments: { action: 'initial', role: 'implementer', prompt: 'Uncertain admission.' } })
      const pending = execute()
      if (disposePending) {
        await entered.promise
        const row = ctx.studioRoles.agents(handle.agent.id)[0]
        if (!row) throw new Error('Missing reserved row')
        const plugin = [...ctx.registry.keys()].find(plugin => plugin.name === 'StudioDelegation')
        if (!plugin) throw new Error('Missing delegation runtime')
        const runtime = ctx.registry.get(plugin)
        if (!runtime) throw new Error('Missing delegation fibers')
        const disposed = Promise.all([...runtime.fibers].map(fiber => fiber.dispose()))
        release.resolve()
        expect((await pending).isError).toBe(true)
        await disposed
        const stored = await ctx.storageDomain.open(delegationSpec)
        try { expect(stored.table('children').get(row.childId)?.state).toBe('unknown') } finally { await stored.close() }
        return
      }
      expect((await pending).isError).toBe(true)
      expect(reservations).toBe(1)
      expect(ctx.studioRoles.agents(handle.agent.id)[0]?.state).toBe('unknown')
      expect(JSON.stringify(await execute())).toContain('studio-admission-unknown')
      expect(reservations).toBe(1)
      expect(ctx.studioRoles.agents(handle.agent.id)).toHaveLength(1)
    } finally { off(); await handle.dispose() }
  } finally { await scaffold.close() }
})

it('drains a live paced child before closing Studio storage', async () => {
  const scaffold = await launchWebScaffold({ extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`, extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`), replayFixture: `${studio}/test/fixtures/delegation/session.v4.jsonl`, replayChildFixtures: [`${studio}/test/fixtures/delegation/session.1.v4.jsonl`], compareReplaySession: false, paceMs: 100 })
  let closed = false
  try {
    const ctx = scaffold.ctx
    const current = ctx.studioRoles.describe()
    const settings = { instructions: 'Live disposal probe.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' }
    await ctx.studioRoles.apply({ expectedProcessId: current.processId, expectedRevision: current.revision, expectedSnapshotId: current.snapshotId, roles: { implementer: settings, reviewer: settings } })
    const handle = await ctx.agents.create({ sessionId: SessionId('studio-live-disposal'), meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' }, agentOptions: { provider: settings.provider, model: settings.model }, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) })
    handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Prime replay.' }], source: { kind: 'user' } }))
    await handle.agent.whenIdle()
    const started = new Promise<void>(resolve => ctx.on('session/event', (session, event) => { if (session.header.parentSession === handle.agent.id && event.type === 'request/header') resolve() }))
    const result = await ctx.tools.execute({ agent: handle.agent, signal: new AbortController().signal, callId: ToolCallId('live-close'), name: 'studio_delegate', arguments: { action: 'initial', role: 'implementer', prompt: 'Paced task.' } })
    expect(result.isError).toBe(false)
    await started
    const row = ctx.studioRoles.agents(handle.agent.id)[0]
    if (!row) throw new Error('Missing live child')
    await readPersistedEvents(scaffold, row.childId)
    expect(ctx.studioRoles.agents(handle.agent.id)[0]?.state).toBe('running')
    const delegation = ctx.studioDelegation
    const plugin = [...ctx.registry.keys()].find(plugin => plugin.name === 'StudioDelegation')
    if (!plugin) throw new Error('Missing delegation runtime')
    const runtime = ctx.registry.get(plugin)
    if (!runtime) throw new Error('Missing delegation fibers')
    await Promise.all([...runtime.fibers].map(fiber => fiber.dispose()))
    const stored = await ctx.storageDomain.open(delegationSpec)
    try { expect(stored.table('children').get(row.childId)?.state).toBe('interrupted') } finally { await stored.close() }
    await expect(delegation.initial(handle.agent, 'After close', new AbortController().signal)).rejects.toThrow('studio-delegation-closed')
    await handle.dispose()
    await scaffold.close(); closed = true
  } finally { if (!closed) await scaffold.close() }
})

it('offers only managed planning capabilities and rejects initial work until roles are applied', async () => {
  const scaffold = await launchWebScaffold({
    extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`,
    extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`),
  })
  try {
    const ctx = scaffold.ctx
    const handle = await ctx.agents.create({
      sessionId: SessionId('studio-initial-parent'),
      meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' },
      setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined),
    })
    try {
      const tools = ctx.tools.schemas(handle.agent).map(tool => tool.name)
      expect(tools).toContain('studio_delegate')
      expect(tools).not.toContain('bash')
      expect(tools).not.toContain('subagent')
      const result = await ctx.tools.execute({
        agent: handle.agent, signal: new AbortController().signal,
        callId: ToolCallId('initial-unconfigured'), name: 'studio_delegate',
        arguments: { action: 'initial', role: 'implementer', prompt: 'Implement the task.' },
      })
      expect(result.isError).toBe(true)
      expect(JSON.stringify(result)).toContain('roles-not-applied')
      for (const name of ['bash', 'write', 'edit', 'subagent', 'workflow', 'plugin_manager', 'create_goal', 'run_code']) {
        const denied = await ctx.tools.execute({ agent: handle.agent, signal: new AbortController().signal, callId: ToolCallId(`denied-${name}`), name, arguments: {} })
        expect(denied.isError, name).toBe(true)
        expect(JSON.stringify(denied), name).toContain('studio-managed-tool-denied')
      }
      expect(await ctx.subagents.listChildren(handle.agent.id)).toHaveLength(0)
      const status = await ctx.tools.execute({ agent: handle.agent, signal: new AbortController().signal, callId: ToolCallId('status-empty'), name: 'studio_delegate', arguments: { action: 'status' } })
      expect(status.isError).toBe(false)
      expect(JSON.stringify(status)).toContain('[]')
      for (const arguments_ of [
        { action: 'initial', role: 'reviewer', prompt: 'x' },
        { action: 'initial', role: 'implementer', prompt: 'x', context: 'fork' },
        { action: 'initial', role: 'implementer', prompt: 'x', provider: 'arbitrary' },
        { action: 'initial', role: 'implementer', prompt: 'x', cycleId: 'invented' },
        { action: 'initial', role: 'implementer', prompt: 'x', tools: ['bash'] },
        { action: 'resume', childId: 'invented' },
        { action: 'status', childId: 'invented' },
      ]) {
        const rejected = await ctx.tools.execute({ agent: handle.agent, signal: new AbortController().signal, callId: ToolCallId('invalid-request'), name: 'studio_delegate', arguments: arguments_ })
        expect(rejected.isError, JSON.stringify(arguments_)).toBe(true)
        expect(JSON.stringify(rejected)).not.toContain('roles-not-applied')
      }
      expect(ctx.studioRoles.agents(handle.agent.id)).toEqual([])
      const own = handle.agent.ctx.tools.register(defineTool({ name: 'studio_own_bypass', description: 'Owned capability probe', parameters: {}, output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] }, async execute() { return 'BYPASSED' } }))
      try {
        const denied = await ctx.tools.execute({ agent: handle.agent, signal: new AbortController().signal, callId: ToolCallId('own-denied'), name: 'studio_own_bypass', arguments: {} })
        expect(JSON.stringify(denied)).toContain('studio-managed-tool-denied')
      } finally { own() }
      await handle.dispose()
      const resumed = await ctx.agents.resume({ resumeSessionId: handle.agent.id, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) })
      try {
        expect(ctx.tools.schemas(resumed.agent)).toEqual([])
        const denied = await ctx.tools.execute({ agent: resumed.agent, signal: new AbortController().signal, callId: ToolCallId('resume-denied'), name: 'studio_delegate', arguments: { action: 'status' } })
        expect(JSON.stringify(denied)).toContain('studio-managed-recovery-required')
      } finally { await resumed.dispose() }
      const orphan = await ctx.agents.create({ sessionId: SessionId('studio-missing-reservation'), meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed', parentSession: handle.agent.id, origin: 'subagent', delegationDepth: 1 }, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) })
      try {
        expect(ctx.tools.schemas(orphan.agent)).toEqual([])
        const denied = await ctx.tools.execute({ agent: orphan.agent, signal: new AbortController().signal, callId: ToolCallId('orphan-denied'), name: 'bash', arguments: {} })
        expect(JSON.stringify(denied)).toContain('studio-managed-recovery-required')
      } finally { await orphan.dispose() }
      const unmanaged = await ctx.agents.create({ sessionId: SessionId('studio-unmanaged-control'), meta: { cwd: scaffold.workspaceCwd } })
      const unmanagedTool = unmanaged.agent.ctx.tools.register(defineTool({ name: 'studio_unmanaged_probe', description: 'Unmanaged positive control', parameters: {}, output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] }, async execute() { return 'UNMANAGED_OK' } }))
      try {
        const allowed = await ctx.tools.execute({ agent: unmanaged.agent, signal: new AbortController().signal, callId: ToolCallId('unmanaged'), name: 'studio_unmanaged_probe', arguments: {} })
        expect(allowed.isError).toBe(false)
        expect(JSON.stringify(allowed)).toContain('UNMANAGED_OK')
      } finally { unmanagedTool(); await unmanaged.dispose() }
    } finally { await handle.dispose() }
  } finally { await scaffold.close() }
})
