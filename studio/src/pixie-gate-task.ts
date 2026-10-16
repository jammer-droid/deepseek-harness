/** Task-centred gate (U11–U24): "when → what Pixie does → result". Shared task model for Host and UI drafts. Node-testable. */

/** When a gate runs, in the user's words. Maps to a runtime point (and input source) inside Pixie. */
export type GateWhen = 'user-message' | 'agent-message' | 'tool-before' | 'tool-after' | 'turn-end';
export const GATE_WHENS: readonly GateWhen[] = ['user-message', 'agent-message', 'tool-before', 'tool-after', 'turn-end'];

/** Script directory shown to the user; one entry point per gate (U18–U19). */
export const GATE_SCRIPT_DIR = '<profile>/studio-data/pixie-gate/commands/';

export interface GateTask {
  id: string;
  name: string;
  enabled: boolean;
  when: GateWhen;
  /** What Pixie does, in natural language. The checked text is always given to Pixie; no variables needed. */
  instruction: string;
  advanced: {
    /** File name inside {@link GATE_SCRIPT_DIR}, run before Pixie (U18, U23). */
    script?: string;
    /** Decide the verdict with the judge model instead of the instruction's own answer. */
    judge?: { question: string; threshold: number };
    /** Ask the user before a replacement is sent (message points only). */
    confirmReplace: boolean;
    onError: 'pass' | 'block';
    agents: 'root' | 'child' | 'any';
    timeoutMs: number;
    /** Turn end only. */
    maxSteers: number;
  };
  presetIds: string[];
}

export type GateTemplateId = 'format-check' | 'agent-protocol' | 'translate-answer' | 'verify-answer' | 'search-digest' | 'subtitle-prep' | 'precompact' | 'file-index';
export interface GateTemplate { id: GateTemplateId; when: GateWhen; available: boolean; script?: string; judge?: true }

/** Templates first (U21). Background tasks are listed but not available until implemented. */
export const GATE_TEMPLATES: readonly GateTemplate[] = [
  { id: 'format-check', when: 'user-message', available: true },
  { id: 'agent-protocol', when: 'agent-message', available: true },
  { id: 'translate-answer', when: 'turn-end', available: true },
  { id: 'verify-answer', when: 'turn-end', available: true, judge: true },
  { id: 'search-digest', when: 'tool-after', available: true, script: 'only-search-tools.sh' },
  { id: 'subtitle-prep', when: 'user-message', available: true, script: 'measure-subtitle.sh' },
  { id: 'precompact', when: 'turn-end', available: false },
  { id: 'file-index', when: 'tool-before', available: false },
];

/** Pixie Gate guide: result rules, script contract, environment, helpers, and examples (U22, U23). */
export const GATE_GUIDE_URL = 'https://github.com/matamt-dbg/dsh-studio/blob/main/docs/appendix/pixie-gate.md';

/** Pixie hook script contract (U23), documented in the guide. */
export const HOOK_EXIT = { continue: 0, skip: 10 } as const;
export const HOOK_ENV: readonly string[] = ['PIXIE_POINT', 'PIXIE_TOOL_NAME', 'PIXIE_TOOL_ARGS', 'PIXIE_AGENT', 'PIXIE_SESSION_ID', 'PIXIE_TURN', 'PIXIE_GATE_NAME', 'PIXIE_URL', 'PIXIE_TOKEN'];
export const HOOK_HELPERS: readonly string[] = ['pixie ask', 'pixie judge'];

/** Points whose message can be replaced or extended before the model reads it. */
export const canReplace = (when: GateWhen) => when === 'user-message' || when === 'agent-message' || when === 'tool-after';
export const isTool = (when: GateWhen) => when === 'tool-before' || when === 'tool-after';
export const isMessage = (when: GateWhen) => when === 'user-message' || when === 'agent-message';

export function makeTask(name: string, when: GateWhen = 'user-message', instruction = ''): GateTask {
  return {
    id: globalThis.crypto.randomUUID(), name, enabled: false, when, instruction,
    advanced: { confirmReplace: false, onError: 'pass', agents: when === 'agent-message' ? 'child' : 'root', timeoutMs: 60000, maxSteers: 1 },
    presetIds: [],
  };
}

/** A gate built from a template; text comes from the caller's locale. */
export function taskFromTemplate(template: GateTemplate, text: { name: string; instruction: string; question?: string }): GateTask {
  const task = makeTask(text.name, template.when, text.instruction);
  if (template.script) task.advanced.script = template.script;
  if (template.judge && text.question) task.advanced.judge = { question: text.question, threshold: 0.5 };
  return task;
}

/** Variables the instruction may use: only the prepared script's output. */
export function taskVariables(task: GateTask): string[] {
  const name = task.advanced.script?.replace(/\.[^.]+$/, '');
  return name ? [`{{hooks.${name}.text}}`, `{{hooks.${name}.data}}`] : [];
}

/** @returns the first problem key, or undefined when the draft can be saved. */
export function taskProblem(task: GateTask): 'name' | 'instruction' | 'judge' | 'limits' | undefined {
  if (!task.name.trim()) return 'name';
  if (!task.instruction.trim()) return 'instruction';
  if (task.advanced.judge && (!task.advanced.judge.question.trim() || !(task.advanced.judge.threshold >= 0 && task.advanced.judge.threshold <= 1))) return 'judge';
  if (!(task.advanced.timeoutMs > 0) || !Number.isInteger(task.advanced.maxSteers) || task.advanced.maxSteers < 0) return 'limits';
  return undefined;
}
