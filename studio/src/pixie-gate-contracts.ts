import type { JudgeQuestion, PixieModel, PixieUsage } from './pixie-contracts.ts';

export const MAX_GATE_STAGES = 5;
export const MAX_GATE_STDOUT_BYTES = 256 * 1024;
export type GatePoint = 'input' | 'tool-before' | 'tool-after' | 'turn-end';
export type StageRole = 'check' | 'revise' | 'note';
export interface CommandSpec { command: string; timeoutMs?: number }
export type ForwardSpec =
  | { kind: 'original' }
  | { kind: 'replace'; from: string }
  | { kind: 'append'; from: string[] };
/** Reserved for the judge runner in S8; definitions containing judge are not accepted yet. */
export type JudgePassRule = { question: string; min: number } | { question: string; choices: string[] };
export type StageDefinition =
  | { id: string; kind: 'command'; role: StageRole; command: CommandSpec }
  | { id: string; kind: 'converse'; role: StageRole; model?: PixieModel; system?: string; prompt: string }
  | { id: string; kind: 'judge'; model?: PixieModel; questions: Record<string, JudgeQuestion>; pass: JudgePassRule };
export interface GateDefinition {
  id: string; name: string; enabled: boolean; point: GatePoint;
  match: { agents?: 'root' | 'child' | 'any'; sources?: string[]; tools?: string[] };
  stages: StageDefinition[];
  onError: 'pass' | 'block';
  confirmRevision: boolean;
  forward: ForwardSpec;
  hooks?: { start?: CommandSpec; end?: CommandSpec };
  limits: { stageTimeoutMs: number; maxSteersPerTurn: number };
}
/** Error is a separate verdict, never a synthetic pass/fail. */
export interface StageResult {
  verdict: 'pass' | 'fail' | 'revise' | 'note' | 'error';
  text?: string; reason?: string; data?: unknown; error?: string; usage?: PixieUsage;
}
export interface GateInput {
  sessionId: string; cwd: string; turn: number; original: string;
  /** Required for commands; unknown policy must never fall back to an unrestricted shell. */
  sandboxPolicy?: { mode: 'read-only' | 'workspace-write' | 'danger-full-access'; workspaceRoot: string; sessionId: string };
  source?: string;
  tool?: { name: string; call_id: string; arguments: string };
  hooks?: { context: string[]; decision: string };
}
export interface StageRecord {
  id: string; result: StageResult;
  appliedPolicy?: 'pass' | 'block';
  subjectBytes: number; textBytes: number;
}
export type GateForward =
  | { kind: 'none' }
  | { kind: 'original'; text: string }
  | { kind: 'replace'; text: string }
  | { kind: 'append'; text: string; contexts: string[]; source: 'studio-pixie-gate' };
