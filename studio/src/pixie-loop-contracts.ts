/** Pixie Loop (#31): the loop spec, compiled checks, pass rules, code checks, item results, and run records.
 * Shared by the Host engine, the `pixie_loop` tool, and the Client run view; no Host or Client runtime dependencies.
 */
import type { JudgeAnswer, JudgeQuestion, PixieUsage } from './pixie-contracts.ts';
import { validateJudgeRequest } from './pixie-contracts.ts';

/** Hard ceilings a spec cannot exceed, whatever it asks for. */
export const LOOP_LIMITS = {
  items: 2000, attempts: 10, concurrency: 8, inputChars: 32_000, sharedChars: 64_000, calibration: 10,
  codeChecks: 10, questions: 10, tokens: 50_000_000, timeMs: 6 * 60 * 60 * 1000,
} as const;
export const LOOP_DEFAULTS = { maxAttempts: 3, concurrency: 4 } as const;

export interface LoopItem { id: string; input: string }
export interface LoopExample { input: string; output: string }

/** Deterministic checks run before the decision engine (D11). */
export type CodeCheck =
  | { type: 'placeholders' }
  | { type: 'regex'; pattern: string; flags?: string; expect: 'match' | 'no-match' }
  | { type: 'json'; keys?: string[] };

/** One pass condition per question: noul by threshold, choice by accepted options, score by minimum. */
export type PassRule =
  | { min: number }
  | { accept: string[] };

export interface LoopChecks { questions: Record<string, JudgeQuestion>; pass: Record<string, PassRule> }

export interface LoopSpec {
  items: { inline: LoopItem[] } | { path: string };
  shared?: string;
  work: { instruction: string };
  /** Natural-language criteria Pixie compiles into {@link LoopChecks}. Exactly one of `criteria` and `checks`. */
  criteria?: string;
  /** Checks given directly; still calibrated (O3). */
  checks?: LoopChecks;
  codeChecks?: CodeCheck[];
  calibration: { pass: LoopExample[]; fail: LoopExample[] };
  maxAttempts: number;
  concurrency: number;
  limits: { tokens: number; timeMs: number };
  output?: string;
}

/** What the engine judges: the item input and one output. Instructions name these fields. */
export interface LoopState { input: string; output: string }

export interface CodeCheckFailure { check: CodeCheck['type']; message: string }
export interface QuestionFailure { id: string; instructions: string; answer: JudgeAnswer; rule: PassRule }

export interface LoopAttempt {
  output: string;
  codeFailures: CodeCheckFailure[];
  answers?: Record<string, JudgeAnswer>;
  passed: boolean;
  /** Pixie's guess at what to fix (D4: never changes the verdict). */
  feedback?: string;
  error?: string;
}

export type LoopItemStatus = 'passed' | 'escalated' | 'error' | 'cancelled' | 'skipped';
export interface LoopItemResult { id: string; status: LoopItemStatus; output?: string; attempts: LoopAttempt[]; error?: string }

export type LoopUsage = { pixie: PixieUsage; judge: PixieUsage };
export type LoopRunStatus = 'compiling' | 'running' | 'done' | 'stopped' | 'error' | 'cancelled';
export interface LoopRun {
  id: string;
  sessionId: string;
  status: LoopRunStatus;
  startedAt: number;
  finishedAt?: number;
  /** Last time the writer saved this run; an active run that stops updating was interrupted. */
  updatedAt?: number;
  instruction: string;
  checks?: LoopChecks;
  compiledBy?: 'pixie' | 'spec';
  /** Why the run stopped early or failed to start. */
  reason?: string;
  total: number;
  items: LoopItemResult[];
  usage: LoopUsage;
  outputPath?: string;
}
export interface LoopRunRecord { version: 1; runs: LoopRun[] }
export type LoopRunFrame = { type: 'sync' } | { type: 'run'; run: LoopRun };

