/** Gate editing model shared by the composition and scope pages: actions, factories, the template, and field-addressed validation. */
import React from 'react';
import { validateGateDefinition, type GatePoint, type StageDefinition } from './pixie-gate-contracts.ts';
import type { GateEditorKey } from './pixie-gate-editor-locale.ts';
import type { GateTrialAction } from './pixie-gate-trial-panel.tsx';
import type { PixieSettingsCatalog } from './pixie-settings.tsx';
import type { GateEntry, GateDefinitionsRead, GateDefinitionError, InvalidGateEntry } from './pixie-gate-definitions.ts';

export type { GateEntry } from './pixie-gate-definitions.ts';
export interface GateEditorActions {
  read(): Promise<GateDefinitionsRead | GateEntry[]>;
  save(entries: GateEntry[]): Promise<unknown>;
  presets(): Promise<{ id: string; name: string }[]>;
  models(): Promise<PixieSettingsCatalog>;
  trial: GateTrialAction;
}
/** A validation failure addressed to one field of one gate. */
export interface GateProblem { gateId: string; field: string; key: GateEditorKey }

export const message = (error: unknown) => error instanceof Error ? error.message : String(error);
export const makeStage = (id: string): StageDefinition => ({ id, kind: 'converse', role: 'check', prompt: '{{subject}}' });
export const makeGate = (name: string, point: GatePoint = 'input'): GateEntry => ({ definition: { id: crypto.randomUUID(), name, enabled: false, point, match: { agents: 'root', ...(point === 'input' ? { sources: ['user'] } : {}) }, stages: [makeStage('stage1')], onError: 'pass', confirmRevision: false, forward: { kind: 'original' }, limits: { stageTimeoutMs: 60000, maxSteersPerTurn: 1 } }, presetIds: [] });

const TEMPLATE = {
  name: ['예시: 자막 번역 준비', 'Example: subtitle translation prep', '示例：字幕翻译准备'],
  measured: ['요청 크기 약 %s바이트', 'Request size about %s bytes', '请求大小约 %s 字节'],
  question: ['요청: {{subject}}\n측정: {{stages.measure.text}}\n이 요청을 한 번의 번역 작업으로 처리할 수 있는 크기입니까?', 'Request: {{subject}}\nMeasured: {{stages.measure.text}}\nIs this request small enough to handle as one translation task?', '请求：{{subject}}\n测量：{{stages.measure.text}}\n该请求的大小能否作为一次翻译任务处理？'],
  yes: ['한 번에 처리할 수 있음', 'Fits in one task', '可以一次处理'],
  no: ['나눠서 처리해야 함', 'Needs to be split', '需要拆分处理'],
  system: ['당신은 번역 작업을 준비하는 보조자입니다. 짧고 구체적으로 답하세요.', 'You prepare translation work. Answer briefly and concretely.', '你负责准备翻译工作。请简短具体地回答。'],
  prompt: ['다음 요청의 번역 방침을 정리하세요: 구간 분할, 용어, 말투.\n요청: {{subject}}\n크기: {{stages.measure.text}}', 'Write a translation plan for this request: segmenting, terminology, tone.\nRequest: {{subject}}\nSize: {{stages.measure.text}}', '为以下请求整理翻译方针：分段、术语、语气。\n请求：{{subject}}\n大小：{{stages.measure.text}}'],
} as const;
const pick = (locale: string, values: readonly [string, string, string]) => values[locale.startsWith('ko') ? 0 : locale.startsWith('zh') ? 2 : 1];

/** The one starter template: the subtitle example (command → judge → conversation, appended after the original). */
export function makeTemplateGate(locale: string): GateEntry {
  const measure = `input=$(cat); bytes=$(printf '%s' "$input" | wc -c | tr -d ' '); printf '{"verdict":"note","text":"${pick(locale, TEMPLATE.measured)}","data":{"bytes":%s}}' "$bytes" "$bytes"`;
  const entry = makeGate(pick(locale, TEMPLATE.name), 'input');
  entry.definition.stages = [
    { id: 'measure', kind: 'command', role: 'note', command: { command: measure } },
    { id: 'size', kind: 'judge', questions: { fits: { type: 'noul', question: pick(locale, TEMPLATE.question), criteria: { true: pick(locale, TEMPLATE.yes), false: pick(locale, TEMPLATE.no) } } }, pass: { mode: 'all', conditions: [{ question: 'fits', type: 'noul', threshold: 0.5 }] } },
    { id: 'plan', kind: 'converse', role: 'note', system: pick(locale, TEMPLATE.system), prompt: pick(locale, TEMPLATE.prompt) },
  ];
  entry.definition.forward = { kind: 'append', from: ['plan'] };
  return entry;
}

