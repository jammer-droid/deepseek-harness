/** Durable cycle reservations and review facts; records never authorize a cold process. */
import { z } from 'zod';
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain';
import { brandString, type Branded } from '@deepseek-ai/dsh-brand';
import { SessionId } from '@deepseek-ai/dsh-session';
import { MessageId } from '@deepseek-ai/dsh-llm';
import type { RoleSnapshotId } from './roles-types.ts';
import { reviewJudgment } from './review.ts';
/** Host-generated cycle identity. */
export type CycleId = Branded<'StudioCycleId'>;
/** Host-generated admission identity. */
export type OperationId = Branded<'StudioOperationId'>;
const setting = z.object({ instructions: z.string(), provider: z.string(), model: z.string(), reasoningEffort: z.string().optional() }).strict();
/** Persisted facts are data, not permission to execute. */
export const delegationRecord = z.object({
  cycleId: z.string().uuid().transform(value => brandString<CycleId>(value)),
  operationId: z.string().uuid().transform(value => brandString<OperationId>(value)),
  parentId: z.string().transform(SessionId), childId: z.string().transform(SessionId),
  role: z.enum(['implementer', 'reviewer']), context: z.enum(['fresh', 'fork']),
  inheritedEventCount: z.number().int().nonnegative().optional(),
  inputCapturedThroughSeq: z.number().int().min(-1).optional(),
  judgment: reviewJudgment.optional(),
  cycleCompletedAt: z.number().optional(),
  snapshotId: z.string().uuid().transform(value => brandString<RoleSnapshotId>(value)), settings: setting,
  state: z.enum(['reserved', 'running', 'completed', 'interrupted', 'failed', 'unknown']),
  prompt: z.string(), createdAt: z.number(),
  messageId: z.string().transform(MessageId).nullable(), diagnostic: z.string().nullable(),
  output: z.string().nullable(),
  observed: z.object({ provider: z.string(), model: z.string(), reasoningEffort: z.string().nullable() }).nullable(),
  // Older rows remain unchanged and cannot acquire a new policy implicitly.
  reworkCap: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  cyclePhase: z.enum(['implementation', 'review-ready', 'review', 'judged', 'complete', 'unknown']).optional(),
  cycleOperation: z.string().uuid().transform(value => brandString<OperationId>(value)).optional(),
  reworkCount: z.number().int().nonnegative(),
}).strict();
/** Validated sidecar row. */
export type DelegationRecord = z.infer<typeof delegationRecord>;
/** Profile-owned sidecar storage, separate from released Session logs. */
export const delegationSpec = defineDomain({ name: 'studio_delegation', version: 1, tables: { children: domainTable(delegationRecord) } });
