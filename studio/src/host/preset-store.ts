import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Context } from '@deepseek-ai/cordis';
import { dump } from 'js-yaml';
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include';
import { parsePreviewRequest, type PreviewRequest } from '../prompt-composition.ts';
import { compositionPlan, parseComposition } from './composition-plan.ts';

export interface StudioPreset {
  id: string; name: string; description: string; request: PreviewRequest;
  conveniences: unknown; agents: unknown; updatedAt: string; appliedAt?: string;
  status: 'draft' | 'applied' | 'modified'; applyWarning?: string;
}
interface StoredPreset extends StudioPreset { applied?: { name: string; description: string; plugins: string } }
const owned = (id: string) => /^studio-user-[a-f0-9-]{36}$/.test(id);
const warning = 'Only prompt and tool settings are applied. Work convenience and subagent settings are saved but not applied yet.';

/** Profile-local Studio data, never a Loader patch or profile package mutation. */
export function studioStorePath(env: NodeJS.ProcessEnv = process.env): string {
  if (!env.DSH_PROFILE_DIR) throw new Error('Studio preset persistence requires a profile (DSH_PROFILE_DIR)');
  return join(env.DSH_PROFILE_DIR, 'studio-data', 'presets.json');
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
  private public(row: StoredPreset): StudioPreset { const { applied, ...value } = row; return structuredClone(value); }
  list() { return this.serial(async () => this.rows.map(row => this.public(row))); }
  save(payload: string) { return this.serial(async () => {
    const value = JSON.parse(payload);
    if (!value || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 120 || typeof value.description !== 'string') throw new Error('Invalid preset name or description');
    const old = value.id ? this.find(value.id) : undefined;
    const row: StoredPreset = { ...old, id: old?.id ?? `studio-user-${randomUUID()}`, name: value.name.trim(), description: value.description,
      request: parsePreviewRequest(value.request), conveniences: value.conveniences ?? {}, agents: value.agents ?? [], updatedAt: new Date().toISOString(), status: old?.applied ? 'modified' : 'draft' };
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
    const applied = { name: old.name, description: old.description, plugins: dump([...plugins, { id: 'studio-policy', name: '@local/dsh-studio-shell/policy', config: { tools: request.tools, toolOverrides: request.toolOverrides ?? {}, sections: request.sections ?? {}, prompt: request.prompt, ...(request.execution ? { execution: request.execution } : {}) } }], { schema: entryListSchema, noRefs: true }) };
    await this.disposers.get(id)?.(); this.disposers.delete(id);
    try {
      await this.mount(id, applied);
      const row: StoredPreset = { ...old, applied, appliedAt: new Date().toISOString(), status: 'applied', applyWarning: warning };
      await this.persist(this.rows.map(item => item.id === id ? row : item));
      return this.public(row);
    } catch (error) {
      await this.disposers.get(id)?.(); this.disposers.delete(id);
      if (old.applied) await this.mount(id, old.applied);
      throw error;
    }
  }); }
  delete(id: string) { return this.serial(async () => {
    const old = this.find(id);
    await this.disposers.get(id)?.(); this.disposers.delete(id);
    try { await this.persist(this.rows.filter(row => row.id !== id)); }
    catch (error) { if (old.applied) await this.mount(id, old.applied); throw error; }
    return { id };
  }); }
  async dispose() { await this.tail; for (const dispose of this.disposers.values()) await dispose(); this.disposers.clear(); }
}
