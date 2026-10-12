/** Locale-owned experiment editor copy. */
const en = {
  title: 'Agent optimizations', description: 'Opt-in policies based on dsh-test-plugin. Select main agents and subagents independently.',
  timing: 'Applies when an agent next starts, including session resume. Running agents retain their policy. Saving does not cancel existing work. All experiments are off by default.',
  native: 'Prompt optimization and waiting policies use native tools for selected agents. Goal suppression preserves the saved goal. Cancellation cleanup is always enabled for experiment-owned work.',
  prompt: 'Adds optimization guidance to model input without replacing your system prompt, including complete overrides. Desktop 0.2.0-rc.2 suppresses this guidance when runtime context is disabled.',
  loading: 'Loading experiment settings…', apply: 'Save for future agents', reload: 'Reload', reset: 'Discard changes', saved: 'Saved. Running agents are unchanged.',
  failure: 'Could not save or load experiment settings. Your draft is retained. Reload to check the saved revision before trying again.',
  invalid: 'Enter whole numbers within the shown limits. Preview must not exceed half the inline budget; default wait must not exceed the wait cap.',
  targets: { off: 'Off', main: 'Main only', sub: 'Subagents only', both: 'Both' },
  features: { offload: 'Large text output offload', goals: 'Disable Goal/Todo and automatic goal continuation', headless: 'Optimized prompt assembly', batch: 'Bounded sequential batch reads', tasks: 'Explicit task success dependencies', waiting: 'Waiting and job collection policy' },
  numbers: { inlineChars: 'Inline text budget (characters, ≥1024)', previewChars: 'Total preview (characters, ≥0)', batchMaxCalls: 'Batch calls (1–8)', readMaxLines: 'Lines per read (1–200)', taskWaitMs: 'Task wait (ms, 1–600000)', bashWaitMs: 'Bash foreground request (ms, 1–600000)', jobWaitMs: 'Default job wait (ms, 1–600000)', jobWaitCapMs: 'Job wait cap (ms, 1–600000)' },
};
type Copy = typeof en;
const ko: Copy = {
  title: '에이전트 최적화', description: 'dsh-test-plugin 기반의 선택형 정책입니다. 메인과 서브에 적용할 기능을 각각 선택합니다.',
  timing: '세션 재개를 포함해 에이전트가 다음에 시작할 때 적용됩니다. 실행 중인 에이전트는 기존 정책을 유지하며 저장으로 작업을 취소하지 않습니다. 초기값은 모두 꺼짐입니다.',
  native: '프롬프트 최적화와 대기 정책은 선택한 에이전트에 native 도구를 사용합니다. Goal 차단은 저장된 목표를 보존합니다. 실험 소유 작업의 취소·종료 정리는 항상 유지됩니다.',
  prompt: '시스템 프롬프트를 바꾸지 않고 모델 입력에 최적화 지침을 추가하며, 전체 프롬프트 대체 시에도 유지합니다. Desktop 0.2.0-rc.2에서 런타임 컨텍스트를 끄면 이 지침은 주입되지 않습니다.',
  loading: '실험 설정을 불러오는 중…', apply: '다음 에이전트부터 적용', reload: '다시 불러오기', reset: '변경 취소', saved: '저장했습니다. 실행 중인 에이전트는 변경되지 않습니다.',
  failure: '실험 설정을 저장하거나 불러오지 못했습니다. 편집 내용은 유지됩니다. 다시 불러와 저장된 버전을 확인한 뒤 재시도하세요.',
  invalid: '표시된 범위의 정수를 입력하세요. 미리보기는 인라인 한도의 절반 이하여야 하며 기본 대기는 대기 상한을 넘을 수 없습니다.',
  targets: { off: '끄기', main: '메인만', sub: '서브만', both: '둘 다' },
  features: { offload: '대용량 텍스트 출력 축소', goals: 'Goal/Todo 및 목표 자동 진행 차단', headless: '최적화 프롬프트 조립', batch: '제한된 순차 일괄 읽기', tasks: '작업 성공 의존성', waiting: '대기 및 작업 결과 수집 정책' },
  numbers: { inlineChars: '인라인 텍스트 한도 (글자, ≥1024)', previewChars: '미리보기 총량 (글자, ≥0)', batchMaxCalls: '일괄 호출 수 (1–8)', readMaxLines: '읽기당 줄 수 (1–200)', taskWaitMs: '작업 대기 (ms, 1–600000)', bashWaitMs: 'Bash 전경 대기 요청 (ms, 1–600000)', jobWaitMs: '기본 작업 대기 (ms, 1–600000)', jobWaitCapMs: '작업 대기 상한 (ms, 1–600000)' },
};
const zh: Copy = {
  title: '智能体优化', description: '基于 dsh-test-plugin 的可选策略。分别选择主智能体和子智能体的适用功能。',
  timing: '在智能体下次启动时生效，包括恢复会话。运行中的智能体保留原策略，保存不会取消现有任务。默认全部关闭。',
  native: '提示词优化和等待策略对所选智能体使用原生工具。目标限制保留已保存目标。实验所拥有任务的取消和退出清理始终启用。',
  prompt: '在模型输入中添加优化指引，不替换系统提示词，完整替换提示词时也保留。Desktop 0.2.0-rc.2 禁用运行时上下文时不会注入此指引',
  loading: '正在加载实验设置…', apply: '保存并应用于后续智能体', reload: '重新加载', reset: '放弃更改', saved: '已保存。运行中的智能体保持不变。',
  failure: '无法保存或加载实验设置。草稿已保留。请重新加载以确认已保存版本后重试。',
  invalid: '请输入所示范围内的整数。预览不得超过内联预算的一半，默认等待不得超过等待上限。',
  targets: { off: '关闭', main: '仅主智能体', sub: '仅子智能体', both: '两者' },
  features: { offload: '大型文本输出转存', goals: '禁用 Goal/Todo 和目标自动继续', headless: '优化提示词组装', batch: '有界顺序批量读取', tasks: '显式任务成功依赖', waiting: '等待和任务结果收集策略' },
  numbers: { inlineChars: '内联文本预算（字符，≥1024）', previewChars: '预览总量（字符，≥0）', batchMaxCalls: '批量调用数（1–8）', readMaxLines: '每次读取行数（1–200）', taskWaitMs: '任务等待（ms，1–600000）', bashWaitMs: 'Bash 前台等待请求（ms，1–600000）', jobWaitMs: '默认任务等待（ms，1–600000）', jobWaitCapMs: '任务等待上限（ms，1–600000）' },
};
/** @param locale Active UI locale. @returns Localized editor copy. */
export function experimentText(locale: string): Copy { return locale.startsWith('ko') ? ko : locale.startsWith('zh') ? zh : en; }
