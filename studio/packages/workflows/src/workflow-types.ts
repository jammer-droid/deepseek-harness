/** Wire values for Studio documents, never executable preset settings. */
import type { Branded } from '@deepseek-ai/dsh-brand';
import type { ComponentId } from './component-registry.ts';
export type { ComponentDefinition, ComponentId } from './component-registry.ts';
/** Stable client-generated identity permits readback after a lost create response. */
export type DraftId = Branded<'StudioWorkflowDraftId'>;
/** JSON values retain configuration from currently unavailable registrations. */
export type ConfigValue = null | boolean | number | string | ConfigValue[] | { [key: string]: ConfigValue };
/** A versioned configuration attached to the main role. */
export interface ComponentInstance {
  id: ComponentId;
  version: number;
  scope: 'role';
  config: { [key: string]: ConfigValue };
}
/** One editable workflow document. Unknown component configuration is retained. */
export interface WorkflowDocument {
  name: string;
  mainRole: { name: string; components: ComponentInstance[] };
}
/** Confirmed stored document and its optimistic concurrency token. */
export interface SavedDraft { id: DraftId; revision: number; document: WorkflowDocument }
/** Revision zero creates; positive revisions replace only the observed draft. */
export interface SaveDraftRequest { id: DraftId; expectedRevision: number; document: WorkflowDocument }
/** Failure identities; only storage uncertainty suspends the owner's writes. */
export type DraftFailure = 'revision-conflict' | 'invalid-document' | 'closed' | 'storage-uncertain';
