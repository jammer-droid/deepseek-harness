import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateGateDefinition, type GateDefinition } from '../pixie-gate-contracts.ts';

export interface PresetGate { definition: GateDefinition; presetIds: string[] }
export function validatePresetGates(value: unknown): PresetGate[] {
  if (!Array.isArray(value)) throw new Error('Gate definitions must be an array');
  const ids = new Set<string>();
  const bindings = new Set<string>();
  return value.map(row => {
    if (!row || !Array.isArray(row.presetIds) || !row.presetIds.every((id: unknown) => typeof id === 'string' && id.trim())) throw new Error('Gate needs presetIds');
    const definition = validateGateDefinition(row.definition);
    if (ids.has(definition.id)) throw new Error('Duplicate gate id');
    ids.add(definition.id);
    const presetIds = [...new Set<string>(row.presetIds)];
    for (const id of presetIds) {
      const key = JSON.stringify([id, definition.point]);
      if (definition.enabled && bindings.has(key)) throw new Error('Only one enabled gate per preset and point is supported');
      if (definition.enabled) bindings.add(key);
    }
    return { definition, presetIds };
  });
}
/** Atomic, serialized replacement; invalid or failed saves never publish a new definition. */
export class PixieGateDefinitions {
  private writes: Promise<unknown> = Promise.resolve();
  constructor(private readonly file: string, private readonly legacyFile?: string) {}
  async read(): Promise<PresetGate[]> {
    try { return validatePresetGates(JSON.parse(await readFile(this.file, 'utf8'))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (!this.legacyFile) return [];
    const operation = this.writes.catch(() => {}).then(async () => {
      // Recheck within the write queue: a save or another first read may have won.
      try { return validatePresetGates(JSON.parse(await readFile(this.file, 'utf8'))); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      let rows: PresetGate[];
      try { rows = validatePresetGates(JSON.parse(await readFile(this.legacyFile!, 'utf8'))); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
      await mkdir(dirname(this.file), { recursive: true });
      // Atomic rename only after validation. A failed move leaves the original intact.
      await rename(this.legacyFile!, this.file);
      return rows;
    });
    this.writes = operation;
    return operation;
  }
  save(value: unknown): Promise<PresetGate[]> {
    const rows = validatePresetGates(value);
    const operation = this.writes.catch(() => {}).then(async () => {
      await mkdir(dirname(this.file), { recursive: true });
      const temporary = `${this.file}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(rows, null, 2), 'utf8');
      await rename(temporary, this.file);
      return structuredClone(rows);
    });
    this.writes = operation;
    return operation;
  }
}