/** What the calling agent gets back (D9). */
export interface LoopSummary {
  runId: string;
  status: LoopRunStatus;
  reason?: string;
  passed: number;
  escalated: { id: string; attempts: number; failed: string[]; feedback?: string }[];
  errors: { id: string; error: string }[];
  skipped: number;
  outputPath?: string;
  usage: LoopUsage;
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
function onlyKeys(value: Record<string, unknown>, allowed: readonly string[], where: string) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Unknown field in ${where}: ${key}`);
}
function integer(value: unknown, min: number, max: number, where: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new Error(`${where} must be an integer from ${min} to ${max}`);
  return value;
}

function validateCodeCheck(raw: unknown, index: number): CodeCheck {
  const where = `codeChecks[${index}]`;
  if (!object(raw)) throw new Error(`${where} must be an object`);
  if (raw.type === 'placeholders') { onlyKeys(raw, ['type'], where); return { type: 'placeholders' }; }
  if (raw.type === 'regex') {
    onlyKeys(raw, ['type', 'pattern', 'flags', 'expect'], where);
    if (!text(raw.pattern)) throw new Error(`${where} needs a pattern`);
    if (raw.flags !== undefined && (typeof raw.flags !== 'string' || !/^[imsu]*$/.test(raw.flags))) throw new Error(`${where} flags may use only i, m, s, u`);
    if (raw.expect !== 'match' && raw.expect !== 'no-match') throw new Error(`${where} expect must be match or no-match`);
    try { new RegExp(raw.pattern, raw.flags as string | undefined); } catch (error) { throw new Error(`${where} has an invalid pattern: ${error instanceof Error ? error.message : String(error)}`); }
    return { type: 'regex', pattern: raw.pattern, ...(raw.flags ? { flags: raw.flags as string } : {}), expect: raw.expect };
  }
  if (raw.type === 'json') {
    onlyKeys(raw, ['type', 'keys'], where);
    if (raw.keys !== undefined && (!Array.isArray(raw.keys) || !raw.keys.every(text))) throw new Error(`${where} keys must be non-empty strings`);
    return { type: 'json', ...(raw.keys ? { keys: [...raw.keys] as string[] } : {}) };
  }
  throw new Error(`${where} type must be placeholders, regex, or json`);
}

/** Validate checks: judge-valid questions, one pass rule per question that fits its type. */
export function validateLoopChecks(raw: unknown): LoopChecks {
  if (!object(raw)) throw new Error('checks must be an object');
  onlyKeys(raw, ['questions', 'pass'], 'checks');
  const { questions } = validateJudgeRequest({ state: '', questions: raw.questions });
  const ids = Object.keys(questions);
  if (ids.length > LOOP_LIMITS.questions) throw new Error(`checks may have at most ${LOOP_LIMITS.questions} questions`);
  if (!object(raw.pass)) throw new Error('checks.pass must map each question id to a rule');
  const pass: Record<string, PassRule> = {};
  for (const id of Object.keys(raw.pass)) if (!ids.includes(id)) throw new Error(`checks.pass names an unknown question: ${id}`);
  for (const id of ids) {
    const rule = raw.pass[id], question = questions[id]!;
    if (!object(rule)) throw new Error(`checks.pass.${id} is required`);
    if (question.type === 'choice') {
      onlyKeys(rule, ['accept'], `checks.pass.${id}`);
      const names = Object.keys(question.criteria);
      if (!Array.isArray(rule.accept) || !rule.accept.length || !rule.accept.every(name => typeof name === 'string' && names.includes(name))) throw new Error(`checks.pass.${id}.accept must list options of the question`);
      if (rule.accept.length === names.length) throw new Error(`checks.pass.${id}.accept must leave at least one failing option`);
      pass[id] = { accept: [...new Set(rule.accept as string[])] };
    } else {
      onlyKeys(rule, ['min'], `checks.pass.${id}`);
      const top = question.type === 'score' ? question.criteria.length - 1 : 1;
      if (typeof rule.min !== 'number' || !Number.isFinite(rule.min) || rule.min <= 0 || rule.min > top) throw new Error(`checks.pass.${id}.min must be above 0 and at most ${top}`);
      pass[id] = { min: rule.min };
    }
  }
  return { questions, pass };
}

function validateItem(raw: unknown, index: number): LoopItem {
  if (!object(raw)) throw new Error(`items[${index}] must be an object`);
  onlyKeys(raw, ['id', 'input'], `items[${index}]`);
  if (!text(raw.id) || raw.id.length > 200) throw new Error(`items[${index}].id must be a non-empty string up to 200 characters`);
  if (typeof raw.input !== 'string' || !raw.input.length) throw new Error(`items[${index}].input must be a non-empty string`);
  if (raw.input.length > LOOP_LIMITS.inputChars) throw new Error(`items[${index}].input exceeds ${LOOP_LIMITS.inputChars} characters`);
  return { id: raw.id, input: raw.input };
}

/** Validate items from a spec or a file; ids are unique. */
export function validateLoopItems(raw: unknown): LoopItem[] {
  if (!Array.isArray(raw) || !raw.length) throw new Error('items must be a non-empty array');
  if (raw.length > LOOP_LIMITS.items) throw new Error(`items may have at most ${LOOP_LIMITS.items} entries`);
  const items = raw.map(validateItem), ids = new Set<string>();
  for (const item of items) { if (ids.has(item.id)) throw new Error(`Duplicate item id: ${item.id}`); ids.add(item.id); }
  return items;
}

/** Parse a JSONL items file: one `{ id, input }` per non-blank line. */
export function parseLoopItemsFile(content: string): LoopItem[] {
  const rows = content.split('\n').map((line, index) => [line.trim(), index + 1] as const).filter(([line]) => line);
  return validateLoopItems(rows.map(([line, number]) => {
    try { return JSON.parse(line) as unknown; } catch { throw new Error(`items file line ${number} is not JSON`); }
  }));
}

function validateExamples(raw: unknown, where: string): LoopExample[] {
  if (!Array.isArray(raw) || !raw.length) throw new Error(`${where} needs at least one example`);
  if (raw.length > LOOP_LIMITS.calibration) throw new Error(`${where} may have at most ${LOOP_LIMITS.calibration} examples`);
  return raw.map((example, index) => {
    if (!object(example)) throw new Error(`${where}[${index}] must be an object`);
    onlyKeys(example, ['input', 'output'], `${where}[${index}]`);
    if (typeof example.input !== 'string' || typeof example.output !== 'string') throw new Error(`${where}[${index}] needs input and output strings`);
    return { input: example.input, output: example.output };
  });
}

const relativePath = (value: unknown, where: string): string => {
  if (!text(value)) throw new Error(`${where} must be a non-empty path`);
  return value;
};

/** Validate a loop spec; anything unknown or out of range is an error before any model call. */
export function validateLoopSpec(raw: unknown): LoopSpec {
  if (!object(raw)) throw new Error('Loop spec must be an object');
  onlyKeys(raw, ['items', 'shared', 'work', 'criteria', 'checks', 'codeChecks', 'calibration', 'maxAttempts', 'concurrency', 'limits', 'output'], 'spec');
  if (!object(raw.items)) throw new Error('items must be { inline: [...] } or { path: "..." }');
  let items: LoopSpec['items'];
  if ('inline' in raw.items) { onlyKeys(raw.items, ['inline'], 'items'); items = { inline: validateLoopItems(raw.items.inline) }; }
  else if ('path' in raw.items) { onlyKeys(raw.items, ['path'], 'items'); items = { path: relativePath(raw.items.path, 'items.path') }; }
  else throw new Error('items must be { inline: [...] } or { path: "..." }');
  if (raw.shared !== undefined && (typeof raw.shared !== 'string' || raw.shared.length > LOOP_LIMITS.sharedChars)) throw new Error(`shared must be a string up to ${LOOP_LIMITS.sharedChars} characters`);
  if (!object(raw.work)) throw new Error('work must be { instruction }');
  onlyKeys(raw.work, ['instruction'], 'work');
  if (!text(raw.work.instruction)) throw new Error('work.instruction is required');
  if ((raw.criteria === undefined) === (raw.checks === undefined)) throw new Error('Give exactly one of criteria and checks');
  if (raw.criteria !== undefined && !text(raw.criteria)) throw new Error('criteria must be a non-empty string');
  const checks = raw.checks === undefined ? undefined : validateLoopChecks(raw.checks);
  let codeChecks: CodeCheck[] | undefined;
  if (raw.codeChecks !== undefined) {
    if (!Array.isArray(raw.codeChecks) || raw.codeChecks.length > LOOP_LIMITS.codeChecks) throw new Error(`codeChecks must be an array of at most ${LOOP_LIMITS.codeChecks}`);
    codeChecks = raw.codeChecks.map(validateCodeCheck);
  }
  if (!object(raw.calibration)) throw new Error('calibration needs pass and fail examples');
  onlyKeys(raw.calibration, ['pass', 'fail'], 'calibration');
  const calibration = { pass: validateExamples(raw.calibration.pass, 'calibration.pass'), fail: validateExamples(raw.calibration.fail, 'calibration.fail') };
  if (!object(raw.limits)) throw new Error('limits needs tokens and timeMs');
  onlyKeys(raw.limits, ['tokens', 'timeMs'], 'limits');
  const limits = { tokens: integer(raw.limits.tokens, 1000, LOOP_LIMITS.tokens, 'limits.tokens'), timeMs: integer(raw.limits.timeMs, 1000, LOOP_LIMITS.timeMs, 'limits.timeMs') };
  return {
    items, work: { instruction: raw.work.instruction }, calibration, limits,
    ...(raw.shared ? { shared: raw.shared } : {}),
    ...(raw.criteria !== undefined ? { criteria: raw.criteria as string } : {}),
    ...(checks ? { checks } : {}),
    ...(codeChecks?.length ? { codeChecks } : {}),
    maxAttempts: raw.maxAttempts === undefined ? LOOP_DEFAULTS.maxAttempts : integer(raw.maxAttempts, 1, LOOP_LIMITS.attempts, 'maxAttempts'),
    concurrency: raw.concurrency === undefined ? LOOP_DEFAULTS.concurrency : integer(raw.concurrency, 1, LOOP_LIMITS.concurrency, 'concurrency'),
    ...(raw.output !== undefined ? { output: relativePath(raw.output, 'output') } : {}),
  };
}

/** Placeholders and tags whose presence must survive a rewrite: `{name}`, `{{x}}`, `%s`/`%1$d`, `<tag>`/`</tag>`. */
const PLACEHOLDER = /\{\{[^{}]+\}\}|\{[A-Za-z0-9_.-]+\}|%(?:\d+\$)?[sdif@]|<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>/g;
function tokens(value: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const match of value.matchAll(PLACEHOLDER)) counts.set(match[0], (counts.get(match[0]) ?? 0) + 1);
  return counts;
}

/** Run deterministic checks; an empty list means every check passed. */
export function runCodeChecks(checks: readonly CodeCheck[], input: string, output: string): CodeCheckFailure[] {
  const failures: CodeCheckFailure[] = [];
  for (const check of checks) {
    if (check.type === 'placeholders') {
      const want = tokens(input), have = tokens(output);
      const missing = [...want].filter(([token, count]) => (have.get(token) ?? 0) < count).map(([token]) => token);
      const extra = [...have].filter(([token, count]) => (want.get(token) ?? 0) < count).map(([token]) => token);
      if (missing.length || extra.length) failures.push({ check: 'placeholders', message: [missing.length ? `missing ${missing.join(' ')}` : '', extra.length ? `unexpected ${extra.join(' ')}` : ''].filter(Boolean).join('; ') });
    } else if (check.type === 'regex') {
      const matched = new RegExp(check.pattern, check.flags).test(output);
      if (matched !== (check.expect === 'match')) failures.push({ check: 'regex', message: `output ${check.expect === 'match' ? 'does not match' : 'matches'} /${check.pattern}/${check.flags ?? ''}` });
    } else {
      let parsed: unknown;
      try { parsed = JSON.parse(output); } catch { failures.push({ check: 'json', message: 'output is not JSON' }); continue; }
      const missing = (check.keys ?? []).filter(key => !object(parsed) || !Object.hasOwn(parsed, key));
      if (missing.length) failures.push({ check: 'json', message: `missing keys ${missing.join(', ')}` });
    }
  }
  return failures;
}

/** Apply pass rules to answers; returns the questions that did not pass. */
export function failedQuestions(checks: LoopChecks, answers: Record<string, JudgeAnswer>): QuestionFailure[] {
  const failed: QuestionFailure[] = [];
  for (const [id, question] of Object.entries(checks.questions)) {
    const answer = answers[id], rule = checks.pass[id]!;
    if (!answer) throw new Error(`Missing answer for "${id}"`);
    const ok = 'accept' in rule ? answer.type === 'choice' && rule.accept.includes(answer.choice)
      : answer.type === 'noul' ? answer.noul >= rule.min : answer.type === 'score' && answer.score >= rule.min;
    if (!ok) failed.push({ id, instructions: question.instructions, answer, rule });
  }
  return failed;
}

export const emptyUsage = (): PixieUsage => ({ inputTokens: 0, outputTokens: 0 });
export function addUsage(total: PixieUsage, value: PixieUsage | undefined) {
  if (!value) return;
  for (const key of ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'reasoningTokens'] as const) {
    if (value[key] !== undefined) total[key] = (total[key] ?? 0) + value[key]!;
  }
}
export const usageTokens = (usage: LoopUsage) => usage.pixie.inputTokens + usage.pixie.outputTokens + usage.judge.inputTokens + usage.judge.outputTokens;

/** The agent-facing summary of a finished run (D9). */
export function summarizeRun(run: LoopRun): LoopSummary {
  const escalated = run.items.filter(item => item.status === 'escalated').map(item => {
    const last = item.attempts.at(-1);
    const failed = [...(last?.codeFailures.map(failure => `code:${failure.check}`) ?? []), ...(last?.answers && run.checks ? failedQuestions(run.checks, last.answers).map(failure => failure.id) : [])];
    return { id: item.id, attempts: item.attempts.length, failed, ...(last?.feedback ? { feedback: last.feedback } : {}) };
  });
  return {
    runId: run.id, status: run.status, ...(run.reason ? { reason: run.reason } : {}),
    passed: run.items.filter(item => item.status === 'passed').length, escalated,
    errors: run.items.filter(item => item.status === 'error').map(item => ({ id: item.id, error: item.error ?? 'error' })),
    skipped: run.total - run.items.filter(item => item.status !== 'skipped' && item.status !== 'cancelled').length,
    ...(run.outputPath ? { outputPath: run.outputPath } : {}), usage: run.usage,
  };
}
