/** Studio roles Client; Host settings remain active without this page. */
import React from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type {} from './contracts.ts';
import type {} from '@deepseek-ai/dsh-client-locale/client';
import { TYPERT_REMOTE } from '@local/dsh-studio-roles/remote';
import { RoleEditor } from './roles-editor.tsx';
import { roleCopy } from './roles-locales.ts';
import { createRoleStore, type RoleStore } from './roles-store.ts';
/** Mount required public services before registering the editor. */
export const inject = ['remote', 'slots', 'locale'];
function Settings({ store }: { store: RoleStore }) {
  const view = React.useSyncExternalStore(store.subscribe, store.getSnapshot);
  const t = roleCopy(view.locale);
  return <>{view.unavailable && <><p role="alert">{t.unavailable}</p><button onClick={() => void store.reload()}>{t.reload}</button></>}{view.state ? <fieldset disabled={view.unavailable}><RoleEditor key={view.generation} locale={view.locale} state={view.state} onApply={store.apply} onReload={store.reload} /></fieldset> : <button onClick={() => void store.reload()}>{t.reload}</button>}</>;
}
/** Register locale-owned role editor through the Studio feature Slot.
 * @param ctx Owning Client context.
 */
export async function apply(ctx: Context): Promise<void> {
  const unmount = await ctx.remote.$mount(TYPERT_REMOTE);
  ctx.effect(() => unmount);
  ctx.inject(['remote.studioRoles'], ctx => {
  const store = createRoleStore({
    async describe() {
      const response = await ctx.remote.studioRoles.describe();
      if (!response.ok) throw response.error;
      return response.value;
    },
    async apply(request) {
      const response = await ctx.remote.studioRoles.apply(request);
      if (!response.ok) throw response.error;
      return response.value;
    },
  }, ctx.locale.getLocale().active);
  ctx.effect(() => () => store.dispose());
  ctx.effect(() => ctx.locale.subscribe(() => store.setLocale(ctx.locale.getLocale().active)));
  ctx.on('connection/reset', () => store.reset());
  void store.reload();
  ctx.slots.inject('local.dsh-studio.features', () => ctx.slots.register({ name: 'local.dsh-studio.features', id: 'role-settings', order: -10 }, () => <Settings store={store} />));
  });
}
