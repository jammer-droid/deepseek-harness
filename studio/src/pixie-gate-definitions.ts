import type { GateDefinition } from './pixie-gate-contracts.ts';

export interface GateEntry { definition: GateDefinition; presetIds: string[] }
export interface GateTasksRead {
  entries: import('./pixie-gate-task.ts').GateTask[];
  invalid: InvalidGateEntry[];
  error?: GateDefinitionError;
}
export interface GateDefinitionError { code: string; message: string }
export interface InvalidGateEntry { index: number; raw: unknown; error: GateDefinitionError }
export interface GateDefinitionsRead {
  entries: GateEntry[];
  invalid: InvalidGateEntry[];
  error?: GateDefinitionError;
}
