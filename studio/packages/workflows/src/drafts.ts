/** Profile-scoped document persistence with no runtime activation dependency. */
import { z } from 'zod';
import { brandString } from '@deepseek-ai/dsh-brand';
import { defineDomain, domainTable, type Domain, type DomainFacility } from '@deepseek-ai/dsh-storage-domain';
import type { ComponentId } from './component-registry.ts';
import type { DraftId, DraftFailure, SaveDraftRequest, SavedDraft, InstanceId, ConnectionId, SystemId, WorkflowDocument, RoleId } from './workflow-types.ts';

const component = z.object({
  id: z.string().min(1).transform(value => brandString<ComponentId>(value)),
  version: z.number().int().positive(), scope: z.literal('role'), config: z.record(z.string(), z.json()),
}).strict();
const legacyDocument = z.object({ name: z.string(), mainRole: z.object({ name: z.string(), components: z.array(component) }).strict() }).strict();
const instanceId = z.string().min(1).transform(value => brandString<InstanceId>(value));
const endpoint = z.object({ kind: z.enum(['component', 'system']), instanceId, portId: z.string().min(1) }).strict();
const v2Document = z.object({
  documentVersion: z.literal(2), name: z.string(),
  mainRole: z.object({ name: z.string(), components: z.array(component.extend({ instanceId, scope: z.string() })) }).strict(),
  systems: z.array(z.object({ instanceId, id: z.string().min(1).transform(value => brandString<SystemId>(value)), version: z.number().int().positive(), scope: z.string(), executionLocation: z.string(), config: z.record(z.string(), z.json()) }).strict()),
  connections: z.array(z.object({ id: z.string().min(1).transform(value => brandString<ConnectionId>(value)), from: endpoint, to: endpoint }).strict()),
}).strict().superRefine((value, ctx) => {
  const ids = [...value.mainRole.components, ...value.systems].map(item => item.instanceId);
  if (new Set(ids).size !== ids.length || new Set(value.connections.map(item => item.id)).size !== value.connections.length) ctx.addIssue({ code: 'custom', message: 'Duplicate document identity' });
});
const roleId = z.string().min(1).transform(value => brandString<RoleId>(value));
const model = z.object({ provider: z.string().min(1), model: z.string().min(1), reasoningEffort: z.string().min(1).optional() }).strict();
const currentDocument = z.object({
  documentVersion: z.literal(3), name: z.string(), mainRoleId: roleId,
  roles: z.array(z.object({ id: roleId, name: z.string(), components: z.array(component.extend({ instanceId, scope: z.string(), enabled: z.boolean().optional() })), model: model.optional() }).strict()),
  initialModel: model.optional(), systems: z.array(v2Document.shape.systems.element.extend({ enabled: z.boolean().optional() })), connections: v2Document.shape.connections,
}).strict().superRefine((value, ctx) => {
  const ids = [...value.roles.flatMap(role => role.components), ...value.systems].map(item => item.instanceId);
  if (new Set(ids).size !== ids.length || new Set(value.roles.map(role => role.id)).size !== value.roles.length || new Set(value.connections.map(item => item.id)).size !== value.connections.length) ctx.addIssue({ code: 'custom', message: 'Duplicate document identity' });
});
const document = z.union([legacyDocument, v2Document, currentDocument]);
function normalize(value: z.infer<typeof document>, draftId: DraftId): WorkflowDocument {
  if ('documentVersion' in value && value.documentVersion === 3) return value;
  const id = brandString<RoleId>(`legacy:${draftId}:role:main`);
  const previous = 'documentVersion' in value ? value : { ...value, documentVersion: 2, mainRole: { ...value.mainRole, components: value.mainRole.components.map((item, index) => ({ ...item, instanceId: brandString<InstanceId>(`legacy:${draftId}:component:${index}`) })) }, systems: [], connections: [] };
  return { documentVersion: 3, name: previous.name, mainRoleId: id, roles: [{ ...previous.mainRole, id }], systems: previous.systems, connections: previous.connections };
}
/** Validate new-format wire input without applying semantic policy.
 * @param value Untrusted Remote document. @returns Parsed detached document.
 */
