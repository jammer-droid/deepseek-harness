/** Application state never replaces the editor's local document. */
import React from 'react';
import type { ApplicationState, ApplyRequest, SavedDraft, WorkflowDiagnostic } from '@local/dsh-studio-workflows/types';
import { Button, Notice } from './ui.tsx';

import { workflowText } from './workflow-locales.ts';
import { applyText } from './workflow-apply-locales.ts';
export interface ApplicationApi {
  applyDraft(request: ApplyRequest): Promise<ApplicationState>;
  applications(): Promise<ApplicationState[]>;
  subscribeConnection(listener: (connected: boolean) => void): () => void;
}
export function WorkflowApply({ api, saved, dirty, disabled, locale, Modal }: { api: ApplicationApi; saved: SavedDraft; dirty: boolean; disabled: boolean; locale: string; Modal: React.ComponentType<React.PropsWithChildren<{ open: boolean; onClose: () => void; title: string; closeLabel: string }>> }) {
  const t = applyText(locale);
  const [state, setState] = React.useState<ApplicationState | null>(null);
  const [known, setKnown] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [diagnostics, setDiagnostics] = React.useState<WorkflowDiagnostic[]>([]);
  const [frozen, setFrozen] = React.useState(false);
  const epoch = React.useRef(0);
  async function query() {
    const current = ++epoch.current;
    setBusy(true);
    try {
      const all = await api.applications();
      if (epoch.current !== current) return;
      setState(all.find(item => item.applied.id === saved.id) ?? null); setKnown(true); setProblem(null); setFrozen(false);
    } catch { if (epoch.current === current) { setKnown(false); setProblem(t.failure); } }
    finally { if (epoch.current === current) setBusy(false); }
  }
  React.useEffect(() => {
    void query();
    const dispose = api.subscribeConnection(connected => { ++epoch.current; setKnown(false); setBusy(false); if (connected) void query(); });
    return () => { ++epoch.current; dispose(); };
  }, [api, saved.id]);
  async function apply() {
    setConfirm(false);
    if (disabled || dirty || !saved.revision || !known || busy || frozen) return;
    setBusy(true);
    const current = ++epoch.current;
    try {
      const result = await api.applyDraft({ id: saved.id, draftRevision: saved.revision, expectedRevision: state?.applied.revision ?? 0 });
      if (epoch.current === current) { setState(result); setKnown(true); setProblem(null); setFrozen(false); }
    } catch (error) {
      if (epoch.current !== current) return;
      const reason = (error as { code?: string; details?: { reason?: string } })?.code === 'studio-workflows/rejected' ? (error as { details?: { reason?: string } }).details?.reason : undefined;
      setDiagnostics((error as { details?: { diagnostics?: WorkflowDiagnostic[] } })?.details?.diagnostics ?? []);
      setKnown(false);
      setProblem(reason === 'storage-uncertain' ? t.storage : reason === 'revision-conflict' ? t.conflict : reason === 'catalog-changed' ? t.changed : reason === 'validation-failed' || reason === 'unsupported-adapter' || reason === 'invalid-request' ? t.invalid : t.unknown);
      if (reason === 'storage-uncertain') setFrozen(true);
    } finally { if (epoch.current === current) setBusy(false); }
  }
  return <section>
    <Button disabled={disabled || dirty || !saved.revision || !known || busy || frozen} onClick={() => setConfirm(true)}>{t.apply}</Button>
    <Button disabled={busy} onClick={() => void query()}>{t.query}</Button>
    {dirty && <p>{t.dirty}</p>}
    {problem && <Notice>{problem}</Notice>}
    {problem && diagnostics.map((item, index) => <Notice key={index}>{workflowText(locale).diagnostics[item.code]} {item.target.roleId} {item.target.instanceId} {item.target.fieldPath}</Notice>)}
    {!known && !problem && <p role="status">{t.unknown}</p>}
    {state && known ? <div role="status">
      <p>{state.experiments === 'targeted' ? t.targeted : state.experiments === 'not-targeted' ? t.notTargeted : t.experimentsUnknown}</p>
      <p>{t.revision}: {state.applied.revision} · {t.draft}: {state.applied.draftRevision}</p>
      <p>{state.activation === 'active' ? t.active : state.activation === 'failed' ? t.failed : t.inactive}</p>
      {state.diagnostic && <Notice>{state.diagnostic}</Notice>}
      {state.observations.map(item => <p key={`${item.sessionId}:${item.revision}`}>{t.revision}: {item.revision} · {item.sessionId} · {item.matches ? t.match : t.mismatch} ({item.actual.provider}/{item.actual.model}{item.actual.reasoningEffort ? ` · ${item.actual.reasoningEffort}` : ''})</p>)}
    </div> : known && <p>{t.empty}</p>}
    <Modal open={confirm} onClose={() => setConfirm(false)} title={t.title} closeLabel={t.cancel}>
      <p>{t.notice}</p><Button onClick={() => setConfirm(false)}>{t.cancel}</Button><Button primary onClick={() => void apply()}>{t.confirm}</Button>
    </Modal>
  </section>;
}
