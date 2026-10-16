import { JudgeValidationError, validateJudgeRequest, type JudgeAnswer, type JudgeQuestion, type PixieModel, type PixieUsage } from './pixie-contracts.ts';

export function validateJudgePassRule(value: unknown, questions: Record<string, JudgeQuestion>): asserts value is JudgePassRule {
  if (!object(value) || !['all', 'any'].includes(value.mode as string) || !Array.isArray(value.conditions) || !value.conditions.length) throw new JudgeValidationError('conditions', 'Judge pass needs all/any and nonempty conditions');
  for (const condition of value.conditions) {
    if (!object(condition) || typeof condition.question !== 'string' || !Object.hasOwn(questions, condition.question)) throw new JudgeValidationError('unknownQuestion', 'Judge condition references unknown question');
    const question = questions[condition.question]!;
    if (condition.type !== question.type) throw new JudgeValidationError('conditionType', 'Judge condition type must match question');
    if (condition.type === 'choice') {
      if (question.type !== 'choice' || !Array.isArray(condition.allowed) || !condition.allowed.length || condition.allowed.some(key => typeof key !== 'string' || !Object.hasOwn(question.options, key))) throw new JudgeValidationError('allowed', 'Judge condition needs known allowed choices');
    } else {
      const number = condition.type === 'noul' ? condition.threshold : condition.min;
      const max = question.type === 'score' ? question.levels.length - 1 : 1;
      if (typeof number !== 'number' || !Number.isFinite(number) || number < 0 || number > max) throw new JudgeValidationError('range', 'Judge condition threshold out of range');
    }
  }
}

/** Missing or mismatched answers are errors, never a successful any-rule fallback. */
export function evaluateJudgePass(rule: JudgePassRule, answers: Record<string, JudgeAnswer>): { pass: boolean; reason?: string; failedConditions?: JudgeFailedCondition[] } {
  const failedConditions: JudgeFailedCondition[] = [];
  const failed = rule.conditions.flatMap(condition => {
    const answer = answers[condition.question];
    if (!answer || answer.type !== condition.type) throw new Error(`Missing or mismatched judge answer: ${condition.question}`);
    const passed = condition.type === 'noul' && answer.type === 'noul' ? answer.noul >= condition.threshold : condition.type === 'score' && answer.type === 'score' ? answer.score >= condition.min : condition.type === 'choice' && answer.type === 'choice' && condition.allowed.includes(answer.choice);
    if (!passed) {
      if (condition.type === 'choice' && answer.type === 'choice') failedConditions.push({ ...condition, actual: answer.choice });
      if (condition.type === 'score' && answer.type === 'score') failedConditions.push({ ...condition, actual: answer.score });
      if (condition.type === 'noul' && answer.type === 'noul') failedConditions.push({ ...condition, actual: answer.noul });
    }
    return passed ? [] : [condition.type === 'choice' ? `${condition.question}: choice must be in [${condition.allowed.join(', ')}]` : condition.type === 'noul' ? `${condition.question}: noul must be >= ${condition.threshold}` : `${condition.question}: score must be >= ${condition.min}`];
  });
  const pass = rule.mode === 'all' ? failed.length === 0 : failed.length < rule.conditions.length;
  return { pass, ...(!pass ? { reason: failed.join('; '), failedConditions } : {}) };
}

export const MAX_GATE_STAGES = 5;
export const MAX_GATE_STDOUT_BYTES = 256 * 1024;
export type GatePoint = 'input' | 'tool-before' | 'tool-after' | 'turn-end';
export type StageRole = 'check' | 'revise' | 'note';
export interface CommandSpec { command: string; timeoutMs?: number }
export type ForwardSpec =
  | { kind: 'original' }
  | { kind: 'replace'; from: string }
  | { kind: 'append'; from: string[] };
/** Typed question conditions; a nonempty flat group deliberately avoids recursive rule complexity. */
export type JudgePassCondition =
  | { question: string; type: 'noul'; threshold: number }
  | { question: string; type: 'score'; min: number }
  | { question: string; type: 'choice'; allowed: string[] };
export type JudgeFailedCondition =
  | (Extract<JudgePassCondition, { type: 'noul' | 'score' }> & { actual: number })
  | (Extract<JudgePassCondition, { type: 'choice' }> & { actual: string });
export interface JudgePassRule { mode: 'all' | 'any'; conditions: JudgePassCondition[] }
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

/** Applied by S4–S6, never inferred from the pipeline verdict.
 * End-hook cancellation preserves GateResult: callers must check signal before applying actions.
 */
export type GateApplied = 'pass' | 'replaced' | 'appended' | 'rejected' | 'steered' | 'blocked' | 'denied' | 'none';
export type GateRunStatus = 'running' | 'done' | 'cancelled' | 'error';
export interface GateRejection {
  original: string;
  reason: string;
  suggestion?: string;
  status: 'pending' | 'resent' | 'dismissed';
}
export interface GateRun {
  when?: import('./pixie-gate-task.ts').GateWhen;
  output?: import('./pixie-gate-task-contracts.ts').GateOutput;
  id: string; gateId: string; gateName: string; point: GatePoint; sessionId: string;
  startedAt: number; endedAt?: number;
  original: string; finalText: string;
  result?: GateResult;
  applied: GateApplied;
  /** Gate calls only, independent of ordinary Pixie and DSH session usage. */
  usage: PixieUsage;
  status: GateRunStatus;
  rejection?: GateRejection;
  hooksInput?: 'observed' | 'unverified';
  reason?: string;
  turn?: number;
  steerCount?: number;
  tool?: { name: string; callId: string };
}
export interface GateRunRecord { sessionId: string; runs: GateRun[] }
export type GateRunFrame = { type: 'sync' } | { type: 'run'; run: GateRun };

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
    if (raw.kind === 'judge') {
      if (raw.role !== undefined) throw new Error('Judge role is fixed to check; omit role');
      const { questions } = validateJudgeRequest({ state: {}, questions: raw.questions });
      validateJudgePassRule(raw.pass, questions);
      if (raw.model !== undefined && (!object(raw.model) || typeof raw.model.provider !== 'string' || !raw.model.provider || typeof raw.model.model !== 'string' || !raw.model.model)) throw new Error('Invalid judge model');
      for (const question of Object.values(questions)) {
        const templates = question.type === 'choice' ? Object.values(question.options) : question.type === 'score' ? question.levels : [question.question, ...Object.values(question.criteria ?? {})];
        for (const template of templates) validateTemplate(template, prior);
      }
      prior.add(raw.id);
      continue;
    }
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
