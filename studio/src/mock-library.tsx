/** Agent library, component catalog/templates, and system registry mock pages. */
import React from 'react';
import { SegmentedControl, StateDot, SUPPORT_DOT, Tag } from './ui-host.tsx';
import { Button, ListGroup, ListItem, MasterDetail, Note, PageHead, SectionHead } from './ui.tsx';
import {
  COMPONENTS, KINDS, SYSTEMS, UNKNOWN_COMPONENT, agentName, defaultValue,
  type Agent, type ComponentKind, type SystemId, type Template, type TemplateKind,
} from './mock-data.ts';
import { InstructionsEditor, ModelEditor, SupportBadge, ToolsEditor } from './mock-parts.tsx';
import { mockId, useMock } from './mock-store.tsx';
import { EditableComponents } from './mock-workflow.tsx';

/** @returns Agent library mock page. */
export function MockAgents() {
  const { t, data, update, toast, go, setWorkflowTab } = useMock();
  const a = t.agents;
  const [selectedId, setSelectedId] = React.useState(data.agents[0]?.id);
  const [open, setOpen] = React.useState<Record<string, boolean>>({ model: true });
  const agent = data.agents.find(item => item.id === selectedId) ?? data.agents[0];
  const edit = (change: (agent: Agent) => void) => update(next => { const target = next.agents.find(item => item.id === agent?.id); if (target) change(target); });
  return <div className="studio-page-stack">
    <Note>{t.mockNotice}</Note>
    <PageHead title={a.title} description={a.description} />
    <MasterDetail label={a.list} list={data.agents.map(item => <ListItem key={item.id} selected={item.id === agent?.id} onClick={() => setSelectedId(item.id)}>
      <span>{agentName(item, t)}</span>
    </ListItem>)}>
      {agent && <>
        <SectionHead title={agentName(agent, t)} actions={<>
            <Button small primary onClick={() => {
              const id = mockId('role');
              update(next => { next.roles.push({ ...structuredClone(agent), id }); });
              toast(t.toasts.copied(t.workflow.name));
              setWorkflowTab({ kind: 'role', id });
              go('workflows');
            }}>{a.copyToWorkflow(t.workflow.name)}</Button>
            <Button small onClick={() => {
              const id = mockId('agent');
              update(next => { next.agents.push({ ...structuredClone(agent), id }); });
              setSelectedId(id);
            }}>{t.common.duplicate}</Button>
        </>} />
        <p className="studio-muted studio-hint">{a.copyNote}</p>
        <EditableComponents agent={agent} edit={edit} roles={undefined} open={open} setOpen={(key, value) => setOpen(previous => ({ ...previous, [key]: value }))} />
      </>}
    </MasterDetail>
  </div>;
}

/** @returns Component catalog and template mock page. */
export function MockComponents() {
  const { t } = useMock();
  const c = t.components;
  const id = React.useId();
  const [view, setView] = React.useState<'catalog' | 'templates'>('catalog');
  return <div className="studio-page-stack">
    <Note>{t.mockNotice}</Note>
    <PageHead title={c.title} description={c.description} />
    <SegmentedControl id={`${id}-view`} label={c.tabs} value={view} onChange={setView} className="studio-view-switch"
      options={[{ value: 'catalog', label: c.catalog }, { value: 'templates', label: c.templates }]} />
    <div role="tabpanel" id={`${id}-view-${view}-panel`} aria-labelledby={`${id}-view-${view}`}>
      {view === 'catalog' ? <Catalog showTemplates={() => setView('templates')} /> : <Templates />}
    </div>
  </div>;
}

function Catalog({ showTemplates }: { showTemplates: () => void }) {
  const { t, data, update } = useMock();
  const c = t.components;
  const [selected, setSelected] = React.useState<ComponentKind | typeof UNKNOWN_COMPONENT>('model');
  const users = (kind: string) => data.roles.filter(role => kind === UNKNOWN_COMPONENT ? role.unknown.includes(kind) : role.components[kind as ComponentKind]).map(role => agentName(role, t));
  const used = users(selected);
  return <MasterDetail label={c.catalog} list={<>
    <ListGroup>{c.registered}</ListGroup>
    {KINDS.map(kind => <ListItem key={kind} selected={selected === kind} onClick={() => setSelected(kind)}>
      <span>{t.kinds[kind].title}</span><SupportBadge support={COMPONENTS[kind].support} t={t} />
    </ListItem>)}
    <ListGroup>{c.unknownGroup}</ListGroup>
    <ListItem selected={selected === UNKNOWN_COMPONENT} onClick={() => setSelected(UNKNOWN_COMPONENT)}>
      <span className="studio-mono">{UNKNOWN_COMPONENT}</span><SupportBadge support="missing" t={t} />
    </ListItem>
  </>}>
    {selected === UNKNOWN_COMPONENT ? <>
      <SectionHead title={<h3 className="studio-panel-title studio-mono">{UNKNOWN_COMPONENT}</h3>} actions={<SupportBadge support="missing" t={t} />} />
      <p className="studio-reason">{c.unknownDescription}</p>
      <dl className="studio-facts"><dt>{c.usedBy}</dt><dd>{used.join(', ') || c.usedByNone}</dd></dl>
    </> : <>
      <SectionHead title={t.kinds[selected].title} actions={<SupportBadge support={COMPONENTS[selected].support} t={t} />} />
      <p>{t.kinds[selected].description}</p>
      <dl className="studio-facts">
        <dt>{c.systems}</dt>
        <dd>{COMPONENTS[selected].systems.map(system => <span key={system} className="studio-inline-state"><StateDot state={SUPPORT_DOT[SYSTEMS[system].state]} />{t.systems.names[system]}</span>)}</dd>
        <dt>{c.scope}</dt><dd>{t.common.role}</dd>
        <dt>{c.io}</dt><dd>{t.common.none}</dd>
        <dt>{t.modelVisible}</dt><dd>{t.kinds[selected].effect}</dd>
        <dt>{c.limit}</dt><dd>{t.kinds[selected].limit}</dd>
        <dt>{c.usedBy}</dt><dd>{used.join(', ') || c.usedByNone}</dd>
      </dl>
      <SectionHead title={<h4>{c.templatesFor}</h4>} actions={COMPONENTS[selected].template && <Button small onClick={() => {
          const kind = selected as TemplateKind;
          update(next => { next.templates.push({ id: mockId('template'), name: c.newTemplateName(t.kinds[kind].title), kind, value: defaultValue(kind) } as Template); });
          showTemplates();
        }}>+ {c.newTemplate}</Button>} />
      {!COMPONENTS[selected].template ? <p className="studio-muted">{c.notTemplatable}</p> : <ul className="studio-plain-list">
        {data.templates.filter(item => item.kind === selected).map(item => <li key={item.id} className="studio-list-row"><span>{item.name}</span></li>)}
        {data.templates.every(item => item.kind !== selected) && <li className="studio-muted">{c.noTemplates}</li>}
      </ul>}
    </>}
  </MasterDetail>;
}

