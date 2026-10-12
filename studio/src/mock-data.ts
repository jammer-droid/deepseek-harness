/** Static catalog, system registry, and initial drafts for the Studio design mock. Nothing here reaches the Host. */
import type { MockCopy } from './mock-locales.ts';

/** Component kinds the first implementation plans to register. */
export type ComponentKind = 'model' | 'instructions' | 'tools' | 'delegate' | 'access' | 'context';
/** Support state shared by component and system displays. */
export type Support = 'supported' | 'conditional' | 'unsupported' | 'missing';
/** Kinds whose values can be saved as named templates. */
export type TemplateKind = 'model' | 'instructions' | 'tools';
/** Reasoning effort; the empty string keeps the provider default. */
export type Effort = '' | 'low' | 'medium' | 'high';
/** Child context mode. */
export type ContextMode = 'fresh' | 'fork';
/** Registered system identifiers. */
export type SystemId = 'modelCatalog' | 'promptExtension' | 'toolGuard' | 'subagent' | 'sandboxPolicy' | 'roleContext';

/** One named instruction block. */
export interface Block { name: string; text: string }
/** Delegation settings toward one target role. */
export interface Link { allowed: boolean; mode: ContextMode; allowOther: boolean }
/** Configured values per component kind. */
export interface ComponentValues {
  model: { provider: string; model: string; effort: Effort };
  instructions: { blocks: Block[] };
  tools: { tools: string[] };
  delegate: { targets: Record<string, Link> };
  access: Record<string, never>;
  context: Record<string, never>;
}
/** Agent definition used both inside a workflow and in the library. */
export interface Agent {
  id: string;
  /** Localized sample name key, or a user-entered name. */
  label: keyof MockCopy['samples']['names'] | { custom: string };
  components: Partial<ComponentValues>;
  /** Unregistered components kept as opaque draft data. */
  unknown: string[];
}
/** Named component settings template. */
export type Template = { [Kind in TemplateKind]: { id: string; name: string; kind: Kind; value: ComponentValues[Kind] } }[TemplateKind];

/** Planned order of component cards. */
export const KINDS: readonly ComponentKind[] = ['model', 'instructions', 'tools', 'delegate', 'access', 'context'];
/** Static component registration facts. */
export const COMPONENTS: Record<ComponentKind, { support: Support; systems: readonly SystemId[]; required: boolean; template: boolean }> = {
  model: { support: 'supported', systems: ['modelCatalog'], required: true, template: true },
  instructions: { support: 'supported', systems: ['promptExtension'], required: false, template: true },
  tools: { support: 'supported', systems: ['toolGuard'], required: false, template: true },
  delegate: { support: 'supported', systems: ['subagent'], required: false, template: false },
  access: { support: 'unsupported', systems: ['sandboxPolicy'], required: false, template: false },
  context: { support: 'conditional', systems: ['roleContext'], required: false, template: false },
};
/** Static system registration facts. */
export const SYSTEMS: Record<SystemId, { plugin: string; handles: readonly ComponentKind[]; state: Support }> = {
  modelCatalog: { plugin: '@deepseek-ai/dsh-api-session-controller', handles: ['model'], state: 'supported' },
  promptExtension: { plugin: '@local/dsh-studio-instructions', handles: ['instructions'], state: 'supported' },
  toolGuard: { plugin: '@local/dsh-studio-tool-guard', handles: ['tools'], state: 'supported' },
  subagent: { plugin: '@deepseek-ai/dsh-subagent', handles: ['delegate'], state: 'supported' },
  sandboxPolicy: { plugin: '@deepseek-ai/dsh-sandbox', handles: ['access'], state: 'conditional' },
  roleContext: { plugin: '@local/dsh-studio-role-context', handles: ['context'], state: 'missing' },
};
/** Unregistered component kept on a sample role. */
export const UNKNOWN_COMPONENT = 'studio.review-gate';
/** Model catalog subset with supported efforts. */
export const CATALOG: Record<string, Record<string, readonly Effort[]>> = {
  deepseek: { 'deepseek-v4': ['low', 'medium', 'high'], 'deepseek-v4-flash': [] },
};
/** Tool groups shown by the tools component. */
export const TOOL_GROUPS = { read: ['read', 'grep', 'glob'], write: ['write', 'edit'], shell: ['bash'], delegate: ['subagent'] } as const;
/** Every tool name in display order. */
export const ALL_TOOLS: readonly string[] = Object.values(TOOL_GROUPS).flat();

/** @param kind Component kind. @returns Default value for a newly added component. */
export function defaultValue<Kind extends ComponentKind>(kind: Kind): ComponentValues[Kind] {
  const values: ComponentValues = {
    model: { provider: 'deepseek', model: 'deepseek-v4', effort: '' },
    instructions: { blocks: [] },
    tools: { tools: [...TOOL_GROUPS.read] },
    delegate: { targets: {} },
    access: {},
    context: {},
  };
  return values[kind];
}

/** Initial mock state built from localized sample content. */
export interface MockData { mainId: string; roles: Agent[]; agents: Agent[]; templates: Template[] }

/** @param t Active locale copy. @returns Fresh sample workflow, library agents, and templates. */
export function initialData(t: MockCopy): MockData {
  const s = t.samples;
  const model = (effort: Effort) => ({ provider: 'deepseek', model: 'deepseek-v4', effort });
  return {
    mainId: 'main',
    roles: [
      { id: 'main', label: 'main', unknown: [], components: {
        model: model('high'),
        instructions: { blocks: [s.specFirst, s.useTeam] },
        tools: { tools: [...TOOL_GROUPS.read, ...TOOL_GROUPS.delegate] },
        delegate: { targets: { implementer: { allowed: true, mode: 'fresh', allowOther: true }, reviewer: { allowed: true, mode: 'fresh', allowOther: false } } },
        access: {}, context: {},
      } },
      { id: 'implementer', label: 'implementer', unknown: [], components: {
        model: model('high'),
        instructions: { blocks: [s.reportEvidence] },
        tools: { tools: [...TOOL_GROUPS.read, ...TOOL_GROUPS.write, ...TOOL_GROUPS.shell] },
        access: {}, context: {},
      } },
      { id: 'reviewer', label: 'reviewer', unknown: [UNKNOWN_COMPONENT], components: {
        model: model('medium'),
        instructions: { blocks: [s.reviewScope] },
        tools: { tools: [...TOOL_GROUPS.read, ...TOOL_GROUPS.shell] },
        access: {},
      } },
    ],
    agents: [
      { id: 'security-reviewer', label: 'securityReviewer', unknown: [], components: {
        model: model('high'), instructions: { blocks: [s.securityCheck] }, tools: { tools: [...TOOL_GROUPS.read] }, access: {},
      } },
      { id: 'doc-writer', label: 'docWriter', unknown: [], components: {
        model: model(''), instructions: { blocks: [s.docStyle] }, tools: { tools: [...TOOL_GROUPS.read, ...TOOL_GROUPS.write] },
      } },
    ],
    templates: [
      { id: 'spec-first', name: s.templateSpecFirst, kind: 'instructions', value: { blocks: [s.specFirst] } },
      { id: 'read-only', name: s.templateReadOnly, kind: 'tools', value: { tools: [...TOOL_GROUPS.read] } },
    ],
  };
}

/** @param agent Agent definition. @param t Active locale copy. @returns Display name. */
export function agentName(agent: Agent, t: MockCopy): string {
  return typeof agent.label === 'string' ? t.samples.names[agent.label] : agent.label.custom;
}
