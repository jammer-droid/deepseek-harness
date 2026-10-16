/** Gate composer modal: the gate drawn as a flow of steps, where each step shows what goes in and what comes out. Node-testable. */
import React from 'react';
import { GateJudgeEditor, makeJudgeStage } from './pixie-gate-judge-editor.tsx';
import { judgeText } from './pixie-gate-judge-locale.ts';
import { GateTrialPanel, type GateTrialAction } from './pixie-gate-trial-panel.tsx';
import { Badge, Button, CheckOption, DetailDialog, Notice, PickOption, Segmented, SettingsRow, Toggle } from './ui.tsx';
import { MAX_GATE_STAGES, type CommandSpec, type GateDefinition, type GatePoint, type StageDefinition, type StageRole } from './pixie-gate-contracts.ts';
import { gateEditorText, type GateEditorKey } from './pixie-gate-editor-locale.ts';
import { gatePointText } from './pixie-gate-locale.ts';
import { gateComposeText, type GateComposeKey } from './pixie-gate-compose-locale.ts';
import { makeStage, message, validation, type GateEntry } from './pixie-gate-editor.tsx';
import type { PixieSettingsCatalog } from './pixie-settings.tsx';

const POINTS: readonly GatePoint[] = ['input', 'tool-before', 'tool-after', 'turn-end'];
/** Points whose output can replace text; the others only record, deny, or steer. */
const rewrites = (point: GatePoint) => point === 'input' || point === 'tool-after';
type Node = 'point' | 'start' | 'end' | 'result' | 'trial' | `stage-${number}`;

/** Which flow node owns a validation field address. */
function nodeOf(field: string): Node {
  if (field.startsWith('stage-')) return `stage-${Number(field.split('-')[1])}`;
  if (field === 'start' || field === 'end') return field;
  if (field === 'timeout' || field === 'forward') return 'result';
  return 'point';
}

/** Variables a stage may reference: built-ins, the start hook, and every earlier stage. */
export function stageVariables(definition: GateDefinition, index: number): string[] {
  const prior = [...(definition.hooks?.start ? ['start'] : []), ...definition.stages.slice(0, index).map(stage => stage.id)];
  return ['{{subject}}', '{{original}}', '{{hooks.context}}', ...prior.flatMap(id => ['text', 'reason', 'data'].map(part => `{{stages.${id}.${part}}}`))];
}

