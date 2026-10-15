import type { GateDefinition, GateForward, GateInput, GateResult, StageResult } from '../pixie-gate-contracts.ts';
import { bytes, errorResult, type GateHookRunner, type StageContext, type StageRunner } from './pixie-gate-runner.ts';

/** Executes an already validated definition. Keeping validation separate permits a future judge runner. */
export async function runGate(gate: GateDefinition, input: GateInput, runner: StageRunner, options: { signal: AbortSignal; hooks?: GateHookRunner } ): Promise<GateResult> {
  const result: GateResult = { verdict: 'pass', original: input.original, subject: input.original, notes: [], stages: {}, records: [], hooks: {}, forward: { kind: 'none' } };
  // Keep the legacy start prompt/stdin alias in execution context only, never in stored stages.
  const context = (signal: AbortSignal, timeoutMs: number): StageContext => ({ ...input, gate, subject: result.subject, stages: structuredClone({ ...result.stages, ...(result.hooks.start ? { start: result.hooks.start } : {}) }), signal, timeoutMs });
  const apply = (stage: StageResult) => {
    if (stage.verdict === 'error') { result.verdict = 'error'; result.appliedPolicy = gate.onError; return false; }
    if (stage.verdict === 'fail') { result.verdict = 'fail'; return false; }
    if (stage.verdict === 'revise') result.subject = stage.text!;
    if (stage.verdict === 'note' && stage.text !== undefined) result.notes.push(stage.text);
    return true;
  };
  if (options.signal.aborted) { result.verdict = 'cancelled'; return result; }
  if (!gate.enabled) { result.verdict = 'skip'; result.forward = { kind: 'original', text: input.original }; return result; }
  let proceed = true;
  if (gate.hooks?.start) {
    const command = gate.hooks.start;
    const timeout = command.timeoutMs ?? gate.limits.stageTimeoutMs;
    const stage = await bounded(timeout, options.signal, signal => options.hooks ? options.hooks.runHook(command, 'start', context(signal, timeout)) : Promise.resolve(errorResult('No hook runner')));
    result.hooks.start = stage;
    proceed = apply(stage);
    if (stage.verdict === 'pass' && stage.data && typeof stage.data === 'object' && (stage.data as { skip?: unknown }).skip === true) { result.verdict = 'skip'; proceed = false; }
  }
  if (proceed) for (const stage of gate.stages) {
    if (options.signal.aborted) break;
    const timeout = stage.kind === 'command' ? stage.command.timeoutMs ?? gate.limits.stageTimeoutMs : gate.limits.stageTimeoutMs;
    const value = await bounded(timeout, options.signal, signal => runner.run(stage, context(signal, timeout)));
    if (options.signal.aborted) break;
    result.stages[stage.id] = value;
    result.records.push({ id: stage.id, result: value, subjectBytes: bytes(result.subject), textBytes: bytes(value.text ?? ''), ...(value.verdict === 'error' ? { appliedPolicy: gate.onError } : {}) });
    if (!apply(value)) break;
  }
  if (options.signal.aborted) result.verdict = 'cancelled';
  else if (result.verdict === 'pass') result.verdict = result.subject === input.original ? 'pass' : 'revise';
  try { result.forward = forward(gate, result); }
  catch (error) { result.forwardError = errorResult(error); apply(result.forwardError); result.forward = gate.onError === 'pass' ? { kind: 'original', text: input.original } : { kind: 'none' }; }
  // Cancellation starts no further command, including observer hooks.
  if (gate.hooks?.end && !options.signal.aborted) {
    const command = gate.hooks.end;
    const timeout = command.timeoutMs ?? gate.limits.stageTimeoutMs;
    const snapshot = structuredClone(result);
    // Observation cannot change the settled decision, including its own timeout/cancellation.
    result.hooks.end = await bounded(timeout, options.signal, signal => options.hooks ? options.hooks.runHook(command, 'end', context(signal, timeout), snapshot) : Promise.resolve(errorResult('No hook runner')));
  }
  return result;
}
function forward(gate: GateDefinition, result: GateResult): GateForward {
  if (result.verdict === 'fail' || result.verdict === 'cancelled' || (result.verdict === 'error' && result.appliedPolicy === 'block')) return { kind: 'none' };
  if (result.verdict === 'error' || result.verdict === 'skip' || gate.forward.kind === 'original') return { kind: 'original', text: result.original };
  const text = (id: string): string => {
    const value = result.stages[id]?.text;
    if (typeof value !== 'string') throw new Error(`Forward stage ${id} has no text`);
    return value;
  };
  if (gate.forward.kind === 'replace') return { kind: 'replace', text: gate.forward.from === 'subject' ? result.subject : text(gate.forward.from) };
  return { kind: 'append', text: result.original, contexts: gate.forward.from.map(text), source: 'studio-pixie-gate' };
}
/** Bound even an adapter that ignores cancellation; its late result cannot mutate pipeline state. */
async function bounded(timeoutMs: number, parent: AbortSignal, run: (signal: AbortSignal) => Promise<StageResult>): Promise<StageResult> {
  const controller = new AbortController();
  const abort = () => controller.abort(parent.reason ?? new Error('Gate cancelled'));
  if (parent.aborted) abort(); else parent.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error(`Gate stage timed out after ${timeoutMs}ms`)), timeoutMs);
  let rejectAbort = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(controller.signal.reason);
    if (controller.signal.aborted) rejectAbort(); else controller.signal.addEventListener('abort', rejectAbort, { once: true });
  });
  cancelled.catch(() => {});
  try {
    controller.signal.throwIfAborted();
    return await Promise.race([Promise.resolve().then(() => run(controller.signal)), cancelled]);
  } catch (error) { return errorResult(error); }
  finally { clearTimeout(timer); parent.removeEventListener('abort', abort); controller.signal.removeEventListener('abort', rejectAbort); }
}
