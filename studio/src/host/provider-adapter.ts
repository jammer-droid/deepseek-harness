/** SettingsX provider routes: one `LlmAdapter` serving every valid definition file, plus the Remote the page reads.
 * Definitions live in `<profile>/studio-data/providers/*.json`. Reloading re-reads the folder and atomically replaces
 * the registered routes; a route another adapter already owns is reported as a conflict and left unregistered.
 */
import type { Context } from '@deepseek-ai/cordis';
import { attributionHeaders, LlmAdapter, LlmError } from '@deepseek-ai/dsh-llm';
import type { GenerateOptions, LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseProviderDefinition, protocolEndpoint, type ProviderDefinition, type ProviderEntry, type ProviderList } from '../provider-contract.ts';
import { requestBody, sseData, translate } from './provider-wire.ts';

type Fetch = typeof fetch;

/** Map an HTTP failure to a provider-neutral code the retry policy understands. */
function httpFailure(status: number, body: string, retryAfter: string | null): LlmError {
  const code = status === 429 ? 'RATE_LIMIT' : status === 401 || status === 403 ? 'AUTHENTICATION' : status === 408 ? 'TIMEOUT' : status >= 500 ? 'SERVER' : 'INVALID_REQUEST';
  const seconds = retryAfter === null ? NaN : Number(retryAfter);
  let detail = body.slice(0, 300);
  try { const parsed = JSON.parse(body) as { error?: { message?: unknown } | string; message?: unknown }; const message = typeof parsed.error === 'object' ? parsed.error?.message : parsed.error ?? parsed.message; if (typeof message === 'string') detail = message; } catch { /* keep raw text */ }
  return new LlmError(`Provider returned HTTP ${status}${detail ? `: ${detail}` : ''}`, code, { status, ...(seconds > 0 ? { providerRetryAfterMs: seconds * 1000 } : {}) });
}

/** Adapter over the current definition set; `definitions` is swapped as a whole on reload. */
export class StudioProviderAdapter extends LlmAdapter {
  definitions = new Map<string, ProviderDefinition>();
  constructor(private readonly fetchImpl: Fetch = fetch) { super(); }
  private definition(provider: string): ProviderDefinition {
    const definition = this.definitions.get(provider);
    if (!definition) throw new LlmError(`Studio provider "${provider}" is not registered`, 'UNKNOWN_PROVIDER');
    return definition;
  }
  override providerInfo(provider: string): LlmProviderInfo { return { id: provider, name: this.definitions.get(provider)?.name ?? provider }; }
  override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    return this.definition(provider).models.map(model => ({ provider, id: model.id, name: model.name ?? model.id, inputModalities: ['text'] }));
  }
  override async resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    const found = this.definition(provider).models.find(entry => entry.id === model);
    return { provider, id: model, name: found?.name ?? model, inputModalities: ['text'],
      ...(found?.contextWindow ? { context: { contextWindow: found.contextWindow } } : {}),
      ...(found?.maxTokens ? { defaultMaxTokens: found.maxTokens } : {}) };
  }
  override async *stream(options: GenerateOptions): AsyncGenerator<StreamChunk> {
    // Capture once: a reload during the request does not switch endpoints mid-call.
    const definition = this.definition(options.provider);
    const maxTokens = options.maxTokens ?? definition.models.find(model => model.id === options.model)?.maxTokens;
    const headers: Record<string, string> = { ...definition.headers, ...attributionHeaders(), 'content-type': 'application/json', accept: 'text/event-stream' };
    let response: Response;
    try {
      response = await this.fetchImpl(protocolEndpoint(definition), { method: 'POST', headers, body: JSON.stringify(requestBody(definition.protocol, options, maxTokens)), signal: options.signal ?? null });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new LlmError(`Could not reach ${definition.name}: ${error instanceof Error ? error.message : String(error)}`, 'TRANSPORT', { cause: error });
    }
    if (!response.ok) throw httpFailure(response.status, await response.text().catch(() => ''), response.headers.get('retry-after'));
    if (!response.body) throw new LlmError('Provider response has no body', 'MALFORMED_RESPONSE');
    yield* translate(definition.protocol, sseData(response.body as unknown as AsyncIterable<Uint8Array>));
  }
}

interface LlmRegistry {
  registerAdapter(providers: string[], adapter: LlmAdapter): (() => void) & { replace(providers: string[]): void };
  listProviders(): LlmProviderInfo[];
}

/** Read every `*.json` in `directory`; invalid files are reported with their issues. Sorted by file name. */
export async function readDefinitions(directory: string): Promise<{ file: string; result: ReturnType<typeof parseProviderDefinition> }[]> {
  let names: string[];
  try { names = (await readdir(directory)).filter(name => name.endsWith('.json')).sort(); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return Promise.all(names.map(async file => ({ file, result: parseProviderDefinition(await readFile(join(directory, file), 'utf8')) })));
}

/** Remote `studioProviders`: lists definition files and reloads them into DSH model selection. */
export class StudioProviders extends TypertRemoteService {
  static inject = ['llm'];
  private adapter: StudioProviderAdapter;
  private registration: ReturnType<LlmRegistry['registerAdapter']> | undefined;
  private entries: ProviderEntry[] = [];
  private loading: Promise<ProviderList> | undefined;
  constructor(ctx: Context, private readonly directory: string, fetchImpl?: Fetch) {
    super(ctx, 'studioProviders');
    this.adapter = new StudioProviderAdapter(fetchImpl);
    ctx.effect(() => () => { this.registration?.(); this.registration = undefined; });
    void this.reload().catch(error => ctx.logger?.warn?.(`studio: provider definitions not loaded: ${String(error)}`));
  }
  private get llm() { return this.ctx.get('llm') as unknown as LlmRegistry; }

  /** Re-read the folder and replace the registered routes in one step. */
  @Remote
  async reload(): Promise<ProviderList> {
    // Serialize: two reloads must not interleave their registry writes.
    const previous = this.loading;
    const next = (async () => { await previous?.catch(() => undefined); return this.load(); })();
    this.loading = next;
    return next;
  }

  @Remote
  async list(): Promise<ProviderList> { await this.loading?.catch(() => undefined); return { directory: this.directory, entries: this.entries }; }

  private async load(): Promise<ProviderList> {
    await mkdir(this.directory, { recursive: true });
    const files = await readDefinitions(this.directory);
    const mine = new Set(this.adapter.definitions.keys());
    const others = new Set(this.llm.listProviders().map(provider => provider.id).filter(id => !mine.has(id)));
    const seen = new Set<string>();
    const accepted = new Map<string, ProviderDefinition>();
    const entries: ProviderEntry[] = files.map(({ file, result }) => {
      if (!result.ok) return { file, status: 'invalid', issues: result.issues };
      const { definition } = result;
      if (others.has(definition.id)) return { file, status: 'conflict', definition, detail: 'route' };
      if (seen.has(definition.id)) return { file, status: 'conflict', definition, detail: 'duplicate' };
      seen.add(definition.id);
      accepted.set(definition.id, definition);
      return { file, status: 'registered', definition };
    });
    const routes = [...accepted.keys()];
    // Publish definitions before routes appear so the first request finds them; keep old ones until the swap succeeds.
    const before = this.adapter.definitions;
    this.adapter.definitions = new Map([...before, ...accepted]);
    try {
      if (this.registration) this.registration.replace(routes);
      else if (routes.length) this.registration = this.llm.registerAdapter(routes, this.adapter);
    } catch (error) {
      this.adapter.definitions = before;
      throw error;
    }
    this.adapter.definitions = accepted;
    this.entries = entries;
    return { directory: this.directory, entries };
  }
}
