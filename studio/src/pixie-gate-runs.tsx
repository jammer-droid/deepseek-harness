import React from 'react';
import type { GateRun, GateRunFrame, GateRunRecord } from './pixie-gate-contracts.ts';
import { gateText, gatePointText, type GateTextKey } from './pixie-gate-locale.ts';
import { GateResultDetails } from './pixie-gate-result.tsx';
import { Badge, Button, IconButton, SectionHead, Notice, Note } from './ui.tsx';

export interface GateRunActions {
  gateRuns(): Promise<GateRunRecord>;
  followGates(listener: (frame: GateRunFrame) => void): () => void;
  resolveGateRejection(runId: string, status: 'resent' | 'dismissed'): Promise<unknown>;
  fillDraft(text: string): void;
}

/** Applied is authoritative; lifecycle states only override when no action was applied. */
export function gateRunStatus(run: GateRun): GateTextKey {
  return run.applied !== 'none' ? run.applied : run.status === 'done' ? 'none' : run.status;
}

export function GateRunsPanel({ actions, locale }: { actions: GateRunActions; locale: string }) {
  const t = (key: GateTextKey) => gateText(locale, key);
  const [runs, setRuns] = React.useState<GateRun[]>([]);
  const [openId, setOpenId] = React.useState<string>();
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    let generation = 0;
    // Run frames arriving during a snapshot read must win over that older snapshot.
    let updates = new Map<string, GateRun>();
    const refresh = async () => {
      const request = ++generation;
      updates = new Map();
      try {
        const record = await actions.gateRuns();
        if (!active || request !== generation) return;
        const merged = new Map(record.runs.map(run => [run.id, run]));
        for (const [id, run] of updates) merged.set(id, run);
        setRuns([...merged.values()]); setError('');
      } catch (cause) { if (active && request === generation) setError(String(cause)); }
    };
    const stop = actions.followGates(frame => {
      if (!active) return;
      if (frame.type === 'sync') { void refresh(); return; }
      updates.set(frame.run.id, frame.run);
      setRuns(current => [...current.filter(run => run.id !== frame.run.id), frame.run]);
    });
    void refresh();
    return () => { active = false; stop(); };
  }, [actions]);
  const sorted = [...runs].sort((a, b) => Number(b.rejection?.status === 'pending') - Number(a.rejection?.status === 'pending') || b.startedAt - a.startedAt);
  const opened = sorted.find(run => run.id === openId);
  const shown = opened ?? sorted[0];
  const badges = (run: GateRun) => <><Badge tone={run.rejection?.status === 'pending' || run.status === 'error' ? 'warning' : 'neutral'}>{t(run.rejection?.status === 'pending' ? 'pending' : gateRunStatus(run))}</Badge></>;
  const resolve = async (run: GateRun, status: 'resent' | 'dismissed') => {
    setBusy(true); setError('');
    try {
      await actions.resolveGateRejection(run.id, status);
      setRuns(current => current.map(item => item.id === run.id && item.rejection ? { ...item, rejection: { ...item.rejection, status } } : item));
    } catch (cause) { setError(String(cause)); }
    finally { setBusy(false); }
  };
  return <div className="studio-pixie-chat">
    {error && <Notice>{error}</Notice>}
    {!runs.length && <Note>{t('emptyRuns')}</Note>}
    <div className="studio-pixie-threads" data-open={opened ? 'true' : 'false'}>
      <div className="studio-pixie-list">
        <div className="studio-pixie-list-head"><span className="studio-pixie-list-title">{t('allRuns')}<span className="studio-count">{runs.length}</span></span></div>
        <ul className="studio-pixie-thread-list">{sorted.map(run => <li key={run.id}>
          <button type="button" className="studio-pixie-thread" aria-current={shown?.id === run.id ? 'true' : undefined} onClick={() => setOpenId(run.id)}>
            <span className="studio-card-head"><strong>{run.gateName}</strong>{badges(run)}</span>
            <span className="studio-card-meta">{gatePointText(locale, run.point)} · {Number.isFinite(run.startedAt) && run.startedAt > 0 && Number.isFinite(new Date(run.startedAt).getTime()) ? new Date(run.startedAt).toLocaleString(locale) : '—'}</span>
            <span className="studio-pixie-thread-preview">{run.original}</span>
            {run.hooksInput === 'unverified' && <span className="studio-card-meta">{t('unverified')}</span>}
          </button>
        </li>)}</ul>
      </div>
      {shown && <div className="studio-pixie-detail">
        <div className="studio-pixie-detail-head"><span className="studio-pixie-back"><IconButton label={t('allRuns')} onClick={() => setOpenId(undefined)}><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg></IconButton></span><strong>{shown.gateName}</strong>{badges(shown)}</div>
        <p className="studio-card-meta">{gatePointText(locale, shown.point)} · {t('applied')}: {t(shown.applied)}{shown.hooksInput === 'unverified' ? ` · ${t('unverified')}` : ''}</p>
        {shown.reason && <p className="studio-pixie-answer">{t('reason')}: {shown.reason}</p>}
        {shown.point === 'turn-end' && <p className="studio-card-meta">{t('turn')}: {shown.turn ?? '—'} · {t('steerCount')}: {shown.steerCount ?? '—'}</p>}
        {shown.point.startsWith('tool-') && shown.tool && <p className="studio-card-meta">{t('tool')}: {shown.tool.name} · {t('callId')}: {shown.tool.callId}</p>}
        {shown.rejection && <section>
          <section><SectionHead title={t('original')} /><p className="studio-pixie-answer">{shown.rejection.original}</p></section>
          <section><SectionHead title={t('reason')} /><p className="studio-pixie-answer">{shown.rejection.reason}</p></section>
          {shown.rejection.suggestion && <section><SectionHead title={t('suggestion')} /><p className="studio-pixie-answer">{shown.rejection.suggestion}</p></section>}
          {shown.rejection.status === 'pending' && <><Note>{t('draftNote')}</Note><div className="studio-inline-actions">
            <Button small disabled={busy} onClick={() => { try { actions.fillDraft(shown.rejection!.suggestion ?? shown.rejection!.original); setError(''); } catch { setError(t('composerUnavailable')); } }}>{t('editSend')}</Button>
            <Button small disabled={busy} onClick={() => { void resolve(shown, 'resent'); }}>{t('resent')}</Button>
            <Button small disabled={busy} onClick={() => { void resolve(shown, 'dismissed'); }}>{t('dismissed')}</Button>
          </div></>}
        </section>}
        {shown.result ? <GateResultDetails result={shown.result} locale={locale} /> : <p className="studio-pixie-answer">{shown.original}</p>}
      </div>}
    </div>
  </div>;
}
