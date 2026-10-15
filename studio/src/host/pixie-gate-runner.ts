import type { CommandSpec, GateDefinition, GateInput, GateResult, StageDefinition, StageResult, StageRole } from '../pixie-gate-contracts.ts';
import { MAX_GATE_STDOUT_BYTES } from '../pixie-gate-contracts.ts';
import type { PixieModel } from '../pixie-contracts.ts';
import { untilAborted, type PixieLlm } from './pixie-runtime.ts';

export interface StageContext extends GateInput {
  gate: GateDefinition; subject: string; stages: Record<string, StageResult>;
  signal: AbortSignal; timeoutMs: number;
}
export interface StageRunner { run(stage: StageDefinition, context: StageContext): Promise<StageResult> }
/** The caller supplies a session-bound adapter; it owns the sandbox policy, not the definition. */
export interface GateShellRequest {
  command: string; workdir: string; timeoutMs: number; onExpiry: 'kill'; stdoutMaxBytes: number;
  signal: AbortSignal; stdin: string; env: Record<string, string>;
  sandboxPolicy: NonNullable<GateInput['sandboxPolicy']>;
}
export interface GateShell<ResultSpec = GateShellRequest> {
  resolve(request: GateShellRequest): ResultSpec;
  execute(spec: ResultSpec): Promise<{ result(): Promise<{
    exitCode: number | null; timedOut: boolean; aborted?: boolean;
    stdout: { text: string; truncated: boolean }; stderr: { text: string };
  }> }>;
}
export interface GateHookRunner { runHook(command: CommandSpec, event: 'start' | 'end', context: StageContext, result?: GateResult): Promise<StageResult> }
export const errorResult = (error: unknown): StageResult => ({ verdict: 'error', error: error instanceof Error ? error.message : String(error) });
export const bytes = (text: string): number => new TextEncoder().encode(text).byteLength;

