import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-agent-preset-registry';
import type {} from '@deepseek-ai/dsh-tools';
import { load } from 'js-yaml';
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include';
import { parsePreviewRequest, promptProviderModules, selectPromptProviders, type CompositionRow, type PreviewRequest } from '../prompt-composition.ts';

export function parseComposition(content: string): CompositionRow[] {
  const rows = load(content, { schema: entryListSchema });
  if (!Array.isArray(rows)) throw new Error('Preset declaration must be a plugin list');
  return rows as CompositionRow[];
}
function findProviders(rows: CompositionRow[]): CompositionRow[] {
  return rows.flatMap(row => row.disabled === true ? [] : row.group && Array.isArray(row.config)
    ? findProviders(row.config) : (promptProviderModules as readonly string[]).includes(row.name) ? [row] : []);
}
/** Server-owned declarations only; client input never supplies module names or executable YAML. */
export async function compositionPlan(ctx: Context, input: PreviewRequest) {
  const request = parsePreviewRequest(input);
  const minimal = parseComposition((await ctx.agentPresets.readDocument('minimal')).content);
  const available = new Map(findProviders(minimal).map(row => [row.name, row]));
  const presets = await ctx.agentPresets.list();
  for (const preset of presets) {
    if (preset.id.startsWith('studio-preview-')) continue;
    try {
      for (const row of findProviders(parseComposition((await ctx.agentPresets.readDocument(preset.id)).content))) {
        if (!available.has(row.name)) available.set(row.name, row);
      }
    } catch { /* Unavailable declarations are not selectable. */ }
  }
  const plugins = [...new Set(request.providers)].map((name, index) => {
    const row = available.get(name);
    if (!row) throw new Error(`Unavailable prompt provider: ${name}`);
    const config = { ...(row.config as Record<string, unknown> ?? {}) };
    const overrides = request.providerConfigs?.[name];
    if (overrides) {
      // Public settings explicitly supported by this editor; no arbitrary plugin internals.
      const allowed: Record<string, Record<string, string>> = {
        '@deepseek-ai/dsh-persona': { prefix: 'string', suffix: 'string', includeRuntimeContext: 'boolean' },
        '@deepseek-ai/dsh-agent-instructions': { maxBytes: 'number' },
      };
      for (const [key, value] of Object.entries(overrides)) {
        if (allowed[name]?.[key] !== typeof value || (typeof value === 'number' && (!Number.isSafeInteger(value) || value <= 0))) throw new Error(`Unsupported provider setting: ${name}.${key}`);
        config[key] = value;
      }
    }
    if (name === '@deepseek-ai/dsh-persona') {
      config.complete = false;
      if (request.persona !== undefined) config.prefix = request.persona;
    }
    return { ...row, id: `studio-provider-${index}`, config };
  });
  if (request.persona !== undefined && !request.providers.includes('@deepseek-ai/dsh-persona')) throw new Error('Select persona before editing its prefix');
  for (const name of Object.keys(request.providerConfigs ?? {})) if (!request.providers.includes(name)) throw new Error(`Unselected provider override: ${name}`);
  const globalNames = new Set(ctx.tools.schemas().map(tool => tool.name));
  const missing = request.tools.filter(name => !globalNames.has(name));
  if (missing.length) {
    // Keep provider closures and dependency realms together; never transplant live definitions
    // from a different preset scope. Prefer minimal, otherwise one compatible source composition.
    let source: CompositionRow[] | undefined;
    const candidates = ['minimal', ...presets.map(p => p.id).filter(id => id !== 'minimal' && !id.startsWith('studio-'))];
    for (const id of candidates) {
      let lease: Awaited<ReturnType<typeof ctx.agentPresets.acquireScope>> | undefined;
      try {
        lease = await ctx.agentPresets.acquireScope(id);
        const names = new Set(ctx.tools.schemas(lease.key).map(tool => tool.name));
        if (missing.every(name => names.has(name))) {
          source = id === 'minimal' ? minimal : parseComposition((await ctx.agentPresets.readDocument(id)).content);
          break;
        }
      } catch { /* Try another registered composition. */ }
      finally { await lease?.[Symbol.asyncDispose](); }
    }
    if (!source) throw new Error(`No compatible installed tool composition supplies: ${missing.join(', ')}. Tools from incompatible source scopes cannot be combined safely.`);
    plugins.push(...selectPromptProviders(source, []) as typeof plugins);
  }
  return { request, plugins };
}
