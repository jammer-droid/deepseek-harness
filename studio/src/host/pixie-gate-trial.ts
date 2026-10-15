import { validateGateDefinition, type GateInput, type GateResult, type StageResult } from '../pixie-gate-contracts.ts';
import { runGate } from './pixie-gate-pipeline.ts';
import type { GateHookRunner, StageRunner } from './pixie-gate-runner.ts';

export interface GateTrialResult {
  result: GateResult;
  durations: Record<string, number>;
  skipped: string[];
}

/** Agentless pipeline preview: never records or applies a result to a session. */
export async function trialGate(payload: unknown, deps: {
  runner(): Promise<StageRunner & GateHookRunner>;
  session(id: string): Pick<GateInput, 'sessionId' | 'cwd' | 'sandboxPolicy'>;
}, signal: AbortSignal): Promise<GateTrialResult> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid gate trial');
  const raw = payload as Record<string, unknown>;
  const definition = validateGateDefinition(raw.definition);
  if (typeof raw.text !== 'string') throw new Error('Trial text is required');
  if (raw.executeCommands !== undefined && typeof raw.executeCommands !== 'boolean') throw new Error('Invalid command consent');
  const execute = raw.executeCommands === true;
  let session: Pick<GateInput, 'sessionId' | 'cwd' | 'sandboxPolicy'> = { sessionId: '', cwd: '' };
  if (execute) {
    if (typeof raw.sessionId !== 'string' || !raw.sessionId) throw new Error('An active session is required for commands');
    session = deps.session(raw.sessionId);
    if (!session.cwd || !session.sandboxPolicy || session.sandboxPolicy.sessionId !== raw.sessionId) throw new Error('Session sandbox policy is required');
  }
  if (raw.toolName !== undefined && typeof raw.toolName !== 'string') throw new Error('Invalid sample tool name');
  if (raw.hooksContext !== undefined && typeof raw.hooksContext !== 'string') throw new Error('Invalid sample hook context');
  const input: GateInput = { ...session, original: raw.text, turn: 0,
    ...(typeof raw.toolName === 'string' ? { tool: { name: raw.toolName, call_id: 'trial', arguments: '{}' } } : {}),
    hooks: { context: typeof raw.hooksContext === 'string' ? [raw.hooksContext] : [], decision: 'none' },
  };
  const runner = await deps.runner();
  const durations: Record<string, number> = {};
  const skipped: string[] = [];
  const timed = async (id: string, command: boolean, run: () => Promise<StageResult>): Promise<StageResult> => {
    const start = performance.now();
    try {
      if (command && !execute) {
        skipped.push(id);
        return { verdict: 'pass', reason: 'skipped: 시험 실행에서 명령 미실행', data: { skipped: true } };
      }
      return await run();
    } finally { durations[id] = Math.max(0, performance.now() - start); }
  };
  const result = await runGate(definition, input, {
    run: (stage, context) => timed(stage.id, stage.kind === 'command', () => runner.run(stage, context)),
  }, { signal, hooks: {
    runHook: (command, event, context, result) => timed(`hooks.${event}`, true, () => runner.runHook(command, event, context, result)),
  } });
  return { result, durations, skipped };
}
