/** Profile-owned role settings; durable snapshots are separate from process revisions. */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain';
import type { Domain, DomainFacility } from '@deepseek-ai/dsh-storage-domain';
import { ReasoningEffortId, type LlmRuntime } from '@deepseek-ai/dsh-llm';
import { brandString } from '@deepseek-ai/dsh-brand';
import type { RoleState, RoleApplyRequest, RoleSnapshotId, RoleProcessId } from './roles-types.ts';

const roleSchema = z.object({ instructions: z.string().trim().min(1), provider: z.string().min(1), model: z.string().min(1), reasoningEffort: z.string().min(1).optional() }).strict();
const rolesSchema = z.object({ implementer: roleSchema, reviewer: roleSchema }).strict();
const snapshotSchema = z.object({ snapshotId: z.string().uuid().transform(value => brandString<RoleSnapshotId>(value)), roles: rolesSchema });
const recordSchema = z.object({ snapshot: snapshotSchema.nullable() });
const spec = defineDomain({ name: 'studio_roles', version: 1, tables: { profiles: domainTable(recordSchema) } });
type Snapshot = z.infer<typeof snapshotSchema>;
type Roles = z.infer<typeof rolesSchema>;
/** Dependencies are public storage and model capability services. */
export interface RoleDependencies {
  storageDomain: Pick<DomainFacility, 'open'>;
  llm: Pick<LlmRuntime, 'listModels' | 'resolveCallConfig'>;
  profile: string;
}
/** Settings owner used by the Host Remote and future child creation. */
export class RoleSettings {
  private readonly processId = brandString<RoleProcessId>(randomUUID());
  private revision = 0;
  private failed = false;
  private closed = false;
  private queue: Promise<void> = Promise.resolve();
  private active: Snapshot | null = null;
  private constructor(private readonly dependencies: RoleDependencies, private readonly domain: Domain<typeof spec>) {}
  /** Open and validate this profile's saved roles before permitting new execution.
   * @param dependencies Public services and current profile identity.
   * @returns Initialized role settings owner.
   */
  static async open(dependencies: RoleDependencies): Promise<RoleSettings> {
    const domain = await dependencies.storageDomain.open(spec);
    const owner = new RoleSettings(dependencies, domain);
    try { await owner.initialize(); }
    catch (error) { await domain.close(); throw error; }
    return owner;
  }
  private async initialize(): Promise<void> {
    const table = this.domain.table('profiles');
    if (!table.get(this.dependencies.profile)) await table.put(this.dependencies.profile, { snapshot: null });
    await this.activate(this.saved());
  }
  private saved(): Snapshot | null {
    return recordSchema.parse(this.domain.table('profiles').get(this.dependencies.profile)).snapshot;
  }
  /** @returns Confirmed saved and applied state without changing execution. */
  describe(): RoleState {
    const saved = this.saved();
    return { processId: this.processId, revision: this.revision, snapshotId: saved?.snapshotId ?? null, appliedSnapshotId: this.active?.snapshotId ?? null, roles: saved?.roles ?? null, failure: this.failed ? 'capability-unavailable' : null, status: this.failed ? 'apply-failed' : this.active ? 'applied' : 'unconfigured' };
  }
  /** Persist and explicitly apply a fixed role pair.
   * @param request Candidate roles and both observed revision identities.
   * @returns Confirmed state after Apply.
   */
  async apply(request: RoleApplyRequest) {
    if (this.closed) throw new Error('roles-closed');
    const operation = this.queue.then(() => this.commit(request));
    this.queue = operation.then(() => {}, () => {});
    return operation;
  }
  private async validate(roles: Roles) {
    for (const settings of Object.values(roles)) {
      const { instructions: _instructions, ...route } = settings;
      const models = await this.dependencies.llm.listModels(route.provider);
      if (!models.some(model => model.id === route.model)) throw new Error('unsupported-model');
      await this.dependencies.llm.resolveCallConfig({ provider: route.provider, model: route.model, ...(route.reasoningEffort === undefined ? {} : { reasoningEffort: ReasoningEffortId(route.reasoningEffort) }) });
    }
  }
  private async activate(snapshot: Snapshot | null) {
    this.active = null;
    this.failed = false;
    if (!snapshot) return;
    try { await this.validate(snapshot.roles); }
    catch (_error) { this.failed = true; return; } // Saved configuration is known; execution remains blocked.
    this.active = snapshot;
  }
  private async commit(request: RoleApplyRequest) {
    const roles = rolesSchema.parse(request.roles);
    await this.validate(roles);
    const snapshot = { snapshotId: brandString<RoleSnapshotId>(randomUUID()), roles };
    await this.domain.table('profiles').update(this.dependencies.profile, current => {
      const previous = recordSchema.parse(current);
      if (request.expectedProcessId !== this.processId || request.expectedRevision !== this.revision || request.expectedSnapshotId !== (previous.snapshot?.snapshotId ?? null)) throw new Error('revision-conflict');
      return { snapshot };
    });
    this.revision++;
    await this.activate(snapshot);
    return this.describe();
  }
  /** Capture a detached creation-time role; existing children retain their copy.
   * @param role Fixed role identifier.
   * @returns Durable snapshot identity and role settings.
   */
  capture(role: keyof Roles) {
    if (this.closed) throw new Error('roles-closed');
    if (!this.active) throw new Error('roles-not-applied');
    return structuredClone({ snapshotId: this.active.snapshotId, settings: this.active.roles[role] });
  }
  /** Release the profile domain after pending writes settle. */
  async close() { this.closed = true; await this.queue; await this.domain.close(); }
}
