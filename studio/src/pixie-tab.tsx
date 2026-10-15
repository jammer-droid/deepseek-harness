/** Pixie tab body for the Trajectory right sidebar. Node-testable: no host primitives. */
import React from 'react';
import { Badge, Button, IconButton, Notice, Note, Segmented, StudioSurface, TabBar, TabPanel } from './ui.tsx';
import type { JudgeRequest, JudgeResult, PixieAskFrame, PixieContextMode, PixieModel, PixieSessionRecord, PixieSettings, PixieThread, PixieTurn, PixieUsage, PixieUsageTotal } from './pixie-contracts.ts';
import { pixieError, pixieText, type PixieTextKey } from './pixie-locale.ts';

/** What the Host returns for one session (mirrors `PixieView` on the Host). */
export interface PixieViewValue {
  record: PixieSessionRecord;
  total: PixieUsageTotal;
  running: boolean;
  frames: PixieAskFrame[];
  settings: PixieSettings;
  contextWindow?: number;
}

/** Model catalog shape returned by `sessionController.modelCatalog()`. */
export interface PixieModelCatalog { groups?: readonly { id: string; name: string; models: readonly { id: string; name: string }[] }[] }

/** Session-bound Pixie operations the tab uses. */
export interface PixieTabActions {
  view(): Promise<PixieViewValue>;
  follow(listener: (frame: PixieAskFrame) => void): () => void;
  ask(question: string, threadId?: string): Promise<{ threadId: string; turnId: string }>;
  cancel(): Promise<boolean>;
  createThread(options: { mode?: PixieContextMode; model?: PixieModel }): Promise<PixieThread>;
  activate(threadId: string): Promise<boolean>;
  deleteThread(threadId: string): Promise<boolean>;
  models(): Promise<PixieModelCatalog>;
  judge(request: JudgeRequest): Promise<JudgeResult>;
}

const PlusIcon = () => <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>;
const TrashIcon = () => <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;

/** Message of a thrown value. */
const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error);
const number = (value: number, locale: string) => value.toLocaleString(locale.startsWith('ko') ? 'ko-KR' : locale.startsWith('zh') ? 'zh-CN' : 'en-US');
/** Input the next request carries, as the provider counted the last one: uncached + cached input + the answer it adds. */
const contextTokens = (usage: PixieUsage) => usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0) + usage.outputTokens;

function UsageLine({ usage, locale }: { usage: PixieUsage; locale: string }) {
  const t = (key: PixieTextKey) => pixieText(locale, key);
  const parts = [`${t('in')} ${number(usage.inputTokens, locale)}`, `${t('out')} ${number(usage.outputTokens, locale)}`];
  if (usage.cacheReadTokens) parts.push(`${t('cache')} ${number(usage.cacheReadTokens, locale)}`);
  if (usage.cacheWriteTokens) parts.push(`${t('cacheWrite')} ${number(usage.cacheWriteTokens, locale)}`);
  if (usage.reasoningTokens) parts.push(`${t('reasoning')} ${number(usage.reasoningTokens, locale)}`);
  return <span className="studio-muted studio-pixie-usage">{parts.join(' · ')}</span>;
}

function Turn({ turn, live, locale }: { turn: PixieTurn; live?: string; locale: string }) {
  const t = (key: PixieTextKey) => pixieText(locale, key);
  const answer = live ?? turn.answer;
  return <li className="studio-pixie-turn">
    <p className="studio-pixie-question">{turn.question}</p>
    {answer && <p className="studio-pixie-answer">{answer}</p>}
    <div className="studio-pixie-turn-meta">
      {turn.status === 'streaming' && <Badge tone="info">{t('streaming')}</Badge>}
      {turn.status === 'cancelled' && <Badge tone="neutral">{t('cancelled')}</Badge>}
      {turn.status === 'error' && <Badge tone="warning">{t('error')}</Badge>}
      {turn.truncated && <Badge tone="warning">{t('truncated')}</Badge>}
      {turn.usage && <UsageLine usage={turn.usage} locale={locale} />}
    </div>
    {turn.error && <p className="studio-pixie-error" role="alert">{pixieError(locale, turn.error)}</p>}
  </li>;
}

