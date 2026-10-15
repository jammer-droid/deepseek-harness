import { readRuntimeGateDefinitions } from './pixie-gate-definition-reader.ts';
import { randomUUID } from 'node:crypto';
import type { ContentBlock, UserMessage } from '@deepseek-ai/dsh-llm';
import type { PostToolDecision, PreToolDecision, ToolExecution, ToolExecutionResult } from '@deepseek-ai/dsh-tools';
import type { GateApplied, GateResult } from '../pixie-gate-contracts.ts';
import type { GateInputDeps } from './pixie-gate-input.ts';
import { runGate } from './pixie-gate-pipeline.ts';
import { gateUsage } from './pixie-gate-store.ts';

const textOf = (content: readonly ContentBlock[]) => content.filter(block => block.type === 'text').map(block => block.text).join('\n');
export function gateTools(deps: GateInputDeps) {
  async function execute(point: 'tool-before' | 'tool-after', exec: ToolExecution, decision: PreToolDecision | PostToolDecision, outcome?: Readonly<ToolExecutionResult>): Promise<PreToolDecision | PostToolDecision> {
    const agent = exec.agent;
    if (!agent) return decision;
    const preset = deps.preset(agent);
    if (!preset) return decision;
    const gate = (await readRuntimeGateDefinitions(deps)).find(row => row.presetIds.includes(preset) && row.definition.point === point && row.definition.enabled)?.definition;
    if (!gate || (gate.match.tools && !gate.match.tools.includes(exec.name))) return decision;
    const root = deps.isRoot(agent);
    if ((gate.match.agents === 'root' && !root) || (gate.match.agents === 'child' && root)) return decision;
    const turn = [...agent.session.snapshotEvents()].reverse().find(event => event.type === 'turn/start')?.data.turn ?? 0;
    const contexts = 'additionalContexts' in decision ? decision.additionalContexts : undefined;
    const context = [...(outcome?.additionalContexts ?? []), ...(contexts ?? [])].map(message => textOf(message.content));
    const hooksInput = context.length || decision.kind === 'ask' || ('content' in decision && decision.content !== undefined) || ('value' in decision && decision.value !== undefined) ? 'observed' as const : 'unverified' as const;
    const original = outcome ? textOf('content' in decision && decision.content ? decision.content : outcome.content) : JSON.stringify(exec.arguments) ?? '';
    const run = await deps.recorder.start(agent.id, gate, original);
    deps.emit('pixie-gate/start', structuredClone(run));
    let result: GateResult;
    try {
      const runner = await deps.runner(); const policy = deps.policy(agent);
      result = await runGate(gate, { sessionId: agent.id, cwd: agent.session.header.cwd ?? '', turn, original, tool: { name: exec.name, call_id: exec.callId, arguments: JSON.stringify(exec.arguments) ?? '' }, ...(policy ? { sandboxPolicy: policy } : {}), hooks: { context, decision: decision.kind } }, runner, { signal: exec.signal, hooks: runner });
    } catch (error) {
      result = { verdict: 'error', original, subject: original, notes: [], stages: {}, records: [], hooks: {}, appliedPolicy: gate.onError, forwardError: { verdict: 'error', error: String(error) }, forward: { kind: 'none' } };
    }
    let committed = decision; let applied: GateApplied = 'none'; let reason: string | undefined;
    const failed = result.verdict === 'fail' || (result.verdict === 'error' && result.appliedPolicy === 'block');
    if (failed) {
      const failure = [result.hooks.start, ...Object.values(result.stages), result.forwardError].find(stage => stage?.verdict === 'fail' || stage?.verdict === 'error');
      const text = failure?.text ?? failure?.reason ?? failure?.error ?? 'Pixie Gate rejected this tool execution';
      committed = point === 'tool-before' ? { kind: 'deny', reason: text } : { kind: 'block', feedback: [{ type: 'text', text }], ...(contexts ? { additionalContexts: contexts } : {}) };
      applied = point === 'tool-before' ? 'denied' : 'blocked';
    } else if (point === 'tool-after' && decision.kind === 'accept') {
      if (result.forward.kind === 'replace') {
        if ((outcome && !outcome.isError && 'value' in outcome) || ('value' in decision && decision.value !== undefined)) reason = 'value-bearing result';
        else { committed = { ...decision, content: [{ type: 'text', text: result.forward.text }] }; applied = 'replaced'; }
      } else if (result.forward.kind === 'append') {
        const message: UserMessage = { id: randomUUID() as UserMessage['id'], role: 'user', source: { kind: 'studio-pixie-gate' }, content: result.forward.contexts.map(text => ({ type: 'text', text })) };
        committed = { ...decision, additionalContexts: [...(contexts ?? []), message] }; applied = 'appended';
      }
    }
    // Commit exactly once before finish. A later abort is the runtime caller's responsibility.
    const cancelled = exec.signal.aborted || result.verdict === 'cancelled';
    if (cancelled) { committed = decision; applied = 'none'; reason = 'cancelled'; }
    const settlement = { status: cancelled ? 'cancelled' as const : result.verdict === 'error' ? 'error' as const : 'done' as const, result, applied, hooksInput, ...(reason ? { reason } : {}), turn, tool: { name: exec.name, callId: exec.callId } };
    await deps.recorder.finish(agent.id, run.id, settlement);
    deps.emit('pixie-gate/end', { ...run, ...settlement, endedAt: Date.now(), finalText: result.subject, usage: gateUsage(result) });
    return committed;
  }
  return {
    before: async (exec: ToolExecution, next: () => Promise<PreToolDecision>): Promise<PreToolDecision> => {
      const decision = await next();
      if (decision.kind === 'deny' || decision.kind === 'cancel') return decision;
      return await execute('tool-before', exec, decision) as PreToolDecision;
    },
    after: async (exec: ToolExecution, result: Readonly<ToolExecutionResult>, next: () => Promise<PostToolDecision>): Promise<PostToolDecision> => {
      const decision = await next();
      if (decision.kind === 'block') return decision;
      return await execute('tool-after', exec, decision, result) as PostToolDecision;
    },
  };
}
