/** Draft selection and explicit persistence; never invokes preset application. */
import React from 'react';
import type { ComponentDefinition, DraftId, SavedDraft, SaveDraftRequest, WorkflowDocument } from '@local/dsh-studio-workflows/types';
import { workflowText } from './workflow-locales.ts';
import { Button } from './ui.tsx';
import { workflowFailure, type WorkflowFailure } from './workflow-failures.ts';

/** User operations projected from the generated workflow Remote. */
export interface WorkflowApi {
  drafts(): Promise<SavedDraft[]>;
  save(request: SaveDraftRequest): Promise<SavedDraft>;
}

/** @param props Initial confirmed drafts and declarations with explicit persistence operations.
 * @returns Multiple-draft editor retaining local edits until save or confirmed discard.
 */
export function WorkflowEditor({ locale, components, initialDrafts, api }: {
  locale: string; components: ComponentDefinition[]; initialDrafts: SavedDraft[]; api: WorkflowApi;
}) {
  const t = workflowText(locale);
  const [drafts, setDrafts] = React.useState(initialDrafts);
  const [selected, setSelected] = React.useState<SavedDraft | null>(initialDrafts[0] ?? null);
  const [document, setDocument] = React.useState<WorkflowDocument | null>(initialDrafts[0]?.document ?? null);
  const [busy, setBusy] = React.useState(false);
  const [failure, setFailure] = React.useState<WorkflowFailure | null>(null);
  const [pending, setPending] = React.useState<{ action: () => void; reload: boolean } | null>(null);
  const uncertainRequest = React.useRef<SaveDraftRequest | null>(null);
  const active = React.useRef(true);
  React.useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const dirty = selected !== null && (selected.revision === 0 || JSON.stringify(document) !== JSON.stringify(selected.document));
  function select(draft: SavedDraft) { setSelected(draft); setDocument(structuredClone(draft.document)); setFailure(null); }
  function change(action: () => void, reload = false) {
    if (dirty || failure !== null) setPending({ action, reload }); else action();
  }
  function create() {
    change(() => select({ id: crypto.randomUUID() as DraftId, revision: 0, document: { name: '', mainRole: { name: '', components: [] } } }));
  }
  async function save() {
    if (!selected || !document) return;
    setBusy(true);
    const request = { id: selected.id, expectedRevision: selected.revision, document: structuredClone(document) };
    try {
      const stored = await api.save(request);
      if (!active.current) return;
      setDrafts(previous => [...previous.filter(item => item.id !== stored.id), stored]);
      select(stored);
    } catch (error) {
      if (active.current) {
        const reason = workflowFailure(error);
        uncertainRequest.current = reason === 'unknown-outcome' ? request : null;
        setFailure(reason);
      }
    }
    finally { if (active.current) setBusy(false); }
  }
  async function reload() {
    setBusy(true);
    try {
      const latest = await api.drafts();
      if (!active.current) return;
      setDrafts(latest);
      const stored = latest.find(item => item.id === selected?.id);
      const unresolved = uncertainRequest.current;
      if (unresolved && (!stored || stored.revision <= unresolved.expectedRevision)) return;
      uncertainRequest.current = null;
      if (stored) select(stored);
      else setFailure(null);
    } catch (error) { if (active.current) setFailure(previous => previous ?? (workflowFailure(error) === 'unknown-outcome' ? 'read-failed' : workflowFailure(error))); }
    finally { if (active.current) setBusy(false); }
  }
  const available = components.filter(item => item.scope === 'role');
  return <section className="studio-card">
    <h2>{t.title}</h2><p>{t.draftOnly}</p>
    <fieldset disabled={busy || pending !== null}>
      <label>{t.select}<select aria-label={t.select} disabled={failure !== null} value={selected?.id ?? ''} onChange={event => {
        const next = drafts.find(item => item.id === event.target.value);
        if (next) change(() => select(next));
      }}><option value="" disabled>{t.select}</option>
        {selected?.revision === 0 && <option value={selected.id}>{t.unsaved}</option>}
        {drafts.map(item => <option key={item.id} value={item.id}>{item.document.name || item.id}</option>)}
      </select></label>
      <Button disabled={failure !== null} onClick={create}>{t.create}</Button>
      {document && selected ? <>
        <label>{t.draftName}<input value={document.name} onChange={event => setDocument({ ...document, name: event.target.value })} /></label>
        <fieldset><legend>{t.mainRole}</legend>
          <label>{t.name}<input value={document.mainRole.name} onChange={event => setDocument({ ...document, mainRole: { ...document.mainRole, name: event.target.value } })} /></label>
          {document.mainRole.components.map((instance, index) => {
            const definition = available.find(item => item.id === instance.id && item.version === instance.version);
            if (!definition) return <p key={index}>{instance.id}: {t.unknown}</p>;
            return definition.fields.map(field => {
              const value = instance.config[field.key];
              const labels: Record<string, string> = { 'studio.instructions:text': t.instructions, 'studio.model:provider': t.provider, 'studio.model:model': t.model, 'studio.model:reasoningEffort': t.reasoningEffort, 'studio.tools:allow': t.allow, 'studio.tools:deny': t.deny };
              const label = labels[`${instance.id}:${field.key}`] ?? `${instance.id} / ${field.key}`;
              return <label key={`${index}:${field.key}`}>{label}<textarea aria-label={label}
              value={typeof value === 'string' ? value : ''}
              onChange={event => setDocument({ ...document, mainRole: { ...document.mainRole, components: document.mainRole.components.map((item, i) => i === index ? { ...item, config: { ...item.config, [field.key]: event.target.value } } : item) } })}
            /></label>; });
          })}
          {document.mainRole.components.some(item => item.id === 'studio.tools') && <p>{t.toolHelp}</p>}
          {available.filter(definition => !document.mainRole.components.some(item => item.id === definition.id)).map(definition =>
            <Button key={definition.id} onClick={() => setDocument({ ...document, mainRole: { ...document.mainRole, components: [...document.mainRole.components, {
              id: definition.id, version: definition.version, scope: definition.scope, config: Object.fromEntries(definition.fields.map(field => [field.key, ''])),
            }] } })}>{definition.id === 'studio.instructions' ? t.add : definition.id === 'studio.model' ? t.addModel : definition.id === 'studio.tools' ? t.addTools : definition.id}</Button>)}
        </fieldset>
        <Button primary disabled={!dirty || (failure !== null && failure !== 'invalid-document')} onClick={() => void save()}>{t.save}</Button>
        <p role="status">{busy ? t.saving : dirty ? t.unsaved : t.saved}</p>
      </> : <p>{t.empty}</p>}
      <Button onClick={() => change(() => { void reload(); }, true)}>{t.retry}</Button>
    </fieldset>
    {failure && <p role="alert">{{ 'revision-conflict': t.conflict, 'storage-uncertain': t.restart, closed: t.closed, 'invalid-document': t.invalid, 'unknown-outcome': t.saveFailed, 'read-failed': t.readFailed }[failure]}</p>}
    {pending && <div role="alert"><p>{pending.reload ? t.reloadConfirm : t.discard}</p>
      <Button onClick={() => { const action = pending.action; setPending(null); action(); }}>{t.confirm}</Button>
      <Button onClick={() => setPending(null)}>{t.cancel}</Button>
    </div>}
  </section>;
}
