/**
 * Korean dictionaries for DSH namespaces, one file per namespace (`./<namespace>.ts`).
 * The translation skill adds a file and one line here per finished namespace.
 */
import type { DshKoDictionaries } from '../dsh-ko-locale.ts';
import settingsLocale from './settings.locale.ts';
import shortcutsLayout from './shortcuts.layout.ts';
import sidebarCodePreview from './sidebarCodePreview.ts';

export const dshKo: DshKoDictionaries = {
  'settings.locale': settingsLocale,
  'shortcuts.layout': shortcutsLayout,
  'sidebarCodePreview': sidebarCodePreview,
};
