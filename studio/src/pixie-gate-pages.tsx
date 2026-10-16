/** Gate pages under the Pixie settings `Gates` group: composition cards with the composer modal, and the scope page. Node-testable. */
import React from 'react';
import { Badge, Button, CheckOption, DetailDialog, Notice, PageHead, SectionHead, SettingsRow, Toggle } from './ui.tsx';
import { gatePointText } from './pixie-gate-locale.ts';
import { gateEditorText } from './pixie-gate-editor-locale.ts';
import { gateComposeText, type GateComposeKey } from './pixie-gate-compose-locale.ts';
import { GateComposer } from './pixie-gate-composer.tsx';
import { bindingConflict, makeGate, makeTemplateGate, message, type GateEditorActions, type GateEntries, type GateEntry } from './pixie-gate-editor.tsx';
import type { GateDefinition } from './pixie-gate-contracts.ts';

/** Notices for unloaded entries and a broken definitions file, shared by both pages. */
function DefinitionNotices({ gates, locale }: { gates: GateEntries; locale: string }) {
  const e = (key: Parameters<typeof gateEditorText>[1]) => gateEditorText(locale, key);
  const [copyError, setCopyError] = React.useState('');
  return <>
    {gates.fileError && <Notice>{e('invalidFile')} ({gates.fileError.code}: {gates.fileError.message})</Notice>}
    {gates.invalid.length > 0 && <Notice><strong>{e('invalidLoaded').replace('{count}', String(gates.invalid.length))}</strong><p>{e('removeInvalidHint')}</p>{gates.invalid.map(item => <div key={item.index}>
      <p>#{item.index + 1}: {e(item.error.code === 'options' ? 'invalidOptions' : 'invalidReason')} ({item.error.code}: {item.error.message})</p>
      <details><summary>{e('rawJson')}</summary><pre>{JSON.stringify(item.raw, null, 2)}</pre></details>
      <Button small onClick={async () => { try { await navigator.clipboard.writeText(JSON.stringify(item.raw, null, 2)); } catch (reason) { setCopyError(message(reason)); } }}>{e('copyJson')}</Button>
      <Button small disabled={gates.saving} onClick={() => gates.removeInvalid(item.index)}>{e('removeInvalid')}</Button>
    </div>)}</Notice>}
    {gates.removedInvalid && <Notice tone="info">{e('removeInvalidHint')}</Notice>}
    {copyError && <Notice action={<Button small onClick={() => setCopyError('')}>{e('close')}</Button>}>{copyError}</Notice>}
    {gates.confirming && <Notice action={<><Button small onClick={() => gates.cancelOverwrite()}>{e('cancelOverwrite')}</Button><Button small onClick={() => void gates.confirmOverwrite()}>{e('confirmOverwrite')}</Button></>}>{e('overwriteInvalid')}</Notice>}
  </>;
}

