import { catalogFailure } from './errors.ts';
/** Opt-in role composition and durable catalog enrichment, using the native subagent runtime. */
import { randomUUID } from 'node:crypto';
import type { Context } from '@deepseek-ai/cordis';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { SessionId } from '@deepseek-ai/dsh-session';
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import type { Domain } from '@deepseek-ai/dsh-storage-domain';
import type {} from '@deepseek-ai/dsh-agent';
import type {} from '@deepseek-ai/dsh-subagent';
import type {} from '@local/dsh-studio-workflows';
import type { ComponentId } from '@local/dsh-studio-workflows/types';
import type { CatalogAssignment, LaunchRequest, RoleChoice } from './types.ts';
import { catalogSpec } from './store.ts';
import { resolveRole } from './resolve.ts';

declare module '@deepseek-ai/cordis' { interface Context { studioCatalog: CatalogRemote } }

/** Shared UI/model invocation service. Uncertain admissions block new launches until reload. */
export class CatalogRemote extends TypertRemoteService {
  private readonly pending = new Set<Promise<unknown>>();
  private readonly cancellation = new AbortController();
  private uncertain = false;
  constructor(ctx: Context, private readonly domain: Domain<typeof catalogSpec>) {
    super(ctx, 'studioCatalog');
    ctx.effect(() => async () => { this.cancellation.abort(); await Promise.allSettled([...this.pending]); await domain.close(); });
  }
  /** @returns Saved role identities and revisions; listing never spawns. */
  @Remote
  async roles(): Promise<RoleChoice[]> {
    return (await this.ctx.studioWorkflows.drafts()).map(draft => ({ id: draft.id, name: draft.document.name, roleName: draft.document.mainRole.name, revision: draft.revision }));
  }
  /** @param parentId Catalog owner. @returns Creation snapshots, never inferred runtime status. */
  @Remote
  async assignments(parentId: SessionId): Promise<CatalogAssignment[]> {
    return structuredClone([...this.domain.table('children').entries()].map(([, row]) => row).filter(row => row.parentId === parentId));
  }
  /** @param request Explicit role revision, task and context. @returns Accepted native child identity. */
  @Remote
  async launch(request: LaunchRequest): Promise<{ childId: SessionId }> {
    if (this.uncertain || this.cancellation.signal.aborted) throw catalogFailure('admission-unavailable');
    return this.launchForAgent(request, this.cancellation.signal);
  }
  /** @param request Explicit invocation. @param signal Caller cancellation before durable admission. @returns Native child identity. */
  async launchForAgent(request: LaunchRequest, signal: AbortSignal): Promise<{ childId: SessionId }> {
    if (this.uncertain || this.cancellation.signal.aborted) throw catalogFailure('admission-unavailable');
    signal.throwIfAborted();
    const operation = this.start(request, signal);
    this.pending.add(operation);
    try { return await operation; } finally { this.pending.delete(operation); }
  }
  private async start(request: LaunchRequest, signal: AbortSignal): Promise<{ childId: SessionId }> {
    const parent = this.ctx.agents.get(request.parentId);
    if (!parent) throw catalogFailure('parent-not-live');
    const draft = (await this.ctx.studioWorkflows.drafts()).find(value => value.id === request.roleId);
    if (!draft) throw catalogFailure('role-not-found');
    const resolved = resolveRole(draft, request);
    signal.throwIfAborted();
    this.cancellation.signal.throwIfAborted();
    if (this.uncertain) throw catalogFailure('admission-unavailable');
    const childId = SessionId(randomUUID());
    const record: CatalogAssignment = { parentId: parent.id, childId, role: { id: draft.id, name: draft.document.mainRole.name, description: draft.document.name }, snapshot: { revision: draft.revision, ...resolved, task: request.task, context: request.context }, createdAt: Date.now() };
    try {
      await this.domain.table('children').put(childId, record);
      await this.ctx.subagents.startActivation({ provider: request.context === 'fork' ? 'fork' : 'spawn', label: record.role.name, childId, delivery: 'parent', signal: this.cancellation.signal,
        request: { parent, prompt: [{ type: 'text', text: record.snapshot.task }],
          ...(resolved.instructions ? { persona: resolved.instructions } : {}),
          ...(resolved.model ? { agentOptions: { provider: resolved.model.provider, model: resolved.model.model, ...(resolved.model.reasoningEffort ? { reasoningEffort: ReasoningEffortId(resolved.model.reasoningEffort) } : {}) } } : {}),
          ...(resolved.tools ? { toolFilter: resolved.tools } : {}),
        },
      });
    } catch (error) {
      this.uncertain = true;
      throw catalogFailure('admission-unknown', childId, error);
    }
    return { childId };
  }
}
export const inject = ['storageDomain', 'studioWorkflows', 'subagents', 'agents'];
/** @param ctx Opt-in plugin lifetime. */
export async function apply(ctx: Context): Promise<void> {
  for (const definition of [
    { id: 'studio.model' as ComponentId, version: 1, scope: 'role' as const, fields: [{ key: 'provider', kind: 'text' as const, required: true }, { key: 'model', kind: 'text' as const, required: true }, { key: 'reasoningEffort', kind: 'text' as const, required: false }] },
    { id: 'studio.tools' as ComponentId, version: 1, scope: 'role' as const, fields: [{ key: 'allow', kind: 'text' as const, required: false }, { key: 'deny', kind: 'text' as const, required: false }] },
  ]) ctx.effect(() => ctx.studioWorkflows.register(definition));
  const domain = await ctx.storageDomain.open(catalogSpec);
  ctx.plugin(CatalogRemote, domain);
}
