/** Optional agent-scoped entry to the same saved-role operation used by the UI. */
import type { Context } from '@deepseek-ai/cordis';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { brandString } from '@deepseek-ai/dsh-brand';
import { z } from 'zod';
import type {} from './index.ts';
import type { DraftId } from './types.ts';
const request = z.discriminatedUnion('action', [
  z.object({ action: z.literal('roles') }).strict(),
  z.object({ action: z.literal('launch'), roleId: z.string().uuid().transform(value => brandString<DraftId>(value)), revision: z.number().int().positive(), task: z.string().trim().min(1), context: z.enum(['fresh', 'fork']) }).strict(),
]);
export const inject = ['tools', 'studioCatalog'];
/** @param ctx Agent-owned tool registration lifetime. */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'studio_role',
    description: 'List saved Studio roles or launch one with a task in the shared workspace. Creation freezes the selected revision, instructions, model and tool restrictions. Results arrive through native subagent notifications. An unknown admission must not be retried: inspect the child ID and report uncertainty.',
    parameters: {
      action: { type: 'string', required: true, enum: ['roles', 'launch'] },
      roleId: { type: 'string', description: 'For launch: role ID returned by roles.' },
      revision: { type: 'integer', description: 'For launch: revision returned by roles.' },
      task: { type: 'string', description: 'For launch: the per-call assignment.' },
      context: { type: 'string', enum: ['fresh', 'fork'], description: 'For launch: fresh starts without parent history; fork inherits completed parent turns.' },
    },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute(args, exec) {
      const parsed = request.parse(args);
      if (parsed.action === 'roles') return JSON.stringify(await ctx.studioCatalog.roles());
      if (!exec.agent) throw new Error('studio-catalog/parent-required');
      return JSON.stringify(await ctx.studioCatalog.launchForAgent({ parentId: exec.agent.id, roleId: parsed.roleId, revision: parsed.revision, task: parsed.task, context: parsed.context }, exec.signal));
    },
    presentCall: () => ({ card: 'generic', title: 'Studio role', kind: 'other' }),
  })));
}
