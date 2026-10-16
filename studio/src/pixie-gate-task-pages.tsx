/** Task-centred gate pages (R3): template picker, two-field editor with Advanced, and scope, saved through the Host. Node-testable. */
import React from 'react';
import { Badge, Button, CheckOption, DetailDialog, Disclosure, Notice, PageHead, PickOption, Segmented, SettingsRow, Toggle } from './ui.tsx';
import { gateTaskText, type GateTaskKey } from './pixie-gate-task-locale.ts';
import { GATE_GUIDE_URL, GATE_SCRIPT_DIR, GATE_TEMPLATES, GATE_WHENS, isMessage, isTool, makeTask, taskFromTemplate, taskProblem, taskVariables, type GateTask, type GateTemplate } from './pixie-gate-task.ts';
import type { GateOutput, gateOutputPlan } from './pixie-gate-task-contracts.ts';
import type { GateTasksRead } from './pixie-gate-definitions.ts';
import type { PixieUsage } from './pixie-contracts.ts';

type Text = (key: GateTaskKey, values?: Record<string, string | number>) => string;
const useText = (locale: string): Text => (key, values) => gateTaskText(locale, key, values);

export interface GateTrialResponse { output: GateOutput; plan: ReturnType<typeof gateOutputPlan>; usage: PixieUsage; skipped?: 'script' }
export interface GateScriptList { directory: string; defaultDirectory: string; custom: boolean; supported: boolean; scripts: string[] }
/** Host Remote calls the gate pages use. */
export interface GateTaskActions {
  read(): Promise<GateTasksRead>;
  save(tasks: GateTask[]): Promise<unknown>;
  scripts(): Promise<GateScriptList>;
  /** Empty restores the default folder. */
  saveScriptDirectory(directory: string): Promise<GateScriptList>;
  trial(request: { task: GateTask; text: string; toolName?: string }): { result: Promise<GateTrialResponse>; cancel(): void };
  presets(): Promise<{ id: string; name: string }[]>;
}