function JudgePanel({ actions, locale }: { actions: PixieTabActions; locale: string }) {
  const t = (key: PixieTextKey) => pixieText(locale, key);
  const [state, setState] = React.useState('');
  const [questions, setQuestions] = React.useState('');
  const [result, setResult] = React.useState<JudgeResult>();
  const [busy, setBusy] = React.useState(false);
  const run = async () => {
    let request: JudgeRequest;
    try {
      const parsedState: unknown = (() => { try { return JSON.parse(state); } catch { return state; } })();
      request = { state: parsedState, questions: JSON.parse(questions) as JudgeRequest['questions'] };
    } catch { setResult({ ok: false, error: t('judgeQuestionsJson') }); return; }
    setBusy(true);
    try { setResult(await actions.judge(request)); } catch (error) { setResult({ ok: false, error: messageOf(error) }); }
    finally { setBusy(false); }
  };
  return <div className="studio-pixie-judge">
    <Note>{t('judgeNote')}</Note>
    <label className="studio-field"><span>{t('judgeState')}</span><textarea value={state} onChange={event => setState(event.target.value)} /></label>
    <label className="studio-field"><span>{t('judgeQuestions')}</span><textarea value={questions} placeholder={'{"clear":{"type":"noul","question":"…"}}'} onChange={event => setQuestions(event.target.value)} /></label>
    <div className="studio-inline-actions studio-pixie-actions"><Button primary small disabled={busy || !questions.trim()} onClick={() => { void run(); }}>{t('runJudge')}</Button></div>
    {result && !result.ok && <p className="studio-pixie-error" role="alert">{pixieError(locale, result.error)}</p>}
    {result?.ok && <dl className="studio-pixie-answers">{Object.entries(result.answers).map(([id, answer]) => <React.Fragment key={id}>
      <dt>{id}</dt>
      <dd>{answer.type === 'choice' ? `${answer.choice} (${t('confidence')} ${answer.confidence})`
        : answer.type === 'score' ? `${answer.score} (${t('confidence')} ${answer.confidence})`
          : `${t('yesProbability')} ${answer.noul}`}</dd>
    </React.Fragment>)}</dl>}
  </div>;
}

