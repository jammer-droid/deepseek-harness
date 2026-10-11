/** Read-only Agents view. Loading and navigation never admit child work. */
import React from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client';
import type { DelegationRecord } from '@local/dsh-studio-roles/types';
import { agentsLocales } from './agents-locales.ts';
const NS = 'studio.agents';
interface Injected {
  selectedId: SessionId;
  load: () => Promise<DelegationRecord[]>;
  open: (target: SessionId | import('@deepseek-ai/dsh-subagent/client').SubagentAddress) => void;
}
function AgentsView({ selectedId, load, open, t }: ConvViewProps & Injected & PropsLocale<'studio.agents'>) {
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
  return <section aria-label={t('title')}>
    <p>{t('shared')}</p><button onClick={reload}>{t('reload')}</button>
    {failed === selectedId ? <p role="alert">{t('unavailable')}</p> : loading || loaded?.id !== selectedId ? <p role="status">{t('loading')}</p> : rows.length === 0 ? <p>{t('empty')}</p> : rows.map(row => <article key={row.childId}>
      <h2>{t('implementer')}</h2><p>{t('fresh')}</p><p>{t(row.state)}</p>
      <button onClick={() => open(row.parentId)}>{t('parent')}</button> <button onClick={() => open({ parentSessionId: row.parentId, childSessionId: row.childId, mode: 'continuable' })}>{t('child')}</button>
      <dl>
        <dt>{t('cycle')}</dt><dd>{row.cycleId}</dd><dt>{t('operation')}</dt><dd>{row.operationId}</dd>
        <dt>{t('snapshot')}</dt><dd>{row.snapshotId}</dd>
        <dt>{t('requested')}</dt><dd>{row.settings.provider} / {row.settings.model} / {row.settings.reasoningEffort ?? t('defaultEffort')}</dd>
        <dt>{t('observed')}</dt><dd>{row.observed ? `${row.observed.provider} / ${row.observed.model} / ${row.observed.reasoningEffort ?? t('defaultEffort')}` : t('unobserved')}</dd>
        <dt>{t('instructions')}</dt><dd><pre>{row.settings.instructions}</pre></dd>
        <dt>{t('task')}</dt><dd><pre>{row.prompt}</pre></dd>
      </dl>
      {row.diagnostic && <p role="alert">{row.diagnostic}</p>}
      {row.output && <pre>{row.output}</pre>}
    </article>)}
  </section>;
}
/** Register a Conversation View beside Trajectory, never a sidebar replacement.
 * @param ctx Ready roles Remote and conversation/navigation Client context.
 */
export function registerAgentsView(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, agentsLocales));
  const t = ctx.locale.bind(NS);
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view', id: 'studio-agents', order: 20, locale: NS, label: () => t('title'),
    inject: (selectedId: SessionId): Injected => ({
      selectedId,
      load: async () => {
        const response = await ctx.remote.studioRoles.agents(selectedId);
        if (!response.ok) throw response.error;
        return response.value;
      },
      open: id => ctx.uiWorkspace.openSession(id),
    }),
  }, AgentsView));
}
