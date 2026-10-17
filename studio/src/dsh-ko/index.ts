/**
 * Korean dictionaries for DSH namespaces, one file per namespace (`./<namespace>.ts`).
 * The translation skill adds a file and one line here per finished namespace.
 */
import type { DshKoDictionaries } from '../dsh-ko-locale.ts';
import claudeCodeMods from './claude-code-mods.ts';
import documentHtml from './documentHtml.ts';
import documentMarkdown from './documentMarkdown.ts';
import settingsLocale from './settings.locale.ts';
import settingsSessionLog from './settings.sessionLog.ts';
import shortcutsLayout from './shortcuts.layout.ts';
import sidebarCodePreview from './sidebarCodePreview.ts';

export const dshKo: DshKoDictionaries = {
  'claude-code-mods': claudeCodeMods,
  documentHtml: documentHtml,
  documentMarkdown: documentMarkdown,
  'settings.locale': settingsLocale,
  'settings.sessionLog': settingsSessionLog,
  'shortcuts.layout': shortcutsLayout,
  'sidebarCodePreview': sidebarCodePreview,
};
