/** Labels for independently registered Studio feature areas. */
const ko = { builder: 'Preset Builder', workflow: 'Workflow', presets: 'DSH 설정', roles: '역할 설정', preview: '디자인 미리보기', experiments: '실험 기능' };
const en: typeof ko = { builder: 'Preset Builder', workflow: 'Workflow', presets: 'DSH settings', roles: 'Role settings', preview: 'Design preview', experiments: 'Experiments' };
const zh: typeof ko = { builder: 'Preset Builder', workflow: 'Workflow', presets: 'DSH 设置', roles: '角色设置', preview: '设计预览', experiments: '实验功能' };
/** Resolve service names without coupling navigation to a fixed service list.
 * @param locale Active locale.
 * @returns Localized service names.
 */
export function serviceText(locale: string) { return locale.startsWith('ko') ? ko : locale.startsWith('zh') ? zh : en; }
