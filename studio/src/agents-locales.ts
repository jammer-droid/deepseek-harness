/** Locale-owned managed delegation status copy. */
import type {} from '@deepseek-ai/dsh-client-locale/client';
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'studio.agents': keyof typeof agentsLocales.en }
}
export const agentsLocales = {
  en: {
    title: 'Agents', loading: 'Loading agent status…', empty: 'No recorded Studio delegation for this session.', unavailable: 'Agent status is unavailable. Reload to retry.', reload: 'Reload',
    shared: 'Agents share this workspace. Studio does not create a worktree automatically.',
    fresh: 'Fresh context',
    implementer: 'Implementer', parent: 'Open orchestrator', child: 'Open implementer',
    snapshot: 'Captured role snapshot', requested: 'Requested settings', observed: 'Observed request settings', unobserved: 'Not observed', defaultEffort: 'Provider default',
    cycle: 'Cycle', operation: 'Operation', instructions: 'Captured instructions', task: 'Task',
    reserved: 'Reserved', running: 'Running', completed: 'Completed', interrupted: 'Interrupted', failed: 'Failed', unknown: 'Unknown — do not retry admission',
  },
  zh: {
    title: '代理', loading: '正在加载代理状态…', empty: '此会话没有已记录的 Studio 委派。', unavailable: '代理状态不可用，请重新加载重试。', reload: '重新加载',
    shared: '代理共享此工作区。Studio 不会自动创建工作树。',
    fresh: '全新上下文',
    implementer: '实现者', parent: '打开协调者', child: '打开实现者',
    snapshot: '捕获的角色快照', requested: '请求设置', observed: '已观察到的请求设置', unobserved: '尚未观察到', defaultEffort: '提供方默认值',
    cycle: '周期', operation: '操作', instructions: '捕获的指令', task: '任务',
    reserved: '已预留', running: '运行中', completed: '已完成', interrupted: '已中断', failed: '失败', unknown: '未知 — 请勿重试准入',
  },
};
