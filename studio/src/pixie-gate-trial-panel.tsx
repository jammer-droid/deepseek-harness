import React from 'react';
import { Button, Notice, SectionHead, SettingsRow, Toggle } from './ui.tsx';
import { validateGateDefinition, type GateDefinition, type GateResult } from './pixie-gate-contracts.ts';
import { GateResultDetails } from './pixie-gate-result.tsx';
import { gateEditorText, type GateEditorKey } from './pixie-gate-editor-locale.ts';

export interface GateTrialRequest {
  definition: GateDefinition;
  text: string;
  toolName?: string;
  hooksContext?: string;
  executeCommands: boolean;
  sessionId?: string;
}
export interface GateTrialResponse { result: GateResult; durations: Record<string, number>; skipped: string[] }
export interface GateTrialHandle { result: Promise<GateTrialResponse>; cancel(): void }
export type GateTrialAction = (request: GateTrialRequest) => GateTrialHandle;

/** Owns one preview lifetime; changing the selected gate unmounts and cancels it. */
export function GateTrialPanel({ definition, trial, locale, sessionId }: {
  definition: GateDefinition; trial: GateTrialAction; locale: string; sessionId?: string;
}) {
  const t = (key: GateEditorKey) => gateEditorText(locale, key);
  const [text, setText] = React.useState('');
  const [toolName, setToolName] = React.useState('');
  const [hooksContext, setHooksContext] = React.useState('');
  const [commands, setCommands] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [cancelled, setCancelled] = React.useState(false);
  const [error, setError] = React.useState('');
  const [result, setResult] = React.useState<GateTrialResponse>();
  const active = React.useRef<GateTrialHandle>();
  React.useEffect(() => () => { const handle = active.current; active.current = undefined; handle?.cancel(); }, [trial, sessionId]);
  const tool = definition.point === 'tool-before' || definition.point === 'tool-after';
  const cancel = () => {
    const handle = active.current; active.current = undefined;
    handle?.cancel(); setRunning(false); setCancelled(true);
  };
  const run = async () => {
    if (active.current || !text.trim() || (tool && !toolName.trim())) return;
    setError(''); setResult(undefined); setCancelled(false);
    let handle: GateTrialHandle | undefined;
    try {
      validateGateDefinition(definition);
      handle = trial({ definition: structuredClone(definition), text,
        ...(tool ? { toolName } : {}), ...(hooksContext ? { hooksContext } : {}),
        executeCommands: commands && !!sessionId, ...(commands && sessionId ? { sessionId } : {}),
      });
      active.current = handle; setRunning(true);
      const response = await handle.result;
      if (active.current === handle) setResult(response);
    } catch (reason) {
      if (!handle || active.current === handle) setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (!handle || active.current === handle) { active.current = undefined; setRunning(false); }
    }
  };
  return <section className="studio-page-stack" aria-label={t('trial')}>
    <SectionHead title={t('trial')} />
    <p className="studio-muted">{t('trialDraft')}</p>
    <SettingsRow title={t('sample')}><textarea aria-label={t('sample')} required value={text} disabled={running} onChange={e => setText(e.target.value)} /></SettingsRow>
    {tool && <SettingsRow title={t('sampleTool')}><input aria-label={t('sampleTool')} required value={toolName} disabled={running} onChange={e => setToolName(e.target.value)} /></SettingsRow>}
    <SettingsRow title={t('sampleHooks')}><textarea aria-label={t('sampleHooks')} value={hooksContext} disabled={running} onChange={e => setHooksContext(e.target.value)} /></SettingsRow>
    <SettingsRow title={t('executeCommands')} description={!sessionId ? t('noSession') : undefined} control={<Toggle label={t('executeCommands')} disabled={!sessionId || running} checked={commands && !!sessionId} onChange={setCommands} />} />
    <div className="studio-actions"><Button primary disabled={running || !text.trim() || (tool && !toolName.trim())} onClick={() => { void run(); }}>{t('runTrial')}</Button><Button disabled={!running} onClick={cancel}>{t('cancelTrial')}</Button></div>
    {running && <p role="status" className="studio-muted">{t('trialRunning')}</p>}
    {cancelled && <p role="status" className="studio-muted">{t('trialCancelled')}</p>}
    {error && <Notice>{t('trialError')}: {error}</Notice>}
    {result && <>{!definition.enabled && <Notice tone="info">{t('disabledTrial')}</Notice>}<GateResultDetails {...result} locale={locale} /></>}
  </section>;
}
