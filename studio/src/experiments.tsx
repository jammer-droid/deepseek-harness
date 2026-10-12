/** Disposable experiment editor registered inside the existing Experiments page. */
import React from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type {} from './contracts.ts';
import type {} from '@deepseek-ai/dsh-client-locale/client';
import { TYPERT_REMOTE } from '@local/dsh-studio-experiments/remote';
import type { ExperimentState, ExperimentChange } from '@local/dsh-studio-experiments/types';
import type { ExperimentSettings, ExperimentTarget } from '@local/dsh-studio-experiments/types';
import { Button, Notice, Note, PageHead, StudioSurface } from './ui.tsx';
import { experimentText } from './experiment-locales.ts';

export interface ExperimentApi { describe(): Promise<ExperimentState>; apply(request: ExperimentChange): Promise<ExperimentState> }
/** @param props Locale and user-only Remote adapter. @returns Persistent editor with explicit application. */
export function ExperimentEditor({ locale, api }: { locale: string; api: ExperimentApi }) {
  const t = experimentText(locale);
  const [state, setState] = React.useState<ExperimentState>();
  const [draft, setDraft] = React.useState<ExperimentSettings>();
  const [busy, setBusy] = React.useState(true);
  const [status, setStatus] = React.useState<'saved' | 'failure' | 'invalid'>();
  const alive = React.useRef(true);
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const load = React.useCallback(async () => {
    setBusy(true); setStatus(undefined);
    try { const next = await api.describe(); if (alive.current) { setState(next); setDraft(structuredClone(next.settings)); } }
    catch { if (alive.current) setStatus('failure'); }
    finally { if (alive.current) setBusy(false); }
  }, [api]);
  React.useEffect(() => { void load(); }, [load]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!state || !draft) return;
    if (draft.previewChars > draft.inlineChars / 2 || draft.jobWaitMs > draft.jobWaitCapMs) { setStatus('invalid'); return; }
    setBusy(true); setStatus(undefined);
    try {
      const next = await api.apply({ expectedRevision: state.revision, settings: draft });
      if (alive.current) { setState(next); setDraft(structuredClone(next.settings)); setStatus('saved'); }
    } catch { if (alive.current) setStatus('failure'); }
    finally { if (alive.current) setBusy(false); }
  }
  const features: (keyof ExperimentSettings['targets'])[] = ['offload', 'goals', 'headless', 'batch', 'tasks', 'waiting'];
  const numbers: (Exclude<keyof ExperimentSettings, 'targets'>)[] = ['inlineChars', 'previewChars', 'batchMaxCalls', 'readMaxLines', 'taskWaitMs', 'bashWaitMs', 'jobWaitMs', 'jobWaitCapMs'];
  const targets: ExperimentTarget[] = ['off', 'main', 'sub', 'both'];
  return <StudioSurface><PageHead title={t.title} description={t.description} /><Note>{t.timing}</Note><Note>{t.native}</Note><Note>{t.prompt}</Note>
    {status === 'failure' || status === 'invalid' ? <Notice>{t[status]}</Notice> : status === 'saved' ? <p role="status">{t.saved}</p> : null}
    {!draft ? <><p role="status">{busy ? t.loading : t.failure}</p><Button disabled={busy} onClick={() => void load()}>{t.reload}</Button></> : <form onSubmit={event => void save(event)}>
      <fieldset disabled={busy} className="studio-panel">
        {features.map(key => <label className="studio-field" key={key}><span>{t.features[key]}</span><select aria-label={t.features[key]} value={draft.targets[key]} onChange={event => {
          const value = targets.find(target => target === event.target.value);
          if (value) setDraft({ ...draft, targets: { ...draft.targets, [key]: value } });
        }}>{targets.map(value => <option key={value} value={value}>{t.targets[value]}</option>)}</select></label>)}
        {numbers.map(key => <label className="studio-field" key={key}><span>{t.numbers[key]}</span><input type="number" required step={1} min={key === 'inlineChars' ? 1024 : key === 'previewChars' ? 0 : 1} max={key === 'batchMaxCalls' ? 8 : key === 'readMaxLines' ? 200 : key.endsWith('Ms') ? 600000 : Number.MAX_SAFE_INTEGER} value={Number.isNaN(draft[key]) ? '' : draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.valueAsNumber })} /></label>)}
      </fieldset>
      <div className="studio-inline-actions"><Button primary type="submit" disabled={busy}>{t.apply}</Button><Button disabled={busy} onClick={() => void load()}>{t.reload}</Button><Button disabled={busy} onClick={() => { if (state) setDraft(structuredClone(state.settings)); setStatus(undefined); }}>{t.reset}</Button></div>
    </form>}
  </StudioSurface>;
}
export const inject = ['remote', 'slots', 'locale'];
/** @param ctx Client plugin owner. */
export async function apply(ctx: Context): Promise<void> {
  const unmount = await ctx.remote.$mount(TYPERT_REMOTE);
  ctx.effect(() => unmount);
  ctx.inject(['remote.studioExperiments'], ctx => {
    const api: ExperimentApi = {
      async describe() { const result = await ctx.remote.studioExperiments.describe(); if (!result.ok) throw result.error; return result.value; },
      async apply(request) { const result = await ctx.remote.studioExperiments.apply(request); if (!result.ok) throw result.error; return result.value; },
    };
    function Editor() {
      const locale = React.useSyncExternalStore(listener => ctx.locale.subscribe(listener), () => ctx.locale.getLocale().active);
      return <ExperimentEditor locale={locale} api={api} />;
    }
    ctx.slots.inject('local.dsh-studio.features', () => ctx.slots.register({ name: 'local.dsh-studio.features', id: 'agent-optimizations', order: 0 }, Editor));
  });
}
