/** Profile-scoped document persistence with no runtime activation dependency. */
import { z } from 'zod';
import { brandString } from '@deepseek-ai/dsh-brand';
import { defineDomain, domainTable, type Domain, type DomainFacility } from '@deepseek-ai/dsh-storage-domain';
import type { ComponentRegistry, ComponentId } from './component-registry.ts';
import type { DraftId, DraftFailure, SaveDraftRequest, SavedDraft } from './workflow-types.ts';

const component = z.object({
  id: z.string().min(1).transform(value => brandString<ComponentId>(value)),
  version: z.number().int().positive(), scope: z.literal('role'), config: z.record(z.string(), z.json()),
}).strict();
const document = z.object({ name: z.string(), mainRole: z.object({ name: z.string(), components: z.array(component) }).strict() }).strict();
const id = z.string().uuid().transform(value => brandString<DraftId>(value));
const saved = z.object({ id, revision: z.number().int().positive(), document }).strict();
const requestSchema = z.object({ id, expectedRevision: z.number().int().nonnegative(), document }).strict();
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
  private constructor(private readonly domain: Domain<typeof spec>, private readonly profile: string, private readonly registry: ComponentRegistry) {}

  /** @param storage Public domain facility. @param profile Current profile. @param registry Shared declarations.
   * @returns Open owner; caller must close it on plugin disposal.
   */
  static async open(storage: Pick<DomainFacility, 'open'>, profile: string, registry: ComponentRegistry): Promise<DraftStore> {
    const domain = await storage.open(spec);
    try {
      if (!domain.table('profiles').get(profile)) await domain.table('profiles').put(profile, { drafts: [] });
      return new DraftStore(domain, profile, registry);
    } catch (error) { await domain.close(); throw error; }
  }

  private usable(): void {
    if (this.closed) throw new DraftError('closed');
    if (this.uncertain) throw new DraftError('storage-uncertain');
  }

  /** @returns Detached confirmed documents; refuses uncertain storage state. */
  list(): SavedDraft[] {
    this.usable();
    return structuredClone(this.domain.table('profiles').get(this.profile)!.drafts);
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
    const operation = this.queue.then(() => this.commit(parsed.data));
    this.queue = operation.then(() => {}, () => {});
    return operation;
  }

  private async commit(request: SaveDraftRequest): Promise<SavedDraft> {
    if (this.uncertain) throw new DraftError('storage-uncertain');
    const declarations = this.registry.describe();
    for (const instance of request.document.mainRole.components) {
      const definition = declarations.find(item => item.id === instance.id && item.version === instance.version);
      if (!definition) continue; // Unavailable versions remain documents, never execution input.
      if (definition.fields.some(field => instance.config[field.key] === undefined ? field.required : typeof instance.config[field.key] !== 'string')) throw new DraftError('invalid-document');
    }
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
