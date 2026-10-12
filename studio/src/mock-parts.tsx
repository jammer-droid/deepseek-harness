/** Component cards and value editors shared by the workflow, agent, and template mock pages. */
import React from 'react';
import { Checkbox, ComponentCard, SegmentedControl, SupportTag, type SupportState } from './ui-host.tsx';
import { Button } from './ui.tsx';
import {
  ALL_TOOLS, CATALOG, COMPONENTS, KINDS, TOOL_GROUPS, agentName,
  type Agent, type ComponentKind, type ComponentValues, type ContextMode, type Effort, type TemplateKind,
} from './mock-data.ts';
import type { MockCopy } from './mock-locales.ts';

/** @param props Support state and copy. @returns The shared support tag with the mock's localized label. */
export function SupportBadge({ support, t }: { support: SupportState; t: MockCopy }) {
  return <SupportTag support={support} label={t.support[support]} />;
}

/** @param props Model value, change callback, copy, and an id seed. @returns Provider, model, and effort controls. */
export function ModelEditor({ value, edit, t, id }: { value: ComponentValues['model']; edit: (change: (value: ComponentValues['model']) => void) => void; t: MockCopy; id: string }) {
  const efforts = CATALOG[value.provider]?.[value.model] ?? [];
  return <>
    <div className="studio-field-grid">
      <label>{t.editors.provider}
        <select value={value.provider} onChange={event => edit(next => { next.provider = event.target.value; })}>
          {Object.keys(CATALOG).map(provider => <option key={provider}>{provider}</option>)}
        </select>
      </label>
      <label>{t.editors.model}
        <select value={value.model} onChange={event => edit(next => {
          next.model = event.target.value;
          if (!(CATALOG[next.provider]?.[next.model] ?? []).includes(next.effort)) next.effort = '';
        })}>
          {Object.keys(CATALOG[value.provider] ?? {}).map(model => <option key={model}>{model}</option>)}
        </select>
      </label>
    </div>
    <div className="studio-field">
      <span>{t.editors.effort}</span>
      <SegmentedControl id={`${id}-effort`} label={t.editors.effort} value={value.effort} onChange={effort => edit(next => { next.effort = effort; })}
        options={(['', 'low', 'medium', 'high'] as const satisfies readonly Effort[]).map(option => ({ value: option, label: option || t.common.default, disabled: option !== '' && !efforts.includes(option) }))} />
    </div>
  </>;
}

/** @param props Instruction blocks, change callback, and copy. @returns Ordered block editor. */
export function InstructionsEditor({ value, edit, t }: { value: ComponentValues['instructions']; edit: (change: (value: ComponentValues['instructions']) => void) => void; t: MockCopy }) {
  const move = (from: number, to: number) => edit(next => { next.blocks.splice(to, 0, ...next.blocks.splice(from, 1)); });
  return <>
    <ol className="studio-blocks">
      {value.blocks.map((block, index) => <li key={index} className="studio-block">
        <div className="studio-block-head">
          <label className="studio-block-name">{t.editors.blockName}
            <input value={block.name} onChange={event => edit(next => { next.blocks[index]!.name = event.target.value; })} />
          </label>
          <div className="studio-inline-actions">
            <Button small disabled={index === 0} onClick={() => move(index, index - 1)}>{t.common.moveUp}</Button>
            <Button small disabled={index === value.blocks.length - 1} onClick={() => move(index, index + 1)}>{t.common.moveDown}</Button>
            <Button small onClick={() => edit(next => { next.blocks.splice(index, 1); })}>{t.common.remove}</Button>
          </div>
        </div>
        <label>{t.editors.blockText}
          <textarea value={block.text} onChange={event => edit(next => { next.blocks[index]!.text = event.target.value; })} />
        </label>
      </li>)}
    </ol>
    <Button small onClick={() => edit(next => { next.blocks.push({ name: '', text: '' }); })}>+ {t.editors.addBlock}</Button>
  </>;
}

