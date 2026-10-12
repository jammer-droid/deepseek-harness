/** Opt-in Studio replacement of the header catalog; core sidebar chat stays its owner. */
import React from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { SubagentAddress } from '@deepseek-ai/dsh-subagent/client';
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client';
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client';
import type {} from '@deepseek-ai/dsh-token-meter/client';
import type {} from './contracts.ts';
import { TYPERT_REMOTE } from '@local/dsh-studio-sub-agent-catalog/remote';
import type { CatalogAssignment, LaunchRequest, RoleChoice } from '@local/dsh-studio-sub-agent-catalog/types';
import { Menu, MenuItemButton, Modal } from './ui-host.tsx';
import { Button, Notice, StudioSurface } from './ui.tsx';
import { catalogText } from './catalog-locales.ts';
import { catalogRows } from './subagent-catalog-model.ts';

/** Client operations, independent of the Remote result envelope. */
export interface CatalogApi {
  assignments(parentId: SessionId): Promise<CatalogAssignment[]>;
  roles(): Promise<RoleChoice[]>;
  launch(request: LaunchRequest): Promise<{ childId: SessionId }>;
  refresh(parentId: SessionId): Promise<void>;
  open(address: SubagentAddress, aside: boolean): void;
}
type Runtime = PropsRuntime<'conversation.session.header.actions'>;
type Shared = Pick<Runtime, 'useSessions' | 'useSessionStatus'> & { api: CatalogApi; locale: string; close(): void; now: number };

