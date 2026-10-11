/** Managed Studio admission; durable links are never cold-process authority. */
import { randomUUID } from 'node:crypto';
import { Service, type Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type {} from '@deepseek-ai/dsh-agent-preset-registry';
import { defineTool, type ToolExecution } from '@deepseek-ai/dsh-tools';
import type {} from '@deepseek-ai/dsh-subagent';
import type { Domain } from '@deepseek-ai/dsh-storage-domain';
import { SessionId, type TurnEndReason } from '@deepseek-ai/dsh-session';
import { ReasoningEffortId, type MessageId, type ToolCallId } from '@deepseek-ai/dsh-llm';
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
  private readonly owners = new Map<CycleId, Agent>();
  private readonly followups = new Map<SessionId, { record: DelegationRecord; claims: Map<MessageId, number>; messageId?: MessageId; turns: Map<number, { output: string; finish?: TurnEndReason }>; settling: boolean; judgment?: NonNullable<DelegationRecord['judgment']> }>();
  private readonly captures = new WeakMap<Readonly<ToolExecution>, { operationId: OperationId; judgment: NonNullable<DelegationRecord['judgment']> }>();
  private readonly live = new Map<SessionId, Agent>();
  private readonly captureAgents = new WeakSet<Agent>();
  private readonly calls = new WeakMap<Agent, Map<ToolCallId, number>>();
  private readonly pending = new WeakSet<Agent>();
  private readonly uncertain = new WeakSet<Agent>();
  private readonly observed = new Map<SessionId, NonNullable<DelegationRecord['observed']>>();
  private readonly settlements = new Set<Promise<void>>();
  private readonly activations = new Set<import('@deepseek-ai/dsh-subagent').SubagentActivation>();
  private readonly failures = new Map<SessionId, string>();
  private readonly admissions = new Set<Promise<string>>();
  private readonly shutdown = new AbortController();
  private readonly domain: Domain<typeof delegationSpec>;
  private readonly reworkCap: number;
  constructor(ctx: Context, policy: { domain: Domain<typeof delegationSpec>; reworkCap: number }) {
    super(ctx, 'studioDelegation');
    const { domain } = policy;
    this.domain = domain;
    this.reworkCap = policy.reworkCap;
    ctx.effect(() => async () => {
      this.shutdown.abort(new Error('studio-delegation-closed'));
      await Promise.allSettled(this.admissions);
      const disposed = await Promise.allSettled([
        ...[...this.activations].map(activation => activation.dispose()),
        ...[...new Set(this.owners.values())].map(owner => ctx.subagents.drainChildren(owner, [...this.followups.values()].filter(operation => operation.record.parentId === owner.id).map(operation => operation.record.childId))),
      ]);
      await Promise.allSettled(this.settlements);
      const recorded = await Promise.allSettled([...this.followups.values()].map(operation => domain.table('children').update(operation.record.childId, row => ({ ...row, state: 'unknown', diagnostic: 'studio-shutdown-unsettled', ...(row.role === 'implementer' ? { cyclePhase: 'unknown' as const } : {}) }))));
      const closed = await Promise.allSettled([domain.close()]);
      const failures = [...disposed, ...recorded, ...closed].filter(result => result.status === 'rejected');
      if (failures.length) throw new AggregateError(failures.map(result => result.reason), 'studio-disposal-failed');
    });
    ctx.effect(() => ctx.tools.guard(exec => {
      if (!exec.agent || ctx.agentPresets.composedPreset(exec.agent.ctx) !== MANAGED_PRESET) return;
      const role = this.admitted.get(exec.agent);
      if (!role) return 'studio-managed-recovery-required';
      if (role === 'reviewer' && exec.name === 'studio_review_submit' && this.followups.get(exec.agent.id)?.record.role === 'reviewer') return;
      if (!(role === 'orchestrator' ? ROOT_TOOLS : role === 'reviewer' ? REVIEW_TOOLS : CHILD_TOOLS).has(exec.name)) return 'studio-managed-tool-denied';
    }));
    ctx.on('session/event', (session, event) => {
      if (!this.reservations.has(session.id)) return;
      if (event.type === 'request/header') {
        const config = event.data.header.config;
        this.observed.set(session.id, { provider: config.provider, model: config.model, reasoningEffort: config.reasoningEffort ?? null });
      }
      const operation = this.followups.get(session.id);
      if (!operation) return;
      if (event.type === 'tool/call') {
        const agent = this.live.get(session.id);
        if (agent) {
          const calls = this.calls.get(agent) ?? new Map<ToolCallId, number>();
          calls.set(event.data.callId, event.data.turn);
          this.calls.set(agent, calls);
        }
      }
      if (event.type === 'assistant/message' || event.type === 'turn/end') {
        const turn = operation.turns.get(event.data.turn) ?? { output: '' };
        if (event.type === 'assistant/message') turn.output = event.data.message.content.filter(block => block.type === 'text').map(block => block.text).join('\n');
        else turn.finish = event.data.reason;
        operation.turns.set(event.data.turn, turn);
        this.scheduleFollowup(session.id);
      }
    });
    ctx.on('agent/inbox/claimed', ({ agent, message, turn }) => {
      const operation = this.followups.get(agent.id);
      if (!operation) return;
      operation.claims.set(message.id, turn);
      this.scheduleFollowup(agent.id);
    });
    ctx.on('agent/created', ({ agent, source }) => {
      if (ctx.agentPresets.composedPreset(agent.ctx) !== MANAGED_PRESET) return;
      this.live.set(agent.id, agent);
      agent.ctx.effect(() => () => { if (this.live.get(agent.id) === agent) this.live.delete(agent.id); });
      agent.ctx.effect(() => agent.ctx.tools.presentAs('native'));
      const reservation = this.reservations.get(agent.id);
      const child = reservation !== undefined && reservation.parentId === agent.session.header.parentSession && (source === 'startup' || (source === 'resume' && this.followups.has(agent.id) && this.owners.get(reservation.cycleId)?.id === reservation.parentId));
      const root = source === 'startup' && !agent.session.header.parentSession;
      const capabilities = child ? reservation.role === 'reviewer' ? REVIEW_TOOLS : CHILD_TOOLS : root ? ROOT_TOOLS : new Set<string>();
      const names = ctx.tools.schemas(agent).map(tool => tool.name).filter(name => name !== 'structured_output' && capabilities.has(name));
      agent.ctx.effect(() => agent.ctx.tools.restrict({ allow: names }));
      if (child) {
        this.admitted.set(agent, reservation.role);
        if (reservation.role === 'reviewer' && this.followups.has(agent.id)) this.installCapture(agent);
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
   * @returns Detached records with live uncertainty diagnostics; empty means no recorded managed membership.
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
  /** Reserve one counted same-child implementation wake.
   * @param agent Actual owning orchestrator.
   * @param cycleId Existing cycle identity.
   * @param prompt Work or verification requested.
   * @param signal Cancellation before acceptance.
   * @returns Accepted operation identity.
   */
  async rework(agent: Agent, cycleId: CycleId, prompt: string, signal: AbortSignal): Promise<string> {
    const admission = this.sendRework(agent, cycleId, prompt, AbortSignal.any([signal, this.shutdown.signal]));
    this.admissions.add(admission);
    try { return await admission; } finally { this.admissions.delete(admission); }
  }
  private async sendRework(agent: Agent, cycleId: CycleId, prompt: string, signal: AbortSignal): Promise<string> {
    if (this.admitted.get(agent) !== 'orchestrator' || this.owners.get(cycleId) !== agent) throw new Error('studio-managed-recovery-required');
    if (this.uncertain.has(agent) || this.pending.has(agent)) throw new Error('studio-admission-pending-or-unknown');
    const rows = this.describe(agent.id).filter(row => row.cycleId === cycleId);
    const original = rows.find(row => row.role === 'implementer');
    if (!original || original.reworkCap === undefined || original.cycleCompletedAt !== undefined || (original.cyclePhase !== 'judged' && original.cyclePhase !== 'review-ready') || rows.some(row => row.state !== 'completed')) throw new Error('studio-cycle-not-ready');
    const operationId = brandString<OperationId>(randomUUID());
    this.pending.add(agent);
    const table = this.domain.table('children');
    try {
      signal.throwIfAborted();
      await table.update(original.childId, row => {
        if (row.state !== 'completed' || (row.cyclePhase !== 'judged' && row.cyclePhase !== 'review-ready') || row.reworkCap === undefined || row.reworkCount >= row.reworkCap) throw new Error('studio-rework-cap-or-conflict');
        return { ...row, operationId, cycleOperation: operationId, cyclePhase: 'implementation', reworkCount: row.reworkCount + 1, state: 'reserved', messageId: null, output: null, diagnostic: null, observed: null };
      });
      const record = table.get(original.childId)!;
      this.reservations.set(record.childId, record);
      this.followups.set(record.childId, { record, claims: new Map(), turns: new Map(), settling: false });
      try {
        const messageId = await this.ctx.subagents.sendMessage(agent, record.childId, [{ type: 'text', text: JSON.stringify({ cycleId, operationId, prompt }) }], { signal });
        await table.update(record.childId, row => ({ ...row, state: 'running', messageId }));
        const operation = this.followups.get(record.childId)!;
        operation.messageId = messageId;
        this.scheduleFollowup(record.childId);
        return JSON.stringify({ cycleId, operationId, childId: record.childId, messageId, state: 'running' });
      } catch (error) {
        this.uncertain.add(agent);
        this.failures.set(record.childId, 'studio-acceptance-unknown');
        await table.update(record.childId, row => ({ ...row, state: 'unknown', cyclePhase: 'unknown' }));
        throw error;
      }
    } finally { this.pending.delete(agent); }
  }
  private async sendReview(agent: Agent, implementer: DelegationRecord, reviewer: DelegationRecord, evidence: ReviewEvidence, signal: AbortSignal): Promise<string> {
    if (this.owners.get(implementer.cycleId) !== agent) throw new Error('studio-managed-recovery-required');
    this.pending.add(agent);
    const table = this.domain.table('children');
    const operationId = brandString<OperationId>(randomUUID());
    try {
      signal.throwIfAborted();
      await table.update(implementer.childId, row => {
        if (row.cyclePhase !== 'review-ready' || row.state !== 'completed') throw new Error('studio-cycle-not-ready');
        return { ...row, cyclePhase: 'review', cycleOperation: operationId };
      });
      await table.update(reviewer.childId, row => {
        const { judgment: _oldJudgment, ...rest } = row;
        return { ...rest, operationId, state: 'reserved', messageId: null, output: null, diagnostic: null, observed: null };
      });
      const record = table.get(reviewer.childId)!;
      this.reservations.set(record.childId, record);
      this.followups.set(record.childId, { record, claims: new Map(), turns: new Map(), settling: false });
      const resident = this.live.get(record.childId);
      if (resident) this.installCapture(resident);
      const messageId = await this.ctx.subagents.sendMessage(agent, record.childId, [{ type: 'text', text: JSON.stringify({ cycleId: record.cycleId, operationId, requirementsAndEvidence: evidence, implementerOutput: implementer.output, instruction: 'Submit current judgment with studio_review_submit.' }) }], { signal });
      await table.update(record.childId, row => ({ ...row, state: 'running', messageId }));
      this.followups.get(record.childId)!.messageId = messageId;
      this.scheduleFollowup(record.childId);
      return JSON.stringify({ cycleId: record.cycleId, operationId, childId: record.childId, messageId });
    } catch (error) {
      this.uncertain.add(agent);
      this.failures.set(implementer.childId, 'studio-acceptance-unknown');
      this.failures.set(reviewer.childId, 'studio-acceptance-unknown');
      await table.update(implementer.childId, row => ({ ...row, cyclePhase: 'unknown' }));
      throw error;
    } finally { this.pending.delete(agent); }
  }
  private installCapture(agent: Agent): void {
    if (this.captureAgents.has(agent)) return;
    this.captureAgents.add(agent);
    agent.ctx.effect(() => agent.ctx.tools.register(defineTool({
      name: 'studio_review_submit', description: 'Submit the judgment for the current logged Studio review operation only.',
      parameters: { judgment: { type: 'string', required: true, enum: ['pass', 'needs-changes', 'unable-to-judge'] }, explanation: { type: 'string', required: true }, evidence: { type: 'array', required: true, items: { type: 'string' } }, additionalVerification: { type: 'array', required: true, items: { type: 'string' } } },
      output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
      execute: async (args, exec) => {
        const operation = this.followups.get(agent.id);
        if (!operation || operation.record.role !== 'reviewer' || operation.judgment || exec.agent !== agent) throw new Error('studio-review-capture-unavailable');
        const callTurn = this.calls.get(agent)?.get(exec.callId);
        if (callTurn === undefined || ![...operation.claims.values()].includes(callTurn) || (operation.messageId !== undefined && operation.claims.get(operation.messageId) !== callTurn)) throw new Error('studio-review-operation-mismatch');
        const judgment = reviewJudgment.parse(args);
        this.captures.set(exec, { operationId: operation.record.operationId, judgment });
        exec.concludeTurn();
        return 'Structured output recorded.';
      },
    })));
    agent.ctx.on('tools/result', (exec, result) => {
      const captured = this.captures.get(exec);
      if (!captured) return;
      this.captures.delete(exec);
      const operation = this.followups.get(agent.id);
      if (!result.isError && operation?.record.operationId === captured.operationId && !operation.judgment) operation.judgment = captured.judgment;
    });
  }
  private scheduleFollowup(childId: SessionId): void {
    const operation = this.followups.get(childId);
    if (!operation || operation.settling || !operation.messageId) return;
    const number = operation.claims.get(operation.messageId);
    const turn = number === undefined ? undefined : operation.turns.get(number);
    if (!turn?.finish) return;
    const finish = turn.finish;
    operation.settling = true;
    const settlement = this.domain.table('children').update(childId, row => {
      if (row.operationId !== operation.record.operationId || row.state !== 'running') throw new Error('studio-operation-conflict');
      return { ...row, state: finish.kind === 'completed' ? 'completed' : finish.kind === 'error' ? 'failed' : finish.kind === 'aborted' ? 'interrupted' : 'unknown', ...(row.role === 'implementer' ? { cyclePhase: finish.kind === 'completed' ? 'review-ready' as const : 'unknown' as const } : {}), output: turn.output, observed: this.observed.get(childId) ?? null, ...(operation.judgment && finish.kind === 'completed' ? { judgment: operation.judgment } : {}), diagnostic: finish.kind !== 'completed' ? `studio-operation-${finish.kind}: ${JSON.stringify(finish)}` : row.role === 'reviewer' && !operation.judgment ? 'studio-review-invalid-result' : null };
    }).then(async () => {
      if (operation.record.role === 'reviewer') {
        const implementer = [...this.domain.table('children').entries()].map(([, row]) => row).find(row => row.cycleId === operation.record.cycleId && row.role === 'implementer')!;
        await this.domain.table('children').update(implementer.childId, row => {
          if (row.cycleOperation !== operation.record.operationId) throw new Error('studio-operation-conflict');
          return { ...row, cyclePhase: finish.kind === 'completed' ? 'judged' : 'unknown' };
        });
      }
      if (this.followups.get(childId) === operation) {
        this.followups.delete(childId); this.reservations.delete(childId); this.observed.delete(childId);
      }
    }).catch(() => {
      const owner = this.owners.get(operation.record.cycleId);
      if (owner) this.uncertain.add(owner);
      this.failures.set(childId, 'studio-settlement-unknown');
    }).finally(() => this.settlements.delete(settlement));
    this.settlements.add(settlement);
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
      if (implementer.cycleCompletedAt !== undefined) throw new Error('studio-review-already-requested');
      if (reviewer) {
        if (implementer.cyclePhase !== 'review-ready' || implementer.reworkCount === 0) throw new Error('studio-review-already-requested');
        return this.sendReview(agent, implementer, reviewer, evidence, signal);
      }
      return this.admit(agent, JSON.stringify({ requirementsAndEvidence: evidence, implementerOutput: implementer.output }), signal, implementer.cycleId);
    }
    if (implementer.reworkCap !== undefined && implementer.cycleCompletedAt === undefined && (implementer.cyclePhase !== 'judged' || implementer.cycleOperation !== reviewer?.operationId)) throw new Error('studio-current-review-required');
    if (!reviewer || reviewer.judgment?.judgment !== 'pass' || reviewer.judgment.additionalVerification.length > 0) throw new Error('studio-review-pass-required');
    if (implementer.cycleCompletedAt !== undefined) return JSON.stringify({ cycleId, state: 'completed' });
    this.pending.add(agent);
    try {
      signal.throwIfAborted();
      await this.domain.table('children').update(implementer.childId, row => {
        if (row.state !== 'completed' || (row.reworkCap !== undefined && (row.cyclePhase !== 'judged' || row.cycleOperation !== reviewer.operationId))) throw new Error('studio-current-review-required');
        return { ...row, cycleCompletedAt: Date.now(), ...(row.reworkCap !== undefined ? { cyclePhase: 'complete' as const } : {}) };
      });
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
      ...(cycleId === undefined ? { reworkCap: this.reworkCap, cyclePhase: 'implementation' as const } : {}),
    };
    if (role === 'implementer') record.cycleOperation = record.operationId;
    const table = domain.table('children');
    const implementer = role === 'reviewer' ? [...table.entries()].map(([, row]) => row).find(row => row.cycleId === cycleId && row.role === 'implementer') : undefined;
    try {
      if (implementer?.reworkCap !== undefined) await table.update(implementer.childId, row => {
        if (row.cyclePhase !== 'review-ready') throw new Error('studio-cycle-not-ready');
        return { ...row, cyclePhase: 'review', cycleOperation: record.operationId };
      });
      await table.put(record.childId, record);
      if (role === 'implementer') this.owners.set(record.cycleId, agent);
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
        await table.update(record.childId, row => ({ ...row, state: result.stopReason === 'completed' ? 'completed' : result.stopReason === 'error' ? 'failed' : 'interrupted', output, diagnostic: judgment && !judgment.success ? 'studio-review-invalid-result' : result.diagnostic ?? null, observed: this.observed.get(record.childId) ?? null, ...(judgment?.success ? { judgment: judgment.data } : {}), ...(role === 'implementer' && row.reworkCap !== undefined ? { cyclePhase: result.stopReason === 'completed' ? 'review-ready' as const : 'unknown' as const } : {}) }));
        if (implementer?.reworkCap !== undefined) await table.update(implementer.childId, row => {
          if (row.cycleOperation !== record.operationId) throw new Error('studio-operation-conflict');
          return { ...row, cyclePhase: result.stopReason === 'completed' ? 'judged' : 'unknown' };
        });
      }).catch(() => {
        // A failed durable settlement cannot be presented as a trustworthy success.
        this.uncertain.add(agent);
        this.failures.set(record.childId, 'studio-settlement-unknown');
      }).finally(() => {
        if (this.reservations.get(record.childId)?.operationId === record.operationId) {
          this.reservations.delete(record.childId);
          this.observed.delete(record.childId);
        }
        this.settlements.delete(settlement);
        this.activations.delete(activation);
      });
      this.settlements.add(settlement);
      try { await receiptWrite; } catch (error) { await activation.dispose(); throw error; }
      return JSON.stringify({ cycleId: record.cycleId, operationId: record.operationId, childId: record.childId, messageId: activation.messageId, state: 'running' });
    } catch (error) {
      // Retain uncertain admission; no automatic retry or fresh child allocation.
      if (implementer && table.get(implementer.childId)?.cycleOperation === record.operationId) {
        this.uncertain.add(agent);
        this.failures.set(implementer.childId, 'studio-acceptance-unknown');
        await table.update(implementer.childId, row => ({ ...row, cyclePhase: 'unknown' }));
      }
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
