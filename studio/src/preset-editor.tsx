/** Drafts stay local until an explicit, confirmed profile write. */
import React from 'react';
import type { PresetChange, PresetSettings } from '@local/dsh-studio-roles/preset-types';
import { Button } from './ui.tsx';
import { presetCopy } from './preset-locales.ts';

/** User-only preset settings transport. */
export interface PresetApi {
  describe(): Promise<PresetSettings[]>;
  apply(request: PresetChange): Promise<PresetSettings[]>;
}
/** @param props Locale and profile editor operations. @returns Persistent draft editor. */
export function PresetEditor({ locale, api }: { locale: string; api: PresetApi }) {
  const t = presetCopy(locale);
  const [rows, setRows] = React.useState<PresetSettings[]>([]);
  const [draft, setDraft] = React.useState<PresetSettings>();
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [confirmed, setConfirmed] = React.useState(false);
  const live = React.useRef(true);
  const pending = React.useRef(false);
  React.useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const original = rows.find(row => row.entryId === draft?.entryId);
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(original);
  const run = async (operation: () => Promise<PresetSettings[]>, selected?: string, applied = false) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setFailed(false); setSaved(false);
    try {
      const next = await operation();
      if (!live.current) return;
      setRows(next);
      setDraft(structuredClone(next.find(row => row.entryId === selected) ?? next[0]));
      setConfirmed(false); setSaved(applied);
    } catch (error) {
      // Transport details remain on the Host; a reload resolves uncertain writes.
      if (live.current) setFailed(true);
    } finally {
      pending.current = false;
      if (live.current) setBusy(false);
    }
  };
  React.useEffect(() => { void run(() => api.describe()); }, [api]);
  const update = (change: (next: PresetSettings) => void) => {
    if (!draft) return;
    const next = structuredClone(draft); change(next); setDraft(next); setConfirmed(false); setSaved(false);
  };
  return <div className="studio-card">
    <h3>{t.title}</h3><p className="studio-muted">{t.warning}</p><p className="studio-muted">{t.limits}</p>
    {failed && <p role="alert">{t.failed}</p>}
    {saved && <p role="status">{t.saved}</p>}
    {busy && <p role="status">{t.loading}</p>}
    <Button disabled={busy} onClick={() => void run(() => api.describe(), draft?.entryId)}>{t.reload}</Button>
    <fieldset disabled={busy || failed}>
      <label>{t.choose}<select disabled={dirty} value={draft?.entryId ?? ''} onChange={event => {
        setDraft(structuredClone(rows.find(row => row.entryId === event.target.value))); setConfirmed(false); setSaved(false);
      }}>{rows.map(row => <option key={row.entryId} value={row.entryId}>{row.name}</option>)}</select></label>
      {!draft && !busy && <p>{t.empty}</p>}
      {draft && <>
        <p role={draft.availability === 'available' ? 'status' : 'alert'}>{t[draft.availability]}</p>
        <p role="status">{dirty ? t.dirty : draft.overridden ? t.overridden : t.inherited}</p>
        {draft.plugins.map((plugin, index) => <details key={plugin.path.join('.')} className="studio-card">
          <summary>{plugin.name}</summary>
          <label><input type="checkbox" disabled={plugin.disabled === null} checked={plugin.disabled === false} onChange={event => update(next => { next.plugins[index]!.disabled = !event.target.checked; })} />{plugin.disabled === null ? t.conditional : t.enabled}</label>
          {plugin.fields.map((field, fieldIndex) => <label key={field.path.join('.')} style={{ display: 'block' }}>
            {field.path.join('.') || 'config'}
            {typeof field.value === 'boolean' ? <input type="checkbox" checked={field.value} onChange={event => update(next => { next.plugins[index]!.fields[fieldIndex]!.value = event.target.checked; })} />
              : typeof field.value === 'number' ? <input type="number" step="any" value={field.value} onChange={event => { const value = event.target.valueAsNumber; if (Number.isFinite(value)) update(next => { next.plugins[index]!.fields[fieldIndex]!.value = value; }); }} />
                : <textarea value={field.value} onChange={event => update(next => { next.plugins[index]!.fields[fieldIndex]!.value = event.target.value; })} />}
          </label>)}
        </details>)}
        <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />{t.confirm}</label>
        <div className="studio-row">
          <Button disabled={!dirty || !confirmed} onClick={() => void run(() => api.apply({ entryId: draft.entryId, revision: draft.revision, reset: false, plugins: draft.plugins }), draft.entryId, true)}>{t.apply}</Button>
          <Button disabled={!dirty} onClick={() => { setDraft(structuredClone(original)); setConfirmed(false); }}>{t.cancel}</Button>
          <Button disabled={!draft.overridden || !confirmed} onClick={() => void run(() => api.apply({ entryId: draft.entryId, revision: draft.revision, reset: true, plugins: [] }), draft.entryId, true)}>{t.reset}</Button>
        </div>
      </>}
    </fieldset>
  </div>;
}
