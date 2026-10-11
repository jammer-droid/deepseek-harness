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
    cycleStatus: 'Cycle status', phase: 'Cycle phase', activation: 'Child activation', usage: 'Rework used / cap', next: 'Next action', capUnavailable: 'cap not recorded', phaseUnavailable: 'Not recorded',
    'phase-implementation': 'Implementation in progress', 'phase-review-ready': 'Ready for review', 'phase-review': 'Review in progress', 'phase-judged': 'Review judged', 'phase-complete': 'Explicitly completed', 'phase-unknown': 'Unknown outcome',
    nextUnavailable: 'Cycle policy or phase is not recorded. Ask the orchestrator to report status to a human; do not infer permission to retry.',
    nextUnknown: 'Stop and report the unknown or unresolved outcome to a human. Do not retry or start a replacement cycle.',
    nextComplete: 'No further work in this completed cycle.', nextWait: 'Wait for the active operation; reload status. Do not request overlapping work.',
    nextReview: 'Request review through the orchestrator. Completion requires a current validated review.',
    nextCompleteOrRework: 'Explicitly complete through the orchestrator, or request rework within the remaining cap.',
    nextExplicitComplete: 'Explicitly complete through the orchestrator. The rework cap is reached; further rework requires human attention.',
    nextRework: 'Ask the orchestrator to request rework, including verification-only work, within the remaining cap. Report conflicting or ambiguous judgments to a human.',
    nextCap: 'Stop: the rework cap is reached and the judgment or verification remains unresolved. Report the reason to a human; do not start a replacement cycle.',
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
    cycleStatus: '周期状态', phase: '周期阶段', activation: '子代理激活状态', usage: '已用返工次数 / 上限', next: '下一步操作', capUnavailable: '未记录上限', phaseUnavailable: '未记录',
    'phase-implementation': '实现进行中', 'phase-review-ready': '等待审查', 'phase-review': '审查进行中', 'phase-judged': '已有审查结论', 'phase-complete': '已显式完成', 'phase-unknown': '结果未知',
    nextUnavailable: '未记录周期策略或阶段。请协调者向人工报告状态；不要推断允许重试。',
    nextUnknown: '停止并向人工报告未知或未解决的结果。不要重试，也不要启动替代周期。',
    nextComplete: '此周期已完成，不再执行工作。', nextWait: '等待当前操作并重新加载状态。不要请求重叠工作。',
    nextReview: '通过协调者请求审查。完成周期需要当前有效的审查结论。',
    nextCompleteOrRework: '通过协调者显式完成，或在剩余次数内请求返工。',
    nextExplicitComplete: '通过协调者显式完成。已达到返工上限；进一步返工需要人工处理。',
    nextRework: '请协调者在剩余次数内请求返工，包括仅验证的工作。存在判断冲突或歧义时请向人工报告。',
    nextCap: '停止：已达到返工上限，审查结论或验证仍未解决。请向人工报告原因，不要启动替代周期。',
    implementer: '实现者', reviewer: '审查者', parent: '打开协调者', child: '打开实现者', reviewChild: '打开审查者',
    judgment: '审查结论', 'pass': '通过', 'needs-changes': '需要修改', 'unable-to-judge': '无法判断', noJudgment: '没有经过验证的审查结论', invalidReview: '审查者未返回有效的结构化结论，周期无法完成。请查看审查者记录；目前不支持自动重试。', verification: '请求额外验证', cycleOpen: '周期未完成 — 需要显式完成', cycleComplete: '周期已显式完成',
    snapshot: '捕获的角色快照', requested: '请求设置', observed: '已观察到的请求设置', unobserved: '尚未观察到', defaultEffort: '提供方默认值',
    cycle: '周期', operation: '操作', instructions: '捕获的指令', task: '任务',
    reserved: '已预留', running: '运行中', completed: '已完成', interrupted: '已中断', failed: '失败', unknown: '未知 — 请勿重试准入',
  },
};
