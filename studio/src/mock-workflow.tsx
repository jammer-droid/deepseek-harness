/** Workflow editor mock: an overview plus one tab per role; values stay in the page. */
import React from 'react';
import { Checkbox, Modal, StateDot, Tag, type StateDotState } from '@deepseek-ai/dsh-client-ui-primitives';
import { Button } from './ui.tsx';
import { COMPONENTS, KINDS, SYSTEMS, agentName, defaultValue, type Agent, type ComponentKind, type SystemId, type TemplateKind } from './mock-data.ts';
import { AgentComponents, SupportTag } from './mock-parts.tsx';
import { mockId, useMock } from './mock-store.tsx';

type Outcome = 'success' | 'activation' | 'unknown' | 'conflict';
const STATE_DOT: Record<'supported' | 'conditional' | 'unsupported' | 'missing', StateDotState> = { supported: 'done', conditional: 'warning', unsupported: 'idle', missing: 'error' };

/** @param agent Agent definition. @returns Count of components that differ from the default DSH agent. */
function changeCount(agent: Agent): number {
  const c = agent.components;
  return [c.instructions?.blocks.length, c.tools, c.delegate && Object.values(c.delegate.targets).some(link => link.allowed), c.model?.effort].filter(Boolean).length;
}

/** @returns The workflow editor mock page. */
export function MockWorkflow() {
  const { t, data, update, toast, workflowTab: tab, setWorkflowTab: setTab } = useMock();
  const w = t.workflow;
  const [revision, setRevision] = React.useState({ draft: 14, applied: 12 });
  const [status, setStatus] = React.useState<'active' | 'activation' | 'unknown'>('active');
  const [notice, setNotice] = React.useState<Outcome>();
  const [applying, setApplying] = React.useState(false);
  const [addingRole, setAddingRole] = React.useState(false);
  const sentinel = React.useRef<HTMLDivElement>(null);
  const role = tab.kind === 'role' ? data.roles.find(item => item.id === tab.id) : undefined;

  // Switching tabs keeps the tab bar in view instead of jumping to the page top.
  const select = (next: typeof tab) => {
    setTab(next);
    const marker = sentinel.current;
    let scroller = marker?.closest<HTMLElement>('[data-studio-scroller]');
    // Narrow layouts scroll the whole Studio surface instead of the content column.
    if (scroller && getComputedStyle(scroller).overflowY === 'visible') scroller = scroller.closest<HTMLElement>('.studio-page');
    if (!marker || !scroller) return;
    const offset = marker.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    if (offset < 0) scroller.scrollTop += offset;
  };
  React.useEffect(() => { if (tab.kind === 'role' && !role) setTab({ kind: 'overview' }); }, [tab, role, setTab]);

  const statusDot: StateDotState = status === 'active' ? 'done' : status === 'activation' ? 'error' : 'warning';
  const statusText = status === 'active' ? w.active : status === 'activation' ? w.activationFailed : w.unknown;
  const usedSystems = [...new Set(data.roles.flatMap(item => KINDS.filter(kind => item.components[kind]).flatMap(kind => COMPONENTS[kind].systems)))];

  return <div className="studio-page-stack">
    <p className="studio-mock-notice" role="note">{t.mockNotice}</p>
    <header className="studio-page-head studio-page-head-actions">
      <div>
        <h2>{w.name}</h2>
        <p className="studio-muted">{w.description}</p>
        <p className="studio-status-line">
          <span>{w.draft} r{revision.draft}</span><span aria-hidden="true">·</span>
          <span>{w.applied} r{revision.applied}</span><span aria-hidden="true">·</span>
          <span className="studio-inline-state"><StateDot state={statusDot} />{statusText}</span>
          <span className="studio-muted">— {w.keepsApplied}</span>
        </p>
      </div>
      <div className="studio-inline-actions">
        <Button onClick={() => { setRevision(previous => ({ ...previous, draft: previous.draft + 1 })); toast(t.toasts.saved); }}>{w.saveDraft}</Button>
        <Button primary disabled={status === 'unknown'} onClick={() => setApplying(true)}>{w.applyEllipsis}</Button>
      </div>
    </header>
    {notice === 'activation' && <p role="alert">{w.activationNotice}</p>}
    {notice === 'unknown' && <div role="alert" className="studio-notice-row"><span>{w.unknownNotice}</span>
      <Button small onClick={() => { setRevision(previous => ({ ...previous, applied: previous.draft })); setStatus('active'); setNotice(undefined); }}>{w.requery}</Button></div>}
    {notice === 'conflict' && <div role="alert" className="studio-notice-row"><span>{w.conflictNotice}</span>
      <Button small onClick={() => setNotice(undefined)}>{w.loadLatest}</Button></div>}

    <div ref={sentinel} />
    <div className="studio-tabs" role="tablist" aria-label={w.tabs}>
      <button type="button" role="tab" className="studio-tab" aria-selected={tab.kind === 'overview'} onClick={() => select({ kind: 'overview' })}>{w.overview}</button>
      {data.roles.map(item => <button key={item.id} type="button" role="tab" className="studio-tab" aria-selected={tab.kind === 'role' && tab.id === item.id}
        onClick={() => select({ kind: 'role', id: item.id })}>
        {agentName(item, t)}{item.id === data.mainId && <Tag tone="outline">{w.mainTag}</Tag>}
      </button>)}
      <button type="button" className="studio-tab studio-tab-add" onClick={() => setAddingRole(true)}>+ {w.addRole}</button>
    </div>

    {/* A minimum height lets the sticky tab bar stay in place when a shorter tab replaces a longer one. */}
    <div role="tabpanel" className="studio-tab-panel">
      {tab.kind === 'overview' && <Overview usedSystems={usedSystems} open={next => select(next)} />}
      {role && <RolePanel key={role.id} role={role} initialOpen={tab.kind === 'role' ? tab.open : undefined} />}
    </div>

    <ApplyDialog open={applying} onClose={() => setApplying(false)} onConfirm={outcome => {
      setApplying(false);
      if (outcome === 'conflict') { setNotice('conflict'); return; }
      if (outcome === 'unknown') { setStatus('unknown'); setNotice('unknown'); return; }
      setRevision(previous => ({ ...previous, applied: previous.draft }));
      setStatus(outcome === 'activation' ? 'activation' : 'active');
      setNotice(outcome === 'activation' ? 'activation' : undefined);
      if (outcome === 'success') toast(t.toasts.applied);
    }} hasUnknown={data.roles.some(item => item.unknown.length > 0)} />
    <Modal open={addingRole} onClose={() => setAddingRole(false)} title={w.addRoleTitle} description={w.addRoleDescription} closeLabel={t.common.close}>
      <div className="studio-ui">
        <ul className="studio-pick-list">
          {[...data.agents, undefined].map(source => <li key={source?.id ?? 'empty'}>
            <button type="button" className="studio-pick" onClick={() => {
              const id = mockId('role');
              update(next => {
                next.roles.push(source
                  ? { ...structuredClone(source), id, components: { ...structuredClone(source.components), ...(source.components.delegate ? { delegate: { targets: {} } } : {}) } }
                  : { id, label: { custom: w.emptyRoleName }, unknown: [], components: { model: defaultValue('model') } });
              });
              setAddingRole(false);
              setTab({ kind: 'role', id });
            }}>
              <strong>{source ? agentName(source, t) : w.emptyRole}</strong>
              <span className="studio-muted">{source ? w.roleCard(KINDS.filter(kind => source.components[kind]).length, source.components.tools?.tools.length ?? 0) : t.kinds.model.title}</span>
            </button>
          </li>)}
        </ul>
        <p className="studio-muted studio-hint">{w.copyNote}</p>
      </div>
    </Modal>
  </div>;
}