export function hookStdin(event: 'start' | 'stage' | 'end', context: StageContext, result?: GateResult): string {
  return JSON.stringify({
    pixie_gate: '1', event,
    gate: { id: context.gate.id, name: context.gate.name, point: context.gate.point },
    session_id: context.sessionId, cwd: context.cwd, turn: context.turn,
    ...(context.source === undefined ? {} : { source: context.source }),
    ...(context.tool === undefined ? {} : { tool: context.tool }),
    original: context.original, subject: context.subject, stages: context.stages,
    hooks: context.hooks ?? { context: [], decision: 'none' },
    ...(result ? { result: { ...result, forwarded: result.forward.kind } } : {}),
  }) + '\n';
}
export function renderGatePrompt(template: string, context: StageContext): string {
  return template.replace(/{{\s*([^{}]+?)\s*}}/g, (_, variable: string) => {
    if (variable === 'subject') return context.subject;
    if (variable === 'original') return context.original;
    if (variable === 'hooks.context') return JSON.stringify(context.hooks?.context ?? []);
    const match = /^stages\.([\w-]+)\.(text|reason|data)$/.exec(variable);
    if (!match || !Object.hasOwn(context.stages, match[1]!)) throw new Error(`Unknown prompt variable: ${variable}`);
    const value = context.stages[match[1]!]![match[2] as 'text' | 'reason' | 'data'];
    return match[2] === 'data' ? JSON.stringify(value) ?? '' : String(value ?? '');
  });
}
function allowed(role: StageRole, result: StageResult): StageResult {
  if (!['pass', 'fail', role === 'check' ? 'pass' : role].includes(result.verdict)) throw new Error(`Verdict ${result.verdict} is not allowed for ${role}`);
  if ((result.verdict === 'revise' || result.verdict === 'note') && typeof result.text !== 'string') throw new Error(`${result.verdict} needs text`);
  return result;
}
export function parseCommandOutput(stdout: string, role: StageRole): StageResult {
  if (!stdout.trim()) return { verdict: 'pass' };
  let raw: unknown;
  try { raw = JSON.parse(stdout); }
  catch {
    if (role === 'check' || /^[\s]*[\[{]/.test(stdout)) throw new Error('Invalid command JSON');
    return { verdict: role, text: stdout };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Command JSON must be an object');
  const data = raw as Record<string, unknown>;
  if (Object.keys(data).some(key => !['verdict', 'text', 'reason', 'data'].includes(key))) throw new Error('Unknown command JSON field');
  if ((data.text !== undefined && typeof data.text !== 'string') || (data.reason !== undefined && typeof data.reason !== 'string')) throw new Error('Invalid command text/reason');
  const verdict = data.verdict ?? (data.text !== undefined && role !== 'check' ? role : 'pass');
  return allowed(role, { ...data, verdict } as StageResult);
}
export function parseCheckOutput(text: string): StageResult {
  const raw: unknown = JSON.parse(text);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Check output must be an object');
  const data = raw as Record<string, unknown>;
  if (typeof data.pass !== 'boolean' || Object.keys(data).some(key => !['pass', 'reason', 'fix'].includes(key)) || (data.reason !== undefined && typeof data.reason !== 'string') || (data.fix !== undefined && typeof data.fix !== 'string')) throw new Error('Invalid check JSON: expected {pass, reason?, fix?}');
  return { verdict: data.pass ? 'pass' : 'fail', ...(data.reason === undefined ? {} : { reason: data.reason as string }), ...(!data.pass && data.fix !== undefined ? { text: data.fix as string } : {}), data };
}

export class DefaultStageRunner<Spec = GateShellRequest> implements StageRunner, GateHookRunner {
  constructor(private readonly deps: { shell: GateShell<Spec>; llm: PixieLlm; model?: PixieModel }) {}
  async run(stage: StageDefinition, context: StageContext): Promise<StageResult> {
    let usage: StageResult['usage'];
    try {
      context.signal.throwIfAborted();
      if (stage.kind === 'command') return await this.command(stage.command, stage.role, 'stage', context);
      if (stage.kind === 'judge') throw new Error('judge is not yet supported');
      const model = stage.model ?? this.deps.model;
      if (!model) throw new Error('No Pixie model configured');
      const instructions = stage.role === 'check' ? '\nReturn only JSON {"pass":boolean,"reason"?:string,"fix"?:string}. No other fields or markdown.' : '';
      const stream = this.deps.llm.stream({ ...model,
        system: renderGatePrompt(stage.system ?? '', context) + instructions,
        messages: [{ role: 'user', content: [{ type: 'text', text: renderGatePrompt(stage.prompt, context) }] }], signal: context.signal,
      });
      let text = ''; let finished = false;
      for await (const chunk of untilAborted(stream, context.signal)) {
        if (chunk.type === 'text-delta' && typeof chunk.text === 'string') text += chunk.text;
        if (chunk.type === 'usage' && chunk.usage && typeof chunk.usage === 'object') {
          const raw = chunk.usage as Record<string, unknown>;
          usage = { inputTokens: typeof raw.inputTokens === 'number' ? raw.inputTokens : 0, outputTokens: typeof raw.outputTokens === 'number' ? raw.outputTokens : 0 };
          for (const key of ['cacheReadTokens', 'cacheWriteTokens', 'reasoningTokens'] as const) if (typeof raw[key] === 'number') usage[key] = raw[key];
        }
        if (chunk.type === 'finish') {
          const reason = chunk.reason as { kind?: string } | undefined;
          if (reason?.kind !== 'stop') throw new Error(`Gate model ended with ${reason?.kind ?? 'unknown'}`);
          finished = true;
        }
      }
      if (!finished) throw new Error('Gate model stream ended without a finish');
      return { ...(stage.role === 'check' ? parseCheckOutput(text) : { verdict: stage.role, text }), ...(usage ? { usage } : {}) };
    } catch (error) { return { ...errorResult(error), ...(usage ? { usage } : {}) }; }
  }
  async runHook(command: CommandSpec, event: 'start' | 'end', context: StageContext, result?: GateResult): Promise<StageResult> {
    try { return await this.command(command, 'check', event, context, result); }
    catch (error) { return errorResult(error); }
  }
  private async command(command: CommandSpec, role: StageRole, event: 'start' | 'stage' | 'end', context: StageContext, result?: GateResult): Promise<StageResult> {
    context.signal.throwIfAborted();
    if (!context.sandboxPolicy || context.sandboxPolicy.sessionId !== context.sessionId || !context.sandboxPolicy.workspaceRoot || !['read-only', 'workspace-write', 'danger-full-access'].includes(context.sandboxPolicy.mode)) throw new Error('Session sandbox policy is required');
    const spec = this.deps.shell.resolve({ command: command.command, workdir: context.cwd, sandboxPolicy: context.sandboxPolicy, timeoutMs: context.timeoutMs,
      onExpiry: 'kill', stdoutMaxBytes: MAX_GATE_STDOUT_BYTES, signal: context.signal,
      stdin: hookStdin(event, context, result), env: { DSH_PIXIE_GATE_ID: context.gate.id, DSH_SESSION_ID: context.sessionId },
    });
    const output = await (await this.deps.shell.execute(spec)).result();
    context.signal.throwIfAborted();
    if (output.timedOut) throw new Error('Gate command timed out');
    if (output.aborted) throw new Error('Gate command aborted');
    if (output.stdout.truncated || bytes(output.stdout.text) > MAX_GATE_STDOUT_BYTES) throw new Error('Gate stdout exceeds 256KB');
    if (output.exitCode === 2) return { verdict: 'fail', reason: output.stderr.text };
    if (output.exitCode !== 0) throw new Error(`Gate command exit ${output.exitCode}: ${output.stderr.text}`);
    return parseCommandOutput(output.stdout.text, role);
  }
}
