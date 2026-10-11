/** Two isolated Host processes share only test-owned durable Session and Studio storage. */
import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { expect, it, onTestFinished } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import { ToolCallId, createUserMessage } from '@deepseek-ai/dsh-llm'
import { launchWebScaffold } from '@studio-test/scaffold'
import type { DelegationRecord } from '../packages/roles/src/delegation-store.ts'
import type {} from '../packages/roles/src/roles-remote.ts'

const studio = fileURLToPath(new URL('..', import.meta.url))
const repository = dirname(studio)
const phase = process.env.STUDIO_RECOVERY_PROCESS_PHASE
const phaseRoot = process.env.STUDIO_RECOVERY_PROCESS_ROOT
const settings = { instructions: 'Keep the original restart implementation settings.', provider: 'deepseek-official', model: 'deepseek-v4-flash-vision-exp' }
const rootId = SessionId('studio-cold-process-root')
const executeFile = promisify(execFile)
interface PhaseResult { pid: number; processId: string; row: DelegationRecord }

it.skipIf(phase !== undefined)('restores a settled cycle across two Host processes and reworks the original child', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'studio-recovery-process-')))
  const cancellation = new AbortController()
  const pending = new Set<Promise<unknown>>()
  onTestFinished(async () => {
    cancellation.abort()
    await Promise.allSettled(pending)
    await rm(root, { recursive: true, force: true })
  })
  await mkdir(join(root, 'workspace'))
  // Distinct Loader ids keep the scaffold's temporary-root patches from replacing these roots.
  await writeFile(join(root, 'restart.patch.yml'), JSON.stringify([
    { id: 'session-persistence-jsonl', disabled: true },
    { id: 'storage-json', disabled: true },
    { insert: [
      { id: 'studio-restart-session-storage', name: '@deepseek-ai/dsh-session-persistence-jsonl', config: { root: join(root, 'sessions') } },
      { id: 'studio-restart-sidecar-storage', name: '@deepseek-ai/dsh-storage-json', config: { root: join(root, 'storage') } },
    ] },
  ]), { flag: 'wx' })
  const vitest = join(dirname(createRequire(import.meta.url).resolve('vitest/package.json')), 'vitest.mjs')
  for (const currentPhase of ['write', 'resume']) {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'NODE_OPTIONS' && !key.startsWith('VITEST') && !/KEY|SECRET|TOKEN|PASSWORD/i.test(key)))
    const execution = executeFile(process.execPath, [vitest, 'run', '--config', 'studio/test/vitest.browser.config.ts', 'studio/test/recovery-process.browser.test.ts', '--pool=forks', '-t', '^recovery process phase$'], {
      cwd: repository,
      env: { ...env, STUDIO_RECOVERY_PROCESS_PHASE: currentPhase, STUDIO_RECOVERY_PROCESS_ROOT: root },
      signal: cancellation.signal,
      timeout: 140_000,
      maxBuffer: 4 * 1024 * 1024,
    })
    pending.add(execution)
    try { await execution } catch (error) {
      if (error instanceof Error && 'stdout' in error && 'stderr' in error) throw new Error(`Restart phase ${currentPhase} failed:\n${String(error.stdout)}\n${String(error.stderr)}`, { cause: error })
      throw error
    } finally { pending.delete(execution) }
  }
  const first: PhaseResult = JSON.parse(await readFile(join(root, 'write.json'), 'utf8'))
  const second: PhaseResult = JSON.parse(await readFile(join(root, 'resume.json'), 'utf8'))
  expect(second.pid).not.toBe(first.pid)
  expect(second.processId).not.toBe(first.processId)
  expect(second.row.childId).toBe(first.row.childId)
  expect(second.row.cycleId).toBe(first.row.cycleId)
  expect(second.row.snapshotId).toBe(first.row.snapshotId)
  expect(second.row.settings).toEqual(first.row.settings)
  expect(second.row.context).toBe(first.row.context)
  expect(second.row.reworkCap).toBe(first.row.reworkCap)
  expect(second.row.reworkCount).toBe(first.row.reworkCount + 1)
  expect(second.row.operationId).not.toBe(first.row.operationId)
  expect(second.row.messageId).not.toBe(first.row.messageId)
  expect(second.row.state).toBe('completed')
// Two sequential phase runners each receive the normal 120-second scaffold budget plus teardown.
}, 300_000)

