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
/** Snapshot for optimistic, explicit profile edits. */
export interface PresetSettings {
  entryId: string;
  id: string;
  name: string;
  revision: string;
  overridden: boolean;
  availability: 'available' | 'broken' | 'unknown';
  plugins: PresetPlugin[];
}
/** Only literals already present in a declaration can be changed. */
export interface PresetChange {
  entryId: string;
  revision: string;
  reset: boolean;
  plugins: PresetPlugin[];
}
