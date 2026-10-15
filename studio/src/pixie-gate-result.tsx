import React from 'react';
import type { GateResult, StageResult } from './pixie-gate-contracts.ts';
import { gateText } from './pixie-gate-locale.ts';
import { Badge, Notice, SectionHead } from './ui.tsx';

function wasSkipped(result: StageResult): boolean {
  return !!result.data && typeof result.data === 'object' && 'skipped' in result.data && result.data.skipped === true;
}

/** Shared trial/run detail; deliberately omits model usage and never infers applied actions. */
export function GateResultDetails({ result, locale, durations = {}, skipped = [] }: {
  result: GateResult; locale: string; durations?: Record<string, number>; skipped?: string[];
}): React.ReactElement {
  const t = (key: Parameters<typeof gateText>[1]) => gateText(locale, key);
  const stage = (id: string, value: StageResult, label = id) => {
    const omitted = skipped.includes(id) || wasSkipped(value);
    return <section key={id} className="studio-pixie-turn" data-gate-stage={id}>
      <SectionHead title={label} actions={<Badge tone={!omitted && (value.verdict === 'error' || value.verdict === 'fail') ? 'warning' : 'neutral'}>{t(omitted ? 'skipped' : value.verdict)}</Badge>} />
      {value.text !== undefined && <p className="studio-pixie-answer">{value.text}</p>}
      {(value.reason || omitted) && <p className="studio-pixie-answer">{t('reason')}: {omitted && (!value.reason || value.reason === 'skipped: 시험 실행에서 명령 미실행') ? t('skippedCommand') : value.reason}</p>}
      {value.error && <Notice>{t('error')}: {value.error}</Notice>}
      {durations[id] !== undefined && <p className="studio-muted">{t('elapsed')}: {durations[id]} ms</p>}
    </section>;
  };
  return <div className="studio-pixie-turns">
    <SectionHead title={t('verdict')} actions={<Badge>{t(result.verdict)}</Badge>} />
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
