/** Managed Studio admission with durable-log verification before owner recovery. */
import { randomUUID } from 'node:crypto';
import { startChild, drainChildren, observeInitial } from './child-runtime.ts';
import type { ChildReceipt } from './child-runtime-types.ts';
import { Service, type Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type {} from '@deepseek-ai/dsh-agent-preset-registry';
import { defineTool, type ToolExecution } from '@deepseek-ai/dsh-tools';
import type {} from '@deepseek-ai/dsh-subagent';
import type {} from '@deepseek-ai/dsh-session-query';
import type {} from '@deepseek-ai/dsh-session-persistence';
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
  static inject = ['studioRoles', 'tools', 'agentPresets', 'storageDomain', 'subagents', 'sessionQuery', 'sessionPersistence', 'llm'];
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
  private readonly settlements = new Map<Promise<void>, SessionId>();
  private readonly activations = new Set<NonNullable<ChildReceipt['completion']>>();
  private readonly failures = new Map<SessionId, string>();
  private readonly admissions = new Map<Promise<string>, Agent>();
  private readonly stops = new Map<CycleId, Promise<string>>();
  private readonly admissionCancellation = new Map<OperationId, AbortController>();
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
      await Promise.allSettled(this.admissions.keys());
      const disposed = await Promise.allSettled([
        ...[...this.activations].map(activation => activation.dispose()),
        ...[...new Set(this.owners.values())].map(owner => drainChildren(ctx, owner, [...this.followups.values()].filter(operation => operation.record.parentId === owner.id).map(operation => operation.record.childId))),
      ]);
      await Promise.allSettled(this.settlements.keys());
      const recorded = await Promise.allSettled([...this.followups.values()].map(operation => domain.table('children').update(operation.record.childId, row => ({ ...row, lastConfirmedState: row.lastConfirmedState ?? row.state, state: 'unknown', diagnostic: 'studio-shutdown-unsettled', ...(row.role === 'implementer' ? { cyclePhase: 'unknown' as const } : {}) }))));
      await Promise.allSettled(this.stops.values());
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
    ctx.on('agent/created', async ({ agent, source }) => {
      if (ctx.agentPresets.composedPreset(agent.ctx) !== MANAGED_PRESET) return;
      this.live.set(agent.id, agent);
      agent.ctx.effect(() => () => { if (this.live.get(agent.id) === agent) this.live.delete(agent.id); });
      agent.ctx.effect(() => agent.ctx.tools.presentAs('native'));
      const reservation = this.reservations.get(agent.id);
      const child = reservation !== undefined && reservation.parentId === agent.session.header.parentSession && (source === 'startup' || (source === 'resume' && this.followups.has(agent.id) && this.owners.get(reservation.cycleId)?.id === reservation.parentId));
      const root = !agent.session.header.parentSession;
      if (root && source === 'resume') await this.restoreOwner(agent);
      if (!child && agent.session.header.parentSession) throw new Error('studio-managed-recovery-required');
      const capabilities = child ? reservation.role === 'reviewer' ? REVIEW_TOOLS : CHILD_TOOLS : root ? ROOT_TOOLS : new Set<string>();
      const names = ctx.tools.schemas(agent).map(tool => tool.name).filter(name => name !== 'structured_output' && capabilities.has(name));
      agent.ctx.effect(() => agent.ctx.tools.restrict({ allow: names }));
      if (child) {
        if (source === 'startup') await domain.table('children').update(agent.id, row => ({ ...row, inheritedEventCount: agent.session.inheritedEventCount }));
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
  private async reconcileAcceptance(record: DelegationRecord, initial = false): Promise<MessageId | undefined> {
    try {
      using observation = await this.ctx.sessionQuery.observeSession(record.childId, { projectionMode: 'none' });
      const matches = new Set<MessageId>();
      for (const event of observation.events) {
        if (event.type !== 'agent/inbox/spliced') continue;
        for (const message of event.data.inserted) {
          const texts = message.content.filter(block => block.type === 'text').map(block => block.text);
          if (initial && texts.join('\n') === record.prompt) { matches.add(message.id); continue; }
          for (const text of texts) {
            let value: unknown;
            try { value = JSON.parse(text); } catch (_syntaxError) { continue; }
            if (typeof value === 'object' && value !== null && 'operationId' in value && value.operationId === record.operationId && 'cycleId' in value && value.cycleId === record.cycleId) matches.add(message.id);
          }
        }
      }
      return matches.size === 1 ? [...matches][0] : undefined;
    } catch (_queryError) { return undefined; } // Unavailable evidence cannot authorize a retry.
  }
  private async operationEvidence(row: DelegationRecord) {
    await using stored = await this.ctx.sessionPersistence.open(row.childId, 'read');
    if (stored.header.parentSession !== row.parentId || stored.header.agentPreset !== MANAGED_PRESET || stored.inheritedEventCount !== row.inheritedEventCount) throw new Error('studio-recovery-identity-mismatch');
    const { events } = await stored.read(stored.inheritedEventCount);
    const pending: Record<'next-turn' | 'next-step', MessageId[]> = { 'next-turn': [], 'next-step': [] };
    let openTurn: number | undefined;
    let claimedTurn: number | undefined;
    let terminal: TurnEndReason | undefined;
    let lastTurn: number | undefined;
    let dropped = false;
    for (const event of events) {
      if (event.type === 'turn/start') { openTurn = event.data.turn; lastTurn = openTurn; }
      if (event.type === 'agent/inbox/spliced') {
        const { target, start, removedCount = 0, inserted, outcome } = event.data;
        const removed = pending[target].splice(start, removedCount, ...inserted.map(message => message.id));
        if (row.messageId !== null && removed.includes(row.messageId)) {
          if (outcome === 'canceled') dropped = true;
          else claimedTurn = openTurn;
        }
      }
      if (event.type === 'turn/end') {
        if (event.data.turn === claimedTurn) terminal = event.data.reason;
        openTurn = undefined;
      }
    }
    const settled = !pending['next-turn'].length && !pending['next-step'].length && openTurn === undefined && (dropped || (claimedTurn !== undefined && claimedTurn === lastTurn && terminal !== undefined));
    return { settled, terminal, dropped };
  }
  /** Freeze admission and await the selected cycle's execution and durable outcome.
   * @param agent Owning managed orchestrator.
   * @param cycleId Recorded cycle to stop.
   * @returns Recorded stop observation; confirmation never implies that work was rolled back.
   */
  async stop(agent: Agent, cycleId: CycleId): Promise<string> {
    this.shutdown.signal.throwIfAborted();
    if (this.admitted.get(agent) !== 'orchestrator' || !this.describe(agent.id).some(row => row.parentId === agent.id && row.cycleId === cycleId)) throw new Error('studio-managed-recovery-required');
    const existing = this.stops.get(cycleId);
    if (existing) return existing;
    this.uncertain.add(agent);
    const stopping = this.stopCycle(agent, cycleId);
    this.stops.set(cycleId, stopping);
    return stopping;
  }
  private async stopCycle(agent: Agent, cycleId: CycleId): Promise<string> {
    const table = this.domain.table('children');
    const rows = this.describe(agent.id).filter(row => row.cycleId === cycleId);
    const requestedAt = Date.now();
    try {
      const intentFailures: unknown[] = [];
      for (const row of rows) {
        try { await table.update(row.childId, saved => ({ ...saved, stop: { requestedAt, status: 'requested' } })); }
        catch (error) { intentFailures.push(error); }
      }
      for (const row of this.describe(agent.id).filter(row => row.cycleId === cycleId)) {
        this.admissionCancellation.get(row.operationId)?.abort(new Error('studio-stop-requested'));
        if (row.cycleOperation) this.admissionCancellation.get(row.cycleOperation)?.abort(new Error('studio-stop-requested'));
      }
      await Promise.allSettled([...this.admissions].filter(([, owner]) => owner === agent).map(([admission]) => admission));
      const current = this.describe(agent.id).filter(row => row.cycleId === cycleId);
      const ids = current.map(row => row.childId);
      await drainChildren(this.ctx, agent, ids);
      await Promise.allSettled([...this.settlements].filter(([, childId]) => ids.includes(childId)).map(([settlement]) => settlement));
      if (intentFailures.length === 1) throw intentFailures[0];
      if (intentFailures.length > 1) throw new AggregateError(intentFailures, 'studio-stop-intent-write-failed');
      for (const row of current) {
        const saved = table.get(row.childId)!;
        const evidence = await this.operationEvidence(saved);
        const confirmed = evidence.settled && !this.failures.has(row.childId);
        await table.update(row.childId, latest => ({ ...latest, stop: { requestedAt, status: confirmed ? 'confirmed' : 'unknown' }, ...(evidence.dropped ? { state: 'interrupted' as const, diagnostic: 'studio-stop-input-canceled' } : {}), ...(latest.role === 'implementer' ? { cyclePhase: 'unknown' as const } : {}) }));
      }
      return JSON.stringify({ cycleId, records: this.describe(agent.id).filter(row => row.cycleId === cycleId) });
    } catch (error) {
      for (const row of this.describe(agent.id).filter(row => row.cycleId === cycleId)) {
        this.failures.set(row.childId, 'studio-stop-unknown');
        try { await table.update(row.childId, saved => ({ ...saved, stop: { requestedAt, status: 'unknown' }, diagnostic: 'studio-stop-unknown' })); }
        catch (_storageError) { /* The live diagnostic remains available when durable reporting also fails. */ }
      }
      throw error;
    }
  }
  private async restoreOwner(agent: Agent): Promise<void> {
    const rows = [...this.domain.table('children').entries()].map(([, row]) => row).filter(row => row.parentId === agent.id);
    if (!rows.length) throw new Error('studio-managed-recovery-required');
    for (const row of rows) {
      try {
        const implementer = rows.find(item => item.cycleId === row.cycleId && item.role === 'implementer');
        if (!implementer || implementer.reworkCap === undefined || !['review-ready', 'judged', 'complete'].includes(implementer.cyclePhase ?? '') || row.state !== 'completed' || row.messageId === null || row.inheritedEventCount === undefined) throw new Error('studio-recovery-unsettled');
        const evidence = await this.operationEvidence(row);
        if (!evidence.settled || evidence.terminal?.kind !== 'completed' || row.stop) throw new Error('studio-recovery-terminal-unconfirmed');
        const models = await this.ctx.llm.listModels(row.settings.provider);
        if (!models.some(model => model.id === row.settings.model)) throw new Error('studio-recovery-model-unavailable');
        await this.ctx.llm.resolveCallConfig({ provider: row.settings.provider, model: row.settings.model, ...(row.settings.reasoningEffort === undefined ? {} : { reasoningEffort: ReasoningEffortId(row.settings.reasoningEffort) }) });
      } catch (error) {
        this.uncertain.add(agent);
        const diagnostic = error instanceof Error ? error.message : 'studio-recovery-unavailable';
        this.failures.set(row.childId, diagnostic);
        await this.domain.table('children').update(row.childId, saved => ({ ...saved, diagnostic }));
      }
    }
    if (!this.uncertain.has(agent)) for (const row of rows) this.owners.set(row.cycleId, agent);
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
        return failure ? { ...copy, lastConfirmedState: copy.lastConfirmedState ?? copy.state, state: 'unknown', diagnostic: failure } : copy;
      });
  }
  /** Start a fresh child only after its detached role reservation is durable.
   * @param agent Current managed orchestrator.
   * @param prompt Additional task input, separate from any inherited history.
   * @param signal Caller cancellation before publication.
   * @param context Initial context selection; fork inherits completed parent turns only.
   * @returns Durable accepted identifiers; the child continues independently.
   */
  async initial(agent: Agent, prompt: string, signal: AbortSignal, context: 'fresh' | 'fork' = 'fresh'): Promise<string> {
    this.shutdown.signal.throwIfAborted();
    const admission = this.admit(agent, prompt, AbortSignal.any([signal, this.shutdown.signal]), undefined, context);
    this.admissions.set(admission, agent);
    try { return await admission; } finally { this.admissions.delete(admission); }
  }
  /** Admit review or explicit completion for an owned settled cycle.
   * @param agent Live managed orchestrator.
   * @param cycleId Previously issued cycle identity.
   * @param evidence Explicit review input, omitted only for completion.
   * @param signal Caller cancellation before admission.
   * @param context First reviewer context; forbidden for subsequent reviews.
   * @returns Recorded admission or completion receipt.
   */
  async reviewCycle(agent: Agent, cycleId: CycleId, evidence: ReviewEvidence | undefined, signal: AbortSignal, context?: 'fresh' | 'fork'): Promise<string> {
    this.shutdown.signal.throwIfAborted();
    const admission = this.advance(agent, cycleId, evidence, AbortSignal.any([signal, this.shutdown.signal]), context);
    this.admissions.set(admission, agent);
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
    this.admissions.set(admission, agent);
    try { return await admission; } finally { this.admissions.delete(admission); }
  }
  private async sendRework(agent: Agent, cycleId: CycleId, prompt: string, signal: AbortSignal): Promise<string> {
    if (this.admitted.get(agent) !== 'orchestrator' || this.owners.get(cycleId) !== agent) throw new Error('studio-managed-recovery-required');
    if (this.uncertain.has(agent) || this.pending.has(agent)) throw new Error('studio-admission-pending-or-unknown');
    const rows = this.describe(agent.id).filter(row => row.cycleId === cycleId);
    const original = rows.find(row => row.role === 'implementer');
    if (!original || original.reworkCap === undefined || original.cycleCompletedAt !== undefined || (original.cyclePhase !== 'judged' && original.cyclePhase !== 'review-ready') || rows.some(row => row.state !== 'completed')) throw new Error('studio-cycle-not-ready');
    const operationId = brandString<OperationId>(randomUUID());
    const cancellation = new AbortController();
    this.admissionCancellation.set(operationId, cancellation);
    signal = AbortSignal.any([signal, cancellation.signal]);
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
        const reconciledMessageId = await this.reconcileAcceptance(record);
        await table.update(record.childId, row => ({ ...row, ...(reconciledMessageId ? { reconciledMessageId } : {}), lastConfirmedState: row.lastConfirmedState ?? row.state, state: 'unknown', cyclePhase: 'unknown' }));
        throw error;
      }
    } finally { this.admissionCancellation.delete(operationId); this.pending.delete(agent); }
  }
  private async sendReview(agent: Agent, implementer: DelegationRecord, reviewer: DelegationRecord, evidence: ReviewEvidence, signal: AbortSignal): Promise<string> {
    if (this.owners.get(implementer.cycleId) !== agent) throw new Error('studio-managed-recovery-required');
    this.pending.add(agent);
    const table = this.domain.table('children');
    const operationId = brandString<OperationId>(randomUUID());
    const cancellation = new AbortController();
    this.admissionCancellation.set(operationId, cancellation);
    signal = AbortSignal.any([signal, cancellation.signal]);
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
      const savedReviewer = table.get(reviewer.childId);
      if (savedReviewer) {
        const reconciledMessageId = await this.reconcileAcceptance(savedReviewer);
        if (reconciledMessageId) await table.update(reviewer.childId, row => ({ ...row, reconciledMessageId }));
      }
      await table.update(implementer.childId, row => ({ ...row, cyclePhase: 'unknown' }));
      throw error;
    } finally { this.admissionCancellation.delete(operationId); this.pending.delete(agent); }
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
    this.settlements.set(settlement, childId);
  }
  private async advance(agent: Agent, cycleId: CycleId, evidence: ReviewEvidence | undefined, signal: AbortSignal, context?: 'fresh' | 'fork'): Promise<string> {
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
        if (context !== undefined) throw new Error('studio-context-creation-only');
        if (implementer.cyclePhase !== 'review-ready' || implementer.reworkCount === 0) throw new Error('studio-review-already-requested');
        return this.sendReview(agent, implementer, reviewer, evidence, signal);
      }
      return this.admit(agent, JSON.stringify({ requirementsAndEvidence: evidence, implementerOutput: implementer.output }), signal, implementer.cycleId, context);
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
  private async admit(agent: Agent, prompt: string, signal: AbortSignal, cycleId?: CycleId, context: 'fresh' | 'fork' = 'fresh'): Promise<string> {
    if (this.admitted.get(agent) !== 'orchestrator') throw new Error('studio-managed-recovery-required');
    if (this.uncertain.has(agent)) throw new Error('studio-admission-unknown');
    if (this.pending.has(agent)) throw new Error('studio-admission-pending');
    const role = cycleId === undefined ? 'implementer' : 'reviewer';
    if (observeInitial && role === 'reviewer') prompt = JSON.stringify({ evidence: prompt, instruction: 'Submit current judgment with studio_review_submit.' });
    const captured = this.ctx.studioRoles.capture(role);
    const domain = this.domain;
    this.pending.add(agent);
    const record: DelegationRecord = {
      cycleId: cycleId ?? brandString<CycleId>(randomUUID()), operationId: brandString<OperationId>(randomUUID()),
      parentId: agent.id, childId: SessionId(randomUUID()), role, context,
      snapshotId: captured.snapshotId, settings: captured.settings, state: 'reserved', prompt, createdAt: Date.now(),
      messageId: null, diagnostic: null, output: null, observed: null, reworkCount: 0,
      ...(cycleId === undefined ? { reworkCap: this.reworkCap, cyclePhase: 'implementation' as const } : {}),
    };
    if (role === 'implementer') record.cycleOperation = record.operationId;
    const table = domain.table('children');
    const implementer = role === 'reviewer' ? [...table.entries()].map(([, row]) => row).find(row => row.cycleId === cycleId && row.role === 'implementer') : undefined;
    const cancellation = new AbortController();
    this.admissionCancellation.set(record.operationId, cancellation);
    signal = AbortSignal.any([signal, cancellation.signal]);
    try {
      if (context === 'fork') {
        using observation = await this.ctx.sessionQuery.observeSession(agent.id, { signal, projectionMode: 'none' });
        const events = observation.events;
        const completed = events.findLastIndex(event => event.type === 'turn/end');
        const evidence = events.slice(completed + 1).flatMap(event => {
          const content = event.type === 'user/message' ? event.data.content : event.type === 'assistant/message' || event.type === 'tool/result' ? event.data.message.content : undefined;
          const text = content?.filter(block => block.type === 'text').map(block => block.text);
          return text?.length ? [{ seq: event.seq, type: event.type, text }] : [];
        });
        record.inputCapturedThroughSeq = observation.cursor;
        record.prompt = JSON.stringify({ additionalTask: prompt, parentEvidence: { capturedThroughSeq: observation.cursor, events: evidence } });
      }
      if (implementer?.reworkCap !== undefined) await table.update(implementer.childId, row => {
        if (row.cyclePhase !== 'review-ready') throw new Error('studio-cycle-not-ready');
        return { ...row, cyclePhase: 'review', cycleOperation: record.operationId };
      });
      await table.put(record.childId, record);
      if (role === 'implementer') this.owners.set(record.cycleId, agent);
      this.reservations.set(record.childId, record);
      if (observeInitial) this.followups.set(record.childId, { record, claims: new Map(), turns: new Map(), settling: false });
      const receipt = await startChild(this.ctx, {
        provider: context === 'fork' ? 'fork' : 'spawn', label: `Studio ${role}`, childId: record.childId, signal,
        request: { ...(role === 'reviewer' ? { outputSchema: reviewOutputSchema } : {}), parent: agent, prompt: [{ type: 'text', text: record.prompt }], persona: captured.settings.instructions,
          agentOptions: { provider: captured.settings.provider, model: captured.settings.model,
            ...(captured.settings.reasoningEffort === undefined ? {} : { reasoningEffort: ReasoningEffortId(captured.settings.reasoningEffort) }) },
        },
      });
      const activation = receipt.completion;
      if (!activation) {
        try { await table.update(record.childId, row => ({ ...row, state: 'running', messageId: receipt.messageId })); }
        catch (error) { await drainChildren(this.ctx, agent, [record.childId]); throw error; }
        this.followups.get(record.childId)!.messageId = receipt.messageId;
        this.scheduleFollowup(record.childId);
        return JSON.stringify({ cycleId: record.cycleId, operationId: record.operationId, childId: record.childId, messageId: receipt.messageId, state: 'running' });
      }
      this.activations.add(activation);
      const outcome = activation.result.then(result => ({ result }), error => ({ error }));
      const receiptWrite = Promise.resolve().then(() => table.update(record.childId, row => ({ ...row, state: 'running', messageId: receipt.messageId })));
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
      this.settlements.set(settlement, record.childId);
      try { await receiptWrite; } catch (error) { await activation.dispose(); throw error; }
      return JSON.stringify({ cycleId: record.cycleId, operationId: record.operationId, childId: record.childId, messageId: receipt.messageId, state: 'running' });
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
        const reconciledMessageId = await this.reconcileAcceptance(record, true);
        await table.update(record.childId, row => ({ ...row, ...(reconciledMessageId ? { reconciledMessageId } : {}), lastConfirmedState: row.lastConfirmedState ?? row.state, state: 'unknown' }));
      }
      throw error;
    } finally {
      this.admissionCancellation.delete(record.operationId);
      this.pending.delete(agent);
    }
  }
}
