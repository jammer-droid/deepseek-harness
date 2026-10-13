/** Application facts are separate from editable draft persistence. */
import type { DraftId, WorkflowDocument, WorkflowDiagnostic, ModelSelection, RoleId } from './workflow-types.ts';
export interface ApplyRequest { id: DraftId; draftRevision: number; expectedRevision: number }
export interface CompiledInstructions { instanceId: string; text: string }
export interface CompiledRole { id: RoleId; model: ModelSelection; instructions: CompiledInstructions[] }
export interface CompiledWorkflow { mainRoleId: RoleId; roles: CompiledRole[] }
export interface AppliedWorkflow { id: DraftId; draftRevision: number; revision: number; presetId: string; experiments: 'targeted' | 'not-targeted' | 'unknown'; document: WorkflowDocument; compiled: CompiledWorkflow }
export interface ModelObservation { sessionId: string; revision: number; actual: ModelSelection; matches: boolean }
export interface ApplicationState {
  applied: AppliedWorkflow;
  activation: 'active' | 'failed' | 'unknown';
  diagnostic?: string;
  experiments: 'targeted' | 'not-targeted' | 'unknown';
  observations: ModelObservation[];
}
export type ApplyFailure = 'revision-conflict' | 'invalid-request' | 'validation-failed' | 'catalog-changed' | 'unsupported-adapter' | 'storage-uncertain' | 'closed';
export interface ApplyRefusal { reason: ApplyFailure; diagnostics: WorkflowDiagnostic[] }
