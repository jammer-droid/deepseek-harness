import type { Context } from '@deepseek-ai/cordis';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { join } from 'node:path';
import type { JudgeRequest, PixieAskFrame, PixieContextMode, PixieSessionRecord, PixieSettings, PixieTurn, PixieUsageTotal } from '../pixie-contracts.ts';
import { totalUsage } from '../pixie-contracts.ts';
import { pixieCommand } from './pixie-command.ts';
import { LlmJudgeEngine } from './pixie-judge.ts';
import { PixieLive } from './pixie-live.ts';
import { PixieGateStore, type PixieGateRecorder } from './pixie-gate-store.ts';
import type { GateRejection, GateRunFrame } from '../pixie-gate-contracts.ts';
import { PixieRuntime, type PixieLlm } from './pixie-runtime.ts';
import { parsePixieModel, PixieSettingsStore, PixieStore } from './pixie-store.ts';
import type { ForkEvent } from './pixie-fork.ts';
import { PixieGateDefinitions } from './pixie-gate-definitions.ts';
import { gateInput } from './pixie-gate-input.ts';
import { DefaultStageRunner, type GateShell } from './pixie-gate-runner.ts';
import type { GateInput } from '../pixie-gate-contracts.ts';

/** What the Pixie tab shows for one session. */
export interface PixieView {
  record: PixieSessionRecord;
  total: PixieUsageTotal;
  running: boolean;
  /** Frames of the request now streaming, for a view that opened mid-answer. */
  frames: PixieAskFrame[];
  settings: PixieSettings;
  /** Context window of the active thread's model, when the adapter declares it. */
  contextWindow?: number;
}

interface SessionControllerSlice {
  inspect(sessionId: string, signal?: AbortSignal): Promise<{ events: readonly ForkEvent[] }>;
  list(request: Record<string, never>, signal: AbortSignal): Promise<{ items: readonly { sessionId: string }[] }>;
  modelCatalog(): Promise<unknown>;
}

/** How often records of deleted sessions are pruned while the Host runs. */
const PRUNE_INTERVAL_MS = 10 * 60 * 1000;
interface LlmSlice extends PixieLlm { resolveModelInfo(provider: string, model: string, signal?: AbortSignal): Promise<{ context?: { contextWindow: number } }> }

const json = <T>(payload: string): T => JSON.parse(payload) as T;
const llmOf = (ctx: Context) => ctx.get('llm') as unknown as LlmSlice;

/** Remote `pixie`: a side model whose requests never enter a session's model-visible log.
 * Also registers `/pixie`. History lives in `<profile>/studio-data/pixie/<sessionId>.json` and follows the session:
 * archived sessions keep it, and records of sessions that no longer exist are pruned on start.
 */
export class PixieService extends TypertRemoteService {
  static inject = ['llm', 'sessionController', 'commands'];
  private store: PixieStore;
  private settings: PixieSettingsStore;
  private runtime: PixieRuntime;
  private live: PixieLive;
  private gates: PixieGateStore;
  private definitions: PixieGateDefinitions;
  /** Internal producer API, intentionally not Remote. */
  get gateRecorder(): PixieGateRecorder { return this.gates; }
  constructor(ctx: Context, dataDir: string) {
    super(ctx, 'studioPixie');
    this.store = new PixieStore(join(dataDir, 'pixie'));
    this.gates = new PixieGateStore(join(dataDir, 'pixie'));
    this.settings = new PixieSettingsStore(join(dataDir, 'pixie-settings.json'));
    this.definitions = new PixieGateDefinitions(join(dataDir, 'pixie', 'gates.json'));
    ctx.on('agent/pre-step', gateInput({
      definitions: () => this.definitions.read(),
      preset: agent => ctx.get('agentPresets')?.composedPreset(agent.ctx),
      isRoot: agent => ctx.get('agents')?.roots().some(root => root.id === agent.id) ?? false,
      policy: agent => {
        const service = ctx.get('sandboxPolicy') as unknown as { resolve(request: { session: unknown }): GateInput['sandboxPolicy'] } | undefined;
        return service?.resolve({ session: agent.session });
      },
      runner: async () => {
        const model = (await this.settings.read()).model;
        return new DefaultStageRunner({
        shell: {
          resolve: request => {
            if (!request.workdir) throw new Error('Agent working directory is required');
            const shell = ctx.get('shell') as unknown as GateShell | undefined;
            if (!shell) throw new Error('Shell service is unavailable');
            return shell.resolve(request);
          },
          execute: spec => (ctx.get('shell') as unknown as GateShell).execute(spec),
        },
        llm: { stream: options => llmOf(ctx).stream(options) },
        ...(model ? { model } : {}),
        });
      },
      recorder: this.gates,
      emit: (event, run) => ctx.emit(event, run),
    }), { prepend: true });
    const sessions = () => ctx.get('sessionController') as unknown as SessionControllerSlice;
    this.runtime = new PixieRuntime({
      store: this.store,
      llm: { stream: options => llmOf(ctx).stream(options) },
      settings: () => this.settings.read(),
      sessionEvents: async (sessionId, signal) => (await sessions().inspect(sessionId, signal)).events,
    });
    this.live = new PixieLive(this.runtime);
    // Cordis awaits an async disposer, so no turn is written after Studio stops.
    ctx.effect(() => async () => { await this.live.dispose(); });
    ctx.effect(() => (ctx.get('commands') as unknown as { register(definition: unknown): () => void }).register(pixieCommand(this.live)));
    // Follow session deletion: the durable list includes archived sessions, so only deleted ones lose their record.
    // A failed listing prunes nothing.
    ctx.effect(() => {
      const lifetime = new AbortController();
      let running: Promise<unknown> = Promise.resolve();
      const prune = () => {
        running = (async () => {
          const listed = await sessions().list({}, lifetime.signal);
          const existing = new Set(listed.items.map(item => item.sessionId));
          await this.store.prune(async sessionId => existing.has(sessionId));
          await this.gates.prune(async () => listed.items);
        })().catch(error => { if (!lifetime.signal.aborted) ctx.logger?.warn?.(`studio pixie: prune skipped: ${String(error)}`); });
      };
      const first = setTimeout(prune, 0);
      const timer = setInterval(prune, PRUNE_INTERVAL_MS);
      return async () => { clearTimeout(first); clearInterval(timer); lifetime.abort(); await running; };
    });
  }

