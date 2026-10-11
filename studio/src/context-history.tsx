/** Read-only child Session evidence. Each expanded view owns and releases one Client reference. */
import React from 'react';
import type {} from '@deepseek-ai/dsh-compaction/types';
import type { Context } from '@deepseek-ai/cordis';
import type { SessionBinding, SessionReference, SessionEventLikeEntry } from '@deepseek-ai/dsh-api-session-controller/client';
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { DelegationRecord } from '@local/dsh-studio-roles/types';

declare module '@deepseek-ai/dsh-api-session-controller/client' {
  interface SessionReferenceSourceMap { studioContextHistory: unknown }
}
/** Read-only Session and connection dependencies; no admission operations are exposed. */
export type HistoryClient = Pick<Context, 'sessions'> & { connection: ConnectionHandle };
type Locale = PropsLocale<'studio.agents'>;

function eventContent(entry: SessionEventLikeEntry): string {
  const event = entry.event;
  switch (event.type) {
    case 'user/message': return JSON.stringify({ role: event.data.role, content: event.data.content.filter(block => block.type === 'text') }, null, 2);
    case 'assistant/message':
    case 'system/message':
    case 'developer/message': return JSON.stringify({ role: event.data.message.role, content: event.data.message.content.filter(block => block.type === 'text') }, null, 2);
    case 'compaction/summary': return JSON.stringify({ summary: event.data.summary.filter(block => block.type === 'text'), shadowedRange: event.data.shadowedRange }, null, 2);
    case 'compaction/prune':
    case 'tool/call':
    case 'tool/result': return JSON.stringify(event.data, null, 2);
    default: return JSON.stringify({ type: event.type, seq: event.seq, time: event.time }, null, 2);
  }
}
function EventContent({ entry, row, initialSeq, finalResponse, t }: { entry: SessionEventLikeEntry; row: DelegationRecord; initialSeq: number | undefined; finalResponse: boolean } & Locale) {
  const event = entry.event;
  const [showContent, setShowContent] = React.useState(false);
  const inherited = row.context === 'fork' && row.inheritedEventCount !== undefined && event.seq < row.inheritedEventCount;
  const category = event.type === 'user/message' && ['user', 'agent-message'].includes(event.data.source.kind) ? (event.seq === initialSeq ? 'historyInput' : initialSeq === undefined ? 'historyUser' : 'historyFollowup')
    : event.type === 'tool/call' ? 'historyToolCall' : event.type === 'tool/result' ? 'historyToolResult'
      : event.type === 'assistant/message' ? (finalResponse ? 'historyFinal' : 'historyResponse') : event.type.startsWith('compaction/') ? 'historyCompacted' : 'historyEvent';
  return <li data-context-event={event.seq}>
    <p>{inherited ? `${t('historyInherited')} · ` : ''}{t(inherited && event.type === 'user/message' ? 'historyEvent' : category)} · {event.type} · {event.seq}</p>
    <button aria-expanded={showContent} onClick={() => setShowContent(!showContent)}>{t(showContent ? 'historyHideContent' : 'historyShowContent')}</button>
    {showContent && <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{eventContent(entry)}</pre>}
  </li>;
}
function isFinalResponse(entry: SessionEventLikeEntry, entries: readonly SessionEventLikeEntry[]): boolean {
  const event = entry.event;
  if (event.type !== 'assistant/message') return false;
  const later = entries.filter(candidate => candidate.event.seq > event.seq);
  return later.some(candidate => candidate.event.type === 'turn/end' && candidate.event.data.turn === event.data.turn && candidate.event.data.reason.kind === 'completed')
    && !later.some(candidate => candidate.event.type === 'assistant/message' && candidate.event.data.turn === event.data.turn);
}
function LoadedHistory({ binding, row, t }: { binding: SessionBinding; row: DelegationRecord } & Locale) {
  const session = React.useSyncExternalStore(listener => binding.session.subscribe(listener), () => binding.session.getSnapshot());
  const events = React.useSyncExternalStore(listener => binding.eventSource.subscribe(listener), () => binding.eventSource.getSnapshot());
  const [endSeq, setEndSeq] = React.useState<number>(Infinity);
  const [pagingFailed, setPagingFailed] = React.useState(false);
  const entries = events.entries.filter(entry => entry.type === 'event');
  const inheritedCount = row.inheritedEventCount ?? (row.context === 'fresh' ? 0 : undefined);
  const initialSeq = inheritedCount !== undefined && (!events.hasMore || (entries[0]?.event.seq ?? Infinity) <= inheritedCount) ? entries.find(entry => entry.event.seq >= inheritedCount && entry.event.type === 'user/message' && entry.event.data.source.kind === 'user')?.event.seq : undefined;
  const end = endSeq === Infinity ? entries.length : entries.findIndex(entry => entry.event.seq > endSeq);
  const endIndex = end < 0 ? entries.length : end;
  const start = Math.max(0, endIndex - 1);
  const visible = entries.slice(start, endIndex);
  const code = session.openError?.code;
  const failure = session.removed ? 'historyRemoved' : code === 'subagent/unauthorized' ? 'historyDenied'
    : code === 'session/not-found' || code === 'subagent/not-found' ? 'historyMissing' : 'historyUnavailable';
  const previous = async () => {
    setPagingFailed(false);
    if (start === 0 && events.hasMore) {
      try { await binding.session.loadOlder(); } catch (error) { /* Retain visible history after an unexpected paging failure. */ setPagingFailed(true); }
    }
    if (visible[0] && binding.eventSource.getSnapshot().entries.some(entry => entry.type === 'event' && entry.event.seq < visible[0]!.event.seq)) setEndSeq(visible[0].event.seq - 1);
  };
  return <>
    {session.openState === 'loading' || session.openState === 'cold' || session.loadingOlder ? <p role="status">{t('historyLoading')}</p> : null}
    {(session.removed || session.openState === 'error' || pagingFailed) && <p role="alert">{t(failure)}</p>}
    {entries.length > 0 && (events.hasMore || session.openState === 'error' || pagingFailed) && <p>{t('historyPartial')}</p>}
    {entries.length === 0 && session.openState === 'open' && <p>{t('historyEmpty')}</p>}
    <ol>{visible.map(entry => <EventContent key={entry.event.seq} entry={entry} row={row} initialSeq={initialSeq} finalResponse={isFinalResponse(entry, entries)} t={t} />)}</ol>
    <nav aria-label={t('historyPages')}>
      <button disabled={session.loadingOlder || (start === 0 && !events.hasMore)} onClick={() => void previous()}>{t('historyOlder')}</button>
      <button disabled={endIndex >= entries.length} onClick={() => setEndSeq(entries[Math.min(entries.length, endIndex + 1) - 1]!.event.seq)}>{t('historyNewer')}</button>
      <button disabled={endSeq === Infinity} onClick={() => setEndSeq(Infinity)}>{t('historyLatest')}</button>
    </nav>
  </>;
}
function RetainedHistory({ client, row, t }: { client: HistoryClient; row: DelegationRecord } & Locale) {
  const [binding, setBinding] = React.useState<SessionBinding>();
  const [failed, setFailed] = React.useState(false);
  const [revision, retry] = React.useReducer((value: number) => value + 1, 0);
  const connection = React.useSyncExternalStore(client.connection.state.subscribe, client.connection.state.getSnapshot);
  React.useEffect(() => {
    let active = true;
    let reference: SessionReference | undefined;
    setBinding(undefined); setFailed(false);
    try {
      reference = client.sessions.retain({ parentSessionId: row.parentId, childSessionId: row.childId, mode: 'continuable' }, { source: 'studioContextHistory' });
      setBinding(reference.binding);
      void reference.ready.catch(() => { if (active) setFailed(true); });
    } catch (error) { /* Acquisition failed before a reference became available. */ setFailed(true); }
    return () => { active = false; reference?.release(); };
  }, [client, row.parentId, row.childId, revision]);
  return <section aria-label={t('history')}>
    <p>{t('historyExport')}</p>
    {row.context === 'fork' && row.inheritedEventCount === undefined && <p>{t('historyBoundaryUnknown')}</p>}
    {connection !== 'connected' && <p role="status">{t('historyDisconnected')}</p>}
    {failed && <p role="alert">{t('historyUnavailable')}</p>}
    {binding ? <LoadedHistory key={`${row.childId}:${revision}`} binding={binding} row={row} t={t} /> : !failed && <p role="status">{t('historyLoading')}</p>}
    <button onClick={retry}>{t('historyRetry')}</button>
  </section>;
}
/** Expand evidence on demand; collapsing releases history without waking a child.
 * @param props Authorized child address, Client services and locale.
 * @returns Collapsed-by-default Session evidence explorer.
 */
export function ContextHistory(props: { client: HistoryClient; row: DelegationRecord } & Locale) {
  const [expanded, setExpanded] = React.useState(false);
  return <div><button aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{props.t(expanded ? 'historyHide' : 'historyShow')}</button>
    {expanded && <RetainedHistory {...props} />}
  </div>;
}
