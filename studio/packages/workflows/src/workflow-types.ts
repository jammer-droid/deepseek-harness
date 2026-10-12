/** Wire values for Studio documents, never executable preset settings. */
import type { Branded } from '@deepseek-ai/dsh-brand';
import type { ComponentId, SystemId, CatalogSnapshot } from './component-registry.ts';
export type { ComponentDefinition, ComponentId, SystemDefinition, SystemId, PortDefinition, CatalogSnapshot } from './component-registry.ts';
/** Stable client-generated draft identity. */
export type DraftId = Branded<'StudioWorkflowDraftId'>;
/** Stable identity independent of registration, position, or display name. */
export type InstanceId = Branded<'StudioWorkflowInstanceId'>;
/** Stable directed connection identity. */
export type ConnectionId = Branded<'StudioWorkflowConnectionId'>;
/** JSON retains configuration of unavailable providers. */
export type ConfigValue = null | boolean | number | string | ConfigValue[] | { [key: string]: ConfigValue };
/** Component attached to a role; unsupported scopes remain diagnosable. */
export interface ComponentInstance { instanceId: InstanceId; id: ComponentId; version: number; enabled?: boolean | undefined; scope: string; config: { [key: string]: ConfigValue } }
/** Workflow-owned system and explicitly selected execution location. */
export interface SystemInstance { instanceId: InstanceId; id: SystemId; version: number; enabled?: boolean | undefined; scope: string; executionLocation: string; config: { [key: string]: ConfigValue } }
/** One endpoint, retained even when its instance or port disappears. */
export interface WorkflowEndpoint { kind: 'component' | 'system'; instanceId: InstanceId; portId: string }
/** Directed connection owned by its workflow. */
export interface WorkflowConnection { id: ConnectionId; from: WorkflowEndpoint; to: WorkflowEndpoint }
/** Stable identity of a workflow-local role. */
export type RoleId = Branded<'StudioWorkflowRoleId'>;
/** Explicit route; absent effort uses this provider/model's default, never another role. */
export interface ModelSelection { provider: string; model: string; reasoningEffort?: string | undefined }
/** Independently editable role copied into a workflow. */
export interface WorkflowRole { id: RoleId; name: string; components: ComponentInstance[]; model?: ModelSelection | undefined }
/** Versioned editable document; semantic errors do not prevent persistence. */
export interface WorkflowDocument {
  documentVersion: 3; name: string; mainRoleId: RoleId; roles: WorkflowRole[]; initialModel?: ModelSelection | undefined;
  systems: SystemInstance[]; connections: WorkflowConnection[];
}
/** Machine-readable, locale-independent configuration failure category. */
export type DiagnosticCode = 'missing-main-role' | 'missing-model' | 'unsupported-provider' | 'unsupported-model' | 'unsupported-reasoning' | 'model-lookup-failed' | 'missing-registration' | 'version-mismatch' | 'missing-system' | 'missing-instance' | 'missing-port' | 'port-direction' | 'port-semantic' | 'port-peer' | 'connection-count' | 'invalid-scope' | 'unsupported-location' | 'required-field' | 'field-type' | 'semantic';
/** Stable location and values used by Client localization. */
export interface WorkflowDiagnostic {
  code: DiagnosticCode;
  target: { kind: 'role' | 'document' | 'component' | 'system' | 'connection'; roleId?: RoleId; instanceId?: InstanceId; connectionId?: ConnectionId; fieldPath?: string };
  relatedIds: string[]; details: { [key: string]: string | number | boolean };
}
/** Decision for one immutable catalog revision, not authorization to execute. */
export interface ValidationResult { catalogRevision: number; valid: boolean; diagnostics: WorkflowDiagnostic[] }
/** Pure synchronous provider check; input copies cannot change saved documents or declarations. */
export type SemanticValidator = (instance: ComponentInstance | SystemInstance, document: WorkflowDocument, catalog: CatalogSnapshot) => WorkflowDiagnostic[];
/** Confirmed persisted document and concurrency token. */
export interface SavedDraft { id: DraftId; revision: number; document: WorkflowDocument }
/** Revision zero creates; later writes compare the observed revision. */
export interface SaveDraftRequest { id: DraftId; expectedRevision: number; document: WorkflowDocument }
/** Only uncertain persistence suspends subsequent writes. */
export type DraftFailure = 'revision-conflict' | 'invalid-document' | 'closed' | 'storage-uncertain';

/** Model catalog projection supplied by the Host adapter. */
export type { ModelCatalog } from './models.ts';