function Branch({ parentId, ancestors, api, locale, close, now, useSessions, useSessionStatus }: Shared & { parentId: SessionId; ancestors: readonly SessionId[] }) {
  const t = catalogText(locale);
  const projection = useSessions(state => state.projectionsBySession[parentId]);
  const summaries = useSessions(state => state.byId);
  const statuses = useSessionStatus(state => state);
  const entries = projection?.values.subagentCatalog;
  const [expanded, setExpanded] = React.useState<ReadonlySet<SessionId>>(new Set());
  const [assignments, setAssignments] = React.useState<CatalogAssignment[]>([]);
  const [failed, setFailed] = React.useState(false);
  const [refreshFailed, setRefreshFailed] = React.useState(false);
  const [revision, reload] = React.useReducer((value: number) => value + 1, 0);
  const identities = entries?.map(entry => entry.id).join('\n');
  React.useEffect(() => {
    let active = true;
    setFailed(false);
    void api.assignments(parentId).then(rows => { if (active) { catalogRows(parentId, [], rows); setAssignments(rows); } }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [api, parentId, identities, revision]);
  React.useEffect(() => {
    let active = true;
    setRefreshFailed(false);
    void api.refresh(parentId).catch(() => { if (active) setRefreshFailed(true); });
    return () => { active = false; };
  }, [api, parentId, revision]);
  return <div className="studio-catalog-branch">
    {failed && <Notice>{t.metadataFailed}<Button small onClick={reload}>{t.retry}</Button></Notice>}
    {(refreshFailed || projection?.state === 'error') && <Notice>{t.failed}<Button small onClick={reload}>{t.retry}</Button></Notice>}
    {projection?.state === 'migration-required' && <p>{t.migration}</p>}
    {entries === undefined ? <p role="status">{t.loading}</p> : entries.length === 0 ? <p>{t.empty}</p> : catalogRows(parentId, entries, assignments).map(({ entry, assignment }) => {
      const summary = summaries[entry.id];
      const running = statuses.get(entry.id)?.running ?? summary?.running ?? false;
      const timing = summary?.projectionValues?.subagentTiming;
      const usage = summary?.projectionValues?.tokenUsage;
      const tokens = usage && usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
      const elapsed = timing && timing.settledMs + (timing.active ? Math.max(0, (running ? now : timing.active.through) - timing.active.since) : 0);
      const external = entry.mode === 'external';
      const address = external ? undefined : { parentSessionId: parentId, childSessionId: entry.id, mode: entry.mode };
      const canExpand = !external && !ancestors.includes(entry.id) && entry.id !== parentId;
      return <section key={entry.id} className="studio-catalog-row" aria-label={entry.label ?? entry.id}>
        <strong>{entry.label ?? entry.id}</strong>
        <div className="studio-catalog-meta">{[summary?.title, t[entry.mode], external ? undefined : running ? t.running : timing?.lastTurnCompleted ? t.completed : t.inactive].filter(Boolean).join(' · ')}</div>
        <div className="studio-catalog-meta">{[tokens === undefined ? undefined : `${tokens.toLocaleString(locale)} ${t.tokens}`, elapsed === undefined ? undefined : `${Math.floor(elapsed / 1000).toLocaleString(locale)} ${t.seconds}`].filter(Boolean).join(' · ')}</div>
        {assignment && <><p>{assignment.role.name} · {assignment.role.description}</p><p className="studio-catalog-task">{assignment.snapshot.task}</p><details><summary>{t.snapshot}</summary><dl>
          <dt>{t.revision}</dt><dd>{assignment.snapshot.revision}</dd><dt>{t.context}</dt><dd>{t[assignment.snapshot.context]}</dd>
          <dt>{t.instructions}</dt><dd><pre>{assignment.snapshot.instructions}</pre></dd>
          {assignment.snapshot.model && <><dt>{t.model}</dt><dd>{assignment.snapshot.model.provider} / {assignment.snapshot.model.model} / {assignment.snapshot.model.reasoningEffort}</dd></>}
          {assignment.snapshot.tools && <><dt>{t.tools}</dt><dd><pre>{JSON.stringify(assignment.snapshot.tools, null, 2)}</pre></dd></>}
        </dl><p>{t.disclosure}</p></details></>}
        {address && <><MenuItemButton onSelect={() => { api.open(address, false); close(); }}>{t.open}</MenuItemButton><MenuItemButton onSelect={() => { api.open(address, true); close(); }}>{t.aside}</MenuItemButton></>}
        {canExpand && <><button type="button" role="menuitem" className="studio-catalog-expand" aria-expanded={expanded.has(entry.id)} onClick={() => setExpanded(previous => { const next = new Set(previous); if (next.has(entry.id)) next.delete(entry.id); else next.add(entry.id); return next; })}>{t.children}</button>
          {expanded.has(entry.id) && <Branch parentId={entry.id} ancestors={[...ancestors, parentId]} {...{ api, locale, close, now, useSessions, useSessionStatus }} />}</>}
      </section>;
    })}
  </div>;
}

function LaunchDialog({ parentId, api, locale, close, uncertain }: { parentId: SessionId; api: CatalogApi; locale: string; close(): void; uncertain(): void }) {
  const t = catalogText(locale);
  const [roles, setRoles] = React.useState<RoleChoice[]>();
  const [selected, setSelected] = React.useState('');
  const [task, setTask] = React.useState('');
  const [context, setContext] = React.useState<'fresh' | 'fork'>('fresh');
  const [state, setState] = React.useState<'loading' | 'ready' | 'failed' | 'busy' | 'uncertain' | 'accepted'>('loading');
  const [childId, setChildId] = React.useState<SessionId>();
  const [revision, reload] = React.useReducer((value: number) => value + 1, 0);
  const alive = React.useRef(true);
  const submitting = React.useRef(false);
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  React.useEffect(() => {
    let active = true;
    setState('loading');
    void api.roles().then(rows => { if (active) { setRoles(rows); setSelected(rows[0]?.id ?? ''); setState('ready'); } }, () => { if (active) setState('failed'); });
    return () => { active = false; };
  }, [api, revision]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const role = roles?.find(row => row.id === selected);
    if (!role || !task.trim() || state !== 'ready' || submitting.current) return;
    submitting.current = true;
    setState('busy');
    try {
      const result = await api.launch({ parentId, roleId: role.id, revision: role.revision, task, context });
      if (alive.current) { setChildId(result.childId); setState('accepted'); }
    } catch { if (alive.current) { setState('uncertain'); uncertain(); } }
    finally { submitting.current = false; }
  }
  return <Modal open title={t.launch} closeLabel={t.close} onClose={() => { if (state !== 'busy') close(); }}><StudioSurface className="studio-catalog-launch">
    {state === 'loading' && <p role="status">{t.loading}</p>}
    {state === 'failed' && <Notice>{t.failed}<Button onClick={reload}>{t.retry}</Button></Notice>}
    {state === 'uncertain' && <Notice>{t.uncertain}</Notice>}
    {state === 'accepted' && <p role="status">{t.accepted}</p>}
    {roles?.length === 0 && <p>{t.noRoles}</p>}
    <form onSubmit={event => void submit(event)}><fieldset disabled={state !== 'ready' || !roles?.length}>
      <label className="studio-field"><span>{t.role}</span><select data-modal-autofocus value={selected} onChange={event => setSelected(event.target.value)}>{roles?.map(role => <option key={role.id} value={role.id}>{role.name} · {role.roleName}</option>)}</select></label>
      <label className="studio-field"><span>{t.task}</span><textarea required value={task} onChange={event => setTask(event.target.value)} /></label>
      <label className="studio-field"><span>{t.context}</span><select value={context} onChange={event => { if (event.target.value === 'fresh' || event.target.value === 'fork') setContext(event.target.value); }}><option value="fresh">{t.fresh}</option><option value="fork">{t.fork}</option></select></label>
      <Button primary type="submit" disabled={!task.trim()}>{t.submit}</Button>
    </fieldset></form>
    {childId && <Button onClick={() => { api.open({ parentSessionId: parentId, childSessionId: childId, mode: 'continuable' }, true); close(); }}>{t.aside}</Button>}
    <Button disabled={state === 'busy'} onClick={close}>{t.close}</Button>
  </StudioSurface></Modal>;
}

/** @param props Standard session hooks and Studio operations. @returns Root-session catalog and explicit launch dialog. */
export function CatalogAction({ sessionId, useSessions, useSessionStatus, api, locale }: Runtime & { api: CatalogApi; locale: string }) {
  const child = useSessions(state => state.byId[sessionId]?.origin === 'subagent');
  const count = useSessions(state => state.projectionsBySession[sessionId]?.values.subagentCatalog?.length ?? 0);
  const [open, setOpen] = React.useState(false);
  const [launch, setLaunch] = React.useState(false);
  const [uncertainLaunch, setUncertainLaunch] = React.useState(false);
  const [now, setNow] = React.useState(Date.now);
  React.useEffect(() => { if (!open) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [open]);
  const t = catalogText(locale);
  if (child) return null;
  return <StudioSurface><Menu portal open={open} onClose={() => setOpen(false)} anchor={<Button small aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>{t.title} · {count}</Button>}>
    <StudioSurface className="studio-catalog">{uncertainLaunch ? <Notice>{t.uncertain}</Notice> : <MenuItemButton onSelect={() => { setOpen(false); setLaunch(true); }}>{t.launch}</MenuItemButton>}
      <Branch key={sessionId} parentId={sessionId} ancestors={[]} {...{ api, locale, now, useSessions, useSessionStatus }} close={() => setOpen(false)} />
    </StudioSurface>
  </Menu>{launch && <LaunchDialog key={sessionId} parentId={sessionId} api={api} locale={locale} close={() => setLaunch(false)} uncertain={() => setUncertainLaunch(true)} />}</StudioSurface>;
}
export const inject = ['remote', 'slots', 'locale', 'sessions', 'uiWorkspace', 'sidebarRight'];
/** @param ctx Client owner. Registers only the root header catalog cell. */
export async function apply(ctx: Context): Promise<void> {
  const unmount = await ctx.remote.$mount(TYPERT_REMOTE);
  ctx.effect(() => unmount);
  ctx.inject(['remote.studioCatalog'], ctx => {
    const api: CatalogApi = {
      async assignments(parentId) { const result = await ctx.remote.studioCatalog.assignments(parentId); if (!result.ok) throw result.error; return result.value; },
      async roles() { const result = await ctx.remote.studioCatalog.roles(); if (!result.ok) throw result.error; return result.value; },
      async launch(request) { const result = await ctx.remote.studioCatalog.launch(request); if (!result.ok) throw result.error; return result.value; },
      async refresh(parentId) { await ctx.sessions.refreshProjections(parentId); },
      open(address, aside) {
        if (!aside) { ctx.uiWorkspace.openSession(address); return; }
        const query = new URLSearchParams({ parent: address.parentSessionId, mode: address.mode });
        ctx.sidebarRight.openResource(`dsh-resource://subagentchat/session/${encodeURIComponent(address.childSessionId)}?${query}`, { kind: 'subagentchat', preferNewPane: true });
      },
    };
    function Action(props: Runtime) {
      const locale = React.useSyncExternalStore(listener => ctx.locale.subscribe(listener), () => ctx.locale.getLocale().active);
      return <CatalogAction key={props.sessionId} {...props} api={api} locale={locale} />;
    }
    ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({ name: 'conversation.session.header.actions', id: 'subagent-catalog', priority: -1, order: -30 }, Action));
  });
}
