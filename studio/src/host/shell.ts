import { BUILTIN_TOOL_PRESETS, OPTIMIZED_PRESET_ID } from '../optimized-preset.ts';
import type { Context } from '@deepseek-ai/cordis';
import { createConfigProjector, isNativeConfigSchema, LOADER_EXPRESSION_SCHEMA } from '@deepseek-ai/dsh-app-boot';
import type { PluginCatalogEntry } from '../plugin-catalog.ts';
import { configEntries } from '../config-overrides.ts';
import { masterComposition } from './master-composition.ts';
import { MasterExtensions, validateExtensions } from './master-extensions.ts';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { CompositionRow } from '../prompt-composition.ts';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { readPresetCatalog, type PresetCatalog, type CatalogServices } from '../preset-catalog.ts';

import { assemblePreview, parseComposition, promptProviders } from './prompt-preview.ts';
import type { PreviewRequest } from '../prompt-composition.ts';
import { executionCapabilities } from '../execution-capabilities.ts';
import { PresetStore, studioStorePath } from './preset-store.ts';
import { MASTER_PRESET_ID, MASTER_PRESET_NAME } from '../master-preset.ts';
import { StudioUpdater } from './studio-update.ts';
import { PixieService } from './pixie-service.ts';
import { CatalogBaseline } from './catalog-baseline.ts';
import { catalogSnapshot, compareCatalog, type CatalogChange, type CatalogSnapshot } from '../master-snapshot.ts';


const flatRows = (rows: CompositionRow[]): CompositionRow[] => rows.flatMap(row => row.disabled === true ? [] : row.group && Array.isArray(row.config) ? flatRows(row.config as CompositionRow[]) : [row]);
const flatNames = (rows: CompositionRow[]) => flatRows(rows).map(row => row.name);
/**
 * Whether a declared row is off on this Host. Literal flags are read as-is; of `!!js` gates only the
 * `process.platform === / !== '<os>'` form DSH presets use is evaluated. Anything else counts as
 * off, so Studio never offers a row whose enablement it cannot decide.
 */
export function disabledHere(row: CompositionRow, platform: string = process.platform): boolean {
  const value = row.disabled;
  if (value === undefined || value === false) return false;
  const expression = value && typeof value === 'object' ? (value as { __jsExpr?: unknown }).__jsExpr : undefined;
  const match = typeof expression === 'string' ? /^process\.platform\s*(===|!==)\s*'([a-z0-9]+)'$/.exec(expression.trim()) : null;
  if (!match) return true;
  return match[1] === '===' ? platform === match[2] : platform !== match[2];
}

/**
 * The Loader rows that adding `name` puts into the Studio Master: its enclosing DSH preset group
 * (isolation and siblings) when it has one, otherwise the row alone. Gated or already present rows
 * are skipped, ids stay unique among `existing`, and non-JSON config is dropped.
 */
export function masterAddition(name: string, source: { row: CompositionRow; group?: CompositionRow } | undefined, existing: readonly CompositionRow[], present: ReadonlySet<string>): CompositionRow | undefined {
  const taken = new Set(existing.map(row => row.id));
  const unique = (raw: string) => {
    const base = raw.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^[^a-z]+/, '').slice(0, 56) || 'plugin';
    let id = base; for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    taken.add(id); return id;
  };
  const literal = (row: CompositionRow): CompositionRow | undefined => {
    if (disabledHere(row)) return undefined;
    if (row.group) {
      const children = (Array.isArray(row.config) ? row.config as CompositionRow[] : []).map(literal).filter(child => child !== undefined && !present.has(child.name)) as CompositionRow[];
      if (!children.some(child => child.name === name || flatNames([child]).includes(name))) return undefined;
      return { id: unique(String(row.id ?? 'group')), name: 'cordis:group', group: true, ...(row.isolate ? { isolate: row.isolate } : {}), config: children };
    }
    const next: CompositionRow = { id: unique(String(row.id ?? row.name.split('/').pop())), name: row.name };
    if (row.config !== undefined) { try { next.config = validateExtensions([{ id: 'probe', name: row.name, config: row.config }])[0]!.config; } catch { /* expressions: start without config */ } }
    return next;
  };
  return source?.group ? literal(source.group) : literal(source?.row ?? { id: name.split('/').pop() ?? 'plugin', name });
}

