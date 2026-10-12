import { Button, StudioSurface } from './ui.tsx';
/** Read-only Agents view. Cycle guidance uses the implementer record and current review operation; absent legacy policy stays unknown. Loading and navigation never admit child work. */
import React from 'react';
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client';
import type { Context } from '@deepseek-ai/cordis';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client';
import type { DelegationRecord } from '@local/dsh-studio-roles/types';
import { ContextHistory, type HistoryClient } from './context-history.tsx';
import { agentsLocales } from './agents-locales.ts';
const NS = 'studio.agents';
interface Injected {
  selectedId: SessionId;
  historyClient: HistoryClient;
  load: () => Promise<DelegationRecord[]>;
  open: (target: SessionId | import('@deepseek-ai/dsh-subagent/client').SubagentAddress) => void;
}
function CycleStatus({ row, rows, t }: { row: DelegationRecord; rows: DelegationRecord[] } & PropsLocale<'studio.agents'>) {
  const cycle = rows.find(item => item.cycleId === row.cycleId && item.role === 'implementer');
  const reviewer = rows.find(item => item.cycleId === row.cycleId && item.role === 'reviewer');
  const phase = cycle?.cyclePhase;
  const currentReview = reviewer?.operationId === cycle?.cycleOperation ? reviewer : undefined;
  let next: keyof typeof agentsLocales.en = 'nextUnavailable';
  const stop = cycle?.stop ?? row.stop;
  if (stop) next = stop.status === 'requested' ? 'nextStopRequested' : stop.status === 'confirmed' ? 'nextStopped' : 'nextStopUnknown';
  else if (cycle?.state === 'unknown' || cycle?.state === 'failed' || cycle?.state === 'interrupted' || phase === 'unknown') next = 'nextUnknown';
  else if (phase === 'complete') next = 'nextComplete';
  else if (phase === 'implementation' || phase === 'review') next = 'nextWait';
  else if (phase === 'review-ready') next = 'nextReview';
  else if (phase === 'judged' && cycle?.reworkCap !== undefined) {
    if (!currentReview?.judgment || currentReview.state !== 'completed') next = 'nextUnknown';
    else if (currentReview.judgment.judgment === 'pass' && currentReview.judgment.additionalVerification.length === 0) next = cycle.reworkCount < cycle.reworkCap ? 'nextCompleteOrRework' : 'nextExplicitComplete';
    else next = cycle.reworkCount < cycle.reworkCap ? 'nextRework' : 'nextCap';
  }
  return <section aria-label={t('cycleStatus')}>
    <dl>
      <dt>{t('phase')}</dt><dd>{t(phase === undefined ? 'phaseUnavailable' : `phase-${phase}`)}</dd>
      <dt>{t('usage')}</dt><dd>{cycle ? `${cycle.reworkCount} / ${cycle.reworkCap === undefined ? t('capUnavailable') : cycle.reworkCap}` : t('phaseUnavailable')}</dd>
      <dt>{t('next')}</dt><dd>{t(next)}</dd>
    </dl>
  </section>;
}
function RecoveryStatus({ row, t }: { row: DelegationRecord } & PropsLocale<'studio.agents'>) {
  const uncertain = row.state === 'unknown' || row.state === 'failed' || row.state === 'interrupted';
  if (!row.stop && !row.diagnostic && !uncertain) return null;
  return <section aria-label={t('recoveryStatus')}>
    {row.stop && <section aria-label={t('stopStatus')}>
      <p>{t(`stop-${row.stop.status}`)}</p>
      <dl><dt>{t('stopRequestedAt')}</dt><dd>{new Date(row.stop.requestedAt).toISOString()}</dd></dl>
    </section>}
    {(uncertain || row.diagnostic) && <p role="alert">{row.diagnostic === 'studio-review-invalid-result' ? t('invalidReview') : t(row.state === 'unknown' ? 'recoveryUnknown' : 'recoveryFailure')}</p>}
    <p>{t('recoveryNext')}</p>
    <dl>
      {row.lastConfirmedState !== undefined && <><dt>{t('lastConfirmed')}</dt><dd>{t(row.lastConfirmedState)}</dd></>}
      <dt>{t('parentIdentity')}</dt><dd>{row.parentId}</dd>
      <dt>{t('childIdentity')}</dt><dd>{row.childId}</dd>
      <dt>{t('messageIdentity')}</dt><dd>{row.messageId ?? t('phaseUnavailable')}</dd>
      {row.reconciledMessageId !== undefined && <><dt>{t('reconciledMessageIdentity')}</dt><dd>{row.reconciledMessageId}</dd></>}
      {row.diagnostic && <><dt>{t('diagnostic')}</dt><dd><code>{row.diagnostic}</code></dd></>}
    </dl>
  </section>;
}
function CapturedDetails({ row, t }: { row: DelegationRecord } & PropsLocale<'studio.agents'>) {
  const [expanded, setExpanded] = React.useState(false);
  return <div><Button aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{t(expanded ? 'capturedHide' : 'capturedShow')}</Button>
    {expanded && <>
      <p>{t('capturedSettings')}</p>
      <dl>
        <dt>{t('cycle')}</dt><dd>{row.cycleId}</dd><dt>{t('operation')}</dt><dd>{row.operationId}</dd>
        <dt>{t('snapshot')}</dt><dd>{row.snapshotId}</dd>
        <dt>{t('requested')}</dt><dd>{row.settings.provider} / {row.settings.model} / {row.settings.reasoningEffort ?? t('defaultEffort')}</dd>
        <dt>{t('observed')}</dt><dd>{row.observed ? `${row.observed.provider} / ${row.observed.model} / ${row.observed.reasoningEffort ?? t('defaultEffort')}` : t('unobserved')}</dd>
        <dt>{t('instructions')}</dt><dd><pre>{row.settings.instructions}</pre></dd>
        <dt>{t('task')}</dt><dd><pre>{row.prompt}</pre></dd>
      </dl>
      {row.output && <pre>{row.output}</pre>}
    </>}
  </div>;
}
function AgentsView({ selectedId, load, open, historyClient, t }: ConvViewProps & Injected & PropsLocale<'studio.agents'>) {
  const [loaded, setLoaded] = React.useState<{ id: SessionId; rows: DelegationRecord[] }>();
  const rows = loaded?.id === selectedId ? loaded.rows : [];
  const [failed, setFailed] = React.useState<SessionId>();
  const [loading, setLoading] = React.useState(true);
  const [revision, reload] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(undefined);
    void load().then(value => { if (active) { setLoaded({ id: selectedId, rows: value }); setLoading(false); } }, () => { if (active) { setLoaded(undefined); setFailed(selectedId); setLoading(false); } });
    return () => { active = false; };
  }, [selectedId, load, revision]);
  return <StudioSurface><section className="studio-agents" aria-label={t('title')}>
    <p>{t('shared')}</p><Button onClick={reload}>{t('reload')}</Button>
    {failed === selectedId ? <p role="alert">{t('unavailable')}</p> : loading || loaded?.id !== selectedId ? <p role="status">{t('loading')}</p> : rows.length === 0 ? <p>{t('empty')}</p> : rows.map(row => <article key={row.childId}>
      <h2>{t(row.role)}</h2><p>{t(row.context)}</p><p>{row.settings.provider} / {row.settings.model}</p>
      <dl><dt>{t('activation')}</dt><dd>{t(row.state)}</dd></dl>
      <CycleStatus row={row} rows={rows} t={t} />
      {row.role === 'implementer' && <p>{t(row.cycleCompletedAt === undefined ? 'cycleOpen' : 'cycleComplete')}</p>}
      {row.role === 'reviewer' && <section aria-label={t('judgment')}>
        <p>{row.judgment ? t(row.judgment.judgment) : t('noJudgment')}</p>
        {row.judgment && <><p>{row.judgment.explanation}</p><ul>{row.judgment.evidence.map((item, index) => <li key={index}>{item}</li>)}</ul>
          {row.judgment.additionalVerification.length > 0 && <><h3>{t('verification')}</h3><ul>{row.judgment.additionalVerification.map((item, index) => <li key={index}>{item}</li>)}</ul></>}
        </>}
      </section>}
      <Button onClick={() => open(row.parentId)}>{t('parent')}</Button> <Button onClick={() => open({ parentSessionId: row.parentId, childSessionId: row.childId, mode: 'continuable' })}>{t(row.role === 'reviewer' ? 'reviewChild' : 'child')}</Button>
      <CapturedDetails row={row} t={t} />
      <ContextHistory client={historyClient} row={row} t={t} />
      <RecoveryStatus row={row} t={t} />
    </article>)}
  </section></StudioSurface>;
}
/** Register a Conversation View beside Trajectory, never a sidebar replacement.
 * @param ctx Ready roles Remote and conversation/navigation Client context.
 */
export function registerAgentsView(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, agentsLocales));
  const t = ctx.locale.bind(NS);
  const historyClient: HistoryClient = { sessions: ctx.sessions, connection: ctx.get('connection') as ConnectionHandle };
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view', id: 'studio-agents', order: 20, locale: NS, label: () => t('title'),
    inject: (selectedId: SessionId): Injected => ({
      selectedId, historyClient,
      load: async () => {
        const response = await ctx.remote.studioRoles.agents(selectedId);
        if (!response.ok) throw response.error;
        return response.value;
      },
      open: id => ctx.uiWorkspace.openSession(id),
    }),
  }, AgentsView));
}