/** @param props Included tools, change callback, and copy. @returns Grouped tool checkboxes with the shell warning. */
export function ToolsEditor({ value, edit, t }: { value: ComponentValues['tools']; edit: (change: (value: ComponentValues['tools']) => void) => void; t: MockCopy }) {
  const has = (tool: string) => value.tools.includes(tool);
  return <>
    {has('bash') && !TOOL_GROUPS.write.every(has) && <p className="studio-reason studio-reason-warning">{t.editors.shellWarning}</p>}
    <div className="studio-tool-groups">
      {(Object.keys(TOOL_GROUPS) as (keyof typeof TOOL_GROUPS)[]).map(group => <fieldset key={group}>
        <legend>{t.editors.toolGroups[group]}</legend>
        {TOOL_GROUPS[group].map(tool => <Checkbox key={tool} label={tool} checked={has(tool)}
          onChange={checked => edit(next => { next.tools = checked ? ALL_TOOLS.filter(item => item === tool || next.tools.includes(item)) : next.tools.filter(item => item !== tool); })} />)}
      </fieldset>)}
    </div>
  </>;
}

/** @param props Delegation targets, the workflow roles when inside one, the editing role id, change callback, and copy. @returns Per-target delegation controls. */
export function DelegateEditor({ value, roles, self, edit, t, id }: {
  value: ComponentValues['delegate']; roles: Agent[] | undefined; self: string; edit: (change: (value: ComponentValues['delegate']) => void) => void; t: MockCopy; id: string;
}) {
  const targets = roles?.filter(role => role.id !== self) ?? [];
  if (!roles) return <p className="studio-reason">{t.editors.noTargets}</p>;
  return <div className="studio-targets">
    {targets.map(role => {
      const link = value.targets[role.id] ?? { allowed: false, mode: 'fresh' as ContextMode, allowOther: false };
      const set = (change: Partial<typeof link>) => edit(next => { next.targets[role.id] = { ...link, ...change }; });
      const other: ContextMode = link.mode === 'fresh' ? 'fork' : 'fresh';
      return <div key={role.id} className="studio-target">
        <Checkbox label={t.editors.allowTo(agentName(role, t))} checked={link.allowed} onChange={allowed => set({ allowed })} />
        {link.allowed && <div className="studio-target-body">
          <div className="studio-field">
            <span>{t.editors.defaultMode}</span>
            <SegmentedControl id={`${id}-${role.id}-mode`} label={t.editors.defaultMode} value={link.mode} onChange={mode => set({ mode })}
              options={(['fresh', 'fork'] as const).map(mode => ({ value: mode, label: t.editors.modes[mode] }))} />
            <span className="studio-muted studio-hint">{t.editors.forkHint}</span>
          </div>
          <Checkbox label={t.editors.allowOther(t.editors.modes[other])} checked={link.allowOther} onChange={allowOther => set({ allowOther })} />
        </div>}
      </div>;
    })}
  </div>;
}

/** @param kind Component kind. @param agent Agent holding the value. @param roles Workflow roles, if any. @param t Copy. @returns One-line card summary. */
export function componentSummary(kind: ComponentKind, agent: Agent, roles: Agent[] | undefined, t: MockCopy): string {
  const c = agent.components;
  switch (kind) {
    case 'model': return c.model ? t.editors.modelSummary(c.model.model, c.model.effort || t.common.default) : '';
    case 'instructions': return t.editors.blocksSummary(c.instructions?.blocks.length ?? 0);
    case 'tools': return t.editors.toolsSummary(c.tools?.tools.length ?? 0, ALL_TOOLS.length);
    case 'delegate': return t.editors.targetsSummary((roles ?? []).filter(role => c.delegate?.targets[role.id]?.allowed).map(role => agentName(role, t)).join(', '));
    case 'access': return t.editors.accessSummary;
    case 'context': return t.editors.contextSummary;
    default: return assertNever(kind);
  }
}

