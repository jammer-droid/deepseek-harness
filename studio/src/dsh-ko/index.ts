/**
 * Korean dictionaries for DSH namespaces, one file per namespace (`./<namespace>.ts`).
 * The translation skill adds a file and one line here per finished namespace.
 */
import type { DshKoDictionaries } from '../dsh-ko-locale.ts';
import agentTeam from './agent-team.ts';
import approval from './approval.ts';
import claudeCodeMods from './claude-code-mods.ts';
import command from './command.ts';
import cotTranslation from './cotTranslation.ts';
import directoryBrowser from './directory-browser.ts';
import documentHtml from './documentHtml.ts';
import documentMarkdown from './documentMarkdown.ts';
import feedback from './feedback.ts';
import goal from './goal.ts';
import inspectorPanel from './inspectorPanel.ts';
import model from './model.ts';
import permissionAccess from './permission.access.ts';
import plan from './plan.ts';
import question from './question.ts';
import reference from './reference.ts';
import sessionLogDownload from './session-log-download.ts';
import settings from './settings.ts';
import settingsAgentLoop from './settings.agentLoop.ts';
import settingsLocale from './settings.locale.ts';
import settingsPermission from './settings.permission.ts';
import settingsPlugins from './settings.plugins.ts';
import settingsSessionLog from './settings.sessionLog.ts';
import settingsShell from './settings.shell.ts';
import settingsTheme from './settings.theme.ts';
import settingsWebSearch from './settings.webSearch.ts';
import shortcutsLayout from './shortcuts.layout.ts';
import sidebar from './sidebar.ts';
import sidebarBrowser from './sidebarBrowser.ts';
import sidebarCodePreview from './sidebarCodePreview.ts';
import sidebarDocumentPreview from './sidebarDocumentPreview.ts';
import sidebarExcel from './sidebarExcel.ts';
import sidebarFiles from './sidebarFiles.ts';
import sidebarImage from './sidebarImage.ts';
import sidebarOffice from './sidebarOffice.ts';
import sidebarPdf from './sidebarPdf.ts';
import sidebarRight from './sidebarRight.ts';
import sidebarTerminal from './sidebarTerminal.ts';
import skill from './skill.ts';
import slashMenu from './slash.menu.ts';
import workflowRun from './workflowRun.ts';

export const dshKo: DshKoDictionaries = {
  'agent-team': agentTeam,
  approval: approval,
  'claude-code-mods': claudeCodeMods,
  command: command,
  cotTranslation: cotTranslation,
  'directory-browser': directoryBrowser,
  documentHtml: documentHtml,
  documentMarkdown: documentMarkdown,
  feedback: feedback,
  goal: goal,
  inspectorPanel: inspectorPanel,
  model: model,
  'permission.access': permissionAccess,
  plan: plan,
  question: question,
  reference: reference,
  'session-log-download': sessionLogDownload,
  settings: settings,
  'settings.agentLoop': settingsAgentLoop,
  'settings.locale': settingsLocale,
  'settings.permission': settingsPermission,
  'settings.plugins': settingsPlugins,
  'settings.sessionLog': settingsSessionLog,
  'settings.shell': settingsShell,
  'settings.theme': settingsTheme,
  'settings.webSearch': settingsWebSearch,
  'shortcuts.layout': shortcutsLayout,
  sidebar: sidebar,
  sidebarBrowser: sidebarBrowser,
  'sidebarCodePreview': sidebarCodePreview,
  sidebarDocumentPreview: sidebarDocumentPreview,
  sidebarExcel: sidebarExcel,
  sidebarFiles: sidebarFiles,
  sidebarImage: sidebarImage,
  sidebarOffice: sidebarOffice,
  sidebarPdf: sidebarPdf,
  sidebarRight: sidebarRight,
  sidebarTerminal: sidebarTerminal,
  skill: skill,
  'slash.menu': slashMenu,
  workflowRun: workflowRun,
};
