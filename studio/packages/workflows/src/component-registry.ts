/** Serializable declarations and effect-owned Host contributions. */
import type { Branded } from '@deepseek-ai/dsh-brand';
import { validateWorkflow } from './validation.ts';
import type { WorkflowDocument, ValidationResult, SemanticValidator } from './workflow-types.ts';
/** Registered component identity. */
export type ComponentId = Branded<'StudioComponentId'>;
/** Registered system identity, independent of component IDs. */
export type SystemId = Branded<'StudioSystemId'>;
/** Editable configuration field. */
export interface ConfigField { key: string; kind: 'text'; required: boolean }
/** Directed, exactly typed connection declaration. */
export interface PortDefinition {
  id: string; direction: 'input' | 'output'; semantic: string; allowedPeers: string[];
  minConnections: number; maxConnections: number;
}
/** Component contribution for the main role. */
export interface ComponentDefinition {
  id: ComponentId; version: number; scope: 'role'; fields: ReadonlyArray<ConfigField>;
  ports?: ReadonlyArray<PortDefinition>;
  requiredSystems?: ReadonlyArray<{ id: SystemId; version: number }>;
}
/** Workflow-owned system contribution; locations are declarations, not support promises. */
export interface SystemDefinition {
  id: SystemId; version: number; scope: 'workflow'; fields: ReadonlyArray<ConfigField>;
  ports?: ReadonlyArray<PortDefinition>; executionLocations: string[];
}
/** Detached serializable catalog at one revision. */
export interface CatalogSnapshot { revision: number; components: ComponentDefinition[]; systems: SystemDefinition[] }
/** Registration refusals leave previous declarations unchanged. */
export class RegistrationError extends Error {
  constructor(readonly reason: 'duplicate-id' | 'invalid-definition') { super(reason); }
}
/** Owns registrations only; drafts outlive their providers. */
export class ComponentRegistry {
  private readonly definitions = new Map<string, ComponentDefinition>();
  private readonly systems = new Map<string, SystemDefinition>();
  private readonly validators = new Map<ComponentDefinition | SystemDefinition, SemanticValidator>();
  private revision = 0;
  constructor(private readonly changed: (revision: number) => void = () => {}) {}
  private bump(): void { this.changed(++this.revision); }
  private add<T extends ComponentDefinition | SystemDefinition>(map: Map<string, T>, definition: T, validator?: SemanticValidator): () => void {
    if (!definition.id.trim() || !Number.isSafeInteger(definition.version) || definition.version < 1
      || definition.fields.some(field => !field.key.trim() || field.kind !== 'text')
      || new Set(definition.fields.map(field => field.key)).size !== definition.fields.length) throw new RegistrationError('invalid-definition');
    const ports = definition.ports ?? [];
    if (new Set(ports.map(port => port.id)).size !== ports.length || ports.some(port =>
      !port.id.trim() || !port.semantic.trim() || !['input', 'output'].includes(port.direction)
      || !Number.isSafeInteger(port.minConnections) || !Number.isSafeInteger(port.maxConnections)
      || port.minConnections < 0 || port.maxConnections < port.minConnections
      || port.allowedPeers.some(id => !id.trim()) || new Set(port.allowedPeers).size !== port.allowedPeers.length)) throw new RegistrationError('invalid-definition');
    if ('executionLocations' in definition) {
      if (definition.scope !== 'workflow' || !definition.executionLocations.length
        || definition.executionLocations.some(location => !location.trim())
        || new Set(definition.executionLocations).size !== definition.executionLocations.length) throw new RegistrationError('invalid-definition');
    } else if (definition.scope !== 'role' || (definition.requiredSystems ?? []).some(system => !system.id.trim() || !Number.isSafeInteger(system.version) || system.version < 1)
      || new Set((definition.requiredSystems ?? []).map(system => system.id)).size !== (definition.requiredSystems ?? []).length) throw new RegistrationError('invalid-definition');
    if (map.has(definition.id)) throw new RegistrationError('duplicate-id');
    const stored = structuredClone(definition);
    map.set(stored.id, stored);
    if (validator) this.validators.set(stored, validator);
    this.bump();
    return () => { if (map.get(stored.id) === stored) { map.delete(stored.id); this.validators.delete(stored); this.bump(); } };
  }
  /** @param definition Component declaration. @param validator Optional pure Host check. @returns Effect disposer. */
  register(definition: ComponentDefinition, validator?: SemanticValidator): () => void { return this.add(this.definitions, definition, validator); }
  /** @param definition System declaration. @param validator Optional pure Host check. @returns Effect disposer. */
  registerSystem(definition: SystemDefinition, validator?: SemanticValidator): () => void { return this.add(this.systems, definition, validator); }
  /** @param document Current editable document. @returns Current catalog decision, never execution authorization. */
  validate(document: WorkflowDocument): ValidationResult {
    const catalog = this.catalog();
    const result = validateWorkflow(document, catalog);
    const contributions = [...this.validators.entries()];
    for (const [definition, validator] of contributions) {
      const instances = definition.scope === 'role' ? document.mainRole.components : document.systems;
      for (const instance of instances) {
        if (instance.id === definition.id && instance.version === definition.version) result.diagnostics.push(...structuredClone(validator(structuredClone(instance), structuredClone(document), structuredClone(catalog))));
      }
    }
    result.valid = result.diagnostics.length === 0;
    return result;
  }
  /** @returns Detached component declarations. */
  describe(): ComponentDefinition[] { return structuredClone([...this.definitions.values()]); }
  /** @returns Detached catalog revision and declarations. */
  catalog(): CatalogSnapshot { return { revision: this.revision, components: this.describe(), systems: structuredClone([...this.systems.values()]) }; }
}
/** Built-in instructions configuration. */
export const instructionsDefinition: ComponentDefinition = {
  id: 'studio.instructions' as ComponentId, version: 1, scope: 'role',
  fields: [{ key: 'text', kind: 'text', required: true }],
};