function assertNever(value: never): never { throw new Error(`Unexpected component kind: ${String(value)}`); }

/** Card handlers an owning page supplies. */
export interface AgentEditorActions {
  saveTemplate?: (kind: TemplateKind) => void;
  remove?: (kind: ComponentKind) => void;
}

/** Component cards for one agent definition.
 * @param props Agent, change callback, workflow roles when the agent is a workflow role, open card state, actions, and copy.
 * @returns Cards in planned order, then preserved unknown components.
 */
export function AgentComponents({ agent, edit, roles, open, setOpen, actions, t }: {
  agent: Agent; edit: (change: (agent: Agent) => void) => void; roles: Agent[] | undefined;
  open: Record<string, boolean>; setOpen: (key: string, open: boolean) => void; actions: AgentEditorActions; t: MockCopy;
}) {
  const id = React.useId();
  const editKind = <Kind extends ComponentKind>(kind: Kind) => (change: (value: ComponentValues[Kind]) => void) =>
    edit(next => { const value = next.components[kind]; if (value) change(value); });
  const card = (kind: ComponentKind, body: React.ReactNode) => {
    const meta = COMPONENTS[kind];
    const copy = t.kinds[kind];
    const cardActions = <>
      {meta.template && actions.saveTemplate && <Button small onClick={() => actions.saveTemplate?.(kind as TemplateKind)}>{t.common.saveAsTemplate}</Button>}
      {!meta.required && actions.remove && <Button small onClick={() => actions.remove?.(kind)}>{t.common.remove}</Button>}
    </>;
    return <ComponentCard key={kind} supportLabel={t.support[meta.support]} effectLabel={t.modelVisible} title={copy.title} summary={componentSummary(kind, agent, roles, t)} support={meta.support}
      reason={meta.support === 'supported' ? undefined : copy.limit} effect={copy.effect} open={!!open[kind]} onToggle={() => setOpen(kind, !open[kind])} actions={cardActions}>
      {body}
    </ComponentCard>;
  };
  const c = agent.components;
  return <div className="studio-cards">
    {KINDS.map(kind => {
      switch (kind) {
        case 'model': return c.model && card(kind, <ModelEditor value={c.model} edit={editKind('model')} t={t} id={`${id}-model`} />);
        case 'instructions': return c.instructions && card(kind, <InstructionsEditor value={c.instructions} edit={editKind('instructions')} t={t} />);
        case 'tools': return c.tools && card(kind, <ToolsEditor value={c.tools} edit={editKind('tools')} t={t} />);
        case 'delegate': return c.delegate && card(kind, <DelegateEditor value={c.delegate} roles={roles} self={agent.id} edit={editKind('delegate')} t={t} id={`${id}-delegate`} />);
        case 'access': return c.access && card(kind, <SegmentedControl id={`${id}-access`} label={t.kinds.access.title} value="inherit" onChange={() => undefined} disabled
          options={[{ value: 'inherit', label: t.editors.accessInherit }, ...(['readOnly', 'workspace', 'full'] as const).map(mode => ({ value: mode, label: t.editors.accessModes[mode] }))]} />);
        case 'context': return c.context && card(kind, <div className="studio-field-grid">
          <label>{t.editors.contextWindow}<input type="number" placeholder="128000" disabled /></label>
          <label>{t.editors.contextThreshold}<input type="number" placeholder="80" disabled /></label>
        </div>);
        default: return assertNever(kind);
      }
    })}
    {agent.unknown.map(name => <ComponentCard key={name} supportLabel={t.support.missing} title={t.editors.unknownTitle} summary={`${name} · ${t.editors.unknownSummary}`} support="missing"
      open={!!open[name]} onToggle={() => setOpen(name, !open[name])}>
      <p className="studio-reason">{t.editors.unknownBody}</p>
    </ComponentCard>)}
  </div>;
}