export interface GateResult {
  verdict: 'pass' | 'revise' | 'fail' | 'error' | 'skip' | 'cancelled';
  original: string; subject: string; notes: string[];
  stages: Record<string, StageResult>; records: StageRecord[];
  appliedPolicy?: 'pass' | 'block';
  forward: GateForward;
  hooks: { start?: StageResult; end?: StageResult };
  forwardError?: StageResult;
}

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function command(value: unknown): void {
  if (!object(value) || typeof value.command !== 'string' || !value.command.trim()) throw new Error('Command needs command text');
  if (value.timeoutMs !== undefined && !(typeof value.timeoutMs === 'number' && Number.isFinite(value.timeoutMs) && value.timeoutMs > 0)) throw new Error('Invalid command timeout');
}
/** Validate at the definition boundary, before executing trusted commands. Returns a normalized copy. */
export function validateGateDefinition(value: unknown): GateDefinition {
  if (!object(value)) throw new Error('Gate must be an object');
  const g = structuredClone(value);
  if (typeof g.id !== 'string' || !g.id.trim() || typeof g.name !== 'string' || !g.name.trim() || typeof g.enabled !== 'boolean') throw new Error('Gate needs id, name and enabled');
  if (!['input', 'tool-before', 'tool-after', 'turn-end'].includes(g.point as string)) throw new Error('Unknown gate point');
  g.onError ??= 'pass'; g.confirmRevision ??= false;
  if (!['pass', 'block'].includes(g.onError as string) || typeof g.confirmRevision !== 'boolean') throw new Error('Invalid gate error/revision policy');
  if (!object(g.match)) throw new Error('Gate needs match');
  g.match.agents ??= 'root';
  if (g.point === 'input') g.match.sources ??= ['user'];
  if (!['root', 'child', 'any'].includes(g.match.agents as string)) throw new Error('Invalid agent match');
  for (const key of ['sources', 'tools']) if (g.match[key] !== undefined && (!Array.isArray(g.match[key]) || !(g.match[key] as unknown[]).every(v => typeof v === 'string'))) throw new Error(`Invalid match ${key}`);
  if (!object(g.limits) || typeof g.limits.stageTimeoutMs !== 'number' || !Number.isFinite(g.limits.stageTimeoutMs) || g.limits.stageTimeoutMs <= 0 || !Number.isInteger(g.limits.maxSteersPerTurn) || (g.limits.maxSteersPerTurn as number) < 0) throw new Error('Invalid gate limits');
  if (!Array.isArray(g.stages) || g.stages.length < 1 || g.stages.length > MAX_GATE_STAGES) throw new Error('Gate needs 1–5 stages');
  if (g.hooks !== undefined) {
    if (!object(g.hooks)) throw new Error('Invalid hooks');
    if (g.hooks.start !== undefined) command(g.hooks.start);
    if (g.hooks.end !== undefined) command(g.hooks.end);
  }
  const prior = new Set<string>(object(g.hooks) && g.hooks.start ? ['start'] : []);
  for (const raw of g.stages) {
    if (!object(raw) || typeof raw.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(raw.id) || ['start', 'forward', 'subject', '__proto__', 'constructor', 'prototype'].includes(raw.id) || prior.has(raw.id)) throw new Error('Duplicate, reserved or invalid stage id');
    if (raw.kind === 'judge') throw new Error('judge is not yet supported (아직 지원하지 않음)');
    if (!['command', 'converse'].includes(raw.kind as string) || !['check', 'revise', 'note'].includes(raw.role as string)) throw new Error('Invalid stage kind/role');
    if (raw.role === 'revise' && ['turn-end', 'tool-before'].includes(g.point as string)) throw new Error('revise is not supported at this point');
    if (raw.kind === 'command') command(raw.command);
    else {
      if (typeof raw.prompt !== 'string' || (raw.system !== undefined && typeof raw.system !== 'string')) throw new Error('Converse needs a prompt');
      for (const template of [raw.prompt, raw.system ?? '']) validateTemplate(template as string, prior);
      if (raw.model !== undefined && (!object(raw.model) || typeof raw.model.provider !== 'string' || typeof raw.model.model !== 'string')) throw new Error('Invalid model');
    }
    prior.add(raw.id);
  }
  if (!object(g.forward) || !['original', 'replace', 'append'].includes(g.forward.kind as string)) throw new Error('Invalid forward');
  if (['tool-before', 'turn-end'].includes(g.point as string) && g.forward.kind !== 'original') throw new Error('forward is not supported at this point');
  const ids = new Set((g.stages as { id: string }[]).map(s => s.id));
  if (g.forward.kind === 'replace' && (typeof g.forward.from !== 'string' || (g.forward.from !== 'subject' && !ids.has(g.forward.from)))) throw new Error('Unknown forward stage');
  if (g.forward.kind === 'append' && (!Array.isArray(g.forward.from) || !g.forward.from.length || !g.forward.from.every(id => typeof id === 'string' && ids.has(id)))) throw new Error('Unknown forward stages');
  return g as unknown as GateDefinition;
}
function validateTemplate(template: string, prior: Set<string>): void {
  const rest = template.replace(/{{\s*([^{}]+?)\s*}}/g, (_, variable: string) => {
    if (['subject', 'original', 'hooks.context'].includes(variable)) return '';
    const match = /^stages\.([\w-]+)\.(text|reason|data)$/.exec(variable);
    if (!match || !prior.has(match[1]!)) throw new Error(`Unknown or forward prompt variable: ${variable}`);
    return '';
  });
  if (rest.includes('{{') || rest.includes('}}')) throw new Error('Malformed prompt variable');
}
