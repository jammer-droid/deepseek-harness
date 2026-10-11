/** Durable storage damage and a lost successful acceptance receipt through the real Loader. */
import { fileURLToPath, pathToFileURL } from 'node:url'
import { expect, it, vi } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import { ToolCallId, createUserMessage, type MessageId } from '@deepseek-ai/dsh-llm'
import { descriptorOf } from '@deepseek-ai/dsh-storage-domain'
import { launchWebScaffold } from '@studio-test/scaffold'
import { delegationSpec } from '../packages/roles/src/delegation-store.ts'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '../packages/roles/src/roles-remote.ts'

const studio = fileURLToPath(new URL('..', import.meta.url))
const settings = { instructions: 'Preserve recorded uncertainty without retrying.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' }

async function start(childFixture: string) {
  const scaffold = await launchWebScaffold({
    extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`,
    extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`),
    replayFixture: `${studio}/test/fixtures/delegation/session.v4.jsonl`,
    replayChildFixtures: [`${studio}/test/fixtures/delegation/${childFixture}.v4.jsonl`], compareReplaySession: false,
  })
  try {
    const ctx = scaffold.ctx
    const current = ctx.studioRoles.describe()
    await ctx.studioRoles.apply({ expectedProcessId: current.processId, expectedRevision: current.revision, expectedSnapshotId: current.snapshotId, roles: { implementer: settings, reviewer: settings } })
    const parent = await ctx.agents.create({ sessionId: SessionId('recovery-fault-parent'), meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' }, agentOptions: settings, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) })
    try {
      parent.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Prepare.' }], source: { kind: 'user' } }))
      await parent.agent.whenIdle()
      const execute = (args: Record<string, unknown>) => ctx.tools.execute({ agent: parent.agent, signal: new AbortController().signal, callId: ToolCallId('recovery-fault'), name: 'studio_delegate', arguments: args })
      const response = await execute({ action: 'initial', role: 'implementer', prompt: 'Implement once.' })
      expect(response.isError, JSON.stringify(response)).toBe(false)
      await expect.poll(() => ctx.studioRoles.agents(parent.agent.id)[0]?.state).toBe('completed')
      const original = ctx.studioRoles.agents(parent.agent.id)[0]!
      return { scaffold, ctx, parent, original, execute }
    } catch (error) { await parent.dispose(); throw error }
  } catch (error) { await scaffold.close(); throw error }
}

it.each(['missing', 'corrupt'] as const)('refuses a persisted managed root after its sidecar becomes %s', async damage => {
  const { scaffold, ctx, parent, original } = await start('session.1')
  try {
    await parent.dispose()
    const owner = [...ctx.loader.entries()].find(entry => entry.options.name === '@local/dsh-studio-roles')
    if (!owner?.fiber) throw new Error('Missing real Studio Loader owner')
    await owner.fiber.dispose()
    // The domain is closed before fault injection; only this test's backend owns the medium.
    const unit = await ctx.storage.backend.get('json').kv!.open(descriptorOf(delegationSpec))
    try {
      if (damage === 'missing') await unit.deleteRecord('children', original.childId)
      else await unit.putRecord('children', original.childId, { ...original, reworkCount: 'invalid-count' })
    } finally { await unit.close() }
    const reload = await ctx.loader.create({ name: pathToFileURL(`${studio}/packages/roles/index.js`).href })
    await ctx.loader.await()
    const reloaded = ctx.loader.resolve(reload).fiber
    expect(reloaded).toBeDefined()
    if (damage === 'corrupt') await expect(reloaded!.await()).rejects.toMatchObject({ code: 'invalid-record' })
    else await reloaded!.await()
    if (damage === 'missing') expect(ctx.studioRoles.agents(parent.agent.id)).toEqual([])
    else expect(ctx.get('studioDelegation')).toBeUndefined()
    let published = 0
    const off = ctx.on('agent/created', ({ agent }) => { if (agent.id === parent.agent.id || agent.id === original.childId) published++ })
    try {
      await expect(ctx.agents.resume({ resumeSessionId: parent.agent.id, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) })).rejects.toThrow(damage === 'missing' ? 'studio-managed-recovery-required' : 'waiting for studioDelegation')
      expect(published).toBe(0)
      expect(ctx.agents.get(parent.agent.id)).toBeUndefined()
      expect(ctx.agents.get(original.childId)).toBeUndefined()
      const ordinary = await ctx.agents.create({ sessionId: SessionId(`ordinary-after-${damage}`), meta: { cwd: scaffold.workspaceCwd } })
      await ordinary.dispose()
    } finally { off() }
  } finally { await parent.dispose(); await scaffold.close() }
})

it('keeps a counted operation unknown when a successful send loses its response and refuses duplicate work', async () => {
  const { scaffold, ctx, parent, original, execute } = await start('rework-once')
  let resumed: Agent | undefined
  let accepted: MessageId | undefined
  const off = ctx.on('agent/created', ({ agent, source }) => { if (source === 'resume' && agent.id === original.childId) resumed = agent })
  const actualSend = ctx.subagents.sendMessage.bind(ctx.subagents)
  const send = vi.spyOn(ctx.subagents, 'sendMessage').mockImplementation(async (...args) => {
    accepted = await actualSend(...args)
    throw new Error('test-successful-acceptance-response-lost')
  })
  try {
    const response = await execute({ action: 'rework', cycleId: original.cycleId, prompt: 'Accepted verification with a lost receipt.' })
    expect(response.isError).toBe(true)
    expect(JSON.stringify(response)).toContain('test-successful-acceptance-response-lost')
    expect(accepted).toBeDefined()
    expect(resumed).toBeDefined()
    await resumed!.whenIdle()
    await expect.poll(() => ctx.agents.get(original.childId)).toBeUndefined()
    await ctx.sessionPersistence.flush()
    const unknown = ctx.studioRoles.agents(parent.agent.id)[0]!
    expect(unknown).toMatchObject({ childId: original.childId, snapshotId: original.snapshotId, settings: original.settings, reworkCount: 1, state: 'unknown', cyclePhase: 'unknown', messageId: null, diagnostic: 'studio-acceptance-unknown' })
    expect(unknown).toMatchObject({ reconciledMessageId: accepted })
    expect(unknown.operationId).not.toBe(original.operationId)
    expect((await execute({ action: 'rework', cycleId: original.cycleId, prompt: 'Must not resend.' })).isError).toBe(true)
    expect((await execute({ action: 'initial', role: 'implementer', prompt: 'Must not replace.' })).isError).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
    expect(ctx.studioRoles.agents(parent.agent.id)).toEqual([unknown])
    expect(await ctx.subagents.listChildren(parent.agent.id)).toHaveLength(1)
    await using stored = await ctx.sessionPersistence.open(original.childId, 'read')
    const { events } = await stored.read()
    const acceptedMessages = events.filter(event => event.type === 'agent/inbox/spliced').flatMap(event => event.data.inserted)
    expect(acceptedMessages.map(message => message.id)).toEqual([original.messageId, accepted])
    expect(JSON.stringify(acceptedMessages.find(message => message.id === accepted))).toContain(unknown.operationId)
    expect(events.filter(event => event.type === 'turn/end').at(-1)?.data.reason.kind).toBe('completed')
    expect((await execute({ action: 'status' })).isError).toBe(false)
  } finally { send.mockRestore(); off(); await parent.dispose(); await scaffold.close() }
})