/** A field address is found by validating progressively, preserving the contract's throw-first order. */
export function validation(entry: GateEntry): Omit<GateProblem, 'gateId'> | undefined {
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
        const part = s.includes('stage id') ? 'id' : s.includes('Command') || s.includes('command timeout') ? 'command' : s.includes('variable') ? 'prompt' : 'role';
        return { field: `stage-${i}-${part}`, key: part === 'id' ? 'invalidId' : part === 'command' ? 'invalidCommand' : part === 'prompt' ? 'invalidPrompt' : 'invalid' };
      }
    }
    return { field: '', key: 'invalid' };
  }
}

/** Gate list state shared by the composition and scope pages.
 * `stored` mirrors the last persisted list. Modal saves and card actions persist one gate against `stored`; the scope page edits `draft` and saves it whole.
 */
export function useGateEntries(actions: GateEditorActions | undefined) {
  const [stored, setStored] = React.useState<GateEntry[]>();
  const [draft, setDraft] = React.useState<GateEntry[]>();
  const [invalid, setInvalid] = React.useState<InvalidGateEntry[]>([]);
  const [fileError, setFileError] = React.useState<GateDefinitionError>();
  const [removedInvalid, setRemovedInvalid] = React.useState(false);
  const [presets, setPresets] = React.useState<{ id: string; name: string }[]>([]);
  const [models, setModels] = React.useState<PixieSettingsCatalog>({ groups: [] });
  const [loadError, setLoadError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const pending = React.useRef<(() => Promise<boolean>) | undefined>(undefined);
  const [confirming, setConfirming] = React.useState(false);
  const load = React.useCallback(async () => {
    if (!actions) return;
    setLoadError('');
    try {
      const [values, list, catalog] = await Promise.all([actions.read(), actions.presets(), actions.models()]);
      const result = Array.isArray(values) ? { entries: values, invalid: [] } : values;
      setInvalid(result.invalid); setFileError(result.error); setRemovedInvalid(false);
      setStored(result.entries); setDraft(structuredClone(result.entries)); setPresets(list); setModels(catalog);
    } catch (error) { setLoadError(message(error)); }
  }, [actions]);
  React.useEffect(() => { void load(); }, [load]);
  /** Persist `next`; asks for overwrite confirmation first while unloaded entries or a broken file remain. @returns whether it was saved. */
  const persist = async (next: GateEntry[], confirmed = false): Promise<boolean> => {
    if (!actions || saving) return false;
    if (!confirmed && (invalid.length || fileError)) {
      pending.current = () => persist(next, true);
      setConfirming(true);
      return false;
    }
    setConfirming(false); pending.current = undefined;
    setSaving(true);
    try {
      await actions.save(next.map(item => ({ ...item, definition: validateGateDefinition(item.definition) })));
      setStored(structuredClone(next)); setInvalid([]); setFileError(undefined); setRemovedInvalid(false);
      return true;
    } finally { setSaving(false); }
  };
  const replace = (list: GateEntry[] | undefined, entry: GateEntry) => list?.some(item => item.definition.id === entry.definition.id)
    ? list.map(item => item.definition.id === entry.definition.id ? entry : item) : [...list ?? [], entry];
  return {
    stored, draft, invalid, fileError, removedInvalid, presets, models, loadError, saving, confirming, load,
    dirty: !!draft && !!stored && JSON.stringify(draft) !== JSON.stringify(stored),
    setDraft,
    /** Save one gate against the persisted list. The draft keeps its unsaved scope fields (enabled, match, presets) for that gate. */
    saveGate: async (entry: GateEntry) => {
      const ok = await persist(replace(stored, entry));
      if (ok) setDraft(old => old?.some(item => item.definition.id === entry.definition.id)
        ? old.map(item => item.definition.id === entry.definition.id ? { ...item, definition: { ...entry.definition, enabled: item.definition.enabled, match: item.definition.match } } : item)
        : [...old ?? [], structuredClone(entry)]);
      return ok;
    },
    removeGate: async (id: string) => {
      const ok = await persist((stored ?? []).filter(item => item.definition.id !== id));
      if (ok) setDraft(old => old?.filter(item => item.definition.id !== id));
      return ok;
    },
    saveDraft: () => persist(draft ?? []),
    confirmOverwrite: () => pending.current?.(),
    cancelOverwrite: () => { pending.current = undefined; setConfirming(false); },
    removeInvalid: (index: number) => { setInvalid(old => old.filter(row => row.index !== index)); setRemovedInvalid(true); setConfirming(false); },
  };
}
export type GateEntries = ReturnType<typeof useGateEntries>;

/** @returns the id of a gate that would be a second enabled gate for the same preset and point. */
export function bindingConflict(entries: readonly GateEntry[]): string | undefined {
  const seen = new Set<string>();
  for (const { definition, presetIds } of entries) {
    if (!definition.enabled) continue;
    for (const preset of presetIds) {
      const key = `${preset}\u0000${definition.point}`;
      if (seen.has(key)) return definition.id;
      seen.add(key);
    }
  }
  return undefined;
}
