import { OPTIMIZED_PRESET_ID } from '../optimized-preset.ts';
import type { Context } from '@deepseek-ai/cordis';
import { disabledHere } from './master-composition.ts';
import { MasterCatalog } from './master-catalog.ts';
export { disabledHere };
import { MasterExtensions, validateExtensions } from './master-extensions.ts';
import { dirname, join } from 'node:path';
import type { CompositionRow } from '../prompt-composition.ts';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';

import { assemblePreview } from './prompt-preview.ts';
import type { PreviewRequest } from '../prompt-composition.ts';
import { PresetStore, studioStorePath } from './preset-store.ts';
import { MASTER_PRESET_ID, MASTER_PRESET_NAME } from '../master-preset.ts';
import { StudioUpdater } from './studio-update.ts';
import { PixieService } from './pixie-service.ts';
import { SessionRoleService } from './session-role-service.ts';
import { installRoleChildPolicies } from './role-child-policy.ts';
import { installSkill } from './skill-install.ts';
import { pixieHookSkill, pixieLoopSkill } from './pixie-hook-skill.ts';
import { readInstalledPlugins } from './installed-plugins.ts';
import { masterRefusal } from '../installed-plugins.ts';
import { migrationPlan, type MigrationBackup } from '../extension-migration.ts';
import { fieldRoles } from '../secret-fields.ts';
import { readProfileConfigs, saveProfileConfig, schemaOf } from './profile-config.ts';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { CatalogBaseline } from './catalog-baseline.ts';


const flatRows = (rows: CompositionRow[]): CompositionRow[] => rows.flatMap(row => row.disabled === true ? [] : row.group && Array.isArray(row.config) ? flatRows(row.config as CompositionRow[]) : [row]);
const flatNames = (rows: CompositionRow[]) => flatRows(rows).map(row => row.name);

/** The row that adding package `name` puts into the Studio Master, with an id unique among `existing`. */
export function masterAddition(name: string, existing: readonly CompositionRow[]): CompositionRow {
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/.test(name)) throw new Error(`Invalid package name: ${name}`);
  const taken = new Set(existing.map(row => row.id));
  const base = (name.split('/').pop() ?? 'plugin').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^[^a-z]+/, '').slice(0, 56) || 'plugin';
  let id = base; for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return { id, name };
}

