/** Public preset registration adapter; only disposes registrations this owner acquired. */
import type { AppliedWorkflow, ApplicationState, ModelObservation } from './apply-types.ts';
import type { ActivationOwner } from './application.ts';
import type { ModelSelection } from './workflow-types.ts';
export interface PresetRegistry {
  register(definition: { id: string; name: string; plugins: { name: string; config: unknown }[] }): Promise<() => Promise<void>>;
  list(): Promise<{ id: string; broken?: unknown }[]>;
}
export class WorkflowRuntime implements ActivationOwner {
  private readonly owned = new Map<string, { revision: number; dispose: () => Promise<void> }>();
  private readonly failures = new Map<string, string>();
  private readonly observations = new Map<string, ModelObservation[]>();
  private readonly models = new Map<string, ModelSelection>();
  constructor(private readonly registry: () => PresetRegistry | undefined) {}
  async activate(record: AppliedWorkflow): Promise<void> {
    const registry = this.registry();
    try {
      if (!registry) throw new Error('Preset registry unavailable');
      const previous = this.owned.get(record.id);
      if (previous) { await previous.dispose(); this.owned.delete(record.id); }
      const main = record.compiled.roles.find(role => role.id === record.compiled.mainRoleId)!;
      this.models.set(`${record.id}:${record.revision}`, main.model);
      const dispose = await registry.register({ id: record.presetId, name: record.document.name, plugins: [{ name: '@local/dsh-studio-workflows/instructions', config: { id: record.id, revision: record.revision, instructions: main.instructions } }] });
      this.owned.set(record.id, { revision: record.revision, dispose });
      this.failures.delete(record.id);
    } catch (error) { this.failures.set(record.id, error instanceof Error ? error.message : String(error)); throw error; }
  }
  invalidate(record: AppliedWorkflow, error: unknown): void { this.failures.set(record.id, error instanceof Error ? error.message : String(error)); }
  observe(id: string, revision: number, sessionId: string, actual: ModelSelection): void {
    const expected = this.models.get(`${id}:${revision}`);
    if (!expected) return;
    const values = this.observations.get(id) ?? [];
    const next = values.filter(item => item.sessionId !== sessionId);
    next.push({ sessionId, revision, actual: { provider: actual.provider, model: actual.model, ...(actual.reasoningEffort ? { reasoningEffort: actual.reasoningEffort } : {}) }, matches: expected.provider === actual.provider && expected.model === actual.model && (expected.reasoningEffort === undefined || expected.reasoningEffort === actual.reasoningEffort) });
    this.observations.set(id, next.slice(-50));
  }
  async inspect(record: AppliedWorkflow): Promise<Omit<ApplicationState, 'applied'>> {
    const base = { experiments: record.experiments, observations: structuredClone(this.observations.get(record.id) ?? []) };
    const failure = this.failures.get(record.id);
    if (failure) return { ...base, activation: 'failed', diagnostic: failure };
    if (this.owned.get(record.id)?.revision !== record.revision) return { ...base, activation: 'unknown', diagnostic: 'Saved snapshot has not been activated by this owner' };
    try {
      const preset = (await this.registry()?.list())?.find(item => item.id === record.presetId);
      if (!preset) return { ...base, activation: 'unknown', diagnostic: 'Owned preset is not currently registered' };
      return preset.broken ? { ...base, activation: 'failed', diagnostic: JSON.stringify(preset.broken) } : { ...base, activation: 'active' };
    } catch (error) { return { ...base, activation: 'unknown', diagnostic: String(error) }; }
  }
  async close(): Promise<void> { for (const item of this.owned.values()) await item.dispose(); this.owned.clear(); this.models.clear(); this.observations.clear(); }
}
