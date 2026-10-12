/** Studio workflow component lookup and independently mounted editor. */
import React from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client';
import type {} from './contracts.ts';
import type {} from '@deepseek-ai/dsh-client-locale/client';
import { TYPERT_REMOTE } from '@local/dsh-studio-workflows/remote';
import type { SavedDraft } from '@local/dsh-studio-workflows/types';
import { WorkflowEditor, type WorkflowApi } from './workflow-editor.tsx';
import { workflowText } from './workflow-locales.ts';
import { serviceText } from './service-locales.ts';
import { DetailLayout } from './detail-layout.tsx';
import { StudioSurface, Button } from './ui.tsx';
export const inject = ['remote', 'slots', 'locale', 'connection'];
/** @param ctx Owning Client context. */
export async function apply(ctx: Context): Promise<void> {
  const unmount = await ctx.remote.$mount(TYPERT_REMOTE);
  ctx.effect(() => unmount);
  ctx.inject(['remote.studioWorkflows'], ctx => {
    const connection = ctx.get('connection') as ConnectionHandle;
    const api: WorkflowApi = {
      async models() { const result = await ctx.remote.studioWorkflows.models(); if (!result.ok) throw result.error; return result.value; },
      async catalog() { const result = await ctx.remote.studioWorkflows.catalog(); if (!result.ok) throw result.error; return result.value; },
      async validate(document) { const result = await ctx.remote.studioWorkflows.validate(document); if (!result.ok) throw result.error; return result.value; },
      subscribeConnection(listener) { return connection.generation.subscribe(() => listener(connection.generation.getSnapshot() !== undefined)); },
      async drafts() { const result = await ctx.remote.studioWorkflows.drafts(); if (!result.ok) throw result.error; return result.value; },
      async save(request) { const result = await ctx.remote.studioWorkflows.save(request); if (!result.ok) throw result.error; return result.value; },
    };
    function Workflows({ active }: { active: boolean }) {
      const locale = React.useSyncExternalStore(listener => ctx.locale.subscribe(listener), () => ctx.locale.getLocale().active);
      const t = workflowText(locale);
      const [data, setData] = React.useState<SavedDraft[] | null>(null);
      const [failed, setFailed] = React.useState(false);
      const [attempt, setAttempt] = React.useState(0);
      React.useEffect(() => {
        let active = true;
        setFailed(false);
        void api.drafts().then(drafts => {
          if (active) setData(drafts);
        }, () => { if (active) setFailed(true); });
        return () => { active = false; };
      }, [attempt]);
      return <StudioSurface>
        {failed && <div role="alert">{t.loadFailed}<Button onClick={() => setAttempt(value => value + 1)}>{t.retry}</Button></div>}
        {data ? <WorkflowEditor visible={active} locale={locale} initialDrafts={data} api={api} /> : !failed && <div role="status" aria-label={t.loading} aria-busy="true" />}
      </StudioSurface>;
    }
    function PresetBuilder({ active }: { active: boolean }) {
      const locale = React.useSyncExternalStore(listener => ctx.locale.subscribe(listener), () => ctx.locale.getLocale().active);
      const t = serviceText(locale);
      return <DetailLayout title={t.builder} navigation={t.builder}
        pages={[{ id: 'workflow', label: t.workflow, content: <Workflows active={active} /> }]}
        selected="workflow" onSelect={() => {}} />;
    }
    ctx.slots.inject('local.dsh-studio.services', () => ctx.slots.register({ name: 'local.dsh-studio.services', id: 'preset-builder', order: 0, label: () => serviceText(ctx.locale.getLocale().active).builder }, PresetBuilder));
  });
}
