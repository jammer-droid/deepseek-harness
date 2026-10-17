/**
 * Korean dictionaries for DSH namespaces, one file per namespace (`./<namespace>.ts`).
 * The translation skill adds a file and one line here per finished namespace.
 */
import type { DshKoDictionaries } from '../dsh-ko-locale.ts';
import approval from './approval.ts';
import claudeCodeMods from './claude-code-mods.ts';
import documentHtml from './documentHtml.ts';
import documentMarkdown from './documentMarkdown.ts';
import inspectorPanel from './inspectorPanel.ts';
import settingsLocale from './settings.locale.ts';
import settingsPlugins from './settings.plugins.ts';
import settingsSessionLog from './settings.sessionLog.ts';
import shortcutsLayout from './shortcuts.layout.ts';
import sidebar from './sidebar.ts';
import sidebarCodePreview from './sidebarCodePreview.ts';

export const dshKo: DshKoDictionaries = {
  approval: approval,
  'claude-code-mods': claudeCodeMods,
  documentHtml: documentHtml,
  documentMarkdown: documentMarkdown,
  inspectorPanel: inspectorPanel,
  'settings.locale': settingsLocale,
  'settings.plugins': settingsPlugins,
  'settings.sessionLog': settingsSessionLog,
  'shortcuts.layout': shortcutsLayout,
  sidebar: sidebar,
  'sidebarCodePreview': sidebarCodePreview,
};
