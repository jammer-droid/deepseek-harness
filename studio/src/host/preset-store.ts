import { OPTIMIZED_PRESET_ID, optimizedTemplate } from '../optimized-preset.ts';
import { applyConfigOverrides } from '../config-overrides.ts';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Context } from '@deepseek-ai/cordis';
import { dump } from 'js-yaml';
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include';
import { parsePreviewRequest, type PreviewRequest } from '../prompt-composition.ts';
import { compositionPlan, parseComposition } from './composition-plan.ts';
import { executableRoles, parseRoles } from '../role-settings.ts';
import type { CompositionRow } from '../prompt-composition.ts';

const genericDelegation = new Set(['subagent', 'subagent_fork', 'list_subagent_models']);
function withoutDelegation(rows: CompositionRow[]): CompositionRow[] {
  return rows.filter(row => row.name !== '@deepseek-ai/dsh-tool-subagent').map(row => row.group && Array.isArray(row.config)
    ? { ...row, config: withoutDelegation(row.config) } : row);
}

export interface StudioPreset {
  id: string; name: string; description: string; request: PreviewRequest;
  conveniences: unknown; agents: unknown; updatedAt: string; appliedAt?: string;
  status: 'draft' | 'applied' | 'modified'; applyWarning?: string;
}
interface StoredPreset extends StudioPreset { applied?: { name: string; description: string; plugins: string } }
const owned = (id: string) => id === OPTIMIZED_PRESET_ID || /^studio-user-[a-f0-9-]{36}$/.test(id);
const warning = 'Work convenience settings are saved but not applied yet. Legacy role overrides are stored only; roles apply only their supported settings.';

/** Profile-local Studio data, never a Loader patch or profile package mutation. */
export function studioStorePath(env: NodeJS.ProcessEnv = process.env, profile?: { readonly dir: string }): string {
  const directory = profile?.dir ?? env.DSH_PROFILE_DIR;
  if (!directory) throw new Error('Studio preset persistence requires a profile');
  return join(directory, 'studio-data', 'presets.json');
}