it.skipIf(phase === undefined)('recovery process phase', async () => {
  if ((phase !== 'write' && phase !== 'resume') || phaseRoot === undefined) throw new Error('Missing restart phase inputs')
  const first: PhaseResult | undefined = phase === 'resume' ? JSON.parse(await readFile(join(phaseRoot, 'write.json'), 'utf8')) : undefined
  const scaffold = await launchWebScaffold({
    extraOverlayPath: [`${studio}/packages/bundle/cordis.patch.yml`, join(phaseRoot, 'restart.patch.yml')],
    extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`),
    harnessHome: join(phaseRoot, `home-${phase}`),
    replayFixture: `${studio}/test/fixtures/delegation/${phase === 'write' ? 'session' : 'session.1'}.v4.jsonl`,
    ...(phase === 'write' ? { replayChildFixtures: [`${studio}/test/fixtures/delegation/session.1.v4.jsonl`] } : {}),
    compareReplaySession: false,
  })
  let result: PhaseResult | undefined
  let phaseFailure: unknown
  try {
    const ctx = scaffold.ctx
    const current = ctx.studioRoles.describe()
    if (phase === 'write') {
      await ctx.studioRoles.apply({ expectedProcessId: current.processId, expectedRevision: current.revision, expectedSnapshotId: current.snapshotId, roles: { implementer: settings, reviewer: settings } })
    } else {
      // The scaffold mounts its replay catalog after Loader startup; Apply validates against that catalog.
      expect(current.roles).toEqual({ implementer: settings, reviewer: settings })
      expect(current.snapshotId).toBe(first!.row.snapshotId)
      expect(ctx.studioRoles.agents(rootId)).toEqual([first!.row])
      await ctx.studioRoles.apply({ expectedProcessId: current.processId, expectedRevision: current.revision, expectedSnapshotId: current.snapshotId, roles: { implementer: { ...settings, instructions: 'New settings must not replace the resumed child.' }, reviewer: settings } })
    }
    const setup = (agentCtx: import('@deepseek-ai/cordis').Context) => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined)
    const handle = phase === 'write'
      ? await ctx.agents.create({ sessionId: rootId, meta: { cwd: join(phaseRoot, 'workspace'), agentPreset: 'studio-managed' }, agentOptions: { provider: settings.provider, model: settings.model }, setup })
      : await ctx.agents.resume({ resumeSessionId: rootId, setup })
    try {
      if (phase === 'write') {
        handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Prepare a durable cycle.' }], source: { kind: 'user' } }))
        await handle.agent.whenIdle()
      }
      const refusals: Promise<void>[] = []
      const off = ctx.on('agent/created', ({ agent, source }) => {
        if (phase !== 'resume' || agent.id !== first!.row.childId) return
        expect(source).toBe('resume')
        refusals.push(ctx.tools.execute({ agent, signal: new AbortController().signal, callId: ToolCallId('restart-child-denied'), name: 'studio_delegate', arguments: { action: 'initial', role: 'implementer', prompt: 'Forbidden nested delegation.' } }).then(response => { expect(response.isError).toBe(true) }))
      })
      try {
        const response = await ctx.tools.execute({ agent: handle.agent, signal: new AbortController().signal, callId: ToolCallId(`restart-${phase}`), name: 'studio_delegate', arguments: phase === 'write'
          ? { action: 'initial', role: 'implementer', prompt: 'Implement the restart scenario.' }
          : { action: 'rework', cycleId: first!.row.cycleId, prompt: 'Verify after the actual Host restart.' } })
        expect(response.isError, JSON.stringify(response)).toBe(false)
        await expect.poll(() => ctx.studioRoles.agents(rootId)[0]?.state).toBe('completed')
        await Promise.all(refusals)
        if (phase === 'resume') expect(refusals).toHaveLength(1)
        const rows = ctx.studioRoles.agents(rootId)
        expect(rows).toHaveLength(1)
        const row = rows[0]!
        expect(row.settings).toEqual(settings)
        await ctx.sessionPersistence.flush()
        await using stored = await ctx.sessionPersistence.open(row.childId, 'read')
        const { events } = await stored.read()
        const headers = events.filter(event => event.type === 'request/header')
        expect(headers).toHaveLength(phase === 'write' ? 1 : 2)
        for (const header of headers) expect(header.data.header.config).toMatchObject({ provider: settings.provider, model: settings.model })
        expect(JSON.stringify(events.filter(event => event.type === 'system/message'))).toContain(settings.instructions)
        expect(JSON.stringify(events.filter(event => event.type === 'system/message'))).not.toContain('New settings must not replace')
        expect(events.filter(event => event.type === 'turn/end').at(-1)?.data.reason.kind).toBe('completed')
        result = { pid: process.pid, processId: ctx.studioRoles.describe().processId, row }
      } finally { off(); await Promise.all(refusals) }
    } finally { await handle.dispose() }
  } catch (error) { phaseFailure = error; throw error }
  finally {
    try { await scaffold.close() }
    catch (error) {
      if (phaseFailure !== undefined) throw new AggregateError([phaseFailure, error], 'Restart phase and teardown failed')
      throw error
    }
  }
  expect(result).toBeDefined()
  await writeFile(join(phaseRoot, `${phase}.json`), JSON.stringify(result), { flag: 'wx' })
})
