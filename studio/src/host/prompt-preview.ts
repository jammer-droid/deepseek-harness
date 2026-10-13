import type { Context } from '@deepseek-ai/cordis';
import { createScope } from '@deepseek-ai/dsh-scope';
import { renderPrompt, renderContextSnapshot } from '@deepseek-ai/dsh-system-prompt';
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include';
import { load } from 'js-yaml';
import { randomUUID } from 'node:crypto';
import { promptProviders, selectPromptProviders, type CompositionRow, type PreviewRequest, type PreviewResult } from '../prompt-composition.ts';
import type {} from '@deepseek-ai/dsh-agent-preset-registry';
import type {} from '@deepseek-ai/dsh-tools';

export function parseComposition(content: string): CompositionRow[] {
  const rows = load(content, { schema: entryListSchema });
  if (!Array.isArray(rows)) throw new Error('Preset declaration must be a plugin list');
  return rows as CompositionRow[];
}
export { promptProviders };
/** Only reads shipped preset declarations; never accepts client-supplied plugin code/config. */
export async function assemblePreview(ctx: Context, request: PreviewRequest): Promise<PreviewResult> {
  if (!['standard', 'ptc', 'minimal', 'cordis'].includes(request.preset)) throw new Error('Unsupported source preset');
  if (!Array.isArray(request.providers) || !Array.isArray(request.tools) || request.tools.some(name => typeof name !== 'string') || typeof request.prompt !== 'string' || typeof request.model !== 'string') throw new Error('Invalid preview request');
  const rows = parseComposition((await ctx.agentPresets.readDocument(request.preset)).content);
  const plugins = selectPromptProviders(rows, request.providers);
  const id = `studio-preview-${randomUUID()}`;
  const unregister = await ctx.agentPresets.register({ id, plugins: plugins as never });
  try {
    const lease = await ctx.agentPresets.acquireScope(id);
    try {
      const key = {};
      const child = createScope(ctx, key, { parent: lease.key });
      try {
        child.ctx.tools.restrict({ allow: request.tools });
        child.ctx.systemPrompt.section({ name: 'studio:additional', order: child.ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_SUFFIX') + 1, text: request.prompt, interpolate: false });
        // Sessionless preview uses the server working directory, not a user's session workspace.
        child.ctx.systemPrompt.variable('cwd', () => process.cwd());
        if (request.model.trim()) child.ctx.systemPrompt.variable('model', () => request.model.trim());
        const assembly = await ctx.systemPrompt.assemble({ scope: key });
        return {
          prompt: renderPrompt(assembly),
          sections: assembly.sections.map(section => ({ name: section.name, text: renderPrompt({ ...assembly, sections: [section] }) })).filter(section => section.text),
          context: renderContextSnapshot(assembly),
          tools: assembly.tools,
        };
      } finally { await child.dispose(); }
    } finally { await lease[Symbol.asyncDispose](); }
  } finally { await unregister(); }
}