/** Pixie conversation for one session: threads, streaming answers, cancel, usage, and the judge trial. */
export function PixieTab({ actions, locale }: { actions: PixieTabActions; locale: string }) {
  const t = (key: PixieTextKey) => pixieText(locale, key);
  const [view, setView] = React.useState<PixieViewValue>();
  const [loadError, setLoadError] = React.useState('');
  const [actionError, setActionError] = React.useState('');
  const [question, setQuestion] = React.useState('');
  const [live, setLive] = React.useState<{ turnId: string; threadId: string; question: string; text: string }>();
  const [section, setSection] = React.useState<'chat' | 'judge'>('chat');
  const [newMode, setNewMode] = React.useState<PixieContextMode | ''>('');
  const [catalog, setCatalog] = React.useState<PixieModelCatalog>();
  const [newModel, setNewModel] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  const refresh = React.useCallback(async () => {
    try { setView(await actions.view()); setLoadError(''); } catch (error) { setLoadError(messageOf(error)); }
  }, [actions]);

  React.useEffect(() => {
    let active = true;
    // Subscribe before the first read so no frame falls between the snapshot and the stream.
    const stop = actions.follow(frame => {
      if (frame.type === 'start') { setLive({ turnId: frame.turnId, threadId: frame.threadId, question: frame.question, text: '' }); void refresh(); }
      else if (frame.type === 'text') setLive(current => current && { ...current, text: current.text + frame.text });
      else if (frame.type === 'end') { setLive(undefined); void refresh(); }
    });
    void actions.view().then(value => {
      if (!active) return;
      setView(value); setLoadError('');
      // A view opened mid-answer replays the frames already streamed, unless the stream already reported this turn.
      const start = value.frames.find(frame => frame.type === 'start');
      if (start?.type === 'start') {
        const text = value.frames.flatMap(frame => frame.type === 'text' ? [frame.text] : []).join('');
        setLive(current => current ?? { turnId: start.turnId, threadId: start.threadId, question: start.question, text });
      }
    }, error => { if (active) setLoadError(messageOf(error)); });
    return () => { active = false; stop(); };
  }, [actions, refresh]);

  React.useEffect(() => {
    if (!view?.settings.allowThreadModel || catalog) return;
    actions.models().then(setCatalog, () => setCatalog({ groups: [] }));
  }, [actions, view?.settings.allowThreadModel, catalog]);

  const guard = async (operation: () => Promise<unknown>) => {
    setActionError('');
    try { await operation(); } catch (error) { setActionError(messageOf(error)); }
  };

  if (loadError) return <StudioSurface className="studio-pixie"><Notice action={<Button small onClick={() => { void refresh(); }}>{t('retry')}</Button>}>{loadError}</Notice></StudioSurface>;
  if (!view) return <StudioSurface className="studio-pixie"><p className="studio-muted">{t('loading')}</p></StudioSurface>;

  const record = view.record;
  const active = record.threads.find(thread => thread.id === record.activeThreadId);
  const lastUsage = [...active?.turns ?? []].reverse().find(turn => turn.usage)?.usage;
  const running = live !== undefined || view.running;
  const configured = Boolean(view.settings.model);
  const submit = () => guard(async () => {
    const text = question.trim();
    if (!text) return;
    await actions.ask(text, active?.id);
    setQuestion('');
  });
  const createThread = () => guard(async () => {
    const [provider, model] = newModel ? newModel.split('\u0000') as [string, string] : [];
    await actions.createThread({ ...(newMode ? { mode: newMode } : {}), ...(provider && model ? { model: { provider, model } } : {}) });
    setCreating(false); setNewMode(''); setNewModel('');
    await refresh();
  });

  return <StudioSurface className="studio-pixie">
    <TabBar label={t('title')} value={section} onChange={setSection} items={[{ value: 'chat', label: t('chat') }, { value: 'judge', label: t('judge') }]} />
    <TabPanel>
      {section === 'judge' ? (configured ? <JudgePanel actions={actions} locale={locale} /> : <Note>{t('noModel')}</Note>) : <div className="studio-pixie-chat">
        {!configured && <Note>{t('noModel')}</Note>}
        <div className="studio-pixie-toolbar">
          <select className="studio-compact studio-pixie-thread-select" aria-label={t('threads')} value={record.activeThreadId ?? ''} disabled={record.threads.length === 0}
            onChange={event => { const id = event.target.value; void guard(async () => { await actions.activate(id); await refresh(); }); }}>
            {record.threads.length === 0 && <option value="">{t('noThreads')}</option>}
            {record.threads.map(thread => <option key={thread.id} value={thread.id}>{`${thread.title}${thread.mode === 'fork' ? ` · ${t('forkBadge')}` : ''} · ${thread.turns.length}`}</option>)}
          </select>
          {configured && <IconButton label={t('newThread')} onClick={() => setCreating(open => !open)}><PlusIcon /></IconButton>}
          {active && <IconButton label={t('deleteThread')} tone="error" disabled={running && live?.threadId === active.id} onClick={() => {
            void guard(async () => { await actions.deleteThread(active.id); await refresh(); });
          }}><TrashIcon /></IconButton>}
        </div>
        {configured && creating && <div className="studio-pixie-new">
          <Segmented label={t('mode')} value={newMode || view.settings.contextMode} onChange={(mode: PixieContextMode) => setNewMode(mode)}
            options={[{ value: 'fresh', label: t('fresh') }, { value: 'fork', label: t('fork') }]} />
          {view.settings.allowThreadModel && <select className="studio-compact" aria-label={t('model')} value={newModel} onChange={event => setNewModel(event.target.value)}>
            <option value="">{view.settings.model!.model}</option>
            {catalog?.groups?.map(group => <optgroup key={group.id} label={group.name}>
              {group.models.map(model => <option key={model.id} value={`${group.id}\u0000${model.id}`}>{model.name}</option>)}
            </optgroup>)}
          </select>}
          <Button small primary onClick={() => { void createThread(); }}>{t('create')}</Button>
        </div>}
        {active && <div className="studio-pixie-status">
          <span className="studio-muted">{`${active.model.provider} / ${active.model.model}`}</span>
          <span className="studio-muted">{`${t('context')} ${lastUsage ? number(contextTokens(lastUsage), locale) : '—'}${view.contextWindow ? ` / ${number(view.contextWindow, locale)}` : ''}`}</span>
        </div>}
        <ol className="studio-pixie-turns">
          {active?.turns.map(turn => <Turn key={turn.id} turn={turn} locale={locale} {...(live?.turnId === turn.id ? { live: live.text } : {})} />)}
          {live && live.threadId === active?.id && !active.turns.some(turn => turn.id === live.turnId) && <Turn locale={locale} live={live.text}
            turn={{ id: live.turnId, question: live.question, answer: '', status: 'streaming', model: active.model, startedAt: 0 }} />}
        </ol>
        {actionError && <p className="studio-pixie-error" role="alert">{pixieError(locale, actionError)}</p>}
        {configured && <div className="studio-pixie-compose">
          <textarea aria-label={t('question')} placeholder={t('placeholder')} value={question} rows={2} onChange={event => setQuestion(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void submit(); } }} />
          <div className="studio-pixie-compose-bar">
            <span className="studio-muted">{t('isolationShort')}</span>
            {running && <Button small onClick={() => { void guard(() => actions.cancel()); }}>{t('cancel')}</Button>}
            <Button small primary disabled={running || !question.trim()} onClick={() => { void submit(); }}>{t('ask')}</Button>
          </div>
        </div>}
        <p className="studio-muted studio-pixie-total">{`${t('sessionTotal')} · ${number(view.total.requests, locale)} ${t('requests')} · `}<UsageLine usage={view.total} locale={locale} /></p>
      </div>}
    </TabPanel>
  </StudioSurface>;
}

