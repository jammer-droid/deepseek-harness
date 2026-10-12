/** Wire values for user-only preset configuration editing. */
export interface PresetField {
  path: string[];
  value: string | number | boolean;
}
/** A child row exposes editable literals, never executable expressions. */
export interface PresetPlugin {
  path: number[];
  name: string;
  disabled: boolean | null;
  fields: PresetField[];
}
/** Host-owned template; its key changes when its complete configuration changes. */
export interface PresetComponent {
  key: string;
  name: string;
  source: string;
  plugins: PresetPlugin[];
}
/** Snapshot for optimistic, explicit profile edits. */
export interface PresetSettings {
  entryId: string;
  id: string;
  name: string;
  revision: string;
  overridden: boolean;
  availability: 'available' | 'broken' | 'unknown';
  plugins: PresetPlugin[];
  components: PresetComponent[];
}
/** Existing literals and explicit structural operations, committed together. */
export interface PresetChange {
  entryId: string;
  revision: string;
  reset: boolean;
  plugins: PresetPlugin[];
  remove?: number[][];
  add?: string[];
}