/** Composition: one card per gate; editing happens in the composer modal. */
export function GateCompositionPage({ gates, actions, locale }: { gates: GateEntries; actions: GateEditorActions; locale: string }) {
  const t = (key: GateComposeKey, values?: Record<string, string | number>) => gateComposeText(locale, key, values);
  const [editing, setEditing] = React.useState<GateEntry>();
  const [deleting, setDeleting] = React.useState<GateDefinition>();
  const [error, setError] = React.useState('');
  const list = gates.stored ?? [];
  const run = async (perform: () => Promise<unknown>) => { setError(''); try { await perform(); } catch (reason) { setError(`${t('saveFailed')} (${message(reason)})`); } };
  return <div className="studio-page-stack">
    <PageHead title={t('composition')} description={t('compositionDescription')} actions={gates.stored && <>
      <Button disabled={gates.saving} onClick={() => setEditing(makeTemplateGate(locale))}>{t('fromTemplate')}</Button>
      <Button primary disabled={gates.saving} onClick={() => setEditing(makeGate(t('newGateName')))}>{t('addGate')}</Button>
    </>} />
    {gates.loadError && <Notice action={<Button small onClick={() => void gates.load()}>{gateEditorText(locale, 'retry')}</Button>}>{gates.loadError}</Notice>}
    {error && <Notice action={<Button small onClick={() => setError('')}>{t('close')}</Button>}>{error}</Notice>}
    <DefinitionNotices gates={gates} locale={locale} />
    {!gates.stored && !gates.loadError && <p role="status" className="studio-muted">{gateEditorText(locale, 'loading')}</p>}
    {gates.stored && !list.length && <p role="status" className="studio-muted">{t('empty')}</p>}
    {list.length > 0 && <div className="studio-tool-cards studio-card-pair">{list.map(entry => {
      const g = entry.definition;
      return <article className="studio-preset-card studio-gate-card" key={g.id} data-gate-card={g.id}>
        <div className="studio-card-head"><h3>{g.name}</h3><Badge tone="outline">{gatePointText(locale, g.point)}</Badge><Badge tone={g.enabled ? 'success' : 'neutral'}>{t(g.enabled ? 'on' : 'off')}</Badge></div>
        <ol className="studio-gate-strip" aria-label={t('flow')}>
          {g.hooks?.start && <li>{t('startHook')}</li>}
          {g.stages.map((stage, i) => <li key={i}>{t(`kind-${stage.kind}`)}{stage.kind !== 'judge' ? ` · ${t(`role-${stage.role}`)}` : ''}</li>)}
          {g.hooks?.end && <li>{t('endHook')}</li>}
        </ol>
        <p className="studio-card-meta">{entry.presetIds.length ? t('presetCount', { count: entry.presetIds.length }) : t('noPreset')}</p>
        <div className="studio-card-footer">
          <Button small disabled={gates.saving} onClick={() => setEditing(structuredClone(entry))}>{t('edit')}</Button>
          <Button small disabled={gates.saving} onClick={() => { const copy = structuredClone(entry); copy.definition.id = crypto.randomUUID(); copy.definition.name += ` (${t('duplicate')})`; copy.definition.enabled = false; void run(() => gates.saveGate(copy)); }}>{t('duplicate')}</Button>
          <Button small disabled={gates.saving} onClick={() => setDeleting(g)}>{t('delete')}</Button>
        </div>
      </article>;
    })}</div>}
    <GateComposer open={!!editing} entry={editing} isNew={!!editing && !list.some(item => item.definition.id === editing.definition.id)} models={gates.models} trial={actions.trial} locale={locale} onClose={() => setEditing(undefined)}
      onSave={async next => {
        const conflict = bindingConflict((gates.stored ?? []).filter(item => item.definition.id !== next.definition.id).concat(next));
        if (conflict) throw new Error(t('conflict'));
        return gates.saveGate(next);
      }} />
    <DetailDialog compact open={!!deleting} title={t('deleteTitle')} subtitle={deleting?.name} onClose={() => setDeleting(undefined)} footer={<>
      <Button onClick={() => setDeleting(undefined)}>{t('cancel')}</Button>
      <Button primary disabled={gates.saving} onClick={() => { const target = deleting!; setDeleting(undefined); void run(() => gates.removeGate(target.id)); }}>{t('confirmDelete')}</Button>
    </>}><p className="studio-muted">{t('deleteBody')}</p></DetailDialog>
  </div>;
}