function Templates() {
  const { t, data, update } = useMock();
  const c = t.components;
  const id = React.useId();
  const [selectedId, setSelectedId] = React.useState(data.templates[0]?.id);
  const template = data.templates.find(item => item.id === selectedId) ?? data.templates[0];
  const edit = (change: (template: Template) => void) => update(next => { const target = next.templates.find(item => item.id === template?.id); if (target) change(target); });
  if (!template) return <p className="studio-muted">{c.emptyTemplates}</p>;
  return <MasterDetail label={c.templates} list={data.templates.map(item => <ListItem key={item.id} selected={item.id === template.id} onClick={() => setSelectedId(item.id)}>
    <span className="studio-list-text"><span>{item.name}</span><span className="studio-muted">{t.kinds[item.kind].title}</span></span>
  </ListItem>)}>
    <SectionHead field title={<label className="studio-grow">{c.templateName}<input value={template.name} onChange={event => edit(next => { next.name = event.target.value; })} /></label>} actions={<>
        <Button small onClick={() => { const copy = mockId('template'); update(next => { next.templates.push({ ...structuredClone(template), id: copy }); }); setSelectedId(copy); }}>{t.common.duplicate}</Button>
        <Button small onClick={() => update(next => { next.templates = next.templates.filter(item => item.id !== template.id); })}>{t.common.remove}</Button>
    </>} />
    <p className="studio-inline-state"><span className="studio-muted">{c.templateKind}</span><Tag tone="neutral">{t.kinds[template.kind].title}</Tag></p>
    <p className="studio-reason">{c.templateCopyNote}</p>
    <div className="studio-component studio-component-flat">
      {template.kind === 'model' && <ModelEditor value={template.value} t={t} id={`${id}-model`} edit={change => edit(next => { if (next.kind === 'model') change(next.value); })} />}
      {template.kind === 'instructions' && <InstructionsEditor value={template.value} t={t} edit={change => edit(next => { if (next.kind === 'instructions') change(next.value); })} />}
      {template.kind === 'tools' && <ToolsEditor value={template.value} t={t} edit={change => edit(next => { if (next.kind === 'tools') change(next.value); })} />}
    </div>
  </MasterDetail>;
}

/** @returns System registry mock page. */
export function MockSystems() {
  const { t, data } = useMock();
  const s = t.systems;
  const usedBy = (system: SystemId) => data.roles.some(role => SYSTEMS[system].handles.some(kind => role.components[kind])) ? t.workflow.name : t.common.none;
  return <div className="studio-page-stack">
    <Note>{t.mockNotice}</Note>
    <PageHead title={s.title} description={s.description} />
    <p className="studio-muted studio-hint">{s.pluginNote}</p>
    <ul className="studio-system-grid">
      {(Object.keys(SYSTEMS) as SystemId[]).map(id => {
        const system = SYSTEMS[id];
        return <li key={id} className="studio-component studio-system">
          <SectionHead title={<span className="studio-inline-state"><StateDot state={SUPPORT_DOT[system.state]} /><strong>{s.names[id]}</strong></span>} actions={<SupportBadge support={system.state} t={t} />} />
          <p className="studio-muted">{s.states[system.state]}</p>
          <dl className="studio-facts">
            <dt>{s.plugin}</dt><dd className="studio-mono">{system.plugin}</dd>
            <dt>{s.handles}</dt><dd>{system.handles.map(kind => t.kinds[kind].title).join(', ')}</dd>
            <dt>{s.placement}</dt><dd className="studio-inline-state">
              <Tag tone="success">{s.inside} · {s.available}</Tag><Tag tone="outline">{s.runtime} · {s.later}</Tag>
            </dd>
            <dt>{s.usedBy}</dt><dd>{usedBy(id)}</dd>
          </dl>
        </li>;
      })}
    </ul>
  </div>;
}
