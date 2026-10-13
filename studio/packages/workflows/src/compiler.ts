/** Host-only conversion of validated declarations into supported execution inputs. */
import type { ComponentRegistry } from './component-registry.ts';
import type { WorkflowModels } from './models.ts';
import type { WorkflowDocument, WorkflowDiagnostic } from './workflow-types.ts';
import type { ApplyFailure, CompiledWorkflow, CompiledInstructions } from './apply-types.ts';
export class ApplyError extends Error {
  constructor(readonly reason: ApplyFailure, readonly diagnostics: WorkflowDiagnostic[] = [], options?: ErrorOptions) { super(reason, options); }
}
type ComponentInstance = WorkflowDocument['roles'][number]['components'][number];
/** Host-owned adapters are independent of discoverable component declarations. */
export interface ComponentAdapter { id: string; version: number; compile(instance: ComponentInstance): CompiledInstructions[] }
const instructions: ComponentAdapter = { id: 'studio.instructions', version: 1, compile: instance => [{ instanceId: instance.instanceId, text: instance.config.text as string }] };
/** Declaration validation and execution support are deliberately separate checks. */
export class WorkflowCompiler {
  constructor(private readonly registry: ComponentRegistry, private readonly models: () => Pick<WorkflowModels, 'validate'>, private readonly revision: () => number, private readonly adapters: readonly ComponentAdapter[] = [instructions]) {}
  async compile(document: WorkflowDocument): Promise<CompiledWorkflow> {
    const revision = this.revision();
    const diagnostics = this.registry.validate(document).diagnostics;
    for (const role of document.roles) {
      const model = await this.models().validate(role.model);
      for (const issue of model.issues) diagnostics.push({ code: issue.code, target: { kind: 'role', roleId: role.id, fieldPath: issue.field }, relatedIds: [], details: {} });
    }
    if (revision !== this.revision()) throw new ApplyError('catalog-changed');
    if (diagnostics.length) throw new ApplyError('validation-failed', diagnostics);
    // #19–#21 add explicit adapters here; declaration registration is never execution permission.
    if (document.systems.some(instance => instance.enabled !== false)
      || document.roles.some(role => role.components.some(instance => instance.enabled !== false && !this.adapters.some(adapter => adapter.id === instance.id && adapter.version === instance.version)))) throw new ApplyError('unsupported-adapter');
    return {
      mainRoleId: document.mainRoleId,
      roles: document.roles.map(role => ({
        id: role.id, model: structuredClone(role.model!),
        instructions: role.components.filter(instance => instance.enabled !== false).flatMap(instance => this.adapters.find(adapter => adapter.id === instance.id && adapter.version === instance.version)!.compile(instance)),
      })),
    };
  }
}