/** Catalog reads and temporary composition previews; no Agents or model calls. */
export default class StudioCatalog extends TypertRemoteService {
  static inject = ['agentPresets', 'systemPrompt', 'tools', 'loader'];
  private store: PresetStore;
  private snapshot: Promise<PresetCatalog>;
  private disposeMaster?: () => Promise<void>;
  private stopped = false;
  private extensions: MasterExtensions;
  private changes: Promise<unknown> = Promise.resolve();
  private updater = new StudioUpdater(this.ctx);
  private baseline: CatalogBaseline;
  /** The newest complete collection and what it changes against the confirmed baseline. */
  private pending: { snapshot: CatalogSnapshot; change?: CatalogChange; error?: string } | undefined;
  constructor(ctx: Context) {
    super(ctx, 'studioCatalog');
    // Shell environment variables are not the Desktop Host's launch environment.
    const storePath = studioStorePath(process.env, ctx.get('profileContext'));
    this.extensions = new MasterExtensions(join(dirname(storePath), 'master-extensions.json'));
    this.baseline = new CatalogBaseline(join(dirname(storePath), 'catalog-snapshot.json'));
    this.store = new PresetStore(ctx, storePath);
    // Pixie is optional: it starts only where llm, sessionController, and commands exist.
    ctx.plugin(PixieService, dirname(storePath));
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
  async listPresets() { const catalog = await this.snapshot; return [{ id: MASTER_PRESET_ID, name: MASTER_PRESET_NAME, description: 'Studio Master · read-only', readOnly: true, status: 'applied' as const, agents: [], request: { preset: MASTER_PRESET_ID, providers: [], tools: catalog.tools.map(tool => tool.name), prompt: '', model: 'testLLM' } }, ...(await this.store.list()).sort((a, b) => Number(b.id === OPTIMIZED_PRESET_ID) - Number(a.id === OPTIMIZED_PRESET_ID))]; }
  @Remote
  async savePreset(payload: string) { return this.store.save(payload); }
  @Remote
  async applyPreset(id: string) { await this.snapshot; return this.store.apply(id); }
  @Remote
  async unapplyPreset(id: string) { return this.store.unapply(id); }
  @Remote
  async roleModels() {
    const service = this.ctx.get('sessionController');
    if (!service) throw new Error('Model catalog API unavailable');
    return service.modelCatalog();
  }
  @Remote
  async updateStatus(force: string) { return this.updater.status(force === 'force'); }
  @Remote
  async updateStudio(version: string) { return this.updater.update(version); }
  @Remote
  async deletePreset(id: string) { return this.store.delete(id); }
  @Remote
  async read() { return structuredClone(await this.snapshot); }
  @Remote
  async readExtensions() { await this.snapshot; return this.extensions.read(); }
  @Remote
  async saveExtensions(payload: string) { return this.replaceExtensions(validateExtensions(JSON.parse(payload))); }
  /**
   * Add one installed plugin to the Studio Master. A plugin a DSH preset declares inside a group
   * comes with that whole group (its isolation and sibling providers): a row lifted out alone would
   * wait forever for services only its group supplies (e.g. terminal-bash without the pty group).
   * Rows disabled for this platform stay out. Config is copied only when it is plain JSON.
   */
  @Remote
  async addMasterPlugin(payload: string) {
    const name = payload;
    const rows = await this.extensions.read();
    const present = new Set([...this.masterNames(), ...flatNames(rows)]);
    if (present.has(name)) throw new Error(`Already in the Studio Master: ${name}`);
    const source = (await this.candidateRows()).get(name);
    const added = masterAddition(name, source, rows, present);
    if (!added) throw new Error(`Nothing to add for ${name} on this platform`);
    return this.replaceExtensions(validateExtensions([...rows, added]));
  }
  @Remote
  async removeMasterPlugin(id: string) {
    const rows = await this.extensions.read();
    if (!rows.some(row => row.id === id)) throw new Error(`Not added by Studio: ${id}`);
    return this.replaceExtensions(rows.filter(row => row.id !== id));
  }
  private masterNames() { return new Set(flatNames(masterComposition())); }
  /**
   * Plugins declared by the DSH presets Studio reads, keyed by package name, with the top-level
   * group that encloses each (if any). Rows disabled by a literal flag or a `!!js` gate are left
   * out: Studio does not evaluate expressions, so a platform-gated row is not offered.
   */
  private async candidateRows() {
    const found = new Map<string, { row: CompositionRow; group?: CompositionRow; presets: string[] }>();
    const registry = this.ctx.agentPresets;
    for (const preset of await registry.list()) {
      if (!BUILTIN_TOOL_PRESETS.includes(preset.id as typeof BUILTIN_TOOL_PRESETS[number])) continue;
      let rows: CompositionRow[];
      try { rows = parseComposition((await registry.readDocument(preset.id)).content); } catch { continue; }
      const visit = (items: CompositionRow[], group?: CompositionRow) => {
        for (const row of items) {
          if (disabledHere(row)) continue;
          if (row.group && Array.isArray(row.config)) { visit(row.config as CompositionRow[], group ?? row); continue; }
          const known = found.get(row.name);
          if (!known) found.set(row.name, { row, ...(group ? { group } : {}), presets: [preset.id] });
          else if (!known.presets.includes(preset.id)) known.presets.push(preset.id);
        }
      };
      visit(rows);
    }
    return found;
  }
  private async replaceExtensions(rows: CompositionRow[]) {
    const operation = this.changes.catch(() => {}).then(async () => {
      await this.snapshot;
      const previous = await this.extensions.read();
      // Probe activation before retiring the working master. Module loading executes code.
      const probe = `studio-probe-${randomUUID()}`;
      const dispose = await this.ctx.agentPresets.register({ id: probe, plugins: this.composition(rows) as never });
      try {
        const resolved = await this.ctx.agentPresets.resolve(probe);
        if (resolved.broken) throw new Error(resolved.broken);
      } finally { await dispose(); }
      const update = (async () => {
        await this.disposeMaster?.();
        try {
          const catalog = await this.capture(rows);
          await this.extensions.save(rows);
          return catalog;
        } catch (error) {
          await this.disposeMaster?.();
          const restored = await this.capture(previous);
          this.snapshot = Promise.resolve(restored);
          throw error;
        }
      })();
      this.snapshot = update;
      try { return await update; } catch (error) { throw error; }
    });
    this.changes = operation;
    return operation;
  }
  private composition(rows: CompositionRow[]) {
    return [...masterComposition(), ...(rows.length ? [{ id: 'studio-added', name: 'cordis:group', group: true, config: rows }] : [])];
  }
  private async capture(extra?: CompositionRow[]) {
    const project = await createConfigProjector();
    await this.ctx.loader.await();
    const composition = this.composition(extra ?? await this.extensions.read());
    const plugins: PluginCatalogEntry[] = [];
    for (const { id, row } of configEntries(composition)) {
      // User extension configs may contain credentials; do not echo them in the catalog.
      const item: PluginCatalogEntry = { id, name: row.name, ...(id.startsWith('studio-added/') ? {} : { config: structuredClone(row.config ?? {}) }) };
      try {
        const module = this.ctx.loader.unwrapExports(await this.ctx.loader.import(row.name));
        if (module?.Config) {
          if (!isNativeConfigSchema(module.Config)) throw new Error('Unsupported Config schema');
          const result = project(module.Config, 'config');
          item.schema = JSON.parse(JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', ...result.schema, $defs: { ...result.definitions, loaderExpression: LOADER_EXPRESSION_SCHEMA } }));
        }
      } catch (error) { item.error = String(error); }
      plugins.push(item);
    }
    if (this.stopped) throw new Error('Studio stopped during catalog initialization');
    // Explicit compatible baseline, not an indiscriminate union of installed plugins.
    this.disposeMaster = await this.ctx.agentPresets.register({ id: MASTER_PRESET_ID, name: MASTER_PRESET_NAME, description: 'Studio-managed read-only explicit composition', plugins: composition as never });
    const master = await this.ctx.agentPresets.resolve(MASTER_PRESET_ID);
    if (master.broken) throw new Error(`Studio Master: ${master.broken}`);
    const registry = this.ctx.get('agentPresets') as unknown as CatalogServices['agentPresets'];
    const catalog = await readPresetCatalog({
      agentPresets: { list: async () => [{ id: MASTER_PRESET_ID, name: MASTER_PRESET_NAME }, ...(await registry.list()).filter(p => BUILTIN_TOOL_PRESETS.includes(p.id as typeof BUILTIN_TOOL_PRESETS[number]))], readDocument: id => registry.readDocument(id), acquireScope: id => registry.acquireScope(id) },
      systemPrompt: this.ctx.get('systemPrompt') as unknown as CatalogServices['systemPrompt'],
      tools: this.ctx.get('tools') as unknown as CatalogServices['tools'],
    });
    if (catalog.presets[0]?.error) throw new Error(catalog.presets[0].error);
    for (const preset of catalog.presets) {
      if (preset.declaration) preset.promptProviders = promptProviders(parseComposition(preset.declaration));
    }
    const baseline = catalog.presets.find(p => p.id === MASTER_PRESET_ID)!;
    await this.store.ensureOptimized(baseline.tools.map(t => t.name), composition);
    catalog.plugins = plugins;
    catalog.execution = executionCapabilities(catalog.tools);
    const present = new Set(flatNames(composition));
    catalog.candidates = [...(await this.candidateRows()).entries()].filter(([name]) => !present.has(name))
      .map(([name, value]) => ({ name, presets: value.presets, ...(value.group ? { with: flatNames([value.group]).filter(other => other !== name && !present.has(other)) } : {}) }));
    catalog.added = (extra ?? await this.extensions.read()).map(row => ({ id: `studio-added/${row.id}`, name: row.name }));
    await this.observe(catalog.tools, plugins, composition);
    return catalog;
  }
  /**
   * Compare a complete collection with the confirmed baseline. The first good collection becomes
   * the baseline; later differences wait for the user, so a partial or failed collection never
   * deletes preset data or replaces the baseline.
   */
  private async observe(tools: PresetCatalog['tools'], plugins: PluginCatalogEntry[], composition: CompositionRow[]) {
    const snapshot = catalogSnapshot(tools, plugins, composition);
    if (!snapshot) { this.pending = undefined; return; }
    try {
      const previous = await this.baseline.read();
      if (!previous) { await this.baseline.save(snapshot); this.pending = undefined; return; }
      const change = compareCatalog(previous, snapshot, await this.store.cleanable());
      this.pending = change ? { snapshot, change } : undefined;
      if (!change && JSON.stringify(previous) !== JSON.stringify(snapshot)) await this.baseline.save(snapshot);
    } catch (error) { this.pending = { snapshot, error: String(error) }; }
  }
  @Remote
  async catalogChange() { await this.snapshot; return this.pending ? structuredClone(this.pending.change ?? { error: this.pending.error }) : null; }
  /** Apply the shown cleanup and adopt the collection as the new baseline. Idempotent. */
  @Remote
  async confirmCatalogChange() {
    await this.snapshot;
    const pending = this.pending;
    if (!pending?.change) return { cleaned: 0 };
    // Recompute against current saved presets: edits made since the notice are cleaned too.
    const cleaned = await this.store.cleanup(pending.change.removed.tools, pending.change.removed.configs);
    await this.baseline.save(pending.snapshot);
    if (this.pending === pending) this.pending = undefined;
    return { cleaned };
  }
  @Remote
  async preview(request: PreviewRequest) { await this.snapshot; return assemblePreview(this.ctx, request); }
}
