/** Studio workflow component lookup and independently mounted editor. */
import React from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type {} from './contracts.ts';
import type {} from '@deepseek-ai/dsh-client-locale/client';
import { TYPERT_REMOTE } from '@local/dsh-studio-workflows/remote';
import type { ComponentDefinition, SavedDraft } from '@local/dsh-studio-workflows/types';
import { WorkflowEditor, type WorkflowApi } from './workflow-editor.tsx';
import { workflowText } from './workflow-locales.ts';
import { StudioSurface, Button } from './ui.tsx';
export const inject = ['remote', 'slots', 'locale'];
/** @param ctx Owning Client context. */
export async function apply(ctx: Context): Promise<void> {
  const unmount = await ctx.remote.$mount(TYPERT_REMOTE);
  ctx.effect(() => unmount);
  ctx.inject(['remote.studioWorkflows'], ctx => {
    const api: WorkflowApi = {
      async drafts() { const result = await ctx.remote.studioWorkflows.drafts(); if (!result.ok) throw result.error; return result.value; },
      async save(request) { const result = await ctx.remote.studioWorkflows.save(request); if (!result.ok) throw result.error; return result.value; },
    };
    function Workflows() {
      const locale = React.useSyncExternalStore(listener => ctx.locale.subscribe(listener), () => ctx.locale.getLocale().active);
      const t = workflowText(locale);
      const [data, setData] = React.useState<{ components: ComponentDefinition[]; drafts: SavedDraft[] } | null>(null);
      const [failed, setFailed] = React.useState(false);
      const [attempt, setAttempt] = React.useState(0);
      React.useEffect(() => {
        let active = true;
        setFailed(false);
        void Promise.all([ctx.remote.studioWorkflows.components(), api.drafts()]).then(([result, drafts]) => {
          if (!active) return;
          if (result.ok) setData({ components: result.value, drafts }); else setFailed(true);
        }, () => { if (active) setFailed(true); });
        return () => { active = false; };
      }, [attempt]);
      return <StudioSurface>
        {failed && <div role="alert">{t.loadFailed}<Button onClick={() => setAttempt(value => value + 1)}>{t.retry}</Button></div>}
        {data ? <WorkflowEditor locale={locale} components={data.components} initialDrafts={data.drafts} api={api} /> : !failed && <div role="status" aria-label={t.loading} aria-busy="true" />}
      </StudioSurface>;
    }
    ctx.slots.inject('local.dsh-studio.features', () => ctx.slots.register({ name: 'local.dsh-studio.features', id: 'workflow-drafts' }, Workflows));
  });
}
