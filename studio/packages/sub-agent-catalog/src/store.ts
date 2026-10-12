/** Immutable child creation records in Studio-owned sidecar storage. */
import { z } from 'zod';
import { brandString } from '@deepseek-ai/dsh-brand';
import { SessionId } from '@deepseek-ai/dsh-session';
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain';
import type { DraftId } from './types.ts';
const tools = z.object({ allow: z.array(z.string()).optional(), deny: z.array(z.string()).optional() }).strict();
const model = z.object({ provider: z.string(), model: z.string(), reasoningEffort: z.string().optional() }).strict();
/** Durable parser validates every snapshot when opening or writing the domain. */
export const assignmentSchema = z.object({
  parentId: z.string().transform(SessionId), childId: z.string().transform(SessionId),
  role: z.object({ id: z.string().uuid().transform(value => brandString<DraftId>(value)), name: z.string(), description: z.string() }).strict(),
  snapshot: z.object({ revision: z.number().int().positive(), instructions: z.string(), task: z.string(), context: z.enum(['fresh', 'fork']), model: model.optional(), tools: tools.optional() }).strict(),
  createdAt: z.number(),
}).strict();
/** A reservation survives uncertain admission; only DSH discovery creates a visible child. */
export const catalogSpec = defineDomain({ name: 'studio_role_catalog', version: 1, tables: { children: domainTable(assignmentSchema) } });
