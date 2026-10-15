import { readRuntimeGateDefinitions } from './pixie-gate-definition-reader.ts';
import { randomUUID } from 'node:crypto';
import type { Message, UserMessage } from '@deepseek-ai/dsh-llm';
import type { GateInputDeps, InputAgent } from './pixie-gate-input.ts';
import { runGate } from './pixie-gate-pipeline.ts';
import { gateUsage } from './pixie-gate-store.ts';
import type { GateResult } from '../pixie-gate-contracts.ts';

export interface TurnAgent extends InputAgent {
  session: InputAgent['session'] & { deriveMessages(): Message[] };
  inbox: { readonly nextStep: readonly UserMessage[] };
  steer(message: UserMessage): void;
}
const textOf = (message: Message) => message.content.filter(block => block.type === 'text').map(block => block.text).join('\n');
export function gateTurn(deps: GateInputDeps) {
  // Runtime Agent lifetime, not durable session lineage. Repeated boundaries retain the same turn budget.
  const budgets = new WeakMap<TurnAgent, { turn: number; gates: Map<string, number> }>();
  return async ({ agent, turn, signal }: { agent: TurnAgent; turn: number; signal: AbortSignal }): Promise<void> => {
    const preset = deps.preset(agent);
    if (!preset) return;
    const gate = (await readRuntimeGateDefinitions(deps)).find(row => row.presetIds.includes(preset) && row.definition.point === 'turn-end' && row.definition.enabled)?.definition;
    if (!gate) return;
    const root = deps.isRoot(agent);
    if ((gate.match.agents === 'root' && !root) || (gate.match.agents === 'child' && root)) return;
    const original = [...agent.session.deriveMessages()].reverse().find(message => message.role === 'assistant');
    const subject = original ? textOf(original) : '';
    const context = agent.inbox.nextStep.map(textOf);
    const hooksInput = context.length ? 'observed' : 'unverified';
    const run = await deps.recorder.start(agent.id, gate, subject);
    deps.emit('pixie-gate/start', structuredClone(run));
    let result: GateResult;
    try {
      const runner = await deps.runner();
      const policy = deps.policy(agent);
      result = await runGate(gate, { sessionId: agent.id, cwd: agent.session.header.cwd ?? '', turn, original: subject, ...(policy ? { sandboxPolicy: policy } : {}), hooks: { context, decision: context.length ? 'steer' : 'none' } }, runner, { signal, hooks: runner });
    } catch (error) {
      result = { verdict: 'error', original: subject, subject, notes: [], stages: {}, records: [], hooks: {}, appliedPolicy: gate.onError, forwardError: { verdict: 'error', error: String(error) }, forward: { kind: 'none' } };
    }
    let budget = budgets.get(agent);
    if (!budget || budget.turn !== turn) { budget = { turn, gates: new Map() }; budgets.set(agent, budget); }
    const count = budget.gates.get(gate.id) ?? 0;
    const failed = result.verdict === 'fail' || (result.verdict === 'error' && result.appliedPolicy === 'block');
    const failure = [result.hooks.start, ...Object.values(result.stages), result.forwardError].find(stage => stage?.verdict === 'fail' || stage?.verdict === 'error');
    const reason = failed ? agent.inbox.nextStep.length ? 'existing steering' : count >= gate.limits.maxSteersPerTurn ? 'maxSteersPerTurn reached' : undefined : undefined;
    // Single commit point: persistence cannot reopen the cancellation decision.
    const cancelled = signal.aborted || result.verdict === 'cancelled';
    const applied = cancelled || !failed || reason ? 'none' : 'steered';
    const message: UserMessage | undefined = applied === 'steered' ? { id: randomUUID() as UserMessage['id'], role: 'user', source: { kind: 'studio-pixie-gate' }, content: [{ type: 'text', text: failure?.text ?? failure?.reason ?? failure?.error ?? 'Please correct the response.' }] } : undefined;
    if (message) budget.gates.set(gate.id, count + 1);
    const settlement = { status: cancelled ? 'cancelled' as const : result.verdict === 'error' ? 'error' as const : 'done' as const, result, applied, hooksInput, ...(cancelled ? { reason: 'cancelled' } : reason ? { reason } : {}), turn, steerCount: count + (message ? 1 : 0) } as const;
    await deps.recorder.finish(agent.id, run.id, settlement);
    deps.emit('pixie-gate/end', { ...run, ...settlement, endedAt: Date.now(), finalText: result.subject, usage: gateUsage(result) });
    if (message) agent.steer(message);
  };
}
