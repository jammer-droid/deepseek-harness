/** `pixie_loop` (#31 S5): run a Pixie Loop spec outside the caller's context and return a summary (D9).
 * Item files are read and results written through the session's own `read`/`write` tools, so file policy and
 * sandbox apply. Background runs are owned DSH jobs: `job_kill` cancels, and the summary is the job result.
 */
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-tools';
import type { JobId } from '@deepseek-ai/dsh-jobs';
import type { SessionId } from '@deepseek-ai/dsh-session';
import { ToolCallId } from '@deepseek-ai/dsh-llm';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import type { PixieSettings } from '../pixie-contracts.ts';
import { parseLoopItemsFile, summarizeRun, validateLoopSpec, type LoopItem, type LoopRun, type LoopSpec, type LoopSummary } from '../pixie-loop-contracts.ts';
import { judgeEngineFor, type JevCredentials } from './jev-judge.ts';
import { runLoop } from './pixie-loop-engine.ts';
import { PixieLoopStore, throttledWriter } from './pixie-loop-store.ts';
import type { PixieLlm } from './pixie-runtime.ts';
import { PixieSettingsStore } from './pixie-store.ts';
import { studioStorePath } from './preset-store.ts';
import { createLifetime, type Lifetime } from './tool-lifetime.ts';
declare module '@deepseek-ai/dsh-jobs' { interface JobKindMap { 'pixie-loop': 'pixie-loop' } }

export const LOOP_TOOL = 'pixie_loop';
/** Rendered result ceiling; the summary is already bounded, this guards very long escalation lists. */
const MAX_RESULT_CHARS = 20_000;
/** Lines read per `read` call when loading an items file. */
const READ_PAGE = 2000;

const TEXT = { type: 'string', minLength: 1 } as const;
const EXAMPLE = { type: 'object', additionalProperties: false, required: ['input', 'output'], properties: { input: { type: 'string' }, output: { type: 'string' } } } as const;
export const LOOP_PARAMETERS = {
  type: 'object', additionalProperties: false, required: ['items', 'work', 'calibration', 'limits'],
  properties: {
    items: { description: 'Items to process: inline [{id, input}] or a JSONL file path (one {"id","input"} per line).', oneOf: [
      { type: 'object', additionalProperties: false, required: ['inline'], properties: { inline: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['id', 'input'], properties: { id: TEXT, input: TEXT } } } } },
      { type: 'object', additionalProperties: false, required: ['path'], properties: { path: TEXT } },
    ] },
    shared: { type: 'string', description: 'Fixed context every item sees (glossary, style guide). Items never see each other.' },
    work: { type: 'object', additionalProperties: false, required: ['instruction'], properties: { instruction: { ...TEXT, description: 'What the worker does with one item input. The worker has no tools.' } } },
    criteria: { type: 'string', description: 'Review criteria in plain words; compiled once into fixed judge questions. Give this or checks.' },
    checks: { type: 'object', description: 'Judge questions and pass rules given directly instead of criteria: {questions: {id: noul|choice|score question about `input`/`output`}, pass: {id: {min} | {accept: [options]}}}.' },
    codeChecks: { type: 'array', description: 'Exact checks run before the judge: {type:"placeholders"} keeps {x}, {{x}}, %s and tags; {type:"regex", pattern, flags?, expect:"match"|"no-match"}; {type:"json", keys?}.', items: { type: 'object' } },
    calibration: { type: 'object', additionalProperties: false, required: ['pass', 'fail'], description: 'Examples the checks must pass and fail before the run starts.',
      properties: { pass: { type: 'array', minItems: 1, items: EXAMPLE }, fail: { type: 'array', minItems: 1, items: EXAMPLE } } },
    maxAttempts: { type: 'integer', minimum: 1, maximum: 10, description: 'Tries per item, each retry seeing its own previous output and feedback. Default 3.' },
    concurrency: { type: 'integer', minimum: 1, maximum: 8, description: 'Items in flight. Default 4.' },
    limits: { type: 'object', additionalProperties: false, required: ['tokens', 'timeMs'], description: 'Run stops when either is reached; remaining items are reported as skipped.',
      properties: { tokens: { type: 'integer', minimum: 1000 }, timeMs: { type: 'integer', minimum: 1000 } } },
    output: { type: 'string', description: 'JSONL results file: one {id, status, output?, attempts} per item.' },
    run_in_background: { type: 'boolean', description: 'Return a job id at once; collect the summary with job_output, cancel with job_kill.' },
  },
} as const;

