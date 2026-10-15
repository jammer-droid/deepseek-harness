import { randomUUID } from 'node:crypto';
import type { Context } from '@deepseek-ai/cordis';
import type { UserMessage } from '@deepseek-ai/dsh-llm';
import type { GateApplied, GateInput, GateResult, GateRun } from '../pixie-gate-contracts.ts';
import { gateUsage, type PixieGateRecorder } from './pixie-gate-store.ts';
import type { PresetGate } from './pixie-gate-definitions.ts';
import { runGate } from './pixie-gate-pipeline.ts';
import type { GateHookRunner, StageRunner } from './pixie-gate-runner.ts';

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap { 'studio-pixie-gate': { kind: 'studio-pixie-gate' } }
}
declare module '@deepseek-ai/cordis' {
  interface Events {
    /** Observation only; decisions cannot be changed by listeners. */
    'pixie-gate/start'(run: GateRun): void;
    'pixie-gate/end'(run: GateRun): void;
  }
}
type Decision = { kind: 'reject' } | { kind: 'enter'; messages: UserMessage[]; startsRequestSeries?: true };
export interface InputAgent { id: string; ctx: Context; session: { header: { cwd?: string } } }
export interface GateInputDeps {
  definitions(): Promise<PresetGate[]>;
  preset(agent: InputAgent): string | undefined;
  isRoot(agent: InputAgent): boolean;
  policy(agent: InputAgent): GateInput['sandboxPolicy'];
  runner(): Promise<StageRunner & GateHookRunner>;
  recorder: PixieGateRecorder;
  emit(event: 'pixie-gate/start' | 'pixie-gate/end', run: GateRun): void;
}
const textOf = (message: UserMessage) => message.content.filter(block => block.type === 'text').map(block => block.text).join('\n');
/** One transaction per pre-step: a later rejection/cancellation must not partially apply earlier rewrites. */
export function gateInput(deps: GateInputDeps) {
  return async (payload: { agent: InputAgent; turn: number; signal: AbortSignal }, next: () => Promise<Decision>): Promise<Decision> => {
    const decision = await next();
    if (decision.kind === 'reject') return decision;
    const preset = deps.preset(payload.agent);
    if (!preset) return decision;
    const rows = await deps.definitions();
    const gate = rows.find(row => row.presetIds.includes(preset) && row.definition.point === 'input' && row.definition.enabled)?.definition;
    if (!gate) return decision;
    const root = deps.isRoot(payload.agent);
    if ((gate.match.agents === 'root' && !root) || (gate.match.agents === 'child' && root)) return decision;
    const protectedSources = ['runtime-context', 'model-selection', 'hooks-claude-code', 'hooks-codex', 'studio-pixie-gate'];
    const targets = decision.messages.filter(message => !protectedSources.includes(message.source.kind) && (gate.match.sources ?? ['user']).includes(message.source.kind));
    if (!targets.length) return decision;
    const context = decision.messages.filter(message => ['hooks-claude-code', 'hooks-codex'].includes(message.source.kind)).map(textOf);
    const hooksInput = context.length ? 'observed' as const : 'unverified' as const;
    const pending: { run: GateRun; result: GateResult; applied: GateApplied; rejection?: { reason: string; suggestion?: string } }[] = [];
    let messages = [...decision.messages];
    let rejected = false;
    for (const message of targets) {
      const original = textOf(message);
      const run = await deps.recorder.start(payload.agent.id, gate, original);
      deps.emit('pixie-gate/start', structuredClone(run));
      let result: GateResult;
      try {
        const runner = await deps.runner();
        const policy = deps.policy(payload.agent);
        result = await runGate(gate, { sessionId: payload.agent.id, cwd: payload.agent.session.header.cwd ?? '', turn: payload.turn, original, source: message.source.kind, ...(policy ? { sandboxPolicy: policy } : {}), hooks: { context, decision: 'none' } }, runner, { signal: payload.signal, hooks: runner });
      } catch (error) {
        result = { verdict: 'error', original, subject: original, notes: [], stages: {}, records: [], hooks: {}, appliedPolicy: gate.onError, forwardError: { verdict: 'error', error: String(error) }, forward: gate.onError === 'block' ? { kind: 'none' } : { kind: 'original', text: original } };
      }
      const item: typeof pending[number] = { run, result, applied: 'pass' };
      pending.push(item);
      if (payload.signal.aborted || result.verdict === 'cancelled') break;
      if (result.verdict === 'fail' || (result.verdict === 'error' && result.appliedPolicy === 'block') || (result.verdict === 'revise' && gate.confirmRevision)) {
        const failure = [result.hooks.start, ...Object.values(result.stages), result.forwardError].find(stage => stage?.verdict === 'fail' || stage?.verdict === 'error');
        item.applied = 'rejected';
        item.rejection = { reason: failure?.reason ?? failure?.error ?? 'Revision requires confirmation', ...(result.verdict === 'revise' ? { suggestion: result.subject } : failure?.text === undefined ? {} : { suggestion: failure.text }) };
        rejected = true; break;
      }
      if (result.forward.kind === 'replace' && result.forward.text !== original) {
        let inserted = false;
        const content = message.content.flatMap<UserMessage['content'][number]>(block => {
          if (block.type !== 'text') return [block];
          if (inserted) return [];
          inserted = true; return [{ type: 'text' as const, text: result.forward.kind === 'replace' ? result.forward.text : original }];
        });
        if (!inserted) content.push({ type: 'text', text: result.forward.text });
        messages = messages.map(value => value === message ? { ...message, content } : value);
        item.applied = 'replaced';
      } else if (result.forward.kind === 'append') {
        messages.push({ id: randomUUID() as UserMessage['id'], role: 'user', source: { kind: 'studio-pixie-gate' }, content: result.forward.contexts.map(text => ({ type: 'text', text })) });
        item.applied = 'appended';
      }
    }
    // Persistence is awaited before returning a destructive decision. Recheck cancellation after every await.
    for (const item of pending) {
      const cancelled = payload.signal.aborted || item.result.verdict === 'cancelled';
      const applied = cancelled || (rejected && item.applied !== 'rejected') ? 'none' : item.applied;
      await deps.recorder.finish(payload.agent.id, item.run.id, { status: cancelled ? 'cancelled' : item.result.verdict === 'error' ? 'error' : 'done', result: item.result, applied, hooksInput, ...(applied === 'rejected' ? { rejection: item.rejection } : {}) });
      const usage = gateUsage(item.result);
      deps.emit('pixie-gate/end', { ...item.run, result: item.result, finalText: item.result.subject, applied, hooksInput, usage, endedAt: Date.now(), status: cancelled ? 'cancelled' : item.result.verdict === 'error' ? 'error' : 'done', ...(applied === 'rejected' && item.rejection ? { rejection: { ...item.rejection, original: item.run.original, status: 'pending' as const } } : {}) });
    }
    if (payload.signal.aborted) return decision;
    if (rejected) return { kind: 'reject' };
    return pending.some(item => item.applied === 'replaced' || item.applied === 'appended') ? { ...decision, messages } : decision;
  };
}
