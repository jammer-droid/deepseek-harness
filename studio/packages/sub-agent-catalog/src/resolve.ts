import { catalogFailure } from './errors.ts';
/** Resolve one supported saved role without executing or mutating its document. */
import type { SavedDraft } from '@local/dsh-studio-workflows/types';
import type { LaunchRequest } from './types.ts';
/** Captured inputs shared by the durable snapshot and the DSH request. */
export interface ResolvedRole { instructions: string; model?: { provider: string; model: string; reasoningEffort?: string }; tools?: { allow?: string[]; deny?: string[] } }
/** @param draft Saved document selected by identity. @param request Observed revision and invocation task.
 * @returns Supported configuration; unavailable components and stale edits refuse invocation.
 */
export function resolveRole(draft: SavedDraft, request: LaunchRequest): ResolvedRole {
  if (draft.id !== request.roleId || draft.revision !== request.revision) throw catalogFailure('revision-conflict');
  if (!request.task.trim()) throw catalogFailure('task-required');
  const result: ResolvedRole = { instructions: '' };
  const instructions: string[] = [];
  let hasTools = false;
  for (const item of draft.document.mainRole.components) {
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
    } else if (item.id === 'studio.model') {
      const provider = text('provider'); const model = text('model'); const reasoningEffort = text('reasoningEffort');
      if (result.model || !provider?.trim() || !model?.trim() || Object.keys(item.config).some(key => !['provider', 'model', 'reasoningEffort'].includes(key))) throw catalogFailure('invalid-component');
      result.model = { provider, model, ...(reasoningEffort?.trim() ? { reasoningEffort } : {}) };
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
