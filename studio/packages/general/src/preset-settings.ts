/** Structured edits preserve expressions and unknown configuration on the Host. */
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-config-editor';
import type {} from '@deepseek-ai/dsh-agent-preset-registry';
import type { PresetChange, PresetField, PresetPlugin, PresetSettings } from './preset-types.ts';

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function revision(config: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(config)).digest('hex');
}
function fields(value: unknown, path: string[] = []): PresetField[] {
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return [{ path, value }];
  if (!object(value) || '__jsExpr' in value) return [];
  return Object.entries(value).flatMap(([key, child]) => fields(child, [...path, key]));
}
function plugins(rows: unknown, parent: number[] = []): PresetPlugin[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row: unknown, index) => {
    if (!object(row)) return [];
    const path = [...parent, index];
    const current: PresetPlugin = {
      path, name: String(row.name ?? row.id ?? index),
      disabled: row.disabled === undefined ? false : typeof row.disabled === 'boolean' ? row.disabled : null,
      fields: row.group ? [] : fields(row.config),
    };
    return [current, ...(row.group ? plugins(row.config, path) : [])];
  });
}
function childAt(rows: unknown, path: number[]): Record<string, unknown> {
  let row: unknown;
  for (const index of path) {
    if (!Array.isArray(rows)) throw new Error('invalid-plugin-path');
    row = rows[index];
    if (!object(row)) throw new Error('invalid-plugin-path');
    rows = row.config;
  }
  if (!object(row)) throw new Error('invalid-plugin-path');
  return row;
}
/** Builtin leaf templates require their ordinary Host services; activation remains registry-owned. */
const builtinComponents = [
  '@deepseek-ai/dsh-persona', '@deepseek-ai/dsh-tool-fs', '@deepseek-ai/dsh-tool-fs-search',
  '@deepseek-ai/dsh-tool-bash', '@deepseek-ai/dsh-tool-todo', '@deepseek-ai/dsh-tool-ask-user',
];
function component(row: Record<string, unknown>, source: string) {
  return { key: revision(row), name: String(row.name ?? row.id), source, plugins: plugins([row]), row };
}
/** User-only editor: toggles may change the tools and policies of future Agents. */
export class PresetSettingsOwner {
  constructor(private readonly ctx: Context) {}
  private catalog() {
    const editor = this.ctx.get('configEditor');
    if (!editor) throw new Error('config-editor-unavailable');
    const candidates = builtinComponents.map(name => component(name === '@deepseek-ai/dsh-persona' ? { name, config: { prefix: '', suffix: '', complete: false, includeRuntimeContext: true } } : { name }, 'DSH'));
    for (const { entry, inherited } of editor.configuration()) {
      if (entry.options.name !== '@deepseek-ai/dsh-agent-preset') continue;
      for (const config of [inherited, entry.options.config]) {
        if (!object(config) || !Array.isArray(config.plugins)) continue;
        for (const row of config.plugins) {
          if (object(row)) candidates.push(component(row, String(config.name ?? config.id)));
        }
      }
    }
    return [...new Map(candidates.map(item => [item.key, item])).values()];
  }
  /** @returns Editable profile-owned preset declarations, or an unavailable error. */
  async describe(): Promise<PresetSettings[]> {
    const editor = this.ctx.get('configEditor');
    if (!editor) throw new Error('config-editor-unavailable');
    const roster = await this.ctx.get('agentPresets')?.list();
    return editor.configuration().filter(({ entry }) => entry.options.name === '@deepseek-ai/dsh-agent-preset').map(({ entry, override }) => {
      const config = entry.options.config as Record<string, unknown>;
      const preset = roster?.find(preset => preset.id === config.id);
      return {
        availability: preset ? preset.broken ? 'broken' : 'available' : 'unknown',
        entryId: entry.options.id, id: String(config.id), name: String(config.name ?? config.id),
        revision: revision(config), overridden: Object.keys(override).length > 0,
        plugins: plugins(config.plugins),
        components: this.catalog().map(({ key, name, source, plugins }) => ({ key, name, source, plugins })),
      };
    });
  }
  /** Validate against the locked current declaration and persist through configEditor.
   * @param request Observed revision and complete structured edit, or reset request.
   * @returns Fresh saved snapshots; registry activation is reported separately.
   */
  async apply(request: PresetChange): Promise<PresetSettings[]> {
    const editor = this.ctx.get('configEditor');
    if (!editor) throw new Error('config-editor-unavailable');
    const entry = editor.entries().find(entry => entry.options.id === request.entryId && entry.options.name === '@deepseek-ai/dsh-agent-preset');
    if (!entry) throw new Error('preset-unavailable');
    await editor.edit(entry, (current, inherited) => {
      if (revision(current) !== request.revision) throw new Error('revision-conflict');
      if (request.reset) return inherited;
      const expected = plugins(current.plugins);
      if (request.plugins.length !== expected.length) throw new Error('invalid-plugin-list');
      for (let index = 0; index < expected.length; index++) {
        const before = expected[index]!;
        const change = request.plugins[index]!;
        if (!isDeepStrictEqual(before.path, change.path) || before.name !== change.name || before.fields.length !== change.fields.length) throw new Error('invalid-plugin-list');
        const row = childAt(current.plugins, before.path);
        if (before.disabled === null ? change.disabled !== null : typeof change.disabled !== 'boolean') throw new Error('invalid-plugin-enablement');
        if (change.disabled !== before.disabled) row.disabled = change.disabled;
        for (let fieldIndex = 0; fieldIndex < before.fields.length; fieldIndex++) {
          const original = before.fields[fieldIndex]!;
          const field = change.fields[fieldIndex]!;
          if (!isDeepStrictEqual(original.path, field.path) || typeof original.value !== typeof field.value || (typeof field.value === 'number' && !Number.isFinite(field.value))) throw new Error('invalid-field');
          if (original.value === field.value) continue;
          if (!field.path.length) { row.config = field.value; continue; }
          let target = row.config;
          for (const key of field.path.slice(0, -1)) {
            if (!object(target) || !Object.hasOwn(target, key)) throw new Error('invalid-field');
            target = target[key];
          }
          const key = field.path.at(-1)!;
          if (!object(target) || !Object.hasOwn(target, key)) throw new Error('invalid-field');
          Object.defineProperty(target, key, { value: field.value, enumerable: true, configurable: true, writable: true });
        }
      }
      const removals = request.remove ?? [];
      const removed = new Set<string>();
      for (const path of removals) {
        if (!expected.some(row => isDeepStrictEqual(row.path, path)) || removed.has(JSON.stringify(path))) throw new Error('invalid-plugin-removal');
        removed.add(JSON.stringify(path));
      }
      const prune = (rows: unknown, parent: number[] = []): unknown => {
        if (!Array.isArray(rows)) return rows;
        return rows.flatMap((row, index) => {
          const path = [...parent, index];
          if (removed.has(JSON.stringify(path))) return [];
          if (object(row) && row.group) row.config = prune(row.config, path);
          return [row];
        });
      };
      current.plugins = prune(current.plugins);
      const additions = request.add ?? [];
      const catalog = this.catalog();
      for (const key of additions) {
        const template = catalog.find(item => item.key === key);
        if (!template) throw new Error('component-unavailable');
        if (!Array.isArray(current.plugins)) throw new Error('invalid-plugin-list');
        const row = structuredClone(template.row);
        // Loader generates fresh entry identities; group-local metadata remains intact.
        const clearIds = (entry: Record<string, unknown>) => {
          delete entry.id;
          if (entry.group && Array.isArray(entry.config)) for (const child of entry.config) if (object(child)) clearIds(child);
        };
        clearIds(row);
        if (current.plugins.some(existing => object(existing) && existing.name === row.name && row.name !== 'cordis:group')) throw new Error('duplicate-component');
        current.plugins.push(row);
      }
      return current;
    });
    return this.describe();
  }
}
