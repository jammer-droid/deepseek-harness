/** Studio workflow declarations; independent of preset application and execution. */
import type { Context } from '@deepseek-ai/cordis';
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { ComponentRegistry, instructionsDefinition, type ComponentDefinition } from './component-registry.ts';

import type {} from '@deepseek-ai/dsh-app-boot';
import { DraftStore, DraftError } from './drafts.ts';
import type { DraftFailure, SavedDraft, SaveDraftRequest } from './workflow-types.ts';

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap { 'studio-workflows/rejected': { reason: DraftFailure } }
}

declare module '@deepseek-ai/cordis' {
  interface Context { studioWorkflows: WorkflowRemote }
}

/** Public declaration lookup with effect-owned Host registration. */
export class WorkflowRemote extends TypertRemoteService {
  constructor(ctx: Context, private readonly options: { registry: ComponentRegistry; store: DraftStore }) { super(ctx, 'studioWorkflows'); }

  /** @returns Confirmed drafts for the current profile, without activation. */
  @Remote
  async drafts(): Promise<SavedDraft[]> {
    try { return await this.options.store.read(); }
    catch (error) { throw this.refusal(error); }
  }

  /** @param request Draft and observed revision. @returns Confirmed saved document. */
  @Remote
  async save(request: SaveDraftRequest): Promise<SavedDraft> {
    try { return await this.options.store.save(request); }
    catch (error) { throw this.refusal(error); }
  }

  private refusal(error: unknown): Error {
    if (!(error instanceof DraftError)) throw error;
    return new RemoteError('studio-workflows/rejected', error.reason, { reason: error.reason }, { cause: error });
  }

  /** @returns Detached registered components for the draft editor. */
  @Remote
  components(): ComponentDefinition[] { return this.options.registry.describe(); }

  /** Host-only declaration contribution, owned by the registering plugin.
   * @param definition Component identity, version, scope and editor fields.
   * @returns Idempotent registration disposer for use with ctx.effect().
   */
  register(definition: ComponentDefinition): () => void { return this.options.registry.register(definition); }
}

/** Mount the workflow declaration service and the built-in instructions component.
 * @param ctx Owning plugin context.
 */
export async function apply(ctx: Context): Promise<void> {
  const registry = new ComponentRegistry();
  ctx.effect(() => registry.register(instructionsDefinition));
  const store = await DraftStore.open(ctx.storageDomain, ctx.profileContext.name, registry);
  ctx.effect(() => () => store.close());
  ctx.plugin(WorkflowRemote, { registry, store });
}

/** Document storage and profile identity only; no model or execution services. */
export const inject = ['storageDomain', 'profileContext'];
