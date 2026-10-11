/** Studio role settings Host plugin, independent of an open Studio page. */
import type { Context } from '@deepseek-ai/cordis';
import { z } from 'zod';
/** Operator policy; captured once for each new cycle. */
export interface Config { reworkCap: number }
/** Validated profile-only limit, unavailable to role editing and model tools. */
export const Config = z.object({ reworkCap: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(2) }).strict().default({ reworkCap: 2 });
import type {} from '@deepseek-ai/dsh-app-boot';
import { RoleSettings } from './roles.ts';
import { RoleSettingsRemote } from './roles-remote.ts';
import { StudioDelegation } from './delegation.ts';
import { delegationSpec } from './delegation-store.ts';
/** Required public services for profile storage and capability validation. */
export const inject = ['storageDomain', 'llm', 'profileContext'];
/** Mount the profile settings owner and its public Remote.
 * @param ctx Owning plugin context.
 * @param config Validated operator policy for new cycles.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const owner = await RoleSettings.open({ storageDomain: ctx.storageDomain, llm: ctx.llm, profile: ctx.profileContext.name });
  ctx.effect(() => () => owner.close());
  ctx.plugin(RoleSettingsRemote, owner);
  const domain = await ctx.storageDomain.open(delegationSpec);
  // Delegation owns domain closure after its accepted operations have drained.
  ctx.plugin(StudioDelegation, { domain, reworkCap: config.reworkCap });
}
