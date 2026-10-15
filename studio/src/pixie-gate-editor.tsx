import React from 'react';
import { GateJudgeEditor, makeJudgeStage } from './pixie-gate-judge-editor.tsx';
import { judgeText } from './pixie-gate-judge-locale.ts';
import { GateTrialPanel, type GateTrialAction } from './pixie-gate-trial-panel.tsx';
import { Button, CheckOption, Notice, PageHead, SectionHead, SettingsRow, Toggle } from './ui.tsx';
import { MAX_GATE_STAGES, validateGateDefinition, type GateDefinition, type StageDefinition } from './pixie-gate-contracts.ts';
import { gateEditorText, type GateEditorKey } from './pixie-gate-editor-locale.ts';
import type { PixieSettingsCatalog } from './pixie-settings.tsx';

export interface GateEntry { definition: GateDefinition; presetIds: string[] }
export interface GateEditorActions {
  read(): Promise<GateEntry[]>;
  save(entries: GateEntry[]): Promise<unknown>;
  presets(): Promise<{ id: string; name: string }[]>;
  models(): Promise<PixieSettingsCatalog>;
  trial: GateTrialAction;
}
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
const makeStage = (id: string): StageDefinition => ({ id, kind: 'converse', role: 'check', prompt: '{{subject}}' });
const makeGate = (name: string): GateEntry => ({ definition: { id: crypto.randomUUID(), name, enabled: false, point: 'input', match: { agents: 'root', sources: ['user'] }, stages: [makeStage('stage1')], onError: 'pass', confirmRevision: false, forward: { kind: 'original' }, limits: { stageTimeoutMs: 60000, maxSteersPerTurn: 1 } }, presetIds: [] });

/** A field address is found by validating progressively, preserving the contract's throw-first order. */
function validation(entry: GateEntry): { field: string; key: GateEditorKey } | undefined {
  try { validateGateDefinition(entry.definition); return; } catch (error) {
    const text = message(error), g = entry.definition;
    if (text === 'Gate needs id, name and enabled') return { field: 'name', key: 'invalidName' };
    if (text === 'Invalid gate limits') return { field: 'timeout', key: 'invalidLimits' };
    if (text.includes('forward') && !text.includes('variable')) return { field: 'forward', key: 'invalidForward' };
    for (const hook of ['start', 'end'] as const) {
      const c = g.hooks?.[hook];
      if (c && (!c.command.trim() || (c.timeoutMs !== undefined && !(c.timeoutMs > 0)))) return { field: hook, key: 'invalidCommand' };
    }
    for (let i = 0; i < g.stages.length; i++) {
      try { validateGateDefinition({ ...g, stages: g.stages.slice(0, i + 1), forward: { kind: 'original' } }); }
      catch (stageError) {
        const s = message(stageError);
        return { field: `stage-${i}-${s.includes('stage id') ? 'id' : s.includes('Command') || s.includes('command timeout') ? 'command' : s.includes('variable') ? 'prompt' : 'role'}`, key: s.includes('stage id') ? 'invalidId' : s.includes('Command') || s.includes('command timeout') ? 'invalidCommand' : s.includes('variable') ? 'invalidPrompt' : 'invalid' };
      }
    }
    return { field: '', key: 'invalid' };
  }
}