/** Shared state for both gate pages: one draft list, saved as a whole (`saveGateDefinitions`). */
export function useGateTasks(actions: GateTaskActions) {
  const [tasks, setTasks] = React.useState<GateTask[]>();
  const [stored, setStored] = React.useState('');
  const [invalid, setInvalid] = React.useState<GateTasksRead['invalid']>([]);
  const [error, setError] = React.useState('');
  const [status, setStatus] = React.useState<'idle' | 'saving' | 'saved'>('idle');
  const [saveError, setSaveError] = React.useState('');
  const load = React.useCallback(async () => {
    setError('');
    try {
      const read = await actions.read();
      if (read.error) throw new Error(read.error.message);
      setTasks(read.entries); setStored(JSON.stringify(read.entries)); setInvalid(read.invalid);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }, [actions]);
  React.useEffect(() => { void load(); }, [load]);
  const edit = (change: (old: GateTask[]) => GateTask[]) => { setTasks(old => old && change(old)); setStatus('idle'); setSaveError(''); };
  const save = async () => {
    if (!tasks) return;
    setStatus('saving'); setSaveError('');
    try { await actions.save(tasks); setStored(JSON.stringify(tasks)); setInvalid([]); setStatus('saved'); }
    catch (cause) { setStatus('idle'); setSaveError(cause instanceof Error ? cause.message : String(cause)); }
  };
  return {
    tasks: tasks ?? [], loaded: tasks !== undefined, error, invalid, status, saveError, actions, load, saveAll: save,
    dirty: tasks !== undefined && JSON.stringify(tasks) !== stored,
    clearSaveError: () => setSaveError(''),
    save: (task: GateTask) => edit(old => old.some(item => item.id === task.id) ? old.map(item => item.id === task.id ? task : item) : [...old, task]),
    remove: (id: string) => edit(old => old.filter(item => item.id !== id)),
    update: (id: string, change: (task: GateTask) => GateTask) => edit(old => old.map(item => item.id === id ? change(item) : item)),
  };
}
export type GateTasks = ReturnType<typeof useGateTasks>;

/** Page head with Save, plus the shared load/save/invalid lines. */
function GateHead({ gates, title, description, t }: { gates: GateTasks; title: string; description: string; t: Text }) {
  return <>
    <PageHead title={title} description={description} actions={gates.loaded ? <Button primary disabled={gates.status === 'saving' || !gates.dirty} onClick={() => { void gates.saveAll(); }}>{gates.status === 'saving' ? t('saving') : gates.dirty ? t('save') : t('saved')}</Button> : undefined} />
    {gates.saveError && <Notice action={<Button small onClick={gates.clearSaveError}>{t('dismiss')}</Button>}>{`${t('saveFailed')} (${gates.saveError})`}</Notice>}
    {gates.error && <Notice action={<Button small onClick={() => { void gates.load(); }}>{t('retry')}</Button>}>{gates.error}</Notice>}
    {!gates.error && !gates.loaded && <p role="status" className="studio-muted">{t('loading')}</p>}
    {gates.invalid.length > 0 && <Notice>{t('invalid', { count: gates.invalid.length, reasons: gates.invalid.map(item => `#${item.index + 1} ${item.error.message}`).join('; ') })}</Notice>}
    {gates.dirty && <Notice tone="info">{t('unsaved')}</Notice>}
  </>;
}

/** Template picker shown before the editor (U21). */
function TemplatePicker({ open, locale, onPick, onClose }: { open: boolean; locale: string; onPick(task: GateTask): void; onClose(): void }) {
  const t = useText(locale);
  const pick = (template: GateTemplate) => onPick(taskFromTemplate(template, {
    name: t(`tpl-${template.id}`),
    instruction: template.available ? t(`tplText-${template.id}` as GateTaskKey) : '',
    ...(template.judge ? { question: t(`tplQuestion-${template.id}` as GateTaskKey) } : {}),
  }));
  return <DetailDialog open={open} title={t('pickTemplate')} subtitle={t('pickHint')} onClose={onClose} footer={<Button onClick={onClose}>{t('cancel')}</Button>}>
    <ul className="studio-pick-list" aria-label={t('pickTemplate')}>
      {GATE_TEMPLATES.map(template => <li key={template.id}>
        {template.available
          ? <PickOption title={<>{t(`tpl-${template.id}`)}<Badge tone="outline">{t(`when-${template.when}`)}</Badge></>} description={t(`tplDesc-${template.id}`)} onClick={() => pick(template)} />
          : <div className="studio-pick studio-pick-disabled" aria-disabled="true"><span className="studio-pick-title">{t(`tpl-${template.id}`)}<Badge tone="neutral">{t('soon')}</Badge></span><span className="studio-muted">{t(`tplDesc-${template.id}`)} {t('soonHint')}</span></div>}
      </li>)}
      <li><PickOption title={t('blank')} description={t('blankDescription')} onClick={() => onPick(makeTask(t('newGate')))} /></li>
    </ul>
  </DetailDialog>;
}

/** Two-field editor: When and What Pixie does; everything else under Advanced. */
export function GateTaskEditor({ task: initial, open, locale, actions, onApply, onClose }: { task: GateTask | undefined; open: boolean; locale: string; actions: GateTaskActions; onApply(task: GateTask): void; onClose(): void }) {
  const t = useText(locale);
  const [task, setTask] = React.useState(initial);
  const [problem, setProblem] = React.useState<ReturnType<typeof taskProblem>>();
  const [sample, setSample] = React.useState('');
  const [toolName, setToolName] = React.useState('');
  const [trial, setTrial] = React.useState<{ state: 'running'; cancel(): void } | { state: 'done'; value: GateTrialResponse } | { state: 'error'; message: string }>();
  const [copied, setCopied] = React.useState(false);
  const [scripts, setScripts] = React.useState<GateScriptList>();
  const [scriptError, setScriptError] = React.useState('');
  const refreshScripts = React.useCallback(async () => {
    setScriptError('');
    try { setScripts(await actions.scripts()); } catch (cause) { setScriptError(cause instanceof Error ? cause.message : String(cause)); }
  }, [actions]);
  React.useEffect(() => { if (open) void refreshScripts(); }, [open, refreshScripts]);
  React.useEffect(() => { setTask(initial); setProblem(undefined); setSample(''); setTrial(undefined); }, [initial]);
  React.useEffect(() => () => { if (trial?.state === 'running') trial.cancel(); }, [trial]);
  if (!task) return <DetailDialog open={false} title="" onClose={onClose} />;
  const set = (patch: Partial<GateTask>) => { setTask({ ...task, ...patch }); setProblem(undefined); setTrial(undefined); };
  const directory = scripts?.directory ?? GATE_SCRIPT_DIR;
  const runTrial = () => {
    const found = taskProblem(task); if (found) { setProblem(found); return; }
    const call = actions.trial({ task, text: sample, ...(isTool(task.when) && toolName.trim() ? { toolName: toolName.trim() } : {}) });
    setTrial({ state: 'running', cancel: call.cancel });
    call.result.then(value => setTrial(current => current?.state === 'running' ? { state: 'done', value } : current),
      cause => setTrial(current => current?.state === 'running' ? { state: 'error', message: cause instanceof Error ? cause.message : String(cause) } : current));
  };
  const field = (key: 'out-reason' | 'out-replace' | 'out-append' | 'out-note', value: string | undefined) => <React.Fragment key={key}><dt>{t(key)}</dt><dd className={value === undefined ? 'studio-muted' : undefined}>{value ?? t('trialEmpty')}</dd></React.Fragment>;
  const planKey = (plan: GateTrialResponse['plan']): GateTaskKey => plan.stop ? (plan.suggestion !== undefined && task.advanced.confirmReplace && plan.reason === undefined ? 'plan-confirm' : 'plan-stop') : plan.replacement !== undefined ? 'plan-replace' : plan.addition !== undefined ? 'plan-append' : 'plan-pass';
  const adv = (patch: Partial<GateTask['advanced']>) => set({ advanced: { ...task.advanced, ...patch } });
  const target = t(`target-${task.when}`);
  const variables = taskVariables(task);
  const apply = () => { const found = taskProblem(task); if (found) { setProblem(found); return; } onApply(task); };
  const problemAt = (key: NonNullable<ReturnType<typeof taskProblem>>) => problem === key ? <Notice>{t(`problem-${key}`)}</Notice> : null;
  return <DetailDialog open={open} title={task.name || t('newGate')} subtitle={t('applyHint')} onClose={onClose} footer={<>
    <Button onClick={onClose}>{t('close')}</Button>
    <Button primary onClick={apply}>{t('apply')}</Button>
  </>}>
    <div className="studio-gate-task">
      <SettingsRow title={t('name')}><input aria-label={t('name')} value={task.name} onChange={event => set({ name: event.target.value })} />{problemAt('name')}</SettingsRow>
      <SettingsRow title={t('when')} control={<select className="studio-compact" aria-label={t('when')} value={task.when} onChange={event => { const when = event.target.value as GateTask['when']; set({ when, advanced: { ...task.advanced, ...(!isMessage(when) ? { confirmReplace: false } : {}) } }); }}>
        {GATE_WHENS.map(when => <option key={when} value={when}>{t(`when-${when}`)}</option>)}
      </select>} />
      <SettingsRow title={t('what')} description={t('whatHint', { target })}>
        <textarea className="studio-gate-instruction" aria-label={t('what')} value={task.instruction} onChange={event => set({ instruction: event.target.value })} />
        {variables.length > 0 && <div className="studio-gate-vars"><span className="studio-muted">{t('variables')}</span>{variables.map((value, i) => <code key={value} title={t(i === 0 ? 'var-text' : 'var-data')}>{value}</code>)}</div>}
        {problemAt('instruction')}
      </SettingsRow>
      <Disclosure title={t('advanced')} description={t('advancedHint')}>
        <SettingsRow title={t('script')} description={t('scriptHint')} control={<select className="studio-compact" aria-label={t('script')} value={task.advanced.script ?? ''} onChange={event => { const { script: _, ...rest } = task.advanced; set({ advanced: event.target.value ? { ...rest, script: event.target.value } : rest }); }}>
          <option value="">{t('noScript')}</option>
          {(scripts?.scripts ?? []).map(name => <option key={name} value={name}>{name}</option>)}
          {task.advanced.script && !(scripts?.scripts ?? []).includes(task.advanced.script) && <option value={task.advanced.script}>{`${task.advanced.script} ${t('scriptMissing')}`}</option>}
        </select>}>
          <div className="studio-gate-path"><span className="studio-muted">{t('scriptDir')}</span><code>{directory}</code>
            <Button small onClick={async () => { try { await navigator.clipboard.writeText(directory); setCopied(true); } catch { setCopied(false); } }}>{copied ? '✓' : t('copyPath')}</Button>
            <Button small onClick={() => { void refreshScripts(); }}>{t('refresh')}</Button>
          </div>
          {scriptError && <Notice>{`${t('scriptsFailed')} (${scriptError})`}</Notice>}
          {scripts && !scripts.supported && <Notice>{t('scriptUnsupported')}</Notice>}
          <p className="studio-muted">{t('scriptEnv')}</p>
          <p className="studio-muted">{t('scriptShell')} <a href={GATE_GUIDE_URL} target="_blank" rel="noreferrer">{t('guideLink')}</a></p>
        </SettingsRow>
        <SettingsRow title={t('judge')} description={t('judgeHint')} control={<Toggle label={t('judge')} checked={!!task.advanced.judge} onChange={on => { const { judge: _, ...rest } = task.advanced; set({ advanced: on ? { ...rest, judge: { question: '', threshold: 0.5 } } : rest }); }} />}>
          {task.advanced.judge && <div className="studio-gate-judge">
            <label className="studio-field"><span>{t('judgeQuestion')}</span><input aria-label={t('judgeQuestion')} value={task.advanced.judge.question} onChange={event => adv({ judge: { ...task.advanced.judge!, question: event.target.value } })} /></label>
            <label className="studio-field"><span>{t('judgeThreshold')}</span><input className="studio-compact" aria-label={t('judgeThreshold')} type="number" min={0} max={1} step={0.05} value={task.advanced.judge.threshold} onChange={event => adv({ judge: { ...task.advanced.judge!, threshold: Number(event.target.value) } })} /></label>
            {problemAt('judge')}
          </div>}
        </SettingsRow>
        {isMessage(task.when) && <SettingsRow title={t('confirmReplace')} description={t('confirmReplaceHint')} control={<Toggle label={t('confirmReplace')} checked={task.advanced.confirmReplace} onChange={confirmReplace => adv({ confirmReplace })} />} />}
        <SettingsRow title={t('onError')} control={<Segmented label={t('onError')} value={task.advanced.onError} options={[{ value: 'pass', label: t('errorPass') }, { value: 'block', label: t('errorBlock') }]} onChange={onError => adv({ onError })} />} />
        <SettingsRow title={t('agents')} control={<Segmented label={t('agents')} value={task.advanced.agents} options={(['root', 'child', 'any'] as const).map(value => ({ value, label: t(value) }))} onChange={agents => adv({ agents })} />} />
        <SettingsRow title={t('timeout')} control={<input className="studio-compact" type="number" min={1} aria-label={t('timeout')} value={task.advanced.timeoutMs / 1000} onChange={event => adv({ timeoutMs: Number(event.target.value) * 1000 })} />} />
        {task.when === 'turn-end' && <SettingsRow title={t('maxSteers')} control={<input className="studio-compact" type="number" min={0} aria-label={t('maxSteers')} value={task.advanced.maxSteers} onChange={event => adv({ maxSteers: Number(event.target.value) })} />} />}
        {problemAt('limits')}
      </Disclosure>
      <section className="studio-gate-trial" aria-label={t('trial')}>
        <h3 className="studio-panel-title">{t('trial')}</h3>
        <p className="studio-muted">{t('trialPreview')}</p>
        {task.advanced.script && <p className="studio-muted">{t('trialScript')}</p>}
        {isTool(task.when) && <input aria-label={t('trialTool')} placeholder={t('trialTool')} value={toolName} onChange={event => setToolName(event.target.value)} />}
        <textarea aria-label={t('trialSample', { target })} placeholder={t('trialSample', { target })} value={sample} onChange={event => { setSample(event.target.value); setTrial(undefined); }} />
        <div className="studio-inline-actions">
          {trial?.state === 'running'
            ? <><span role="status" className="studio-muted">{t('trialRunning')}</span><Button onClick={() => { trial.cancel(); setTrial(undefined); }}>{t('trialCancel')}</Button></>
            : <Button disabled={!sample.trim()} onClick={runTrial}>{t('trialRun')}</Button>}
        </div>
        {trial?.state === 'error' && <Notice>{`${t('trialFailed')} (${trial.message})`}</Notice>}
        {trial?.state === 'done' && <dl className="studio-gate-result" aria-label={t('trial')}>
          <dt>{t('out-verdict')}</dt><dd><Badge tone={trial.value.output.verdict === 'stop' ? 'warning' : 'success'}>{t(trial.value.output.verdict === 'stop' ? 'trialStop' : 'trialPass')}</Badge></dd>
          {field('out-reason', trial.value.output.reason)}
          {field('out-replace', trial.value.output.replace)}
          {field('out-append', trial.value.output.append)}
          {field('out-note', trial.value.output.note)}
          <dt>{t('trialApplied')}</dt><dd>{t(planKey(trial.value.plan))}</dd>
          <dt /><dd className="studio-muted">{t('trialUsage', { input: trial.value.usage.inputTokens, output: trial.value.usage.outputTokens })}</dd>
        </dl>}
      </section>
    </div>
  </DetailDialog>;
}

/** Composition: one card per gate showing its one-line sentence. */
export function GateTaskCompositionPage({ gates, locale }: { gates: GateTasks; locale: string }) {
  const t = useText(locale);
  const [picking, setPicking] = React.useState(false);
  const [editing, setEditing] = React.useState<GateTask>();
  // Summarize with the first line that is plain language, not a bare variable line.
  const firstLine = (text: string) => (text.split('\n').map(line => line.trim()).find(line => line && !/\{\{[^}]+\}\}\s*$/.test(line)) ?? text.trim()).slice(0, 80);
  return <div className="studio-page-stack">
    <GateHead gates={gates} title={t('composition')} description={t('compositionDescription')} t={t} />
    {gates.loaded && <div className="studio-inline-actions"><Button onClick={() => setPicking(true)}>{t('newGate')}</Button></div>}
    {gates.loaded && !gates.tasks.length && <p role="status" className="studio-muted">{t('empty')}</p>}
    {gates.tasks.length > 0 && <div className="studio-tool-cards studio-card-pair">{gates.tasks.map(task => <article className="studio-preset-card studio-gate-card" key={task.id} data-gate-task={task.id}>
      <div className="studio-card-head"><h3>{task.name}</h3><Badge tone={task.enabled ? 'success' : 'neutral'}>{t(task.enabled ? 'on' : 'off')}</Badge></div>
      <p className="studio-gate-sentence"><span>{t(`when-${task.when}`)}</span><span aria-hidden="true">→</span><span>{firstLine(task.instruction)}</span></p>
      <p className="studio-card-meta">{task.presetIds.length ? t('presetCount', { count: task.presetIds.length }) : t('noPreset')}{task.advanced.script ? ` · ${task.advanced.script}` : ''}</p>
      <div className="studio-card-footer">
        <Button small onClick={() => setEditing(structuredClone(task))}>{t('edit')}</Button>
        <Button small onClick={() => gates.save({ ...structuredClone(task), id: globalThis.crypto.randomUUID(), name: `${task.name} (${t('duplicate')})`, enabled: false })}>{t('duplicate')}</Button>
        <Button small onClick={() => gates.remove(task.id)}>{t('delete')}</Button>
      </div>
    </article>)}</div>}
    <TemplatePicker open={picking} locale={locale} onClose={() => setPicking(false)} onPick={task => { setPicking(false); setEditing(task); }} />
    <GateTaskEditor open={!!editing} task={editing} locale={locale} actions={gates.actions} onClose={() => setEditing(undefined)} onApply={task => { gates.save(task); setEditing(undefined); }} />
  </div>;
}