  @Remote
  async view(sessionId: string): Promise<PixieView> {
    const [record, settings] = await Promise.all([this.store.read(sessionId), this.settings.read()]);
    const active = record.threads.find(thread => thread.id === record.activeThreadId);
    const model = active?.model ?? settings.model;
    let contextWindow: number | undefined;
    if (model) {
      try { contextWindow = (await llmOf(this.ctx).resolveModelInfo(model.provider, model.model)).context?.contextWindow; } catch { /* unknown routes show no limit */ }
    }
    const frames = this.live.current(sessionId);
    return { record, total: totalUsage(record), running: frames.length > 0, frames, settings, ...(contextWindow === undefined ? {} : { contextWindow }) };
  }

  /** Create a thread (정리 = start a new one); payload `{ mode?, model? }`. */
  @Remote
  async createThread(sessionId: string, payload: string) {
    const raw = json<{ mode?: PixieContextMode; model?: unknown }>(payload);
    if (raw.mode !== undefined && raw.mode !== 'fresh' && raw.mode !== 'fork') throw new Error('Pixie thread mode must be fresh or fork');
    return this.runtime.createThread(sessionId, { ...(raw.mode ? { mode: raw.mode } : {}), ...(raw.model ? { model: parsePixieModel(raw.model) } : {}) });
  }

  @Remote
  async activate(sessionId: string, threadId: string) { await this.store.activate(sessionId, threadId); return true; }

  @Remote
  async deleteThread(sessionId: string, threadId: string) { await this.live.deleteThread(sessionId, threadId); return true; }

  /** The turn a `/pixie` command started, for the conversation row; undefined while it is not recorded yet. */
  @Remote
  async commandTurn(sessionId: string, commandId: string): Promise<PixieTurn | null> {
    const record = await this.store.read(sessionId);
    for (const thread of record.threads) for (const turn of thread.turns) if (turn.commandId === commandId) return turn;
    return null;
  }

  /** Start a request; the answer arrives through `follow`. Payload `{ question, threadId? }`. */
  @Remote
  async ask(sessionId: string, payload: string) {
    const raw = json<{ question?: unknown; threadId?: unknown }>(payload);
    if (typeof raw.question !== 'string' || !raw.question.trim()) throw new Error('[pixie/empty] Pixie question is required');
    return this.live.start(sessionId, { question: raw.question.trim(), ...(typeof raw.threadId === 'string' ? { threadId: raw.threadId } : {}) });
  }

  /** 회수: cancel the running request of a session. */
  @Remote
  async cancel(sessionId: string) { return this.live.cancel(sessionId); }

  /** Stream frames of requests in one session until the caller disconnects. */
  @Remote({ mode: 'stream' })
  async *follow(sessionId: string, signal: AbortSignal): AsyncIterable<PixieAskFrame> {
    // Snapshot and subscribe without yielding: replay precedes every new frame.
    // Sync also repairs a completion missed while the carrier was disconnected.
    const queue: PixieAskFrame[] = [{ type: 'sync' }, ...this.live.current(sessionId)];
    let wake: (() => void) | undefined;
    const stop = this.live.subscribe(sessionId, frame => { queue.push(frame); wake?.(); });
    const onAbort = () => wake?.();
    signal.addEventListener('abort', onAbort);
    try {
      while (!signal.aborted) {
        while (queue.length) yield queue.shift()!;
        if (signal.aborted) break;
        await new Promise<void>(resolve => { wake = resolve; });
        wake = undefined;
      }
    } finally { stop(); signal.removeEventListener('abort', onAbort); }
  }

  @Remote
  async gateDefinitions() { return this.definitions.read(); }

  @Remote
  async saveGateDefinitions(payload: string) { return this.definitions.save(json(payload)); }

  @Remote
  async gateRuns(sessionId: string) { return this.gates.read(sessionId); }

  /** Marks an already resent/dismissed card; this method does not send input. */
  @Remote
  async resolveGateRejection(sessionId: string, runId: string, status: Exclude<GateRejection['status'], 'pending'>) {
    return this.gates.resolveRejection(sessionId, runId, status);
  }

  @Remote({ mode: 'stream' })
  async *followGates(sessionId: string, signal: AbortSignal): AsyncIterable<GateRunFrame> {
    yield* this.gates.follow(sessionId, signal);
  }

  @Remote
  async readSettings() { return this.settings.read(); }

  @Remote
  async saveSettings(payload: string) { return this.settings.save(json(payload)); }

  @Remote
  async models() {
    return (this.ctx.get('sessionController') as unknown as SessionControllerSlice).modelCatalog();
  }

  /** Manual judge trial with the configured Pixie model; Jev-shaped request and result. */
  @Remote
  async judge(payload: string, signal: AbortSignal) {
    const settings = await this.settings.read();
    if (!settings.model) return { ok: false, error: '[pixie/no-model] No Pixie model is configured in Studio settings' };
    const engine = new LlmJudgeEngine({ stream: options => llmOf(this.ctx).stream(options) }, settings.model);
    return engine.judge(json<JudgeRequest>(payload), signal);
  }
}
