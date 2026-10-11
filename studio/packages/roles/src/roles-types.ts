/** Wire values owned by Studio role settings. */
import type { Branded } from '@deepseek-ai/dsh-brand';
export type { DelegationRecord, CycleId, OperationId } from './delegation-store.ts';
/** Durable identity of one saved role pair. */
export type RoleSnapshotId = Branded<'StudioRoleSnapshotId'>;
/** Identity of one running settings owner; prevents revision ABA. */
export type RoleProcessId = Branded<'StudioRoleProcessId'>;
export interface RoleSetting {
  instructions: string;
  provider: string;
  model: string;
  reasoningEffort?: string | undefined;
}
/** Exactly two supported roles; additions require a new product decision. */
export interface RolePair { implementer: RoleSetting; reviewer: RoleSetting }
/** Explicit optimistic Apply request. Snapshot identity survives process restarts. */
export interface RoleApplyRequest {
  expectedProcessId: RoleProcessId;
  expectedRevision: number;
  expectedSnapshotId: RoleSnapshotId | null;
  roles: RolePair;
}
/** Independently confirmed persistence and runtime application facts. */
export interface RoleState {
  processId: RoleProcessId;
  revision: number;
  snapshotId: RoleSnapshotId | null;
  appliedSnapshotId: RoleSnapshotId | null;
  roles: RolePair | null;
  status: 'unconfigured' | 'applied' | 'apply-failed';
  failure: 'capability-unavailable' | null;
}
