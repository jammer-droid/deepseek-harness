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
    implementer: 'Implementer', reviewer: 'Reviewer', parent: 'Open orchestrator', child: 'Open implementer', reviewChild: 'Open reviewer',
    judgment: 'Review judgment', 'pass': 'Pass', 'needs-changes': 'Needs changes', 'unable-to-judge': 'Unable to judge', noJudgment: 'No validated review judgment', invalidReview: 'The reviewer did not return a valid structured judgment. Cycle completion is blocked. Inspect the reviewer transcript; automatic retry is unavailable.', verification: 'Additional verification requested', cycleOpen: 'Cycle open — explicit completion required', cycleComplete: 'Cycle explicitly completed',
    snapshot: 'Captured role snapshot', requested: 'Requested settings', observed: 'Observed request settings', unobserved: 'Not observed', defaultEffort: 'Provider default',
    cycle: 'Cycle', operation: 'Operation', instructions: 'Captured instructions', task: 'Task',
    reserved: 'Reserved', running: 'Running', completed: 'Completed', interrupted: 'Interrupted', failed: 'Failed', unknown: 'Unknown — do not retry admission',
  },
  zh: {
    title: '代理', loading: '正在加载代理状态…', empty: '此会话没有已记录的 Studio 委派。', unavailable: '代理状态不可用，请重新加载重试。', reload: '重新加载',
    shared: '代理共享此工作区。Studio 不会自动创建工作树。',
    fresh: '全新上下文',
    implementer: '实现者', reviewer: '审查者', parent: '打开协调者', child: '打开实现者', reviewChild: '打开审查者',
    judgment: '审查结论', 'pass': '通过', 'needs-changes': '需要修改', 'unable-to-judge': '无法判断', noJudgment: '没有经过验证的审查结论', invalidReview: '审查者未返回有效的结构化结论，周期无法完成。请查看审查者记录；目前不支持自动重试。', verification: '请求额外验证', cycleOpen: '周期未完成 — 需要显式完成', cycleComplete: '周期已显式完成',
    snapshot: '捕获的角色快照', requested: '请求设置', observed: '已观察到的请求设置', unobserved: '尚未观察到', defaultEffort: '提供方默认值',
    cycle: '周期', operation: '操作', instructions: '捕获的指令', task: '任务',
    reserved: '已预留', running: '运行中', completed: '已完成', interrupted: '已中断', failed: '失败', unknown: '未知 — 请勿重试准入',
  },
};
