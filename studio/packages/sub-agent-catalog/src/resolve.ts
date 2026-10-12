import { catalogFailure } from './errors.ts';
/** Resolve one supported saved role without executing or mutating its document. */
import type { SavedDraft, WorkflowDocument, WorkflowRole } from '@local/dsh-studio-workflows/types';
import type { LaunchRequest } from './types.ts';
/** Select by stable reference only; malformed or ambiguous references never fall back. */
export function mainRole(document: WorkflowDocument): WorkflowRole {
  const matches = document.roles.filter(role => role.id === document.mainRoleId);
  if (matches.length !== 1) throw catalogFailure('role-not-found');
  return matches[0]!;
}
/** Captured inputs shared by the durable snapshot and the DSH request. */
export interface ResolvedRole { instructions: string; model?: { provider: string; model: string; reasoningEffort?: string }; tools?: { allow?: string[]; deny?: string[] } }
/** @param draft Saved document selected by identity. @param request Observed revision and invocation task.
 * @returns Supported configuration; unavailable components and stale edits refuse invocation.
 */
export function resolveRole(draft: SavedDraft, request: LaunchRequest): ResolvedRole {
  if (draft.id !== request.roleId || draft.revision !== request.revision) throw catalogFailure('revision-conflict');
  if (!request.task.trim()) throw catalogFailure('task-required');
  const role = mainRole(draft.document);
  const model = role.model;
  if (!model || typeof model.provider !== 'string' || !model.provider.trim() || typeof model.model !== 'string' || !model.model.trim()
    || (model.reasoningEffort !== undefined && (typeof model.reasoningEffort !== 'string' || !model.reasoningEffort.trim()))) throw catalogFailure('invalid-component');
  // This adapter composes a native role, not a workflow graph executor.
  if (draft.document.systems.some(system => system.enabled !== false) || draft.document.connections.length) throw catalogFailure('unsupported-component');
  const result: ResolvedRole = { instructions: '', model: { provider: model.provider, model: model.model, ...(model.reasoningEffort === undefined ? {} : { reasoningEffort: model.reasoningEffort }) } };
  const instructions: string[] = [];
  let hasTools = false;
  for (const item of role.components) {
    if (item.enabled === false) continue;
    if (item.scope !== 'role' || item.version !== 1) throw catalogFailure('unsupported-component');
    const text = (key: string): string | undefined => {
      const value = item.config[key];
      if (value === undefined) return undefined;
      if (typeof value !== 'string') throw catalogFailure('invalid-component');
      return value;
    };
    if (item.id === 'studio.instructions') {
      if (Object.keys(item.config).some(key => key !== 'text') || text('text') === undefined) throw catalogFailure('invalid-component');
      instructions.push(text('text')!);
    } else if (item.id === 'studio.tools') {
      if (hasTools || Object.keys(item.config).some(key => !['allow', 'deny'].includes(key))) throw catalogFailure('invalid-component');
      hasTools = true;
      const allow = text('allow')?.split('\n').map(value => value.trim()).filter(Boolean);
      const deny = text('deny')?.split('\n').map(value => value.trim()).filter(Boolean);
      if (allow?.length || deny?.length) result.tools = { ...(allow?.length ? { allow } : {}), ...(deny?.length ? { deny } : {}) };
    } else throw catalogFailure('unsupported-component');
  }
  result.instructions = instructions.join('\n\n');
  return result;
}
