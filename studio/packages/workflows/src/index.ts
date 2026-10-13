/** Studio workflow declarations; independent of preset application and execution. */
import type { Context } from '@deepseek-ai/cordis';
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { ComponentRegistry, instructionsDefinition, type ComponentDefinition, type SystemDefinition, type CatalogSnapshot } from './component-registry.ts';

import type {} from '@deepseek-ai/dsh-app-boot';
import type {} from '@deepseek-ai/dsh-api-remotes';
import { WorkflowModels, type ModelCatalog } from './models.ts';
import type {} from '@deepseek-ai/dsh-llm';
import { DraftStore, DraftError, parseDocument } from './drafts.ts';
import { AppliedStore } from './applied.ts';
import { WorkflowCompiler, ApplyError } from './compiler.ts';
import { WorkflowApplication } from './application.ts';
import { WorkflowRuntime, type PresetRegistry } from './runtime.ts';
import type { ApplyRequest, ApplicationState, ApplyFailure } from './apply-types.ts';
import type { ModelSelection } from './workflow-types.ts';
import type { DraftFailure, SavedDraft, SaveDraftRequest, WorkflowDocument, ValidationResult, SemanticValidator } from './workflow-types.ts';

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap { 'studio-workflows/rejected': { reason: DraftFailure | ApplyFailure; diagnostics?: import('./workflow-types.ts').WorkflowDiagnostic[] } }
}

declare module '@deepseek-ai/cordis' {
  interface Context { studioWorkflows: WorkflowRemote }
}

/** Public declaration lookup with effect-owned Host registration. */
export class WorkflowRemote extends TypertRemoteService {
  constructor(ctx: Context, private readonly options: { registry: ComponentRegistry; store: DraftStore; models: () => WorkflowModels; revision: () => number; application?: WorkflowApplication; runtime?: WorkflowRuntime }) { super(ctx, 'studioWorkflows'); }

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

  /** Apply only an explicitly saved revision; never saves editor input. */
  @Remote
  async applyDraft(request: ApplyRequest): Promise<ApplicationState> {
    try {
      if (!this.options.application) throw new ApplyError('closed');
      return await this.options.application.apply(request);
    } catch (error) { throw this.refusal(error); }
  }

  /** Reconcile lost responses without repeating persistence or activation. */
  @Remote
  async applications(): Promise<ApplicationState[]> {
    try { return await this.options.application?.read() ?? []; }
    catch (error) { throw this.refusal(error); }
  }

  /** Preset-scoped Host observation; not a Remote operation or route setter. */
  observeModel(id: string, revision: number, sessionId: string, actual: ModelSelection): void { this.options.runtime?.observe(id, revision, sessionId, actual); }

  private refusal(error: unknown): Error {
    if (!(error instanceof DraftError) && !(error instanceof ApplyError)) throw error;
    return new RemoteError('studio-workflows/rejected', error.reason, { reason: error.reason, ...(error instanceof ApplyError ? { diagnostics: error.diagnostics } : {}) }, { cause: error });
  }

  /** @returns Detached registered components for the draft editor. */
  @Remote
  components(): ComponentDefinition[] { return this.options.registry.describe(); }

  /** @returns Detached catalog at the reported revision. */
  @Remote
  catalog(): CatalogSnapshot { return { ...this.options.registry.catalog(), revision: this.options.revision() }; }

  /** @returns Current DSH routes and reasoning metadata, including lookup failures. */
  @Remote
  models(): Promise<ModelCatalog> { return this.options.models().catalog(); }

  /** @param document New-format wire document. @returns Configuration decision against current registrations. */
  @Remote
  async validate(document: WorkflowDocument): Promise<ValidationResult> {
    try {
      const parsed = parseDocument(document);
      const revision = this.options.revision();
      const result = this.options.registry.validate(parsed);
      result.catalogRevision = revision;
      const models = this.options.models();
      for (const role of parsed.roles) {
        const checked = await models.validate(role.model);
        for (const issue of checked.issues) result.diagnostics.push({ code: issue.code, target: { kind: 'role', roleId: role.id, fieldPath: issue.field }, relatedIds: [], details: issue.failure ? { operation: issue.failure.operation, failureCode: issue.failure.code } : {} });
      }
      if (revision !== this.options.revision()) result.diagnostics.push({ code: 'model-lookup-failed', target: { kind: 'document' }, relatedIds: [], details: {} });
      result.valid = result.diagnostics.length === 0;
      return result;
    }
    catch (error) { throw this.refusal(error); }
  }

  /** @param definition System declaration. @param validator Pure Host-only semantic check. @returns Effect-owned disposer. */
  registerSystem(definition: SystemDefinition, validator?: SemanticValidator): () => void { return this.options.registry.registerSystem(definition, validator); }

  /** Host-only declaration contribution, owned by the registering plugin.
   * @param definition Component identity, version, scope and editor fields.
   * @param validator Optional pure synchronous Host semantic check.
   * @returns Idempotent registration disposer for use with ctx.effect().
   */
  register(definition: ComponentDefinition, validator?: SemanticValidator): () => void { return this.options.registry.register(definition, validator); }
}

/** Mount the workflow declaration service and the built-in instructions component.
 * @param ctx Owning plugin context.
 */
export async function apply(ctx: Context): Promise<void> {
  let revision = 0;
  const changed = () => { ++revision; };
  const registry = new ComponentRegistry(changed);
  ctx.on('llm/adapters-updated', changed);
  ctx.effect(() => registry.register(instructionsDefinition));
  const store = await DraftStore.open(ctx.storageDomain, ctx.profileContext.name);
  ctx.effect(() => () => store.close());
  const models = () => new WorkflowModels(ctx.get('llm'));
  const runtime = new WorkflowRuntime(() => ctx.get('agentPresets') as unknown as PresetRegistry | undefined);
  const applied = await AppliedStore.open(ctx.storageDomain, ctx.profileContext.name);
  const application = new WorkflowApplication(store, applied, new WorkflowCompiler(registry, models, () => revision), runtime, () => {
    const experiments = ctx.get('studioExperiments') as { describe(): { settings: { targets: Record<string, string> } } } | undefined;
    if (!experiments) return 'not-targeted';
    try { return Object.values(experiments.describe().settings.targets).some(target => target === 'main' || target === 'both') ? 'targeted' : 'not-targeted'; }
    catch { return 'unknown'; }
  });
  ctx.effect(() => () => application.close());
  ctx.inject(['agentPresets', 'llm'], async scope => {
    scope.on('llm/adapters-updated', async () => { await application.restore(); });
    await application.restore();
  });
  ctx.plugin(WorkflowRemote, { registry, store, models, revision: () => revision, application, runtime });
}

/** Document storage and profile identity; model lookup is optional and never required to save drafts. */
export const inject = ['storageDomain', 'profileContext'];
