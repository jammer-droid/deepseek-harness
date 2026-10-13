/** Draft selection and explicit persistence; never invokes preset application. */
import React from 'react';
import { WorkflowForms } from './workflow-forms.tsx';
import type { ApplicationApi } from './workflow-apply.tsx';
import type { CatalogSnapshot, ValidationResult, DraftId, SavedDraft, SaveDraftRequest, WorkflowDocument, RoleId, ModelCatalog } from '@local/dsh-studio-workflows/types';
import { workflowText } from './workflow-locales.ts';
import { Button } from './ui.tsx';
import { workflowFailure, type WorkflowFailure } from './workflow-failures.ts';

/** User operations projected from the generated workflow Remote. */
export interface WorkflowApi extends Partial<Pick<ApplicationApi, 'applyDraft' | 'applications'>> {
  drafts(): Promise<SavedDraft[]>;
  save(request: SaveDraftRequest): Promise<SavedDraft>;
  models(): Promise<ModelCatalog>;
  catalog(): Promise<CatalogSnapshot>;
  validate(document: WorkflowDocument): Promise<ValidationResult>;
  subscribeConnection(listener: (connected: boolean) => void): () => void;
}

/** @param props Initial confirmed drafts and declarations with explicit persistence operations.
 * @returns Multiple-draft editor retaining local edits until save or confirmed discard.
 */
export function WorkflowEditor({ locale, initialDrafts, api, visible = true, renderApplication }: {
  locale: string; initialDrafts: SavedDraft[]; api: WorkflowApi; visible?: boolean;
  renderApplication?: (saved: SavedDraft, dirty: boolean, disabled: boolean) => React.ReactNode;
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
    const roleId = crypto.randomUUID() as RoleId;
    change(() => select({ id: crypto.randomUUID() as DraftId, revision: 0, document: { documentVersion: 3, name: '', mainRoleId: roleId, roles: [{ id: roleId, name: '', components: [] }], systems: [], connections: [] } }));
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
  const [models, setModels] = React.useState<ModelCatalog>({ status: 'unavailable', providers: [] });
  const [catalog, setCatalog] = React.useState<CatalogSnapshot>({ revision: 0, components: [], systems: [] });
  const [availability, setAvailability] = React.useState<'checking' | 'ready' | 'unknown'>('checking');
  const [refresh, setRefresh] = React.useState(0);
  const [decision, setDecision] = React.useState<{ document: WorkflowDocument; result: ValidationResult } | null>(null);
  const validation = decision?.document === document ? decision.result : null;
  const setValidation = (result: ValidationResult | null) => setDecision(result && document ? { document, result } : null);
  const [validationFailed, setValidationFailed] = React.useState(false);
  const catalogEpoch = React.useRef(0);
  const minimumRevision = React.useRef(0);
  const validationEpoch = React.useRef(0);
  React.useEffect(() => {
    if (!visible) { setAvailability('unknown'); setValidation(null); return; }
    let mounted = true;
    async function load() {
      const epoch = ++catalogEpoch.current;
      ++validationEpoch.current;
      setAvailability('checking'); setValidation(null);
      try {
        const [next, nextModels] = await Promise.all([api.catalog(), api.models()]);
        if (!mounted || epoch !== catalogEpoch.current) return;
        if (next.revision < minimumRevision.current) { setAvailability('unknown'); return; }
        minimumRevision.current = next.revision;
        setCatalog(next); setModels(nextModels); setAvailability('ready');
      } catch (error) { if (mounted && epoch === catalogEpoch.current) setAvailability('unknown'); }
    }
    const stopConnection = api.subscribeConnection(connected => {
      ++catalogEpoch.current; ++validationEpoch.current; minimumRevision.current = 0; setValidation(null);
      if (connected) void load(); else setAvailability('unknown');
    });
    void load();
    return () => { mounted = false; ++catalogEpoch.current; ++validationEpoch.current; stopConnection(); };
  }, [api, refresh, visible]);
  React.useEffect(() => {
    const epoch = ++validationEpoch.current;
    setValidation(null); setValidationFailed(false);
    if (!document || availability !== 'ready') return;
    void api.validate(document).then(result => {
      if (epoch !== validationEpoch.current) return;
      if (result.catalogRevision !== catalog.revision) { setAvailability('unknown'); return; }
      setValidation(result);
    }, () => { if (epoch === validationEpoch.current) setValidationFailed(true); });
    return () => { ++validationEpoch.current; };
  }, [api, document, catalog, availability]);
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
        <WorkflowForms key={selected.id} document={document} catalog={catalog} models={models} enabled={availability === 'ready'} diagnostics={validation?.diagnostics ?? []} locale={locale} onChange={setDocument} />
        <p aria-live="polite">{availability !== 'ready' ? availability === 'checking' ? t.checking : t.availabilityUnknown : validationFailed ? t.validationFailed : validation ? validation.valid ? t.valid : t.invalidConfiguration : t.checking}</p>
        <Button primary disabled={!dirty || (failure !== null && failure !== 'invalid-document')} onClick={() => void save()}>{t.save}</Button>
        <p role="status">{busy ? t.saving : dirty ? t.unsaved : t.saved}</p>
      </> : <p>{t.empty}</p>}
      <Button onClick={() => setRefresh(value => value + 1)}>{t.refresh}</Button>
      <Button onClick={() => change(() => { void reload(); }, true)}>{t.retry}</Button>
    </fieldset>
    {selected && renderApplication?.(selected, dirty, busy || failure !== null || pending !== null)}
    {failure && <p role="alert">{{ 'revision-conflict': t.conflict, 'storage-uncertain': t.restart, closed: t.closed, 'invalid-document': t.invalid, 'unknown-outcome': t.saveFailed, 'read-failed': t.readFailed }[failure]}</p>}
    {pending && <div role="alert"><p>{pending.reload ? t.reloadConfirm : t.discard}</p>
      <Button onClick={() => { const action = pending.action; setPending(null); action(); }}>{t.confirm}</Button>
      <Button onClick={() => setPending(null)}>{t.cancel}</Button>
    </div>}
  </section>;
}
