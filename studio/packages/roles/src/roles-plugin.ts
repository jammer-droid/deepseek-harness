/** Studio role settings Host plugin, independent of an open Studio page. */
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-app-boot';
import { RoleSettings } from './roles.ts';
import { RoleSettingsRemote } from './roles-remote.ts';
/** Required public services for profile storage and capability validation. */
export const inject = ['storageDomain', 'llm', 'profileContext'];
/** Mount the profile settings owner and its public Remote.
 * @param ctx Owning plugin context.
 */
export async function apply(ctx: Context): Promise<void> {
  const owner = await RoleSettings.open({ storageDomain: ctx.storageDomain, llm: ctx.llm, profile: ctx.profileContext.name });
  ctx.effect(() => () => owner.close());
  ctx.plugin(RoleSettingsRemote, owner);
}
