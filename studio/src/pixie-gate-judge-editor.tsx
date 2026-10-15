import React from 'react';
import { Button, IconButton, CheckOption, Notice, SectionHead, SettingsRow } from './ui.tsx';
import { validateGateDefinition, type GateDefinition, type JudgePassCondition, type StageDefinition } from './pixie-gate-contracts.ts';
import type { JudgeQuestion } from './pixie-contracts.ts';
import { judgeText, type JudgeTextKey } from './pixie-gate-judge-locale.ts';
import { gateEditorText } from './pixie-gate-editor-locale.ts';

type JudgeStage = Extract<StageDefinition, { kind: 'judge' }>;
const initialQuestion = (type: JudgeQuestion['type']): JudgeQuestion => type === 'choice' ? { type, options: { yes: '', no: '' } } : type === 'score' ? { type, levels: ['', ''] } : { type, question: '{{subject}}' };
const initialCondition = (question: string, q?: JudgeQuestion): JudgePassCondition => q?.type === 'choice' ? { question, type: 'choice', allowed: Object.keys(q.options).slice(0, 1) } : q?.type === 'score' ? { question, type: 'score', min: 0 } : { question, type: 'noul', threshold: 0.5 };
export const makeJudgeStage = (id: string): JudgeStage => ({ id, kind: 'judge', questions: { question1: initialQuestion('noul') }, pass: { mode: 'all', conditions: [initialCondition('question1')] } });

