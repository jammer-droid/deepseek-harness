/** Build-selected public child lifecycle operations. */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { SessionId } from '@deepseek-ai/dsh-session';
import type { ChildStart, ChildReceipt } from './child-runtime-types.ts';

/** Whether initial operations require message-correlated Session observation. */
export const observeInitial = false;
/** Start a reserved child through the selected runtime API.
 * @param ctx Owning Host context.
 * @param spec Persisted child identity and captured request.
 * @returns Accepted message and caller-owned activation.
 */
export async function startChild(ctx: Context, spec: ChildStart): Promise<ChildReceipt> {
  const activation = await ctx.subagents.startActivation({ ...spec, delivery: 'caller' });
  return { messageId: activation.messageId, completion: activation };
}
/** Await release of selected direct children.
 * @param ctx Owning Host context.
 * @param owner Exact live parent.
 * @param ids Children selected for release.
 * @returns Once selected children have released their resources.
 */
export function drainChildren(ctx: Context, owner: Agent, ids: readonly SessionId[]): Promise<void> {
  return ctx.subagents.drainChildren(owner, ids);
}