export function parseDocument(value: unknown): WorkflowDocument {
  const parsed = currentDocument.safeParse(value);
  if (!parsed.success) throw new DraftError('invalid-document', { cause: parsed.error });
  return parsed.data;
}
const id = z.string().uuid().transform(value => brandString<DraftId>(value));
const saved = z.object({ id, revision: z.number().int().positive(), document }).strict();
const requestSchema = z.object({ id, expectedRevision: z.number().int().nonnegative(), document: currentDocument }).strict();
const spec = defineDomain({ name: 'studio_workflow_drafts', version: 1, tables: { profiles: domainTable(z.object({ drafts: z.array(saved) }).strict()) } });

/** Refusals preserve saved data; uncertain storage requires reopening the owner. */
export class DraftError extends Error {
  constructor(readonly reason: DraftFailure, options?: ErrorOptions) { super(reason, options); }
}

/** Serializes profile writes and drains accepted operations before closing storage. */
export class DraftStore {
  private closed = false;
  private uncertain = false;
  private queue: Promise<void> = Promise.resolve();
  private constructor(private readonly domain: Domain<typeof spec>, private readonly profile: string) {}

  /** @param storage Public domain facility. @param profile Current profile.
   * @returns Open owner; caller must close it on plugin disposal.
   */
  static async open(storage: Pick<DomainFacility, 'open'>, profile: string): Promise<DraftStore> {
    const domain = await storage.open(spec);
    try {
      if (!domain.table('profiles').get(profile)) await domain.table('profiles').put(profile, { drafts: [] });
      return new DraftStore(domain, profile);
    } catch (error) { await domain.close(); throw error; }
  }

  private usable(): void {
    if (this.closed) throw new DraftError('closed');
    if (this.uncertain) throw new DraftError('storage-uncertain');
  }

  /** @returns Detached confirmed documents; refuses uncertain storage state. */
  list(): SavedDraft[] {
    this.usable();
    return structuredClone(this.domain.table('profiles').get(this.profile)!.drafts.map(draft => ({ ...draft, document: normalize(draft.document, draft.id) })));
  }

  /** @returns Confirmed documents after writes already admitted to this owner settle. */
  async read(): Promise<SavedDraft[]> {
    await this.queue;
    return this.list();
  }

  /** @param request Complete document and observed revision (zero for creation).
   * @returns Confirmed committed draft. No preset or agent state is changed.
   */
  async save(request: SaveDraftRequest): Promise<SavedDraft> {
    this.usable();
    const parsed = requestSchema.safeParse(request);
    if (!parsed.success) throw new DraftError('invalid-document', { cause: parsed.error });
    const operation = this.queue.then(() => this.commit({ ...parsed.data, document: normalize(parsed.data.document, parsed.data.id) }));
    this.queue = operation.then(() => {}, () => {});
    return operation;
  }

  private async commit(request: SaveDraftRequest): Promise<SavedDraft> {
    if (this.uncertain) throw new DraftError('storage-uncertain');
    const next: SavedDraft = { id: request.id, revision: request.expectedRevision + 1, document: request.document };
    try {
      await this.domain.table('profiles').update(this.profile, current => {
        const index = current.drafts.findIndex(item => item.id === request.id);
        const previous = current.drafts[index];
        if ((previous?.revision ?? 0) !== request.expectedRevision) throw new DraftError('revision-conflict');
        const drafts = [...current.drafts];
        if (index < 0) drafts.push(next); else drafts[index] = next;
        return { drafts };
      });
    } catch (error) {
      if (error instanceof DraftError) throw error;
      this.uncertain = true;
      throw new DraftError('storage-uncertain', { cause: error });
    }
    return structuredClone(next);
  }

  /** Reject new operations, drain admitted saves, then release the domain. */
  async close(): Promise<void> { this.closed = true; await this.queue; await this.domain.close(); }
}