/** Script folder shared by every gate: the profile default unless the user sets another. */
function ScriptFolder({ actions, t }: { actions: GateTaskActions; t: Text }) {
  const [list, setList] = React.useState<GateScriptList>();
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const apply = async (value: string) => {
    setBusy(true); setError('');
    try { const next = await actions.saveScriptDirectory(value); setList(next); setDraft(next.custom ? next.directory : ''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };
  React.useEffect(() => {
    let active = true;
    actions.scripts().then(next => { if (active) { setList(next); setDraft(next.custom ? next.directory : ''); } }, cause => { if (active) setError(String(cause)); });
    return () => { active = false; };
  }, [actions]);
  return <section className="studio-settings-card" aria-label={t('folderTitle')}>
    <SettingsRow title={t('folderTitle')} description={t('folderHint')}>
      <div className="studio-gate-folder">
        <input aria-label={t('folderTitle')} placeholder={list?.defaultDirectory ?? GATE_SCRIPT_DIR} value={draft} disabled={busy} onChange={event => setDraft(event.target.value)} />
        <Button small disabled={busy || !list || draft.trim() === (list.custom ? list.directory : '')} onClick={() => { void apply(draft); }}>{t('folderApply')}</Button>
        <Button small disabled={busy || !list?.custom} onClick={() => { void apply(''); }}>{t('folderReset')}</Button>
      </div>
      {list && <p className="studio-card-meta">{t(list.custom ? 'folderCurrent' : 'folderDefault')}: <code>{list.directory}</code> · {t('folderCount', { count: list.scripts.length })}</p>}
      {list && !list.supported && <Notice>{t('scriptUnsupported')}</Notice>}
      {error && <Notice>{`${t('folderFailed')} (${error})`}</Notice>}
    </SettingsRow>
  </section>;
}

/** Scope grouped by preset: each preset lists the gates that run for it; gates without a preset come last. */
export function GateTaskScopePage({ gates, presets, locale }: { gates: GateTasks; presets: readonly { id: string; name: string }[]; locale: string }) {
  const t = useText(locale);
  // Preset choice opens a dialog so a row keeps its height however many presets exist.
  const [picking, setPicking] = React.useState<GateTask>();
  const [query, setQuery] = React.useState('');
  const choose = picking ? gates.tasks.find(task => task.id === picking.id) : undefined;
  const shown = presets.filter(preset => preset.name.toLowerCase().includes(query.trim().toLowerCase()));
  const used = [...new Set(gates.tasks.flatMap(task => task.presetIds))];
  const groups = [
    ...presets.filter(preset => used.includes(preset.id)).map(preset => ({ id: preset.id, name: preset.name, hint: undefined as string | undefined })),
    ...used.filter(id => !presets.some(preset => preset.id === id)).map(id => ({ id, name: `${id} ${t('unknownPreset')}`, hint: undefined })),
  ];
  const unassigned = gates.tasks.filter(task => !task.presetIds.length);
  const row = (task: GateTask, group: string | undefined) => {
    const conflict = group !== undefined && task.enabled && gates.tasks.some(other => other.id !== task.id && other.enabled && other.when === task.when && other.presetIds.includes(group));
    return <li key={task.id} className="studio-gate-scope-row" data-gate-scope={task.id}>
      <span className="studio-gate-scope-name"><strong>{task.name}</strong><span className="studio-card-meta">{t(`when-${task.when}`)}{task.advanced.script ? ` · ${task.advanced.script}` : ''}</span>{conflict && <Badge tone="warning">{t('conflict')}</Badge>}</span>
      <span className="studio-inline-actions">
        <Button small onClick={() => setPicking(task)}>{t('editPresets')}</Button>
        <Toggle label={`${t('enabled')} ${task.name}`} checked={task.enabled} onChange={enabled => gates.update(task.id, item => ({ ...item, enabled }))} />
      </span>
    </li>;
  };
  const section = (id: string | undefined, name: string, hint: string | undefined, tasks: GateTask[]) => <section key={id ?? 'none'} className="studio-settings-card" aria-label={name} data-gate-preset={id ?? ''}>
    <div className="studio-gate-scope-head"><strong>{name}</strong><span className="studio-card-meta">{t('gateCount', { count: tasks.length, on: tasks.filter(task => task.enabled).length })}</span></div>
    {hint && <p className="studio-card-meta">{hint}</p>}
    <ul className="studio-gate-scope-list">{tasks.map(task => row(task, id))}</ul>
  </section>;
  return <div className="studio-page-stack">
    <GateHead gates={gates} title={t('scope')} description={t('scopeDescription')} t={t} />
    <ScriptFolder actions={gates.actions} t={t} />
    {gates.loaded && !gates.tasks.length && <p role="status" className="studio-muted">{t('scopeEmpty')}</p>}
    {gates.tasks.length > 0 && <p className="studio-muted">{t('presetGroupHint')}</p>}
    {groups.map(group => section(group.id, group.name, group.hint, gates.tasks.filter(task => task.presetIds.includes(group.id))))}
    {unassigned.length > 0 && section(undefined, t('noPresetGroup'), t('noPresetGroupHint'), unassigned)}
    <DetailDialog compact open={!!choose} title={t('choosePresets')} subtitle={choose?.name} onClose={() => { setPicking(undefined); setQuery(''); }} footer={<Button primary onClick={() => { setPicking(undefined); setQuery(''); }}>{t('done')}</Button>}>
      {presets.length > 8 && <input aria-label={t('searchPresets')} placeholder={t('searchPresets')} value={query} onChange={event => setQuery(event.target.value)} />}
      <div className="studio-gate-preset-list" role="group" aria-label={`${t('presets')} ${choose?.name ?? ''}`}>{choose && shown.map(preset => <CheckOption key={preset.id} label={preset.name} checked={choose.presetIds.includes(preset.id)} onChange={checked => gates.update(choose.id, item => ({ ...item, presetIds: checked ? [...item.presetIds, preset.id] : item.presetIds.filter(id => id !== preset.id) }))} />)}</div>
    </DetailDialog>
  </div>;
}