/** Keep broken references in the draft; the shared definition validator owns their validity. */
export function GateJudgeEditor({ stage, definition, index, onChange, locale }: {
  stage: JudgeStage; definition: GateDefinition; index: number; onChange(stage: JudgeStage): void; locale: string;
}) {
  const t = (key: JudgeTextKey) => judgeText(locale, key);
  const remove = gateEditorText(locale, 'remove');
  const [duplicate, setDuplicate] = React.useState('');
  const validate = (candidate: JudgeStage) => {
    try { validateGateDefinition({ ...definition, stages: [...definition.stages.slice(0, index), candidate], forward: { kind: 'original' } }); return ''; }
    catch (error) { return error instanceof Error ? error.message : String(error); }
  };
  const row = (key: JudgeTextKey, control: React.ReactNode) => <SettingsRow title={t(key)}>{control}</SettingsRow>;
  const input = (key: JudgeTextKey, value: string, change: (value: string) => void) => row(key, <input aria-label={t(key)} value={value} onChange={e => change(e.target.value)} />);
  const compactInput = (key: JudgeTextKey, value: string, change: (value: string) => void) => <label className="studio-field"><span>{t(key)}</span><input aria-label={t(key)} value={value} onChange={e => change(e.target.value)} /></label>;
  const deleteIcon = <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10M6 4V2h4v2M5 6v7h6V6" fill="none" stroke="currentColor" /></svg>;
  const updateQuestion = (id: string, question: JudgeQuestion) => onChange({ ...stage, questions: { ...stage.questions, [id]: question } });
  const conditionChange = (i: number, condition: JudgePassCondition) => onChange({ ...stage, pass: { ...stage.pass, conditions: stage.pass.conditions.map((value, n) => i === n ? condition : value) } });
  const unique = (ids: string[], prefix: string) => { let n = 1; while (ids.includes(`${prefix}${n}`)) n++; return `${prefix}${n}`; };
  return <div className="studio-page-stack">
    <Notice tone="info">{t('fixedRole')}</Notice>
    <SectionHead title={t('questions')} actions={<Button onClick={() => { const id = unique(Object.keys(stage.questions), 'question'); updateQuestion(id, initialQuestion('noul')); }}>{t('addQuestion')}</Button>} />
    {Object.entries(stage.questions).map(([id, q], qi) => {
      const error = validate({ ...stage, questions: { [id]: q }, pass: { mode: 'all', conditions: [initialCondition(id, q)] } });
      return <section key={qi} className="studio-form-section" data-judge-question={qi}>
        <SectionHead title={id} actions={<Button onClick={() => { const questions = { ...stage.questions }; delete questions[id]; onChange({ ...stage, questions }); }}>{remove}</Button>} />
        {input('questionId', id, next => { if (next !== id && Object.hasOwn(stage.questions, next)) { setDuplicate(`question-${qi}`); return; } setDuplicate(''); onChange({ ...stage, questions: Object.fromEntries(Object.entries(stage.questions).map(([key, value]) => [key === id ? next : key, value])) }); })}
        {duplicate === `question-${qi}` && <Notice>{t('duplicate')}</Notice>}
        {row('type', <select aria-label={t('type')} value={q.type} onChange={e => updateQuestion(id, initialQuestion(e.target.value as JudgeQuestion['type']))}>{(['choice', 'score', 'noul'] as const).map(type => <option key={type} value={type}>{t(type)}</option>)}</select>)}
        {q.type === 'choice' && <>
          {Object.entries(q.options).map(([option, label], oi) => <div className="studio-inline-actions studio-edit-row" key={oi} data-judge-option={oi}>
            {compactInput('optionId', option, next => { if (next !== option && Object.hasOwn(q.options, next)) { setDuplicate(`option-${qi}-${oi}`); return; } setDuplicate(''); updateQuestion(id, { ...q, options: Object.fromEntries(Object.entries(q.options).map(([key, value]) => [key === option ? next : key, value])) }); })}
            {duplicate === `option-${qi}-${oi}` && <Notice>{t('duplicate')}</Notice>}
            {compactInput('label', label, value => updateQuestion(id, { ...q, options: { ...q.options, [option]: value } }))}
            <IconButton label={remove} onClick={() => { const options = { ...q.options }; delete options[option]; updateQuestion(id, { ...q, options }); }}>{deleteIcon}</IconButton>
          </div>)}
          <Button onClick={() => updateQuestion(id, { ...q, options: { ...q.options, [unique(Object.keys(q.options), 'option')]: '' } })}>{t('addOption')}</Button>
        </>}
        {q.type === 'score' && <>
          {q.levels.map((level, li) => <div key={li} className="studio-inline-actions studio-edit-row">
            {compactInput('level', level, value => updateQuestion(id, { ...q, levels: q.levels.map((item, n) => n === li ? value : item) }))}
            <IconButton label={remove} disabled={q.levels.length <= 2} onClick={() => updateQuestion(id, { ...q, levels: q.levels.filter((_, n) => n !== li) })}>{deleteIcon}</IconButton>
          </div>)}
          <Button disabled={q.levels.length >= 10} onClick={() => updateQuestion(id, { ...q, levels: [...q.levels, ''] })}>{t('addLevel')}</Button>
        </>}
        {q.type === 'noul' && <>
          {input('question', q.question, question => updateQuestion(id, { ...q, question }))}
          {(['true', 'false'] as const).map(key => <React.Fragment key={key}>{input(key, q.criteria?.[key] ?? '', value => updateQuestion(id, { ...q, criteria: { ...q.criteria, [key]: value } }))}</React.Fragment>)}
        </>}
        {error && <Notice>{t('invalid')}: {error}</Notice>}
      </section>;
    })}
    {!Object.keys(stage.questions).length && <Notice>{t('invalid')}: {validate(stage)}</Notice>}
    <SectionHead title={t('pass')} actions={<Button onClick={() => { const id = Object.keys(stage.questions)[0] ?? ''; onChange({ ...stage, pass: { ...stage.pass, conditions: [...stage.pass.conditions, initialCondition(id, stage.questions[id])] } }); }}>{t('addCondition')}</Button>} />
    {row('mode', <select aria-label={t('mode')} value={stage.pass.mode} onChange={e => onChange({ ...stage, pass: { ...stage.pass, mode: e.target.value as 'all' | 'any' } })}>{(['all', 'any'] as const).map(mode => <option key={mode} value={mode}>{t(mode)}</option>)}</select>)}
    {stage.pass.conditions.map((c, ci) => {
      const q = stage.questions[c.question];
      const error = validate({ ...stage, pass: { ...stage.pass, conditions: [c] } });
      return <section className="studio-form-section" key={ci} data-judge-condition={ci}>
        <SectionHead title={`${t('condition')} ${ci + 1}`} actions={<Button onClick={() => onChange({ ...stage, pass: { ...stage.pass, conditions: stage.pass.conditions.filter((_, n) => n !== ci) } })}>{remove}</Button>} />
        {row('selectQuestion', <select aria-label={t('selectQuestion')} value={q && q.type !== c.type ? '' : c.question} onChange={e => conditionChange(ci, initialCondition(e.target.value, stage.questions[e.target.value]))}>
          {q && q.type !== c.type && <option value="" disabled>{t('selectQuestion')}</option>}
          {!q && <option value={c.question}>{c.question || t('selectQuestion')}</option>}
          {Object.entries(stage.questions).map(([id, question]) => { const preview = (question.type === 'noul' ? question.question : question.type === 'choice' ? Object.values(question.options).join(' / ') : question.levels.join(' / ')).slice(0, 60); return <option value={id} key={id}>{id} · {t(question.type)}{preview ? ` — ${preview}` : ''}</option>; })}
        </select>)}
        {c.type === 'noul' && row('threshold', <input aria-label={t('threshold')} type="number" min={0} max={1} step="any" value={c.threshold} onChange={e => conditionChange(ci, { ...c, threshold: e.target.value === '' ? NaN : Number(e.target.value) })} />)}
        {c.type === 'score' && row('min', <select aria-label={t('min')} value={c.min} onChange={e => conditionChange(ci, { ...c, min: Number(e.target.value) })}>
          {(q?.type !== 'score' || !q.levels[c.min]) && <option value={c.min}>{c.min}</option>}
          {q?.type === 'score' && q.levels.map((label, n) => <option value={n} key={n}>{n}: {label}</option>)}
        </select>)}
        {c.type === 'choice' && row('allowed', <div role="group" aria-label={t('allowed')}>
          {[...new Set([...(q?.type === 'choice' ? Object.keys(q.options) : []), ...c.allowed])].map(option => <CheckOption key={option} label={q?.type === 'choice' ? q.options[option] || option : option} checked={c.allowed.includes(option)} onChange={checked => conditionChange(ci, { ...c, allowed: checked ? [...c.allowed, option] : c.allowed.filter(id => id !== option) })} />)}
        </div>)}
        {error && <Notice>{t('invalid')}: {error}</Notice>}
      </section>;
    })}
    {!stage.pass.conditions.length && <Notice>{t('invalid')}: {validate(stage)}</Notice>}
  </div>;
}
