import React from 'react';
import { judgeText } from './pixie-gate-judge-locale.ts';
import type { JudgeAnswer } from './pixie-contracts.ts';
import type { GateDefinition, GateResult, StageResult } from './pixie-gate-contracts.ts';
import { gateText } from './pixie-gate-locale.ts';
import { Badge, Notice, SectionHead } from './ui.tsx';

function wasSkipped(result: StageResult): boolean {
  return !!result.data && typeof result.data === 'object' && 'skipped' in result.data && result.data.skipped === true;
}

/** Shared trial/run detail; deliberately omits model usage and never infers applied actions. */
export function GateResultDetails({ result, locale, durations = {}, skipped = [], definition }: {
  definition?: GateDefinition | undefined; result: GateResult; locale: string; durations?: Record<string, number>; skipped?: string[];
}): React.ReactElement {
  const t = (key: Parameters<typeof gateText>[1]) => gateText(locale, key);
  const skippedCount = new Set([...skipped.filter(id => !id.startsWith('hooks.')), ...Object.entries(result.stages).filter(([, value]) => wasSkipped(value)).map(([id]) => id)]).size;
  const duration = (ms: number) => ms < 1 ? t('milliseconds').replace('{value}', '<1') : ms < 1000 ? t('milliseconds').replace('{value}', String(Math.round(ms))) : t('seconds').replace('{value}', (ms / 1000).toFixed(1));
  const stage = (id: string, value: StageResult, label = id) => {
    const omitted = skipped.includes(id) || wasSkipped(value);
    return <section key={id} className="studio-pixie-turn" data-gate-stage={id}>
      <SectionHead title={label} actions={<Badge tone={!omitted && (value.verdict === 'error' || value.verdict === 'fail') ? 'warning' : 'neutral'}>{t(omitted ? 'skipped' : value.verdict)}</Badge>} />
      {value.text !== undefined && <p className="studio-pixie-answer">{value.text}</p>}
      {(value.reason || omitted) && <p className="studio-pixie-answer">{t('reason')}: {omitted && (!value.reason || value.reason === 'skipped: 시험 실행에서 명령 미실행') ? t('skippedCommand') : value.reason}</p>}
      {!!value.data && typeof value.data === 'object' && 'answers' in value.data && !!value.data.answers && typeof value.data.answers === 'object' && <section aria-label={judgeText(locale, 'answers')}>
        <SectionHead title={judgeText(locale, 'answers')} />
        {Object.entries(value.data.answers as Record<string, JudgeAnswer>).map(([questionId, answer]) => {
          const s = definition?.stages.find(stage => stage.id === id);
          const q = s?.kind === 'judge' ? s.questions[questionId] : undefined;
          if (!answer || !['choice', 'score', 'noul'].includes(answer.type)) return null;
          const percent = (number: number) => `${Math.round(number * 100)}%`;
          return <p key={questionId} className="studio-pixie-answer">{questionId}: {answer.type === 'noul' ? answer.noul : answer.type === 'choice' ? <>
            {q?.type === 'choice' ? q.options[answer.choice] || answer.choice : answer.choice} · {judgeText(locale, 'probability')}: {percent(answer.probabilities?.[answer.choice] ?? 0)} · {judgeText(locale, 'confidence')}: {percent(answer.confidence)}
          </> : <>{q?.type === 'score' ? q.levels[answer.score] || answer.score : answer.score} · {judgeText(locale, 'confidence')}: {percent(answer.confidence)}</>}</p>;
        })}
      </section>}
      {value.error && <Notice>{t('error')}: {value.error}</Notice>}
      {durations[id] !== undefined && <p className="studio-muted">{t('elapsed')}: {duration(durations[id]!)}</p>}
    </section>;
  };
  return <div className="studio-pixie-turns">
    <SectionHead title={t('verdict')} actions={<><Badge>{t(result.verdict)}</Badge>{skippedCount > 0 && <span className="studio-muted">{t('skippedCount').replace('{count}', String(skippedCount))}</span>}</>} />
    <section><SectionHead title={t('original')} /><p className="studio-pixie-answer">{result.original}</p></section>
    <section><SectionHead title={t('subject')} /><p className="studio-pixie-answer">{result.subject}</p></section>
    {result.hooks.start && stage('start', result.hooks.start, t('start'))}
    <SectionHead title={t('stages')} />
    {Object.entries(result.stages).map(([id, value]) => stage(id, value))}
    {skipped.filter(id => !id.startsWith('hooks.') && !result.stages[id]).map(id => stage(id, { verdict: 'pass' }))}
    <SectionHead title={t('forward')} actions={<Badge>{t(result.forward.kind)}</Badge>} />
    {result.forward.kind !== 'none' && <p className="studio-pixie-answer">{result.forward.text}</p>}
    {result.forward.kind === 'append' && result.forward.contexts.map((text, index) => <p key={index} className="studio-pixie-answer">{text}</p>)}
    {result.forwardError && <>
      {Object.entries(result.stages).some(([id, value]) => skipped.includes(id) || wasSkipped(value)) && <Notice>{t('skippedForward')}</Notice>}
      {stage('forward', result.forwardError, t('forwardError'))}
    </>}
    {result.hooks.end && stage('end', result.hooks.end, t('end'))}
  </div>;
}