function Overview({ usedSystems, open }: { usedSystems: SystemId[]; open: (tab: { kind: 'role'; id: string; open?: string }) => void }) {
  const { t, data, go } = useMock();
  const w = t.workflow;
  return <div className="studio-page-stack">
    <section className="studio-block-section">
      <h3>{w.rolesHeading}</h3>
      <div className="studio-tile-grid">
        {data.roles.map(role => <button key={role.id} type="button" className="studio-tile" onClick={() => open({ kind: 'role', id: role.id })}>
          <span className="studio-tile-title">{agentName(role, t)}{role.id === data.mainId && <Tag tone="outline">{w.mainTag}</Tag>}</span>
          <span className="studio-muted">{role.components.model?.model ?? t.common.none}</span>
          <span className="studio-muted">{w.roleCard(KINDS.filter(kind => role.components[kind]).length, role.components.tools?.tools.length ?? 0)}</span>
        </button>)}
      </div>
    </section>
    <section className="studio-block-section">
      <h3>{w.delegationHeading}</h3>
      <p className="studio-muted">{w.delegationIntro}</p>
      <div className="studio-matrix-scroll">
        <table className="studio-matrix">
          <thead><tr><th scope="col">{w.caller} \ {w.target}</th>{data.roles.map(role => <th key={role.id} scope="col">{agentName(role, t)}</th>)}</tr></thead>
          <tbody>{data.roles.map(caller => <tr key={caller.id}>
            <th scope="row">{agentName(caller, t)}</th>
            {data.roles.map(target => {
              if (caller.id === target.id) return <td key={target.id} className="studio-muted">—</td>;
              const link = caller.components.delegate?.targets[target.id];
              return <td key={target.id}>
                <button type="button" className="studio-matrix-cell" onClick={() => open({ kind: 'role', id: caller.id, open: 'delegate' })}>
                  {link?.allowed ? <><span>{t.editors.modes[link.mode]}</span>{link.allowOther && <span className="studio-muted">+ {t.editors.modes[link.mode === 'fresh' ? 'fork' : 'fresh']}</span>}</>
                    : <span className="studio-muted">{w.notAllowed}</span>}
                </button>
              </td>;
            })}
          </tr>)}</tbody>
        </table>
      </div>
    </section>
    <section className="studio-block-section">
      <div className="studio-section-head"><h3>{w.systemsHeading}</h3><Button small onClick={() => go('systems')}>{w.openSystems}</Button></div>
      <p className="studio-muted">{w.systemsIntro}</p>
      <ul className="studio-plain-list">
        {usedSystems.map(id => <li key={id} className="studio-list-row">
          <StateDot state={STATE_DOT[SYSTEMS[id].state]} />
          <span>{t.systems.names[id]}</span>
          <span className="studio-muted studio-grow">{t.systems.states[SYSTEMS[id].state]}</span>
          <SupportTag support={SYSTEMS[id].state} t={t} />
        </li>)}
      </ul>
    </section>
  </div>;
}

