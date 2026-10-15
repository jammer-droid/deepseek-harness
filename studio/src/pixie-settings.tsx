/** Studio → Pixie settings page: default model and request options, separate from presets. Node-testable. */
import React from 'react';
import { Button, Notice, PageHead, Segmented, SettingsRow, Toggle } from './ui.tsx';
import type { PixieContextMode, PixieSettings } from './pixie-contracts.ts';
import { pixieText, type PixieTextKey } from './pixie-locale.ts';

/** Model catalog as `sessionController.modelCatalog()` returns it. */
export interface PixieSettingsCatalog {
  groups: readonly { id: string; name: string; models: readonly { id: string; name: string; reasoning?: { efforts: readonly { id: string; name: string }[]; defaultEffort?: string } }[] }[];
  failures?: readonly { id: string; name: string; message: string }[];
}

export interface PixieSettingsActions {
  read(): Promise<PixieSettings>;
  save(settings: PixieSettings): Promise<PixieSettings>;
  models(): Promise<PixieSettingsCatalog>;
}

const SEP = '\u0000';

export function PixieSettingsPage({ actions, locale }: { actions: PixieSettingsActions; locale: string }) {
  const t = (key: PixieTextKey) => pixieText(locale, key);
  const [draft, setDraft] = React.useState<PixieSettings>();
  const [catalog, setCatalog] = React.useState<PixieSettingsCatalog>();
  const [error, setError] = React.useState('');
  const [status, setStatus] = React.useState<'idle' | 'saving' | 'saved'>('idle');
  const load = React.useCallback(async () => {
    setError('');
    try {
      const [settings, models] = await Promise.all([actions.read(), actions.models()]);
      setDraft(settings); setCatalog(models);
    } catch (reason) { setError((reason instanceof Error ? reason.message : String(reason))); }
  }, [actions]);
  React.useEffect(() => { void load(); }, [load]);
  if (error && !draft) return <Notice action={<Button small onClick={() => { void load(); }}>{t('retry')}</Button>}>{error}</Notice>;
  if (!draft || !catalog) return <p className="studio-muted">{t('loading')}</p>;

  const selected = draft.model ? catalog.groups.find(group => group.id === draft.model!.provider)?.models.find(model => model.id === draft.model!.model) : undefined;
  const efforts = selected?.reasoning?.efforts ?? [];
  const update = (next: Partial<PixieSettings>) => { setDraft({ ...draft, ...next }); setStatus('idle'); };
  const replace = (next: PixieSettings) => { setDraft(next); setStatus('idle'); };
  const save = async () => {
    setStatus('saving'); setError('');
    try { setDraft(await actions.save(draft)); setStatus('saved'); } catch (reason) { setStatus('idle'); setError((reason instanceof Error ? reason.message : String(reason))); }
  };

  return <div className="studio-stack">
    <PageHead title={t('settingsTitle')} description={t('settingsDescription')}
      actions={<Button primary small disabled={status === 'saving'} onClick={() => { void save(); }}>{t('save')}</Button>} />
    {status === 'saved' && <p role="status" className="studio-muted">{t('saved')}</p>}
    {error && <Notice>{error}</Notice>}
    {catalog.failures && catalog.failures.length > 0 && <Notice>{`${t('catalogFailed')} ${catalog.failures.map(failure => failure.name).join(', ')}`}</Notice>}
    <section className="studio-settings-card">
      <SettingsRow title={t('settingsModel')} description={t('settingsModelHint')} control={
        <select className="studio-compact" aria-label={t('settingsModel')} value={draft.model ? `${draft.model.provider}${SEP}${draft.model.model}` : ''} onChange={event => {
          const [provider, model] = event.target.value.split(SEP);
          const { model: _previous, ...rest } = draft;
          replace(provider && model ? { ...rest, model: { provider, model } } : rest);
        }}>
          <option value="">{t('settingsNoModel')}</option>
          {catalog.groups.map(group => <optgroup key={group.id} label={group.name}>
            {group.models.map(model => <option key={model.id} value={`${group.id}${SEP}${model.id}`}>{model.name}</option>)}
          </optgroup>)}
        </select>} />
      <SettingsRow title={t('settingsEffort')} control={
        <select className="studio-compact" aria-label={t('settingsEffort')} disabled={!draft.model || efforts.length === 0} value={draft.model?.reasoningEffort ?? ''} onChange={event => {
          if (!draft.model) return;
          const { reasoningEffort: _previous, ...model } = draft.model;
          update({ model: event.target.value ? { ...model, reasoningEffort: event.target.value } : model });
        }}>
          <option value="">{t('settingsEffortDefault')}</option>
          {efforts.map(effort => <option key={effort.id} value={effort.id}>{effort.name}</option>)}
        </select>} />
      <SettingsRow title={t('settingsMaxTokens')} description={t('settingsMaxTokensHint')} control={
        <input className="studio-compact" aria-label={t('settingsMaxTokens')} type="number" min={1} step={1} disabled={!draft.model} placeholder={t('settingsEffortDefault')} value={draft.model?.maxTokens ?? ''} onChange={event => {
          if (!draft.model) return;
          const { maxTokens: _previous, ...model } = draft.model;
          const value = Number(event.target.value);
          update({ model: event.target.value && Number.isInteger(value) && value > 0 ? { ...model, maxTokens: value } : model });
        }} />} />
      <SettingsRow title={t('settingsMode')} description={t(draft.contextMode === 'fresh' ? 'settingsModeFresh' : 'settingsModeFork')} control={
        <Segmented label={t('settingsMode')} value={draft.contextMode} onChange={(mode: PixieContextMode) => update({ contextMode: mode })}
          options={[{ value: 'fresh', label: t('fresh') }, { value: 'fork', label: t('fork') }]} />} />
      <SettingsRow title={t('settingsAllowThreadModel')} description={t(draft.allowThreadModel ? 'settingsThreadModelOnHint' : 'settingsThreadModelOffHint')} control={
        <Toggle label={t('settingsAllowThreadModel')} checked={draft.allowThreadModel} onChange={allowThreadModel => update({ allowThreadModel })} />} />
      <SettingsRow title={t('settingsPrompt')}>
        <textarea className="studio-pixie-prompt" aria-label={t('settingsPrompt')} value={draft.systemPrompt} onChange={event => update({ systemPrompt: event.target.value })} />
      </SettingsRow>
    </section>
  </div>;
}