const DESCRIPTION = 'Run a repeated generate-and-review loop outside your context with the lightweight Pixie model and the decision engine. For each item: the worker produces an output from `work.instruction` and `shared`; exact codeChecks run; the decision engine judges it with fixed questions; on failure Pixie writes feedback and the worker retries with only that item\'s history. Criteria are compiled once and must separate the calibration examples, or the run does not start. You get counts, the results file, and only the items that still failed (escalated) or errored — handle those yourself. Use it for many independent items judged by the same criteria (translation review, copy edits, per-file audits). Item inputs go to the configured model providers.';

interface ToolExec { agent?: { id: string }; signal: AbortSignal; callId: string; rootCallId?: string; token?: unknown }
type ToolsSlice = { register(definition: unknown): () => void; execute(call: unknown): Promise<{ isError: boolean; value?: unknown; content: { type: string; text?: string }[] }> };

/** Render a summary for the model, bounded. */
export function renderSummary(summary: LoopSummary): string {
  const lines = [`pixie_loop ${summary.status}${summary.reason ? `: ${summary.reason}` : ''}`,
    `passed ${summary.passed}, escalated ${summary.escalated.length}, errors ${summary.errors.length}, skipped ${summary.skipped}`,
    ...(summary.outputPath ? [`results: ${summary.outputPath}`] : []),
    `usage: pixie ${summary.usage.pixie.inputTokens}/${summary.usage.pixie.outputTokens}, judge ${summary.usage.judge.inputTokens}/${summary.usage.judge.outputTokens} (input/output tokens)`];
  const detail = JSON.stringify({ escalated: summary.escalated, errors: summary.errors });
  const text = `${lines.join('\n')}\n${detail}`;
  return text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}\n[truncated; see the results file and the Pixie tab › Loops]` : text;
}

export interface LoopToolDeps {
  settings: () => Promise<PixieSettings>;
  store: PixieLoopStore;
  llm: () => PixieLlm | undefined;
  credentials: () => JevCredentials | undefined;
  jobs: () => { start(spec: unknown): JobId; wait(id: JobId, timeoutMs: number, caller?: SessionId, signal?: AbortSignal): Promise<unknown> } | undefined;
}

export function installLoop(ctx: Context, life: Lifetime, deps: LoopToolDeps): () => void {
  const tools = ctx.get('tools') as unknown as ToolsSlice | undefined;
  if (!tools) throw new Error('Studio pixie_loop requires tools');
  const nested = async (exec: ToolExec, name: string, args: Record<string, unknown>, signal: AbortSignal) => {
    const result = await tools.execute({ name, arguments: args, ...(exec.agent ? { agent: exec.agent } : {}), signal, callId: ToolCallId(`${exec.callId}:loop-${name}-${randomUUID().slice(0, 8)}`), rootCallId: exec.rootCallId, parent: exec.token });
    if (result.isError) throw new Error(`${name} failed: ${result.content.map(block => block.text ?? '').join(' ').slice(0, 500)}`);
    return result.value as Record<string, unknown>;
  };
  async function loadItems(spec: LoopSpec, exec: ToolExec, signal: AbortSignal): Promise<LoopItem[]> {
    if ('inline' in spec.items) return spec.items.inline;
    const lines: string[] = [];
    for (let offset = 1; ; offset += READ_PAGE) {
      const value = await nested(exec, 'read', { file_path: spec.items.path, offset, limit: READ_PAGE }, signal);
      const page = (value.lines as { number: number; text: string }[] | undefined) ?? [];
      for (const line of page) {
        if (/\.\.\. \(line truncated to \d+ chars\)$/.test(line.text)) throw new Error(`items file line ${line.number} is too long to read whole; keep each item under the read tool's line limit`);
        lines.push(line.text);
      }
      if (!page.length || page.at(-1)!.number >= (value.totalLines as number)) break;
    }
    return parseLoopItemsFile(lines.join('\n'));
  }
  async function execute(spec: LoopSpec, items: LoopItem[], exec: ToolExec, runId: string, signal: AbortSignal, outputPath: string | undefined, onProgress?: (run: LoopRun) => void): Promise<LoopSummary> {
    const settings = await deps.settings();
    const llm = deps.llm() ?? { stream: () => { throw new Error('DSH llm service is unavailable'); } };
    const judge = judgeEngineFor(settings, { llm, credentials: deps.credentials() });
    const writer = throttledWriter(run => deps.store.put(run), 500, error => ctx.logger?.warn?.(`studio pixie_loop: record write failed: ${String(error)}`));
    const run = await runLoop(spec, items, { llm, model: settings.model, judge, update: value => { writer.update(value); onProgress?.(value); } },
      { sessionId: exec.agent!.id, signal, runId, ...(outputPath ? { outputPath } : {}) });
    if (outputPath && run.items.some(item => item.status !== 'skipped')) {
      const body = run.items.filter(item => item.status !== 'skipped').map(item => JSON.stringify({ id: item.id, status: item.status, ...(item.output !== undefined ? { output: item.output } : {}), attempts: item.attempts.length, ...(item.error ? { error: item.error } : {}) })).join('\n') + '\n';
      try { await nested(exec, 'write', { file_path: outputPath, content: body }, new AbortController().signal); }
      catch (error) { run.reason = `${run.reason ? `${run.reason}; ` : ''}results file not written: ${error instanceof Error ? error.message : String(error)}`; delete run.outputPath; }
    }
    writer.update(run);
    await writer.flush();
    return summarizeRun(run);
  }
  return tools.register({
    name: LOOP_TOOL, description: DESCRIPTION, parameters: LOOP_PARAMETERS as unknown as Record<string, unknown>,
    output: { schema: { type: 'object' }, render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: (value as { kind?: string }).kind === 'background' ? JSON.stringify(value) : renderSummary(value as LoopSummary) }] },
    async execute(raw: unknown, exec: ToolExec) {
      const { run_in_background: background, ...rest } = (raw ?? {}) as Record<string, unknown>;
      const spec = validateLoopSpec(rest);
      const owner = exec.agent?.id;
      if (!owner) throw new Error('pixie_loop requires a calling agent');
      const items = await loadItems(spec, exec, exec.signal);
      const runId = randomUUID();
      if (background !== true) {
        return life.run(async owned => JSON.parse(JSON.stringify(await execute(spec, items, exec, runId, AbortSignal.any([owned, exec.signal]), spec.output))));
      }
      const jobs = deps.jobs();
      if (!jobs) throw new Error('Background pixie_loop requires the DSH jobs service');
      const id = jobs.start({ kind: 'pixie-loop', owner: owner as SessionId, label: `pixie_loop: ${items.length} item(s) — ${spec.work.instruction.slice(0, 60)}`,
        run(handle: { append(text: string): void; updateProgress(line: string): void }) {
          const controller = new AbortController();
          let reported = 0;
          const done = life.run(async owned => {
            try {
              const summary = await execute(spec, items, exec, runId, AbortSignal.any([owned, controller.signal]), spec.output, run => {
                const finished = run.items.filter(item => item.status !== 'skipped').length;
                handle.updateProgress(`${run.status} ${finished}/${run.total}`);
                for (const item of run.items.slice(reported)) handle.append(`${item.id}: ${item.status}${item.attempts.length ? ` after ${item.attempts.length} attempt(s)` : ''}\n`);
                reported = run.items.length;
              });
              const result = renderSummary(summary);
              return summary.status === 'cancelled' ? { status: 'killed' as const, detail: summary.reason ?? 'cancelled', result }
                : summary.status === 'error' ? { status: 'failed' as const, detail: summary.reason ?? 'error', result }
                  : { status: 'completed' as const, detail: `${summary.passed} passed, ${summary.escalated.length} escalated`, result };
            } catch (error) { return { status: controller.signal.aborted ? 'killed' as const : 'failed' as const, detail: String(error) }; }
          }).catch(error => ({ status: 'failed' as const, detail: String(error) }));
          return { done, cancel: (reason?: string) => controller.abort(new Error(reason ?? 'pixie_loop cancelled')) };
        } });
      return { kind: 'background', jobId: id, runId };
    },
  });
}

export const inject = ['tools'];
export function apply(ctx: Context) {
  // Same files the Pixie settings page and the Pixie tab use, under `<profile>/studio-data/`.
  const dataDir = dirname(studioStorePath(process.env, ctx.get('profileContext')));
  const settings = new PixieSettingsStore(join(dataDir, 'pixie-settings.json'));
  const store = new PixieLoopStore(join(dataDir, 'pixie'));
  const life = createLifetime();
  ctx.effect(() => installLoop(ctx, life, {
    settings: () => settings.read(), store,
    llm: () => ctx.get('llm') as unknown as PixieLlm | undefined,
    credentials: () => ctx.get('credentials') as unknown as JevCredentials | undefined,
    jobs: () => ctx.get('jobs') as unknown as ReturnType<LoopToolDeps['jobs']>,
  }));
  ctx.effect(() => () => life.dispose());
}
