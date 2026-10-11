/** Managed Studio admission; durable links are never cold-process authority. */
import { randomUUID } from 'node:crypto';
import { Service, type Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type {} from '@deepseek-ai/dsh-agent-preset-registry';
import type {} from '@deepseek-ai/dsh-tools';
import type {} from '@deepseek-ai/dsh-subagent';
import type { Domain } from '@deepseek-ai/dsh-storage-domain';
import { SessionId } from '@deepseek-ai/dsh-session';
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import { brandString } from '@deepseek-ai/dsh-brand';
import { delegationSpec, type CycleId, type OperationId, type DelegationRecord } from './delegation-store.ts';
import type {} from './roles-remote.ts';
import { reviewJudgment, reviewOutputSchema, type ReviewEvidence } from './review.ts';
/** Fixed trusted preset identity, persisted by the public child runtime. */
export const MANAGED_PRESET = 'studio-managed';
const ROOT_TOOLS = new Set(['studio_delegate', 'read', 'glob', 'grep', 'todo_write', 'ask_user_question']);
const CHILD_TOOLS = new Set(['read', 'glob', 'grep', 'write', 'edit', 'bash', 'todo_write']);
const REVIEW_TOOLS = new Set(['read', 'glob', 'grep', 'structured_output']);
declare module '@deepseek-ai/cordis' { interface Context { studioDelegation: StudioDelegation } }
/** Owns admission and restricts only explicitly managed agents. */
export class StudioDelegation extends Service {
  static inject = ['studioRoles', 'tools', 'agentPresets', 'storageDomain', 'subagents'];
  private readonly admitted = new WeakMap<Agent, 'orchestrator' | 'implementer' | 'reviewer'>();
  private readonly reservations = new Map<SessionId, DelegationRecord>();
  private readonly pending = new WeakSet<Agent>();
  private readonly uncertain = new WeakSet<Agent>();
  private readonly observed = new Map<SessionId, NonNullable<DelegationRecord['observed']>>();
  private readonly settlements = new Set<Promise<void>>();
  private readonly activations = new Set<import('@deepseek-ai/dsh-subagent').SubagentActivation>();
  private readonly failures = new Map<SessionId, string>();
  private readonly admissions = new Set<Promise<string>>();
  private readonly shutdown = new AbortController();
  constructor(ctx: Context, private readonly domain: Domain<typeof delegationSpec>) {
    super(ctx, 'studioDelegation');
    ctx.effect(() => async () => {
      this.shutdown.abort(new Error('studio-delegation-closed'));
      await Promise.allSettled(this.admissions);
      const disposed = await Promise.allSettled([...this.activations].map(activation => activation.dispose()));
      await Promise.allSettled(this.settlements);
      await domain.close();
      const failures = disposed.filter(result => result.status === 'rejected');
      if (failures.length) throw new AggregateError(failures.map(result => result.reason), 'studio-disposal-failed');
    });
    ctx.effect(() => ctx.tools.guard(exec => {
      if (!exec.agent || ctx.agentPresets.composedPreset(exec.agent.ctx) !== MANAGED_PRESET) return;
      const role = this.admitted.get(exec.agent);
      if (!role) return 'studio-managed-recovery-required';
      if (!(role === 'orchestrator' ? ROOT_TOOLS : role === 'reviewer' ? REVIEW_TOOLS : CHILD_TOOLS).has(exec.name)) return 'studio-managed-tool-denied';
    }));
    ctx.on('session/event', (session, event) => {
      if (!this.reservations.has(session.id) || event.type !== 'request/header') return;
      const config = event.data.header.config;
      this.observed.set(session.id, { provider: config.provider, model: config.model, reasoningEffort: config.reasoningEffort ?? null });
    });
    ctx.on('agent/created', ({ agent, source }) => {
      if (ctx.agentPresets.composedPreset(agent.ctx) !== MANAGED_PRESET) return;
      agent.ctx.effect(() => agent.ctx.tools.presentAs('native'));
      const reservation = this.reservations.get(agent.id);
      const child = source === 'startup' && reservation !== undefined && reservation.parentId === agent.session.header.parentSession;
      const root = source === 'startup' && !agent.session.header.parentSession;
      const capabilities = child ? reservation.role === 'reviewer' ? REVIEW_TOOLS : CHILD_TOOLS : root ? ROOT_TOOLS : new Set<string>();
      const names = ctx.tools.schemas(agent).map(tool => tool.name).filter(name => name !== 'structured_output' && capabilities.has(name));
      agent.ctx.effect(() => agent.ctx.tools.restrict({ allow: names }));
      if (child) {
        this.admitted.set(agent, reservation.role);
        agent.ctx.on('agent/request', async (_payload, next) => {
          const proposal = await next();
          const { reasoningEffort: _inherited, ...withoutEffort } = proposal;
          return {
            ...withoutEffort, provider: reservation.settings.provider, model: reservation.settings.model,
            ...(reservation.settings.reasoningEffort === undefined ? {} : { reasoningEffort: ReasoningEffortId(reservation.settings.reasoningEffort) }),
          };
        });
      }
      else if (root) this.admitted.set(agent, 'orchestrator');
    });
  }
  /** Read related sidecar rows without loading or waking any Agent.
   * @param sessionId Parent or child whose recorded delegation is displayed.
   * @returns Detached durable records; empty means no recorded managed membership.
   */
  describe(sessionId: SessionId): DelegationRecord[] {
    return [...this.domain.table('children').entries()].map(([, row]) => row)
      .filter(row => row.parentId === sessionId || row.childId === sessionId).map(row => {
        const copy = structuredClone(row);
        const failure = this.failures.get(row.childId);
        return failure ? { ...copy, state: 'unknown', diagnostic: failure } : copy;
      });
  }
  /** Start a fresh child only after its detached role reservation is durable.
   * @param agent Current managed orchestrator.
   * @param prompt Task input; no conversation fork.
   * @param signal Caller cancellation before publication.
   * @returns Durable accepted identifiers; the child continues independently.
   */
  async initial(agent: Agent, prompt: string, signal: AbortSignal): Promise<string> {
    this.shutdown.signal.throwIfAborted();
    const admission = this.admit(agent, prompt, AbortSignal.any([signal, this.shutdown.signal]));
    this.admissions.add(admission);
    try { return await admission; } finally { this.admissions.delete(admission); }
  }
  /** Admit review or explicit completion for an owned settled cycle.
   * @param agent Live managed orchestrator.
   * @param cycleId Previously issued cycle identity.
   * @param evidence Explicit review input, omitted only for completion.
   * @param signal Caller cancellation before admission.
   * @returns Recorded admission or completion receipt.
   */
  async reviewCycle(agent: Agent, cycleId: CycleId, evidence: ReviewEvidence | undefined, signal: AbortSignal): Promise<string> {
    this.shutdown.signal.throwIfAborted();
    const admission = this.advance(agent, cycleId, evidence, AbortSignal.any([signal, this.shutdown.signal]));
    this.admissions.add(admission);
    try { return await admission; } finally { this.admissions.delete(admission); }
  }
  private async advance(agent: Agent, cycleId: CycleId, evidence: ReviewEvidence | undefined, signal: AbortSignal): Promise<string> {
    if (this.admitted.get(agent) !== 'orchestrator') throw new Error('studio-managed-recovery-required');
    if (this.uncertain.has(agent)) throw new Error('studio-admission-unknown');
    if (this.pending.has(agent)) throw new Error('studio-admission-pending');
    const rows = this.describe(agent.id).filter(row => row.parentId === agent.id && row.cycleId === cycleId);
    const implementer = rows.find(row => row.role === 'implementer');
    if (!implementer) throw new Error('studio-cycle-not-found');
    if (rows.some(row => row.state !== 'completed')) throw new Error('studio-cycle-not-ready');
    const reviewer = rows.find(row => row.role === 'reviewer');
    if (evidence !== undefined) {
      if (reviewer || implementer.cycleCompletedAt !== undefined) throw new Error('studio-review-already-requested');
      return this.admit(agent, JSON.stringify({ requirementsAndEvidence: evidence, implementerOutput: implementer.output }), signal, implementer.cycleId);
    }
    if (!reviewer || reviewer.judgment?.judgment !== 'pass' || reviewer.judgment.additionalVerification.length > 0) throw new Error('studio-review-pass-required');
    if (implementer.cycleCompletedAt !== undefined) return JSON.stringify({ cycleId, state: 'completed' });
    this.pending.add(agent);
    try {
      signal.throwIfAborted();
      await this.domain.table('children').update(implementer.childId, row => ({ ...row, cycleCompletedAt: Date.now() }));
      return JSON.stringify({ cycleId, state: 'completed' });
    } finally { this.pending.delete(agent); }
  }
  private async admit(agent: Agent, prompt: string, signal: AbortSignal, cycleId?: CycleId): Promise<string> {
    if (this.admitted.get(agent) !== 'orchestrator') throw new Error('studio-managed-recovery-required');
    if (this.uncertain.has(agent)) throw new Error('studio-admission-unknown');
    if (this.pending.has(agent)) throw new Error('studio-admission-pending');
    const role = cycleId === undefined ? 'implementer' : 'reviewer';
    const captured = this.ctx.studioRoles.capture(role);
    const domain = this.domain;
    this.pending.add(agent);
    const record: DelegationRecord = {
      cycleId: cycleId ?? brandString<CycleId>(randomUUID()), operationId: brandString<OperationId>(randomUUID()),
      parentId: agent.id, childId: SessionId(randomUUID()), role, context: 'fresh',
      snapshotId: captured.snapshotId, settings: captured.settings, state: 'reserved', prompt, createdAt: Date.now(),
      messageId: null, diagnostic: null, output: null, observed: null, reworkCount: 0,
    };
    const table = domain.table('children');
    try {
      await table.put(record.childId, record);
      this.reservations.set(record.childId, record);
      const activation = await this.ctx.subagents.startActivation({
        provider: 'spawn', label: `Studio ${role}`, childId: record.childId, delivery: 'caller', signal,
        request: { ...(role === 'reviewer' ? { outputSchema: reviewOutputSchema } : {}), parent: agent, prompt: [{ type: 'text', text: prompt }], persona: captured.settings.instructions,
          agentOptions: { provider: captured.settings.provider, model: captured.settings.model,
            ...(captured.settings.reasoningEffort === undefined ? {} : { reasoningEffort: ReasoningEffortId(captured.settings.reasoningEffort) }) },
        },
      });
      this.activations.add(activation);
      const outcome = activation.result.then(result => ({ result }), error => ({ error }));
      const receiptWrite = Promise.resolve().then(() => table.update(record.childId, row => ({ ...row, state: 'running', messageId: activation.messageId })));
      const settlement = outcome.then(async outcome => {
        await receiptWrite;
        if ('error' in outcome) throw outcome.error;
        const result = outcome.result;
        const output = result.output.filter(block => block.type === 'text').map(block => block.text).join('\n');
        const judgment = role === 'reviewer' && result.stopReason === 'completed' ? reviewJudgment.safeParse(result.structured) : undefined;
        await table.update(record.childId, row => ({ ...row, state: result.stopReason === 'completed' ? 'completed' : result.stopReason === 'error' ? 'failed' : 'interrupted', output, diagnostic: judgment && !judgment.success ? 'studio-review-invalid-result' : result.diagnostic ?? null, observed: this.observed.get(record.childId) ?? null, ...(judgment?.success ? { judgment: judgment.data } : {}) }));
      }).catch(() => {
        // A failed durable settlement cannot be presented as a trustworthy success.
        this.uncertain.add(agent);
        this.failures.set(record.childId, 'studio-settlement-unknown');
      }).finally(() => {
        this.reservations.delete(record.childId);
        this.observed.delete(record.childId);
        this.settlements.delete(settlement);
        this.activations.delete(activation);
      });
      this.settlements.add(settlement);
      try { await receiptWrite; } catch (error) { await activation.dispose(); throw error; }
      return JSON.stringify({ cycleId: record.cycleId, operationId: record.operationId, childId: record.childId, messageId: activation.messageId, state: 'running' });
    } catch (error) {
      // Retain uncertain admission; no automatic retry or fresh child allocation.
      const saved = table.get(record.childId);
      if (saved?.state === 'reserved' || saved?.state === 'running') {
        this.uncertain.add(agent);
        await table.update(record.childId, row => ({ ...row, state: 'unknown' }));
      }
      throw error;
    } finally {
      this.pending.delete(agent);
    }
  }
}