function RolePanel({ role, initialOpen }: { role: Agent; initialOpen: string | undefined }) {
  const { t, data, update, toast } = useMock();
  const w = t.workflow;
  const [open, setOpenState] = React.useState<Record<string, boolean>>(() => ({ model: true, ...(initialOpen ? { [initialOpen]: true } : {}) }));
  React.useEffect(() => { if (initialOpen) setOpenState(previous => ({ ...previous, [initialOpen]: true })); }, [initialOpen]);
  const edit = (change: (agent: Agent) => void) => update(next => { const target = next.roles.find(item => item.id === role.id); if (target) change(target); });
  const isMain = role.id === data.mainId;
  return <div className="studio-page-stack">
    <div className="studio-section-head">
      <div>
        <h3 className="studio-panel-title">{agentName(role, t)}{isMain && <Tag tone="outline">{w.mainTag}</Tag>}</h3>
        <p className="studio-muted">{w.changes(changeCount(role))}</p>
      </div>
      <div className="studio-inline-actions">
        <Button small onClick={() => { update(next => { next.agents.push({ ...structuredClone(role), id: mockId('agent'), components: { ...structuredClone(role.components), ...(role.components.delegate ? { delegate: { targets: {} } } : {}) } }); }); toast(t.toasts.agentSaved); }}>{w.saveToLibrary}</Button>
        {!isMain && <Button small onClick={() => update(next => { next.mainId = role.id; })}>{w.makeMain}</Button>}
        {!isMain && <Button small onClick={() => update(next => {
          next.roles = next.roles.filter(item => item.id !== role.id);
          for (const item of next.roles) delete item.components.delegate?.targets[role.id];
        })}>{w.removeRole}</Button>}
      </div>
    </div>
    <EditableComponents agent={role} edit={edit} roles={data.roles} open={open} setOpen={(key, value) => setOpenState(previous => ({ ...previous, [key]: value }))} />
  </div>;
}

/** Component cards with add, remove, and save-as-template actions; the workflow role tab and the agent library share it.
 * @param props Agent, change callback, workflow roles when the agent is a workflow role, and open card state.
 * @returns Cards followed by the add-component action and its picker.
 */
export function EditableComponents({ agent, edit, roles, open, setOpen }: {
  agent: Agent; edit: (change: (agent: Agent) => void) => void; roles: Agent[] | undefined;
  open: Record<string, boolean>; setOpen: (key: string, open: boolean) => void;
}) {
  const { t, data, update, toast } = useMock();
  const [picking, setPicking] = React.useState(false);
  const saveTemplate = (kind: TemplateKind) => {
    const value = agent.components[kind];
    if (!value) return;
    update(next => {
      next.templates.push({ id: mockId('template'), name: `${agentName(agent, t)} · ${t.kinds[kind].title}`, kind, value: structuredClone(value) } as typeof next.templates[number]);
    });
    toast(t.toasts.templateSaved);
  };
  return <>
    <AgentComponents agent={agent} edit={edit} roles={roles} open={open} setOpen={setOpen} t={t}
      actions={{ saveTemplate, remove: kind => edit(next => { delete next.components[kind]; }) }} />
    <div><Button onClick={() => setPicking(true)}>+ {t.workflow.addComponent}</Button></div>
    <ComponentPicker open={picking} role={agent} onClose={() => setPicking(false)} onAdd={(kind, templateId) => {
      edit(next => {
        const template = data.templates.find(item => item.id === templateId && item.kind === kind);
        Object.assign(next.components, { [kind]: template ? structuredClone(template.value) : defaultValue(kind) });
      });
      setOpen(kind, true);
      setPicking(false);
    }} />
  </>;
}

