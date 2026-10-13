import type { Context } from '@deepseek-ai/cordis';
import { createConfigProjector, isNativeConfigSchema, LOADER_EXPRESSION_SCHEMA } from '@deepseek-ai/dsh-app-boot';
import { readPluginCatalog, type PluginCatalogLoader } from '../plugin-catalog.ts';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { readPresetCatalog, type PresetCatalog, type CatalogServices } from '../preset-catalog.ts';

import { assemblePreview, parseComposition, promptProviders } from './prompt-preview.ts';
import type { PreviewRequest } from '../prompt-composition.ts';
import { executionCapabilities } from '../execution-capabilities.ts';
import { PresetStore, studioStorePath } from './preset-store.ts';
import { MASTER_PRESET_ID, MASTER_PRESET_NAME } from '../master-preset.ts';


/** Catalog reads and temporary composition previews; no Agents or model calls. */
export default class StudioCatalog extends TypertRemoteService {
  static inject = ['agentPresets', 'systemPrompt', 'tools', 'loader'];
  private store: PresetStore;
  private snapshot: Promise<PresetCatalog>;
  private disposeMaster?: () => Promise<void>;
  private stopped = false;
  constructor(ctx: Context) {
    super(ctx, 'studioCatalog');
    this.store = new PresetStore(ctx, studioStorePath());
    // Do not return this task from a Cordis activation effect: Loader awaits us.
    this.snapshot = new Promise<void>(resolve => { setImmediate(resolve); }).then(() => this.capture());
    // Keep failure observable to RPC callers without an unhandled rejection.
    void this.snapshot.catch(() => undefined);
    ctx.effect(() => async () => { this.stopped = true; await this.snapshot.catch(() => {}); await this.disposeMaster?.(); });
    ctx.effect(async () => {
      await this.store.initialize();
      return () => this.store.dispose();
    });
  }
  @Remote
  async listPresets() { const catalog = await this.snapshot; return [{ id: MASTER_PRESET_ID, name: MASTER_PRESET_NAME, description: 'Studio 관리 · 읽기 전용 · standard 기반 원본', readOnly: true, status: 'applied' as const, agents: [], request: { preset: MASTER_PRESET_ID, providers: [], tools: catalog.tools.map(tool => tool.name), prompt: '', model: 'testLLM' } }, ...await this.store.list()]; }
  @Remote
  async savePreset(payload: string) { return this.store.save(payload); }
  @Remote
  async applyPreset(id: string) { await this.snapshot; return this.store.apply(id); }
  @Remote
  async deletePreset(id: string) { return this.store.delete(id); }
  @Remote
  async read() { return structuredClone(await this.snapshot); }
  private async capture() {
    const project = await createConfigProjector();
    const plugins = await readPluginCatalog(this.ctx.get('loader') as unknown as PluginCatalogLoader, async schema => {
      if (!isNativeConfigSchema(schema)) throw new Error('Unsupported Config schema');
      const result = project(schema, 'config');
      return JSON.parse(JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', ...result.schema, $defs: { ...result.definitions, loaderExpression: LOADER_EXPRESSION_SCHEMA } }));
    });
    if (this.stopped) throw new Error('Studio stopped during catalog initialization');
    // Explicit compatible baseline, not an indiscriminate union of installed plugins.
    const source = await this.ctx.agentPresets.readDocument('standard');
    this.disposeMaster = await this.ctx.agentPresets.register({ id: MASTER_PRESET_ID, name: MASTER_PRESET_NAME, description: 'Studio-managed read-only source composition (standard baseline)', plugins: parseComposition(source.content) as never });
    const master = await this.ctx.agentPresets.resolve(MASTER_PRESET_ID);
    if (master.broken) throw new Error(`Studio Master: ${master.broken}`);
    const registry = this.ctx.get('agentPresets') as unknown as CatalogServices['agentPresets'];
    const catalog = await readPresetCatalog({
      agentPresets: { list: async () => [{ id: MASTER_PRESET_ID, name: MASTER_PRESET_NAME }], readDocument: id => registry.readDocument(id), acquireScope: id => registry.acquireScope(id) },
      systemPrompt: this.ctx.get('systemPrompt') as unknown as CatalogServices['systemPrompt'],
      tools: this.ctx.get('tools') as unknown as CatalogServices['tools'],
    });
    if (catalog.presets[0]?.error) throw new Error(catalog.presets[0].error);
    for (const preset of catalog.presets) {
      if (preset.declaration) preset.promptProviders = promptProviders(parseComposition(preset.declaration));
    }
    catalog.plugins = plugins;
    catalog.execution = executionCapabilities(catalog.tools);
    return catalog;
  }
  @Remote
  async preview(request: PreviewRequest) { await this.snapshot; return assemblePreview(this.ctx, request); }
}
