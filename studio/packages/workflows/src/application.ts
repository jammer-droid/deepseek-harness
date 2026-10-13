/** One serialized lifetime owns persistence, activation and re-query. */
import { z } from 'zod';
import type { DraftStore } from './drafts.ts';
import { ApplyError, type WorkflowCompiler } from './compiler.ts';
import type { AppliedStore } from './applied.ts';
import type { AppliedWorkflow, ApplicationState, ApplyRequest } from './apply-types.ts';
const requestSchema = z.object({ id: z.string().uuid(), draftRevision: z.number().int().positive(), expectedRevision: z.number().int().nonnegative() }).strict();
export interface ActivationOwner {
  activate(record: AppliedWorkflow): Promise<void>;
  inspect(record: AppliedWorkflow): Promise<Omit<ApplicationState, 'applied'>>;
  invalidate?(record: AppliedWorkflow, error: unknown): void;
  close(): Promise<void>;
}
export class WorkflowApplication {
  private queue: Promise<void> = Promise.resolve();
  private closed = false;
  constructor(private readonly drafts: DraftStore, private readonly store: AppliedStore, private readonly compiler: WorkflowCompiler, private readonly runtime: ActivationOwner, private readonly experiments: () => AppliedWorkflow['experiments'] = () => 'unknown') {}
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    if (this.closed) return Promise.reject(new ApplyError('closed'));
    const result = this.queue.then(operation); this.queue = result.then(() => {}, () => {}); return result;
  }
  /** Restart revalidates saved snapshots; no revision or draft is rewritten. */
  restore(): Promise<void> {
    return this.enqueue(async () => {
      for (const record of this.store.list()) {
        try { const compiled = await this.compiler.compile(record.document); await this.runtime.activate({ ...record, compiled }); }
        catch (error) { this.runtime.invalidate?.(record, error); }
      }
    });
  }
  apply(request: ApplyRequest): Promise<ApplicationState> {
    const parsed = requestSchema.safeParse(request);
    if (!parsed.success) return Promise.reject(new ApplyError('invalid-request'));
    return this.enqueue(async () => {
      const previous = this.store.list().find(item => item.id === request.id);
      if ((previous?.revision ?? 0) !== request.expectedRevision) throw new ApplyError('revision-conflict');
      const draft = (await this.drafts.read()).find(item => item.id === request.id);
      if (!draft || draft.revision !== request.draftRevision) throw new ApplyError('revision-conflict');
      const compiled = await this.compiler.compile(draft.document);
      // Awaiting model lookups must not silently apply a superseded saved draft.
      if (this.drafts.list().find(item => item.id === request.id)?.revision !== draft.revision) throw new ApplyError('revision-conflict');
      const applied: AppliedWorkflow = { id: draft.id, draftRevision: draft.revision, revision: request.expectedRevision + 1, presetId: `studio-workflow:${draft.id}`, experiments: this.experiments(), document: draft.document, compiled };
      await this.store.commit(applied, request.expectedRevision);
      try { await this.runtime.activate(applied); } catch { /* Persistence already committed; query actual activation below. */ }
      return { applied, ...await this.runtime.inspect(applied) };
    });
  }
  /** Response loss never triggers a retry or writes another revision. */
  read(): Promise<ApplicationState[]> {
    return this.enqueue(async () => Promise.all(this.store.list().map(async applied => ({ applied, ...await this.runtime.inspect(applied) }))));
  }
  async close(): Promise<void> { this.closed = true; await this.queue; try { await this.runtime.close(); } finally { await this.store.close(); } }
}
