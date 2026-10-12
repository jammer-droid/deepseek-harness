/** Workflow component declarations shared by draft validation and editing. */
import type { Branded } from '@deepseek-ai/dsh-brand';
/** Stable identity of a registered Studio component. */
export type ComponentId = Branded<'StudioComponentId'>;
/** Serializable settings declaration shared by Host validation and the editor. */
export interface ComponentDefinition {
  id: ComponentId;
  version: number;
  scope: 'role';
  fields: ReadonlyArray<{ key: string; kind: 'text'; required: boolean }>;
}

/** Registration refusals leave the previous declaration unchanged. */
export class RegistrationError extends Error {
  constructor(readonly reason: 'duplicate-id' | 'invalid-definition') {
    super(reason);
  }
}

/** Owns component declarations, never workflow settings or execution state. */
export class ComponentRegistry {
  private readonly definitions = new Map<string, ComponentDefinition>();

  /** Register until the caller's effect is disposed.
   * @param definition Stable identity and serializable editor fields.
   * @returns Idempotent disposer for this registration only.
   */
  register(definition: ComponentDefinition): () => void {
    if (!definition.id.trim() || !Number.isSafeInteger(definition.version) || definition.version < 1
      || definition.fields.some(field => !field.key.trim())
      || new Set(definition.fields.map(field => field.key)).size !== definition.fields.length) {
      throw new RegistrationError('invalid-definition');
    }
    if (this.definitions.has(definition.id)) throw new RegistrationError('duplicate-id');
    const stored = structuredClone(definition);
    this.definitions.set(stored.id, stored);
    return () => {
      if (this.definitions.get(stored.id) === stored) this.definitions.delete(stored.id);
    };
  }

  /** @returns Detached declarations; callers cannot mutate registration state. */
  describe(): ComponentDefinition[] {
    return structuredClone([...this.definitions.values()]);
  }
}

/** First supported component; changing its meaning requires a version change. */
export const instructionsDefinition: ComponentDefinition = {
  id: 'studio.instructions' as ComponentId, version: 1, scope: 'role',
  fields: [{ key: 'text', kind: 'text', required: true }],
};