/** Catalog reads and temporary composition previews; no Agents or model calls. */
export default class StudioCatalog extends TypertRemoteService {
  static inject = ['agentPresets', 'systemPrompt', 'tools', 'loader'];
  private store: PresetStore;
  private master: MasterCatalog;
  private updater = new StudioUpdater(this.ctx);
  constructor(ctx: Context) {
    super(ctx, 'studioCatalog');
    // Shell environment variables are not the Desktop Host's launch environment.
    const storePath = studioStorePath(process.env, ctx.get('profileContext'));
    installRoleChildPolicies(ctx, join(dirname(storePath), 'child-policies'));
    const extensions = new MasterExtensions(join(dirname(storePath), 'master-extensions.json'));
    const baseline = new CatalogBaseline(join(dirname(storePath), 'catalog-snapshot.json'));
    this.master = new MasterCatalog(ctx, extensions, baseline);
    this.store = new PresetStore(ctx, storePath);
    // Pixie is optional: it starts only where llm, sessionController, and commands exist.
    ctx.plugin(PixieService, dirname(storePath));
    // Session roles start where sessionController exists; the role tool reads the same files.
    ctx.plugin(SessionRoleService, dirname(storePath));
    // Agents read user skills from <DSH home>/skills; a user-edited copy is never overwritten. Failure only warns.
    const home = (ctx.get('profileContext') as { home?: string } | undefined)?.home;
    if (home) for (const bundled of [pixieHookSkill, pixieLoopSkill]) void Promise.resolve().then(() => { const skill = bundled(); return installSkill(join(home, 'skills'), skill).then(results => {
      const kept = Object.entries(results).filter(([, result]) => result === 'kept-user-edit').map(([file]) => file);
      if (kept.length) ctx.logger?.info?.(`studio: kept user-edited ${skill.name}/${kept.join(', ')}`);
    }); }).catch(error => ctx.logger?.warn?.(`studio: skill install skipped: ${String(error)}`));
    // Do not return this task from a Cordis activation effect: Loader awaits us.
    this.master.start(this.store);
    ctx.effect(() => () => this.master.stop());
    ctx.effect(async () => {
      await this.store.initialize();
      return () => this.store.dispose();
    });
  }
  @Remote
  async listPresets() { const catalog = await this.master.ready(); return [{ id: MASTER_PRESET_ID, name: MASTER_PRESET_NAME, description: 'Studio Master · read-only', readOnly: true, status: 'applied' as const, agents: [], request: { preset: MASTER_PRESET_ID, providers: [], tools: catalog.tools.map(tool => tool.name), prompt: '', model: 'testLLM' } }, ...(await this.store.list()).sort((a, b) => Number(b.id === OPTIMIZED_PRESET_ID) - Number(a.id === OPTIMIZED_PRESET_ID))]; }
  @Remote
  async savePreset(payload: string) { return this.store.save(payload); }
  @Remote
  async applyPreset(id: string) { await this.master.ready(); return this.store.apply(id); }
  @Remote
  async unapplyPreset(id: string) { return this.store.unapply(id); }
  /** Replace Optimized with the shipped defaults and apply them. */
  @Remote
  async restoreOptimized() { await this.master.ready(); return this.store.restoreOptimized(); }
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
  async read() { return structuredClone(await this.master.ready()); }
  @Remote
  async readExtensions() { await this.master.ready(); return this.master.readExtensions(); }
  @Remote
  async saveExtensions(payload: string) {
    const rows = validateExtensions(JSON.parse(payload));
    // New profile-scoped rows are refused; ones already saved stay until migrated (D7).
    const current = new Set(flatNames(await this.master.readExtensions()));
    const added = flatNames(rows).filter(name => !current.has(name));
    if (added.length) {
      const { plugins } = await this.installed();
      for (const name of added) { const found = plugins.find(plugin => plugin.entry === name); const refusal = found && masterRefusal(found); if (refusal) throw new Error(refusal); }
    }
    return this.master.replaceExtensions(rows);
  }
  /**
   * Add one installed package to the Studio Master by name, without config (edit it as an override).
   * Activation is checked before the Master is replaced; a failure keeps the previous Master.
   */
  @Remote
  async addMasterPlugin(payload: string) {
    // A package name, or `{ name, config }` JSON with the initial config probed together (#38 S4).
    const parsed = payload.trim().startsWith('{') ? JSON.parse(payload) as { name?: unknown; config?: unknown } : { name: payload };
    const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
    const rows = await this.master.readExtensions();
    if (new Set([...this.master.masterNames(), ...flatNames(rows)]).has(name)) throw new Error(`Already in the Studio Master: ${name}`);
    const found = (await this.installed()).plugins.find(plugin => plugin.entry === name);
    const refusal = found && masterRefusal(found);
    if (refusal) throw new Error(refusal);
    const config = parsed.config && typeof parsed.config === 'object' && Object.keys(parsed.config).length ? { config: parsed.config } : {};
    return this.master.replaceExtensions(validateExtensions([...rows, { ...masterAddition(name, rows), ...config }]));
  }
  @Remote
  async removeMasterPlugin(id: string) {
    const rows = await this.master.readExtensions();
    if (!rows.some(row => row.id === id)) throw new Error(`Not added by Studio: ${id}`);
    return this.master.replaceExtensions(rows.filter(row => row.id !== id));
  }
  private async installed() {
    await this.master.ready();
    const rows = await this.master.readExtensions();
    return readInstalledPlugins(this.ctx, this.master.masterNames(), new Set(flatNames(rows)));
  }
  /** Installed plugin entry points with their run scope and evidence (#38). Read-only. */
  @Remote
  async listInstalledPlugins() { return this.installed(); }
  private async migration() {
    const [{ plugins }, extensions, presets] = await Promise.all([this.installed(), this.master.readExtensions(), this.store.migrationSources()]);
    const catalog = await this.master.ready();
    const roles = Object.fromEntries((catalog.plugins ?? []).map(entry => [entry.name, fieldRoles(entry.schema)]));
    return { plan: migrationPlan({ extensions, installed: plugins, presets, roles }), extensions, presets };
  }
  /** Profile-scoped rows still in the Studio Master, with masked settings and the presets that run them (#38 D7). */
  @Remote
  async extensionMigration() { return (await this.migration()).plan; }
  /**
   * Move one profile-scoped row out of the Studio Master after the user confirmed it. Raw config and
   * per-preset overrides are saved first to `studio-data/migrated-extensions.json` (0600); preset
   * overrides of the removed id are then cleared through the catalog change notice.
   */
  @Remote
  async migrateExtension(id: string) {
    const { plan, extensions, presets } = await this.migration();
    const item = plan.find(entry => entry.id === id);
    if (!item) throw new Error(`Not a profile-scoped Studio addition: ${id}`);
    const row = extensions.find(entry => entry.id === id)!;
    const configId = `studio-added/${id}`;
    const backup: MigrationBackup = { movedAt: new Date().toISOString(), row: structuredClone(row),
      overrides: presets.filter(preset => preset.overrides[configId]).map(preset => ({ preset: preset.id, config: structuredClone(preset.overrides[configId]!) })) };
    const file = join(dirname(studioStorePath(process.env, this.ctx.get('profileContext'))), 'migrated-extensions.json');
    let previous: MigrationBackup[] = [];
    try { previous = JSON.parse(await readFile(file, 'utf8')).moved ?? []; } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    // Fixed sibling of the profile-local Studio store.
    await writeFile(`${file}.tmp`, JSON.stringify({ version: 1, moved: [...previous, backup] }, null, 2), { mode: 0o600 });
    await rename(`${file}.tmp`, file);
    const catalog = await this.master.replaceExtensions(extensions.filter(entry => entry.id !== id));
    return { catalog, appliedIn: item.appliedIn };
  }
  /** Projected Config schema of one installed entry, for the initial settings before inclusion (#38 S4). */
  @Remote
  async installedPluginSchema(id: string) {
    if (!(await this.installed()).plugins.some(plugin => plugin.entry === id)) throw new Error(`Not an installed plugin entry: ${id}`);
    const { schema, schemaError } = await schemaOf(this.ctx, id);
    return { ...(schema ? { schema } : {}), ...(schemaError ? { error: schemaError } : {}) };
  }
  /** Profile rows (installed profile plugins and their services) with masked secrets (#38 S5). */
  @Remote
  async listProfileConfigs() { return readProfileConfigs(this.ctx, (await this.installed()).plugins); }
  /** Save one profile row: `{ patchId, diff, secrets }` as JSON. Applies to every session. */
  @Remote
  async saveProfileConfig(payload: string) {
    await saveProfileConfig(this.ctx, (await this.installed()).plugins, JSON.parse(payload));
    return readProfileConfigs(this.ctx, (await this.installed()).plugins);
  }
  @Remote
  async catalogChange() { return this.master.catalogChange(); }
  @Remote
  async confirmCatalogChange() { return this.master.confirmCatalogChange(); }
  @Remote
  async preview(request: PreviewRequest) { await this.master.ready(); return assemblePreview(this.ctx, request); }
}