/** Serializes mutations; retains last applied composition separately from unsaved-to-DSH drafts. */
export class PresetStore {
  private rows: StoredPreset[] = [];
  private disposers = new Map<string, () => Promise<void>>();
  private ready?: Promise<void>;
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private ctx: Context, private file: string) {}
  initialize(): Promise<void> {
    return this.ready ??= (async () => {
      try {
        const value = JSON.parse(await readFile(this.file, 'utf8'));
        if (value.version !== 1 || !Array.isArray(value.presets)) throw new Error('Unsupported Studio preset store');
        this.rows = value.presets;
        for (const row of this.rows) {
          if (!owned(row.id)) throw new Error('Invalid Studio preset ownership');
          parsePreviewRequest(row.request);
        }
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      for (const row of this.rows) if (row.applied) {
        try { await this.mount(row.id, row.applied); }
        catch (error) { row.applyWarning = `Restore failed: ${String(error)}`; row.status = 'modified'; }
      }
    })();
  }
  private async mount(id: string, definition: NonNullable<StoredPreset['applied']>) {
    const dispose = await this.ctx.agentPresets.register({ id, name: definition.name, description: definition.description, plugins: parseComposition(definition.plugins) as never });
    try {
      const preset = await this.ctx.agentPresets.resolve(id);
      if (preset.broken) throw new Error(preset.broken);
      this.disposers.set(id, dispose);
    } catch (error) { await dispose(); throw error; }
  }
  private async persist(rows: StoredPreset[]) {
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
    const temp = `${this.file}.tmp`;
    await writeFile(temp, JSON.stringify({ version: 1, presets: rows }, null, 2), { mode: 0o600 });
    // Both paths are fixed siblings of the explicit profile-local store path.
    await rename(temp, this.file);
    this.rows = rows;
  }
  private serial<T>(action: () => Promise<T>): Promise<T> {
    const result = this.tail.then(async () => { await this.initialize(); return action(); });
    this.tail = result.catch(() => {});
    return result;
  }
  private public(row: StoredPreset): StudioPreset & { template?: boolean; nonDeletable?: boolean } { const { applied, ...value } = row; return structuredClone({ ...value, ...(row.id === OPTIMIZED_PRESET_ID ? { template: true, nonDeletable: true } : {}) }); }
  /** Seed once. Later startups retain user edits and explicit unapplied state. */
  ensureOptimized(tools: string[], plugins: CompositionRow[]) { return this.serial(async () => {
    const existing = this.rows.find(row => row.id === OPTIMIZED_PRESET_ID);
    if (existing) return this.public(existing);
    const template = optimizedTemplate(tools);
    const request = template.request;
    const applied = { name: template.name, description: template.description, plugins: dump([...applyConfigOverrides(plugins, request.configOverrides ?? {}), { id: 'studio-optimized-policy', name: '@local/dsh-studio-shell/policy', config: { tools: request.tools, toolOverrides: request.toolOverrides, sections: {}, prompt: request.prompt, execution: request.execution } }], { schema: entryListSchema, noRefs: true }) };
    const now = new Date().toISOString();
    const row: StoredPreset = { id: template.id, name: template.name, description: template.description, request: template.request, conveniences: {}, agents: [], updatedAt: now, appliedAt: now, status: 'applied', applied, ...(template.applyWarning ? { applyWarning: template.applyWarning } : {}) };
    await this.mount(row.id, applied);
    try { await this.persist([...this.rows, row]); }
    catch (error) { await this.disposers.get(row.id)?.(); this.disposers.delete(row.id); throw error; }
    return this.public(row);
  }); }
  list() { return this.serial(async () => this.rows.map(row => this.public(row))); }
  save(payload: string) { return this.serial(async () => {
    const value = JSON.parse(payload);
    if (!value || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 120 || typeof value.description !== 'string') throw new Error('Invalid preset name or description');
    const old = value.id ? this.find(value.id) : undefined;
    const row: StoredPreset = { ...old, id: old?.id ?? `studio-user-${randomUUID()}`, name: value.name.trim(), description: value.description,
      request: parsePreviewRequest(value.request), conveniences: value.conveniences ?? {}, agents: parseRoles(value.agents ?? old?.agents ?? []).map(role => {
        const prior = Array.isArray(old?.agents) ? old.agents.find(item => item.role === role.role || item.name === role.name) : undefined;
        return prior && 'overrides' in prior && !('overrides' in role) ? { ...role, overrides: prior.overrides } : role;
      }), updatedAt: new Date().toISOString(), status: old?.applied ? 'modified' : 'draft' };
    await this.persist([...this.rows.filter(item => item.id !== row.id), row]);
    return this.public(row);
  }); }
  private find(id: string) {
    if (!owned(id)) throw new Error('Only Studio-owned presets may be managed');
    const row = this.rows.find(row => row.id === id);
    if (!row) throw new Error('Studio preset not found');
    return row;
  }
  apply(id: string) { return this.serial(async () => {
    const old = this.find(id);
    const { request, plugins } = await compositionPlan(this.ctx, old.request);
    const roles = executableRoles(parseRoles(old.agents));
    const tools = roles.length ? [...request.tools.filter(name => !genericDelegation.has(name)), 'studio_role'] : request.tools;
    const keep = <T>(entries: Record<string, T>) => Object.fromEntries(Object.entries(entries).filter(([name]) => tools.includes(name)));
    const rolePlugins: CompositionRow[] = roles.length ? [{ id: 'studio-roles', name: '@local/dsh-studio-shell/roles', config: { roles } }] : [];
    const execution = request.execution && { ...request.execution, defaults: keep(request.execution.defaults),
      ...(request.execution.batch && !tools.includes(request.execution.batch.tool) ? { batch: undefined } : {}) };
    const applied = { name: old.name, description: old.description, plugins: dump([...(roles.length ? withoutDelegation(plugins) : plugins), ...rolePlugins, { id: 'studio-policy', name: '@local/dsh-studio-shell/policy', config: { tools: [...new Set(tools)], toolOverrides: keep(request.toolOverrides ?? {}), sections: request.sections ?? {}, prompt: request.prompt, ...(execution ? { execution } : {}) } }], { schema: entryListSchema, noRefs: true }) };
    await this.disposers.get(id)?.(); this.disposers.delete(id);
    try {
      await this.mount(id, applied);
      const hasLegacySettings = (old.conveniences != null && Object.keys(Object(old.conveniences)).length > 0)
        || (Array.isArray(old.agents) && old.agents.some(role => role && Object.hasOwn(role, 'overrides')));
      const row: StoredPreset = { ...old, applied, appliedAt: new Date().toISOString(), status: 'applied' };
      if (hasLegacySettings) row.applyWarning = warning;
      else delete row.applyWarning;
      await this.persist(this.rows.map(item => item.id === id ? row : item));
      return this.public(row);
    } catch (error) {
      await this.disposers.get(id)?.(); this.disposers.delete(id);
      if (old.applied) await this.mount(id, old.applied);
      throw error;
    }
  }); }
  unapply(id: string) { return this.serial(async () => {
    const old = this.find(id);
    await this.disposers.get(id)?.(); this.disposers.delete(id);
    const { applied, appliedAt, applyWarning, ...draft } = old;
    const row: StoredPreset = { ...draft, status: 'draft' };
    try { await this.persist(this.rows.map(item => item.id === id ? row : item)); }
    catch (error) { if (applied) await this.mount(id, applied); throw error; }
    return this.public(row);
  }); }
  delete(id: string) { return this.serial(async () => {
    if (id === OPTIMIZED_PRESET_ID) throw new Error('Optimized is a non-deletable built-in preset');
    const old = this.find(id);
    await this.disposers.get(id)?.(); this.disposers.delete(id);
    try { await this.persist(this.rows.filter(row => row.id !== id)); }
    catch (error) { if (old.applied) await this.mount(id, old.applied); throw error; }
    return { id };
  }); }
  async dispose() { await this.tail; for (const dispose of this.disposers.values()) await dispose(); this.disposers.clear(); }
}