export function GateComposer({ entry: initial, isNew = false, open, models, trial, locale, onSave, onClose }: {
  entry: GateEntry | undefined; isNew?: boolean; open: boolean; models: PixieSettingsCatalog; trial: GateTrialAction; locale: string;
  onSave(entry: GateEntry): Promise<boolean>; onClose(): void;
}) {
  const t = (key: GateComposeKey, values?: Record<string, string | number>) => gateComposeText(locale, key, values);
  const e = (key: GateEditorKey) => gateEditorText(locale, key);
  const [entry, setEntry] = React.useState(initial);
  // A gate that is not saved yet starts dirty so it can be saved without edits.
  const [baseline, setBaseline] = React.useState(isNew ? '' : JSON.stringify(initial));
  const [node, setNode] = React.useState<Node>('point');
  const [problem, setProblem] = React.useState<ReturnType<typeof validation>>();
  const [notice, setNotice] = React.useState('');
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);
  React.useEffect(() => { setEntry(initial); setBaseline(isNew ? '' : JSON.stringify(initial)); setNode('point'); setProblem(undefined); setNotice(''); setError(''); setLeaving(false); }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!entry) return <DetailDialog open={false} title="" onClose={onClose} />;
  const g = entry.definition;
  const dirty = JSON.stringify(entry) !== baseline;
  const update = (patch: Partial<GateDefinition>) => { setEntry({ ...entry, definition: { ...g, ...patch } }); setProblem(undefined); setLeaving(false); };
  const setStage = (index: number, stage: StageDefinition) => update({ stages: g.stages.map((value, i) => i === index ? stage : value) });
  const problemAt = (field: string) => problem?.field === field ? <Notice>{e(problem.key)}</Notice> : null;
  const save = async () => {
    setError('');
    const found = validation(entry);
    if (found) { setProblem(found); setNode(nodeOf(found.field)); return; }
    setSaving(true);
    try { if (await onSave(entry)) { setBaseline(JSON.stringify(entry)); setLeaving(false); } }
    catch (reason) { setError(`${t('saveFailed')} (${message(reason)})`); }
    finally { setSaving(false); }
  };
  const close = () => { if (dirty && !leaving) { setLeaving(true); return; } onClose(); };

  /** The text a stage receives as {{subject}}: the original until a revise stage rewrote it. */
  const carried = (index: number) => {
    const reviser = g.stages.slice(0, index).reverse().find(stage => stage.kind !== 'judge' && stage.role === 'revise');
    return reviser ? t('carriesRevised', { id: reviser.id }) : t('originalText');
  };
  const forwardSummary = () => g.forward.kind === 'original' ? t('forwardSummary-original')
    : g.forward.kind === 'replace' ? t('forwardSummary-replace', { from: g.forward.from === 'subject' ? t('finalText') : g.forward.from })
      : t('forwardSummary-append', { from: g.forward.from.join(', ') || '—' });
  const flagged = (target: Node) => problem && nodeOf(problem.field) === target;
  const item = (target: Node, kind: string, title: React.ReactNode, meta: React.ReactNode, extra?: React.ReactNode) => <li>
    <button type="button" className="studio-gate-node" aria-current={node === target ? 'step' : undefined} data-gate-node={target} onClick={() => setNode(target)}>
      <span className="studio-gate-node-kind">{kind}</span>
      <span className="studio-gate-node-title">{title}{extra}{flagged(target) && <Badge tone="warning">{t('problem')}</Badge>}</span>
      <span className="studio-gate-node-meta">{meta}</span>
    </button>
  </li>;
  const addStage = (at: number) => {
    let n = 1; while (g.stages.some(stage => stage.id === `stage${n}`)) n++;
    const stages = [...g.stages]; stages.splice(at, 0, makeStage(`stage${n}`));
    update({ stages }); setNode(`stage-${at}`);
  };
  const adder = (at: number) => g.stages.length < MAX_GATE_STAGES
    ? <li className="studio-gate-add"><Button small aria-label={`${t('addStage')} ${at + 1}`} title={t('addStage')} onClick={() => addStage(at)}>+</Button></li>
    : null;
  const flow = <ol className="studio-gate-flow" aria-label={t('flow')}>
    {item('point', t('pointNode'), gatePointText(locale, g.point), t(`in-${g.point}`))}
    {item('start', t('startHook'), g.hooks?.start ? <code>{g.hooks.start.command.split('\n')[0]}</code> : t('notUsed'), g.hooks?.start ? t('outLabel') + ': skip / fail / data' : '')}
    {g.stages.map((stage, i) => <React.Fragment key={i}>
      {adder(i)}
      {item(`stage-${i}`, `${i + 1} · ${stage.id}`, t(`kind-${stage.kind}`), <>{t('inLabel')}: {carried(i)} → {t('outLabel')}: {t(stage.kind === 'judge' ? 'out-judge' : `out-${stage.role}`)}</>, stage.kind !== 'judge' && <Badge tone="outline">{t(`role-${stage.role}`)}</Badge>)}
    </React.Fragment>)}
    {adder(g.stages.length)}
    {item('end', t('endHook'), g.hooks?.end ? <code>{g.hooks.end.command.split('\n')[0]}</code> : t('notUsed'), '')}
    {item('result', t('resultNode'), forwardSummary(), `${t('onFail')}: ${t(`fail-${g.point}`)}`)}
    {item('trial', t('trialNode'), e('trial'), '')}
  </ol>;

  const io = (input: React.ReactNode, output: React.ReactNode) => <div className="studio-gate-io">
    <div><span className="studio-gate-io-label">{t('inLabel')}</span><div>{input}</div></div>
    <div><span className="studio-gate-io-label">{t('outLabel')}</span><div>{output}</div></div>
  </div>;
  const variables = (index: number) => <div className="studio-gate-vars" aria-label={t('variables')}><span className="studio-muted">{t('variables')}</span>{stageVariables(g, index).map(value => <code key={value}>{value}</code>)}</div>;
  const modelSelect = (stage: Extract<StageDefinition, { kind: 'converse' | 'judge' }>, index: number) => <SettingsRow title={e('model')} control={
    <select className="studio-compact" aria-label={e('model')} value={stage.model ? JSON.stringify([stage.model.provider, stage.model.model]) : ''} onChange={event => {
      const { model: _, ...rest } = stage; const route = event.target.value ? JSON.parse(event.target.value) as string[] : undefined;
      setStage(index, route ? { ...rest, model: { provider: route[0]!, model: route[1]! } } : rest);
    }}><option value="">{stage.kind === 'judge' ? judgeText(locale, 'defaultModel') : e('defaultModel')}</option>{models.groups.map(group => <optgroup key={group.id} label={group.name}>{group.models.map(model => <option key={model.id} value={JSON.stringify([group.id, model.id])}>{model.name}</option>)}</optgroup>)}</select>} />;

  const pointPanel = <>
    <SettingsRow title={e('name')}><input aria-label={e('name')} value={g.name} onChange={event => update({ name: event.target.value })} />{problemAt('name')}</SettingsRow>
    <SettingsRow title={t('pointNode')} description={t('pointHelp')}>
      <div className="studio-pick-list" role="radiogroup" aria-label={t('pointNode')}>{POINTS.map(point => <PickOption key={point} checked={g.point === point} title={gatePointText(locale, point)} description={t(`pick-${point}`)} onClick={() => {
        if (point === g.point) return;
        const restricted = !rewrites(point);
        const cleaned = restricted && (g.forward.kind !== 'original' || g.stages.some(stage => stage.kind !== 'judge' && stage.role === 'revise'));
        update({ point, match: { ...g.match, ...(point === 'input' ? { sources: g.match.sources ?? ['user'] } : {}) }, ...(restricted ? { forward: { kind: 'original' }, stages: g.stages.map(stage => stage.kind !== 'judge' && stage.role === 'revise' ? { ...stage, role: 'check' } : stage) } : {}) });
        setNotice(cleaned ? e('cleaned') : '');
      }} />)}</div>
    </SettingsRow>
    {io(t('pointIn', { source: t(`in-${g.point}`) }), <><p>{t('onFail')}: {t(`fail-${g.point}`)}</p><p>{t('onPass')}: {rewrites(g.point) ? forwardSummary() : t(`pass-${g.point as 'tool-before' | 'turn-end'}`)}</p></>)}
    <p className="studio-muted">{t('scopeNote')}</p>
  </>;

  const hookPanel = (hook: 'start' | 'end') => {
    const spec = g.hooks?.[hook];
    const set = (next: CommandSpec | undefined) => { const hooks = { ...g.hooks }; if (next) hooks[hook] = next; else delete hooks[hook]; update({ hooks }); };
    return <>
      {io(t(hook === 'start' ? 'hookStartIn' : 'hookEndIn'), t(hook === 'start' ? 'hookStartOut' : 'hookEndOut'))}
      {!spec ? <div className="studio-inline-actions"><Button onClick={() => set({ command: '' })}>{t('addHook')}</Button></div> : <>
        <SettingsRow title={t('hookCommand')}><textarea aria-label={e(hook)} value={spec.command} onChange={event => set({ ...spec, command: event.target.value })} />{problemAt(hook)}</SettingsRow>
        <SettingsRow title={t('hookTimeout')} control={<input className="studio-compact" type="number" min={1} aria-label={t('hookTimeout')} value={spec.timeoutMs ?? ''} onChange={event => { const { timeoutMs: _, ...rest } = spec; set(event.target.value ? { ...rest, timeoutMs: Number(event.target.value) } : rest); }} />} />
        <div className="studio-inline-actions"><Button onClick={() => set(undefined)}>{t('removeHook')}</Button></div>
      </>}
    </>;
  };

  let stageActions: React.ReactNode = null;
  const stagePanel = (index: number) => {
    const stage = g.stages[index]!;
    const roles: readonly StageRole[] = rewrites(g.point) ? ['check', 'revise', 'note'] : ['check', 'note'];
    const move = (to: number) => { const stages = [...g.stages]; [stages[index], stages[to]] = [stages[to]!, stages[index]!]; update({ stages }); setNode(`stage-${to}`); };
    const output = stage.kind === 'judge' ? t('roleOut-judge') : t(`roleOut-${stage.role}`, { id: stage.id });
    stageActions = <>
      <Button small disabled={index === 0} onClick={() => move(index - 1)}>{t('moveUp')}</Button>
      <Button small disabled={index === g.stages.length - 1} onClick={() => move(index + 1)}>{t('moveDown')}</Button>
      <Button small disabled={g.stages.length === 1} title={g.stages.length === 1 ? e('minStages') : undefined} onClick={() => { update({ stages: g.stages.filter((_, i) => i !== index) }); setNode(index > 0 ? `stage-${index - 1}` : 'point'); }}>{t('removeStage')}</Button>
    </>;
    return <>
      <SettingsRow title={e('id')} control={<input className="studio-compact" aria-label={e('id')} value={stage.id} onChange={event => setStage(index, { ...stage, id: event.target.value })} />}>{problemAt(`stage-${index}-id`)}</SettingsRow>
      <SettingsRow title={t('stageKind')} control={<Segmented label={t('stageKind')} value={stage.kind} options={(['command', 'converse', 'judge'] as const).map(kind => ({ value: kind, label: t(`kind-${kind}`) }))} onChange={kind => {
        if (kind === stage.kind) return;
        const role = stage.kind === 'judge' ? 'check' : stage.role;
        setStage(index, kind === 'judge' ? makeJudgeStage(stage.id) : kind === 'command' ? { id: stage.id, kind, role, command: { command: '' } } : { id: stage.id, kind, role, prompt: '{{subject}}' });
      }} />} />
      {stage.kind !== 'judge' && <SettingsRow title={t('stageRole')} control={<Segmented label={t('stageRole')} value={stage.role} options={roles.map(role => ({ value: role, label: t(`role-${role}`) }))} onChange={role => setStage(index, { ...stage, role })} />}>{problemAt(`stage-${index}-role`)}</SettingsRow>}
      {io(<><p>{t('carries')}: <strong>{carried(index)}</strong></p><p>{t(`kindIn-${stage.kind}`)}</p></>, <p>{output}</p>)}
      {stage.kind === 'command' && <>
        <SettingsRow title={e('command')} description={t('commandHelp')}><textarea className="studio-gate-code" aria-label={e('command')} value={stage.command.command} onChange={event => setStage(index, { ...stage, command: { ...stage.command, command: event.target.value } })} />{problemAt(`stage-${index}-command`)}</SettingsRow>
        <SettingsRow title={e('commandTimeout')} control={<input className="studio-compact" type="number" min={1} aria-label={e('commandTimeout')} value={stage.command.timeoutMs ?? ''} onChange={event => { const { timeoutMs: _, ...command } = stage.command; setStage(index, { ...stage, command: event.target.value ? { ...command, timeoutMs: Number(event.target.value) } : command }); }} />} />
      </>}
      {stage.kind === 'converse' && <>
        {modelSelect(stage, index)}
        <SettingsRow title={e('system')}><textarea aria-label={e('system')} value={stage.system ?? ''} onChange={event => setStage(index, { ...stage, system: event.target.value })} /></SettingsRow>
        <SettingsRow title={e('prompt')} description={stage.role === 'check' ? t('checkHelp') : undefined}><textarea aria-label={e('prompt')} value={stage.prompt} onChange={event => setStage(index, { ...stage, prompt: event.target.value })} />{problemAt(`stage-${index}-prompt`)}</SettingsRow>
        {variables(index)}
      </>}
      {stage.kind === 'judge' && <>
        {modelSelect(stage, index)}
        {variables(index)}
        <GateJudgeEditor stage={stage} definition={g} index={index} onChange={next => setStage(index, next)} locale={locale} />
      </>}
    </>;
  };

  const resultPanel = <>
    <p className="studio-muted">{t('resultHelp')}</p>
    {rewrites(g.point) ? <>
      <SettingsRow title={t('forwardLabel')} control={<Segmented label={t('forwardLabel')} value={g.forward.kind} options={(['original', 'replace', 'append'] as const).map(kind => ({ value: kind, label: t(`forward-${kind}`) }))} onChange={kind => update({ forward: kind === 'replace' ? { kind, from: 'subject' } : kind === 'append' ? { kind, from: [] } : { kind: 'original' } })} />}>{problemAt('forward')}</SettingsRow>
      {g.forward.kind === 'replace' && <SettingsRow title={t('replaceFrom')} control={<select className="studio-compact" aria-label={t('replaceFrom')} value={g.forward.from} onChange={event => update({ forward: { kind: 'replace', from: event.target.value } })}><option value="subject">{t('finalText')}</option>{g.stages.map(stage => <option key={stage.id} value={stage.id}>{stage.id}</option>)}</select>} />}
      {g.forward.kind === 'append' && <SettingsRow title={t('appendFrom')}><div role="group" aria-label={t('appendFrom')}>{g.stages.map(stage => <CheckOption key={stage.id} label={stage.id} checked={(g.forward as { from: string[] }).from.includes(stage.id)} onChange={checked => { const from = (g.forward as { from: string[] }).from; update({ forward: { kind: 'append', from: checked ? [...from, stage.id] : from.filter(id => id !== stage.id) } }); }} />)}</div></SettingsRow>}
      {g.point === 'input' && <SettingsRow title={t('confirm')} description={t('confirmHelp')} control={<Toggle label={t('confirm')} checked={g.confirmRevision} onChange={confirmRevision => update({ confirmRevision })} />} />}
    </> : <SettingsRow title={t('onPass')} description={t(`pass-${g.point as 'tool-before' | 'turn-end'}`)} />}
    <SettingsRow title={t('onFail')} description={t(`fail-${g.point}`)} />
    <SettingsRow title={t('onErrorLabel')} control={<Segmented label={t('onErrorLabel')} value={g.onError} options={[{ value: 'pass', label: t('errorPass') }, { value: 'block', label: t('errorBlock') }]} onChange={onError => update({ onError })} />} />
    <SettingsRow title={t('timeout')} control={<input className="studio-compact" type="number" min={1} aria-label={t('timeout')} value={g.limits.stageTimeoutMs} onChange={event => update({ limits: { ...g.limits, stageTimeoutMs: Number(event.target.value) } })} />}>{problemAt('timeout')}</SettingsRow>
    {g.point === 'turn-end' && <SettingsRow title={t('steers')} control={<input className="studio-compact" type="number" min={0} aria-label={t('steers')} value={g.limits.maxSteersPerTurn} onChange={event => update({ limits: { ...g.limits, maxSteersPerTurn: Number(event.target.value) } })} />} />}
  </>;

  const index = node.startsWith('stage-') ? Number(node.slice(6)) : -1;
  const panel = node === 'point' ? pointPanel : node === 'start' || node === 'end' ? hookPanel(node) : node === 'result' ? resultPanel
    : node === 'trial' ? null : g.stages[index] ? stagePanel(index) : pointPanel;
  const panelTitle = node === 'point' ? t('pointNode') : node === 'start' ? t('startHook') : node === 'end' ? t('endHook') : node === 'result' ? t('resultNode') : node === 'trial' ? t('trialNode') : `${index + 1} · ${g.stages[index]?.id ?? ''}`;
  return <DetailDialog wide open={open} title={g.name || t('newGateName')} subtitle={gatePointText(locale, g.point)} onClose={close} footer={<>
    <Button disabled={saving} onClick={close}>{t('close')}</Button>
    <Button primary disabled={saving || !dirty} onClick={() => void save()}>{saving ? t('saving') : dirty ? t('save') : t('saved')}</Button>
  </>}>
    <div className="studio-gate-composer-frame"><fieldset disabled={saving} className="studio-config-root studio-gate-composer">
      {leaving && <Notice action={<><Button small onClick={() => setLeaving(false)}>{t('keepEditing')}</Button><Button small onClick={onClose}>{t('discard')}</Button></>}>{t('discardTitle')}</Notice>}
      {error && <Notice action={<Button small onClick={() => setError('')}>{t('close')}</Button>}>{error}</Notice>}
      {notice && <Notice tone="info" action={<Button small onClick={() => setNotice('')}>{t('close')}</Button>}>{notice}</Notice>}
      {problem?.field === '' && <Notice>{e(problem.key)}</Notice>}
      {flow}
      <section className="studio-gate-panel" aria-label={t('node')}>
        {node !== 'trial' && <div className="studio-section-head"><h3 className="studio-panel-title">{panelTitle}</h3>{index >= 0 && stageActions && <div className="studio-inline-actions">{stageActions}</div>}</div>}
        {panel}
        {/* Kept mounted so a running or finished trial survives switching steps. */}
        <div hidden={node !== 'trial'}><GateTrialPanel definition={g} trial={trial} locale={locale} /></div>
      </section>
    </fieldset></div>
  </DetailDialog>;
}