function ComponentPicker({ open, role, onClose, onAdd }: { open: boolean; role: Agent; onClose: () => void; onAdd: (kind: ComponentKind, templateId?: string) => void }) {
  const { t, data } = useMock();
  const w = t.workflow;
  const missing = KINDS.filter(kind => !role.components[kind]);
  const [kind, setKind] = React.useState<ComponentKind>();
  const [source, setSource] = React.useState('');
  const selected = kind && missing.includes(kind) ? kind : missing[0];
  const templates = data.templates.filter(item => item.kind === selected);
  return <Modal open={open} onClose={onClose} title={w.pickerTitle} description={w.pickerDescription} closeLabel={t.common.close}
    footer={<div className="studio-ui studio-modal-footer">
      <Button onClick={onClose}>{t.common.cancel}</Button>
      <Button primary disabled={!selected} onClick={() => selected && onAdd(selected, source || undefined)}>{t.common.add}</Button>
    </div>}>
    <div className="studio-ui">
      {missing.length === 0 ? <p className="studio-muted">{w.allAdded}</p> : <>
        <ul className="studio-pick-list" role="radiogroup" aria-label={w.pickerTitle}>
          {missing.map(item => <li key={item}>
            <button type="button" role="radio" aria-checked={item === selected} className="studio-pick" onClick={() => { setKind(item); setSource(''); }}>
              <span className="studio-pick-title"><strong>{t.kinds[item].title}</strong><SupportTag support={COMPONENTS[item].support} t={t} /></span>
              <span className="studio-muted">{t.kinds[item].description}</span>
            </button>
          </li>)}
        </ul>
        {templates.length > 0 && <label>{w.source}
          <select value={source} onChange={event => setSource(event.target.value)}>
            <option value="">{w.fromDefault}</option>
            {templates.map(item => <option key={item.id} value={item.id}>{w.fromTemplate(item.name)}</option>)}
          </select>
        </label>}
      </>}
    </div>
  </Modal>;
}

function ApplyDialog({ open, onClose, onConfirm, hasUnknown }: { open: boolean; onClose: () => void; onConfirm: (outcome: Outcome) => void; hasUnknown: boolean }) {
  const { t } = useMock();
  const w = t.workflow;
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [outcome, setOutcome] = React.useState<Outcome>('success');
  React.useEffect(() => { if (open) setAcknowledged(false); }, [open]);
  return <Modal open={open} onClose={onClose} title={w.applyTitle} description={w.applyDescription} closeLabel={t.common.close}
    footer={<div className="studio-ui studio-modal-footer">
      <Button onClick={onClose}>{t.common.cancel}</Button>
      <Button primary disabled={!acknowledged} onClick={() => onConfirm(outcome)}>{w.confirmApply}</Button>
    </div>}>
    {/* Modal portals to body, so its content re-enters the Studio style scope. */}
    <div className="studio-ui">
      <ul className="studio-checklist">
        {(['references', 'models', 'systems', 'placement', 'links', 'enforcement'] as const).map(check => <li key={check}>
          <StateDot state={check === 'systems' ? 'warning' : 'done'} />
          <span>{w.checks[check]}{check === 'systems' && <span className="studio-muted"> — {w.contextMissing}</span>}</span>
        </li>)}
        {hasUnknown && <li><StateDot state="warning" /><span className="studio-muted">{w.unknownKept}</span></li>}
      </ul>
      <p className="studio-muted">{w.newRuns}</p>
      <Checkbox checked={acknowledged} onChange={setAcknowledged} label={w.acknowledge} />
      <label className="studio-simulate"><span className="studio-muted">{w.simulate}</span>
        <select value={outcome} onChange={event => setOutcome(event.target.value as Outcome)}>
          {(['success', 'activation', 'unknown', 'conflict'] as const).map(value => <option key={value} value={value}>{w.outcomes[value]}</option>)}
        </select>
      </label>
    </div>
  </Modal>;
}