/** Comma-separated tool names; keeps the typed text so commas and spaces can be entered. */
function ToolNames({ label, value, onChange }: { label: string; value: readonly string[]; onChange(tools: string[]): void }) {
  const [text, setText] = React.useState(value.join(', '));
  const parse = (raw: string) => raw.split(',').map(item => item.trim()).filter(Boolean);
  React.useEffect(() => { if (parse(text).join('\u0000') !== value.join('\u0000')) setText(value.join(', ')); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <input className="studio-compact" aria-label={label} value={text} onChange={event => { setText(event.target.value); onChange(parse(event.target.value)); }} />;
}

/** Scope: per gate, whether it runs and for which presets, agents, sources, and tools. */
export function GateScopePage({ gates, locale, onEditFlow }: { gates: GateEntries; locale: string; onEditFlow(): void }) {
  const t = (key: GateComposeKey, values?: Record<string, string | number>) => gateComposeText(locale, key, values);
  const [error, setError] = React.useState('');
  const draft = gates.draft ?? [];
  const conflict = bindingConflict(draft);
  const update = (id: string, change: (entry: GateEntry) => GateEntry) => gates.setDraft(old => old?.map(item => item.definition.id === id ? change(item) : item));
  const save = async () => { setError(''); try { await gates.saveDraft(); } catch (reason) { setError(`${t('saveFailed')} (${message(reason)})`); } };
  const presetOptions = (entry: GateEntry) => [...gates.presets, ...entry.presetIds.filter(id => !gates.presets.some(preset => preset.id === id)).map(id => ({ id, name: id }))];
  return <div className="studio-page-stack">
    <PageHead title={t('scope')} description={t('scopeDescription')} actions={gates.draft && <Button primary disabled={gates.saving || !gates.dirty || !!conflict} onClick={() => void save()}>{gates.saving ? t('saving') : gates.dirty ? t('save') : t('saved')}</Button>} />
    {gates.loadError && <Notice action={<Button small onClick={() => void gates.load()}>{gateEditorText(locale, 'retry')}</Button>}>{gates.loadError}</Notice>}
    {error && <Notice action={<Button small onClick={() => setError('')}>{t('close')}</Button>}>{error}</Notice>}
    {conflict && <Notice>{t('conflict')}</Notice>}
    <DefinitionNotices gates={gates} locale={locale} />
    {!gates.draft && !gates.loadError && <p role="status" className="studio-muted">{gateEditorText(locale, 'loading')}</p>}
    {gates.draft && !draft.length && <p role="status" className="studio-muted">{t('scopeEmpty')}</p>}
    {draft.length > 0 && <fieldset disabled={gates.saving} className="studio-config-root studio-page-stack">{draft.map(entry => {
      const g = entry.definition;
      const match = (patch: Partial<GateDefinition['match']>) => update(g.id, item => ({ ...item, definition: { ...item.definition, match: { ...item.definition.match, ...patch } } }));
      return <section className="studio-settings-card" key={g.id} aria-label={g.name} data-gate-scope={g.id}>
        <SectionHead title={<span className="studio-card-head"><strong>{g.name}</strong><Badge tone="outline">{gatePointText(locale, g.point)}</Badge>{conflict === g.id && <Badge tone="warning">{t('problem')}</Badge>}</span>} actions={<Button small onClick={onEditFlow}>{t('editFlow')}</Button>} />
        <SettingsRow title={t('enabled')} description={t('enabledHelp')} control={<Toggle label={`${t('enabled')} ${g.name}`} checked={g.enabled} onChange={enabled => update(g.id, item => ({ ...item, definition: { ...item.definition, enabled } }))} />} />
        <SettingsRow title={t('presets')} description={t('presetsHelp')}><div role="group" aria-label={`${t('presets')} ${g.name}`}>{presetOptions(entry).map(preset => <CheckOption key={preset.id} label={preset.name} checked={entry.presetIds.includes(preset.id)} onChange={checked => update(g.id, item => ({ ...item, presetIds: checked ? [...item.presetIds, preset.id] : item.presetIds.filter(id => id !== preset.id) }))} />)}</div></SettingsRow>
        <SettingsRow title={t('agents')} description={t('agentsHelp')} control={<select className="studio-compact" aria-label={`${t('agents')} ${g.name}`} value={g.match.agents ?? 'root'} onChange={event => match({ agents: event.target.value as 'root' | 'child' | 'any' })}>{(['root', 'child', 'any'] as const).map(value => <option key={value} value={value}>{t(value)}</option>)}</select>} />
        {g.point === 'input' && <SettingsRow title={t('sources')} description={t('sourcesHelp')}><div role="group" aria-label={`${t('sources')} ${g.name}`}>{(['user', 'agent-message'] as const).map(source => <CheckOption key={source} label={t(source)} checked={(g.match.sources ?? ['user']).includes(source)} onChange={checked => { const sources = g.match.sources ?? ['user']; match({ sources: checked ? [...sources, source] : sources.filter(value => value !== source) }); }} />)}</div></SettingsRow>}
        {(g.point === 'tool-before' || g.point === 'tool-after') && <SettingsRow title={t('tools')} description={t('toolsHelp')} control={<ToolNames label={`${t('tools')} ${g.name}`} value={g.match.tools ?? []} onChange={tools => { const { tools: _, ...rest } = g.match; update(g.id, item => ({ ...item, definition: { ...item.definition, match: tools.length ? { ...rest, tools } : rest } })); }} />} />}
      </section>;
    })}</fieldset>}
  </div>;
}