/** What the `/pixie` row needs: its recorded turn and the live stream of its session. */
export interface PixieCommandRowActions {
  commandId: string;
  commandTurn(): Promise<PixieTurn | null>;
  follow(listener: (frame: PixieAskFrame) => void): () => void;
}

/** The conversation row for `/pixie`: question, then Pixie's answer (shown here and in the tab, never added to the model context). */
export function PixieCommandRow({ question, outcome, locale, onOpen, actions }: { question: string; outcome: { kind: 'success' | 'error'; text?: string } | null; locale: string; onOpen: () => void; actions?: PixieCommandRowActions }) {
  const t = (key: PixieTextKey) => pixieText(locale, key);
  const [turn, setTurn] = React.useState<PixieTurn | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [live, setLive] = React.useState<string>();
  React.useEffect(() => {
    if (!actions || outcome?.kind !== 'success') return;
    let active = true;
    // Frames belong to this row only between its own start and the next start or end.
    let mine = false;
    const load = () => actions.commandTurn().then(value => { if (!active) return; setTurn(value); setLoaded(true); if (value && value.status !== 'streaming') setLive(undefined); }, () => { if (active) setLoaded(true); });
    const stop = actions.follow(frame => {
      if (frame.type === 'start') { mine = frame.commandId === actions.commandId; if (mine) setLive(''); }
      else if (frame.type === 'text') { if (mine) setLive(current => (current ?? '') + frame.text); }
      else if (frame.type === 'end') { if (mine) { mine = false; void load(); } }
    });
    void load();
    return () => { active = false; stop(); };
  }, [actions, outcome?.kind]);
  const answer = live ?? turn?.answer ?? '';
  const status = turn?.status === 'streaming' || live !== undefined ? 'streaming' : turn?.status;
  return <div className="studio-pixie-row">
    <div className="studio-pixie-row-head">
      <Badge tone="outline">Pixie</Badge>
      <span className="studio-pixie-row-question">{question}</span>
      <Button small onClick={onOpen}>{t('openTab')}</Button>
    </div>
    {outcome?.kind === 'error' ? <p className="studio-pixie-error" role="alert">{pixieError(locale, outcome.text ?? '')}</p>
      : turn?.status === 'error' ? <p className="studio-pixie-error" role="alert">{pixieError(locale, turn.error ?? '')}</p>
        : answer ? <p className="studio-pixie-answer">{answer}</p>
          // A row from an older Studio has no linked turn: point to the tab instead of waiting forever.
          : <p className="studio-muted">{!outcome ? t('streaming') : status === 'cancelled' ? t('cancelled') : loaded && !turn ? t('rowAsked') : t('rowWaiting')}</p>}
    <div className="studio-pixie-turn-meta">
      {status === 'cancelled' && answer && <Badge tone="neutral">{t('cancelled')}</Badge>}
      {turn?.truncated && <Badge tone="warning">{t('truncated')}</Badge>}
      {turn?.usage && <UsageLine usage={turn.usage} locale={locale} />}
      <span className="studio-muted studio-pixie-usage">{t('isolationShort')}</span>
    </div>
  </div>;
}