export function GateEditor({ actions, locale }: { actions: GateEditorActions; locale: string }) {
  const t = (key: GateEditorKey) => gateEditorText(locale, key);
  const [entries, setEntries] = React.useState<GateEntry[]>();
  const [stored, setStored] = React.useState('');
  const [selected, setSelected] = React.useState('');
  const [presets, setPresets] = React.useState<{ id: string; name: string }[]>([]);
  const [models, setModels] = React.useState<PixieSettingsCatalog>({ groups: [] });
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [problem, setProblem] = React.useState<ReturnType<typeof validation>>();
  const load = React.useCallback(async () => {
    setError('');
    try { const [values, list, catalog] = await Promise.all([actions.read(), actions.presets(), actions.models()]); setEntries(values); setStored(JSON.stringify(values)); setSelected(values[0]?.definition.id ?? ''); setPresets(list); setModels(catalog); }
    catch (e) { setError(message(e)); }
  }, [actions]);
  React.useEffect(() => { void load(); }, [load]);
  const entry = entries?.find(item => item.definition.id === selected);
  const g = entry?.definition;
  const dirty = !!entries && JSON.stringify(entries) !== stored;
  const update = (patch: Partial<GateDefinition>) => { setEntries(old => old?.map(item => item.definition.id === selected ? { ...item, definition: { ...item.definition, ...patch } } : item)); setProblem(undefined); };
  const stageUpdate = (index: number, stage: StageDefinition) => update({ stages: g!.stages.map((s, i) => i === index ? stage : s) });
  const save = async () => {
    if (!entries || saving) return;
    setError(''); setProblem(undefined);
    for (const item of entries) { const p = validation(item); if (p) { setSelected(item.definition.id); setProblem(p); return; } }
    setSaving(true);
    try { await actions.save(entries.map(item => ({ ...item, definition: validateGateDefinition(item.definition) }))); setStored(JSON.stringify(entries)); }
    catch (e) { setError(`${t('failed')} (${message(e)})`); }
    finally { setSaving(false); }
  };
  const field = (key: GateEditorKey, control: React.ReactNode, address: string = key) => <SettingsRow title={t(key)}><>{control}{problem?.field === address && <Notice>{t(problem.key)}</Notice>}</></SettingsRow>;
  const text = (key: GateEditorKey, value: string | number, change: (v: string) => void, address: string = key, numeric = false) => field(key, <input className="studio-compact" aria-label={t(key)} type={numeric ? 'number' : 'text'} value={value} onChange={e => change(e.target.value)} />, address);
  const select = (key: GateEditorKey, value: string, options: readonly GateEditorKey[], change: (v: string) => void, address: string = key) => field(key, <select className="studio-compact" aria-label={t(key)} value={value} onChange={e => change(e.target.value)}>{options.map(v => <option key={v} value={v} >{t(v)}</option>)}</select>, address);
  const add = (copy = false) => { const item = copy && entry ? structuredClone(entry) : makeGate(t('title')); if (copy) { item.definition.id = crypto.randomUUID(); item.definition.name += ` (${t('duplicate')})`; item.definition.enabled = false; } setEntries(old => [...old!, item]); setSelected(item.definition.id); setProblem(undefined); };
  return <div className="studio-page-stack">
    <PageHead title={t('title')} description={t('description')} actions={entries && <Button primary disabled={saving || !dirty} onClick={() => void save()}>{saving ? t('saving') : dirty ? t('save') : t('saved')}</Button>} />
    {error && <Notice action={!entries ? <Button onClick={() => void load()}>{t('retry')}</Button> : undefined}>{error}</Notice>}
    {notice && <Notice>{notice}</Notice>}
    {problem?.field === '' && <Notice>{t(problem.key)}</Notice>}
    {!entries && !error && <p role="status">{t('loading')}</p>}
    {entries && <fieldset disabled={saving} className="studio-config-root studio-page-stack">
      <section className="studio-settings-card" aria-label={t('title')}>
      <SectionHead title={t('title')} actions={<Button onClick={() => add()}>{t('add')}</Button>} />
      {!entries.length && <p className="studio-muted">{t('empty')}</p>}
      {entries.map(item => <div key={item.definition.id} className="studio-catalog-row"><Button aria-pressed={selected === item.definition.id} onClick={() => { setSelected(item.definition.id); setProblem(undefined); }}>{item.definition.name}</Button><span className="studio-muted"> {t(item.definition.point)} · {t(item.definition.enabled ? 'yes' : 'no')} · {t('presetCount').replace('{count}', String(item.presetIds.length))} · {t('stageCount').replace('{count}', String(item.definition.stages.length))}</span></div>)}
      </section>
      {g && entry && <>
        <SectionHead title={g.name} actions={<><Button onClick={() => add(true)}>{t('duplicate')}</Button><Button onClick={() => { const next = entries.filter(item => item.definition.id !== selected); setEntries(next); setSelected(next[0]?.definition.id ?? ''); setProblem(undefined); }}>{t('remove')}</Button></>} />
        <section className="studio-settings-card" aria-label={t('basic')}><SectionHead title={t('basic')} />
        {text('name', g.name, name => update({ name }))}
        {field('enabled', <Toggle label={t('enabled')} checked={g.enabled} onChange={enabled => update({ enabled })} />)}
        {select('point', g.point, ['input', 'tool-before', 'tool-after', 'turn-end'], point => {
          const restricted = point === 'tool-before' || point === 'turn-end';
          const cleaned = restricted && (g.forward.kind !== 'original' || g.stages.some(s => s.kind !== 'judge' && s.role === 'revise'));
          update({ point: point as GateDefinition['point'], ...(restricted ? { forward: { kind: 'original' }, stages: g.stages.map(s => s.kind !== 'judge' && s.role === 'revise' ? { ...s, role: 'check' } : s) } : {}) }); setNotice(cleaned ? t('cleaned') : '');
        })}
        {field('presets', <div role="group" aria-label={t('presets')}>{[...presets, ...entry.presetIds.filter(id => !presets.some(p => p.id === id)).map(id => ({ id, name: id }))].map(p => <CheckOption key={p.id} label={p.name} checked={entry.presetIds.includes(p.id)} onChange={checked => { const presetIds = checked ? [...entry.presetIds, p.id] : entry.presetIds.filter(id => id !== p.id); setEntries(entries.map(item => item === entry ? { ...item, presetIds } : item)); }} />)}</div>)}
        </section>
        <section className="studio-settings-card" aria-label={t('target')}><SectionHead title={t('target')} />
        {select('agents', g.match.agents ?? 'root', ['root', 'child', 'any'], agents => update({ match: { ...g.match, agents: agents as 'root' | 'child' | 'any' } }))}
        {g.point === 'input' && field('sources', <>{(['user', 'agent-message'] as const).map(source => <CheckOption key={source} label={t(source)} checked={(g.match.sources ?? ['user']).includes(source)} onChange={checked => update({ match: { ...g.match, sources: checked ? [...(g.match.sources ?? ['user']), source] : (g.match.sources ?? ['user']).filter(s => s !== source) } })} />)}</>)}
        {g.point.startsWith('tool-') && text('tools', g.match.tools?.join(', ') ?? '', value => update({ match: { ...g.match, tools: value.split(',').map(s => s.trim()).filter(Boolean) } }))}
        </section>
        <section className="studio-settings-card" aria-label={t('handling')}><SectionHead title={t('handling')} />
        {select('onError', g.onError, ['pass', 'block'], onError => update({ onError: onError as 'pass' | 'block' }))}
        {g.point === 'input' && field('confirm', <Toggle label={t('confirm')} checked={g.confirmRevision} onChange={confirmRevision => update({ confirmRevision })} />)}
        {select('forward', g.forward.kind, g.point === 'input' || g.point === 'tool-after' ? ['original', 'replace', 'append'] : ['original'], kind => update({ forward: kind === 'replace' ? { kind, from: 'subject' } : kind === 'append' ? { kind, from: [] } : { kind: 'original' } }))}
        {g.forward.kind === 'replace' && field('from', <select className="studio-compact" aria-label={t('from')} value={g.forward.from} onChange={e => update({ forward: { kind: 'replace', from: e.target.value } })}><option value="subject">{t('subject')}</option>{g.stages.map(s => <option key={s.id} value={s.id}>{s.id}</option>)}</select>)}
        {g.forward.kind === 'append' && field('from', <select multiple aria-label={t('from')} value={g.forward.from} onChange={e => update({ forward: { kind: 'append', from: [...e.target.selectedOptions].map(o => o.value) } })}>{g.stages.map(s => <option key={s.id} value={s.id}>{s.id}</option>)}</select>)}
        {text('timeout', g.limits.stageTimeoutMs, v => update({ limits: { ...g.limits, stageTimeoutMs: Number(v) } }), 'timeout', true)}
        {g.point === 'turn-end' && text('steers', g.limits.maxSteersPerTurn, v => update({ limits: { ...g.limits, maxSteersPerTurn: Number(v) } }), 'timeout', true)}
        </section>
        <section className="studio-settings-card" aria-label={t('hooks')}><SectionHead title={t('hooks')} />
        {(['start', 'end'] as const).map(hook => <React.Fragment key={hook}>{text(hook, g.hooks?.[hook]?.command ?? '', command => { const hooks = { ...g.hooks }; if (command) hooks[hook] = { ...hooks[hook], command }; else delete hooks[hook]; update({ hooks }); })}</React.Fragment>)}
        </section>
        <section className="studio-page-stack" aria-label={t('stages')}>
        <SectionHead title={t('stages')} actions={<Button disabled={g.stages.length >= MAX_GATE_STAGES} title={g.stages.length >= MAX_GATE_STAGES ? t('maxStages') : undefined} onClick={() => { let n = 1; while (g.stages.some(s => s.id === `stage${n}`)) n++; update({ stages: [...g.stages, makeStage(`stage${n}`)] }); }}>{t('addStage')}</Button>} />
        {g.stages.length >= MAX_GATE_STAGES && <p className="studio-muted">{t('maxStages')}</p>}
        {g.stages.map((s, i) => <section className="studio-settings-card" key={i} data-gate-editor-stage={i}>
          <SectionHead title={`${t('stages')} ${i + 1}`} actions={<><Button disabled={i === 0} onClick={() => { const stages = [...g.stages]; [stages[i - 1], stages[i]] = [stages[i]!, stages[i - 1]!]; update({ stages }); }}>{t('up')}</Button><Button disabled={i === g.stages.length - 1} onClick={() => { const stages = [...g.stages]; [stages[i + 1], stages[i]] = [stages[i]!, stages[i + 1]!]; update({ stages }); }}>{t('down')}</Button><Button disabled={g.stages.length === 1} title={g.stages.length === 1 ? t('minStages') : undefined} onClick={() => update({ stages: g.stages.filter((_, n) => n !== i) })}>{t('remove')}</Button></>} />
          {text('id', s.id, id => stageUpdate(i, { ...s, id }), `stage-${i}-id`)}
          {select('kind', s.kind, ['command', 'converse', 'judge'], kind => stageUpdate(i, kind === 'judge' ? makeJudgeStage(s.id) : kind === 'command' ? { id: s.id, kind, role: s.kind === 'judge' ? 'check' : s.role, command: { command: '' } } : { id: s.id, kind: 'converse', role: s.kind === 'judge' ? 'check' : s.role, prompt: '{{subject}}' }))}
          {s.kind !== 'judge' && select('role', s.role, g.point === 'input' || g.point === 'tool-after' ? ['check', 'revise', 'note'] : ['check', 'note'], role => stageUpdate(i, { ...s, role: role as 'check' | 'revise' | 'note' }), `stage-${i}-role`)}
          {s.kind === 'command' && <>{text('command', s.command.command, command => stageUpdate(i, { ...s, command: { ...s.command, command } }), `stage-${i}-command`)}{text('commandTimeout', s.command.timeoutMs ?? '', value => { const { timeoutMs: _, ...command } = s.command; stageUpdate(i, { ...s, command: value ? { ...command, timeoutMs: Number(value) } : command }); }, `stage-${i}-command`, true)}</>}
          {s.kind !== 'command' && <>
            {field('model', <select className="studio-compact" aria-label={t('model')} value={s.model ? JSON.stringify([s.model.provider, s.model.model]) : ''} onChange={e => { const { model: _, ...rest } = s; const v = e.target.value ? JSON.parse(e.target.value) as string[] : undefined; stageUpdate(i, v ? { ...rest, model: { provider: v[0]!, model: v[1]! } } : rest); }}><option value="">{s.kind === 'judge' ? judgeText(locale, 'defaultModel') : t('defaultModel')}</option>{models.groups.map(group => <optgroup key={group.id} label={group.name}>{group.models.map(m => <option key={m.id} value={JSON.stringify([group.id, m.id])}>{m.name}</option>)}</optgroup>)}</select>)}
            {s.kind === 'judge' ? <GateJudgeEditor stage={s} definition={g} index={i} onChange={next => stageUpdate(i, next)} locale={locale} /> : <>
            {field('system', <textarea aria-label={t('system')} value={s.system ?? ''} onChange={e => stageUpdate(i, { ...s, system: e.target.value })} />, `stage-${i}-prompt`)}
            {field('prompt', <textarea aria-label={t('prompt')} value={s.prompt} onChange={e => stageUpdate(i, { ...s, prompt: e.target.value })} />, `stage-${i}-prompt`)}
            </>}
            <p className="studio-muted">{t('variables')}: {['{{subject}}', '{{original}}', '{{hooks.context}}', ...(g.hooks?.start ? ['start'] : []), ...g.stages.slice(0, i).map(s => s.id)].flatMap(v => v.startsWith('{{') ? [v] : ['text', 'reason', 'data'].map(part => `{{stages.${v}.${part}}}`)).join(', ')}</p>
          </>}
        </section>)}
        </section>
      </>}
    </fieldset>}
    {g && <GateTrialPanel key={g.id} definition={g} trial={actions.trial} locale={locale} />}
  </div>;
}
