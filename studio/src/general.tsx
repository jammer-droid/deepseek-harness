/** General preset editor registration without role services or role policy. */
import React from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type {} from './contracts.ts';
import type {} from '@deepseek-ai/dsh-client-locale/client';
import { TYPERT_REMOTE } from '@local/dsh-studio-general/remote';
import { PresetEditor, type PresetApi } from './preset-editor.tsx';
import { StudioSurface } from './ui.tsx';
import { serviceText } from './service-locales.ts';
export const inject = ['remote', 'slots', 'locale'];
/** @param ctx Owning Client context. */
export async function apply(ctx: Context): Promise<void> {
  const unmount = await ctx.remote.$mount(TYPERT_REMOTE);
  ctx.effect(() => unmount);
  ctx.inject(['remote.studioGeneral'], ctx => {
    const api: PresetApi = {
      async describe() { const result = await ctx.remote.studioGeneral.presets(); if (!result.ok) throw result.error; return result.value; },
      async apply(request) { const result = await ctx.remote.studioGeneral.applyPreset(request); if (!result.ok) throw result.error; return result.value; },
    };
    function Presets() {
      const locale = React.useSyncExternalStore(listener => ctx.locale.subscribe(listener), () => ctx.locale.getLocale().active);
      return <StudioSurface><PresetEditor locale={locale} api={api} /></StudioSurface>;
    }
    ctx.slots.inject('local.dsh-studio.services', () => ctx.slots.register({ name: 'local.dsh-studio.services', id: 'preset-settings', order: 10, label: () => serviceText(ctx.locale.getLocale().active).presets }, Presets));
  });
}
