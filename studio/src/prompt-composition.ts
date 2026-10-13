export const promptProviderModules = [
  '@deepseek-ai/dsh-persona',
  '@deepseek-ai/dsh-agent-instructions',
  '@deepseek-ai/dsh-time-context',
] as const;
export interface PromptProvider { name: string; description: string }
export interface PreviewRequest { preset: string; providers: string[]; tools: string[]; prompt: string; model: string }
/** Runtime schema used by the public Remote input codec. */
export function parsePreviewRequest(value: unknown): PreviewRequest {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid preview request');
  const row = value as Record<string, unknown>;
  const strings = (input: unknown): input is string[] => Array.isArray(input) && input.every(item => typeof item === 'string');
  if (typeof row.preset !== 'string' || !strings(row.providers) || !strings(row.tools) || typeof row.prompt !== 'string' || typeof row.model !== 'string') throw new Error('Invalid preview request');
  return { preset: row.preset, providers: [...row.providers], tools: [...row.tools], prompt: row.prompt, model: row.model };
}
export interface PreviewResult { prompt: string; sections: { name: string; text: string }[]; context: string; tools: { name: string; description: string; parameters: Record<string, unknown> }[] }
export type PreviewAction = (request: PreviewRequest) => Promise<PreviewResult>;
export interface CompositionRow { id?: string; name: string; group?: boolean; config?: unknown; disabled?: unknown; [key: string]: unknown }
/** Curated semantic classification; do not guess prompt providers from package substrings. */
export function promptProviders(rows: CompositionRow[]): PromptProvider[] {
  const found: PromptProvider[] = [];
  for (const row of rows) {
    if (row.disabled === true) continue;
    if (row.group && Array.isArray(row.config)) found.push(...promptProviders(row.config));
    else if ((promptProviderModules as readonly string[]).includes(row.name)) found.push({ name: row.name, description: JSON.stringify(row.config ?? {}, null, 2) });
  }
  return [...new Map(found.map(item => [item.name, item])).values()];
}
/** Keep dependency groups intact, remove only the explicitly managed prompt providers. */
export function selectPromptProviders(rows: CompositionRow[], selected: string[]): CompositionRow[] {
  const available = new Set(promptProviders(rows).map(item => item.name));
  if (selected.some(name => !available.has(name))) throw new Error('Unknown prompt provider selection');
  const visit = (entries: CompositionRow[]): CompositionRow[] => entries.flatMap(row => {
    if ((promptProviderModules as readonly string[]).includes(row.name) && !selected.includes(row.name)) return [];
    return [{ ...row, ...(row.group && Array.isArray(row.config) ? { config: visit(row.config) } : {}) }];
  });
  return visit(rows);
}
