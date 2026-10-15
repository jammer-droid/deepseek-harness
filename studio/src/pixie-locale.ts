/** Pixie copy in ko, en, and zh. */
const en = {
  title: 'Pixie', chat: 'Chat', judge: 'Judge', threads: 'Pixie threads', newThread: 'New thread', fresh: 'New conversation', fork: 'Continue this conversation',
  mode: 'Context mode', model: 'Model', defaultMode: 'Default', defaultModel: 'Default',
  context: 'Context', in: 'In', out: 'Out', cache: 'Cache', cacheWrite: 'Cache write', reasoning: 'Reasoning',
  streaming: 'Answering', cancelled: 'Cancelled', error: 'Failed', cancel: 'Cancel', ask: 'Ask', retry: 'Retry', loading: 'Loading…',
  question: 'Question for Pixie', placeholder: 'Ask Pixie… (⌘/Ctrl+Enter)',
  isolation: 'Pixie answers stay here. Nothing is added to the conversation or the agent’s context.',
  noModel: 'No Pixie model is set. Choose one in DSH Studio → Pixie.',
  sessionTotal: 'Session total', requests: 'requests',
  judgeNote: 'Try a judgment with the Pixie model: give a state and questions, and get a choice, a score, or a yes probability for each.',
  judgeState: 'State (text or JSON)', judgeQuestions: 'Questions (JSON by id)', runJudge: 'Run judge', judgeQuestionsJson: 'Questions must be JSON.',
  confidence: 'confidence', yesProbability: 'P(yes)',
  settingsTitle: 'Pixie', settingsDescription: 'A side model you can ask with /pixie or the Pixie tab without adding anything to the conversation.',
  settingsModel: 'Default model', settingsNoModel: 'Not set', settingsEffort: 'Reasoning effort', settingsEffortDefault: 'Model default',
  settingsMaxTokens: 'Max output tokens', settingsMaxTokensHint: 'Empty uses the model default.', settingsMode: 'Default context for new threads',
  settingsModeFresh: 'Start empty.', settingsModeFork: 'Copy the conversation text once when the thread starts (fork; user and assistant text only).',
  settingsPrompt: 'Pixie system prompt', settingsAllowThreadModel: 'Model per thread', settingsThreadModelOn: 'Allow a different model', settingsThreadModelOnHint: 'A new thread can pick its own model.', settingsThreadModelOff: 'Always the default model', settingsThreadModelOffHint: 'Every thread uses the default model.', save: 'Save', saved: 'Saved.',
  catalogFailed: 'Some providers could not list models:',
  rowAsked: 'Asked Pixie — the answer is in the Pixie tab', openTab: 'Open Pixie',
  truncated: 'Cut at the token limit', forkBadge: 'Continued', errNoModel: 'No Pixie model is set. Choose one in DSH Studio → Pixie.', errBusy: 'Pixie is still answering in this session.', errEmpty: 'Type a question after /pixie.',
} as const;
export type PixieTextKey = keyof typeof en;
const ko: Record<PixieTextKey, string> = {
  title: 'Pixie', chat: '대화', judge: '판정', threads: 'Pixie 스레드', newThread: '새 스레드', fresh: '새 대화', fork: '이 대화 이어받기',
  mode: '컨텍스트 모드', model: '모델', defaultMode: '기본값', defaultModel: '기본값',
  context: '컨텍스트', in: '입력', out: '출력', cache: '캐시', cacheWrite: '캐시 쓰기', reasoning: '추론',
  streaming: '답변 중', cancelled: '취소됨', error: '실패', cancel: '취소', ask: '요청', retry: '다시 시도', loading: '불러오는 중…',
  question: 'Pixie에게 질문', placeholder: 'Pixie에게 묻기… (⌘/Ctrl+Enter)',
  isolation: 'Pixie 답변은 여기에만 남습니다. 대화와 에이전트 컨텍스트에는 아무것도 추가되지 않습니다.',
  noModel: 'Pixie 모델이 설정되지 않았습니다. DSH Studio → Pixie에서 선택하세요.',
  sessionTotal: '세션 누적', requests: '요청',
  judgeNote: 'Pixie 모델로 판정을 시험합니다. 상태와 질문을 주면 질문마다 선택, 점수, 예일 확률을 돌려줍니다.',
  judgeState: '상태 (텍스트 또는 JSON)', judgeQuestions: '질문 (ID별 JSON)', runJudge: '판정 실행', judgeQuestionsJson: '질문은 JSON이어야 합니다.',
  confidence: '확신도', yesProbability: '예일 확률',
  settingsTitle: 'Pixie', settingsDescription: '/pixie나 Pixie 탭으로 대화에 아무것도 추가하지 않고 물어볼 수 있는 보조 모델입니다.',
  settingsModel: '기본 모델', settingsNoModel: '설정 안 함', settingsEffort: '추론 강도', settingsEffortDefault: '모델 기본값',
  settingsMaxTokens: '최대 출력 토큰', settingsMaxTokensHint: '비우면 모델 기본값을 씁니다.', settingsMode: '새 스레드의 기본 컨텍스트',
  settingsModeFresh: '빈 상태로 시작합니다.', settingsModeFork: '스레드를 만들 때 대화 텍스트를 한 번 복사합니다 (fork, 사용자·어시스턴트 텍스트만).',
  settingsPrompt: 'Pixie 시스템 프롬프트', settingsAllowThreadModel: '스레드별 모델', settingsThreadModelOn: '다른 모델 허용', settingsThreadModelOnHint: '새 스레드에서 모델을 따로 고를 수 있습니다.', settingsThreadModelOff: '항상 기본 모델', settingsThreadModelOffHint: '모든 스레드가 기본 모델을 씁니다.', save: '저장', saved: '저장했습니다.',
  catalogFailed: '모델 목록을 가져오지 못한 제공자:',
  rowAsked: 'Pixie에 요청함 — 답변은 Pixie 탭에 있습니다', openTab: 'Pixie 열기',
  truncated: '토큰 한도에서 잘림', forkBadge: '이어받음', errNoModel: 'Pixie 모델이 설정되지 않았습니다. DSH Studio → Pixie에서 선택하세요.', errBusy: '이 세션에서 Pixie가 아직 답변 중입니다.', errEmpty: '/pixie 뒤에 질문을 입력하세요.',
};
const zh: Record<PixieTextKey, string> = {
  title: 'Pixie', chat: '对话', judge: '判定', threads: 'Pixie 线程', newThread: '新线程', fresh: '新对话', fork: '接续当前对话',
  mode: '上下文模式', model: '模型', defaultMode: '默认', defaultModel: '默认',
  context: '上下文', in: '输入', out: '输出', cache: '缓存', cacheWrite: '缓存写入', reasoning: '推理',
  streaming: '回答中', cancelled: '已取消', error: '失败', cancel: '取消', ask: '提问', retry: '重试', loading: '加载中…',
  question: '向 Pixie 提问', placeholder: '向 Pixie 提问…（⌘/Ctrl+Enter）',
  isolation: 'Pixie 的回答只保留在这里，不会加入对话或智能体上下文。',
  noModel: '尚未设置 Pixie 模型。请在 DSH Studio → Pixie 中选择。',
  sessionTotal: '会话累计', requests: '次请求',
  judgeNote: '使用 Pixie 模型试用判定：提供状态和问题，每个问题返回选择、分数或为是的概率。',
  judgeState: '状态（文本或 JSON）', judgeQuestions: '问题（按 ID 的 JSON）', runJudge: '运行判定', judgeQuestionsJson: '问题必须是 JSON。',
  confidence: '置信度', yesProbability: '为是的概率',
  settingsTitle: 'Pixie', settingsDescription: '可通过 /pixie 或 Pixie 标签页提问的辅助模型，不会向对话添加任何内容。',
  settingsModel: '默认模型', settingsNoModel: '未设置', settingsEffort: '推理强度', settingsEffortDefault: '模型默认',
  settingsMaxTokens: '最大输出 token', settingsMaxTokensHint: '留空则使用模型默认值。', settingsMode: '新线程的默认上下文',
  settingsModeFresh: '从空开始。', settingsModeFork: '创建线程时复制一次对话文本（fork，仅用户与助手文本）。',
  settingsPrompt: 'Pixie 系统提示词', settingsAllowThreadModel: '线程模型', settingsThreadModelOn: '允许不同模型', settingsThreadModelOnHint: '新线程可以单独选择模型。', settingsThreadModelOff: '始终使用默认模型', settingsThreadModelOffHint: '所有线程都使用默认模型。', save: '保存', saved: '已保存。',
  catalogFailed: '以下提供方无法列出模型：',
  rowAsked: '已询问 Pixie — 回答在 Pixie 标签页中', openTab: '打开 Pixie',
  truncated: '已在 token 上限处截断', forkBadge: '接续', errNoModel: '尚未设置 Pixie 模型。请在 DSH Studio → Pixie 中选择。', errBusy: 'Pixie 仍在此会话中回答。', errEmpty: '请在 /pixie 后输入问题。',
};
const tables = { en, ko, zh } as const;

/** @returns copy for the active locale, falling back to English. */
export function pixieText(locale: string, key: PixieTextKey): string {
  const table = locale.startsWith('ko') ? tables.ko : locale.startsWith('zh') ? tables.zh : tables.en;
  return table[key];
}

/** Stable codes the Host puts in front of user-facing failures, so the Client can show them in the active language. */
export const PIXIE_ERROR_CODES = { 'pixie/no-model': 'errNoModel', 'pixie/busy': 'errBusy', 'pixie/empty': 'errEmpty' } as const satisfies Record<string, PixieTextKey>;

/** Localize a Host failure that starts with a known `[code]`; other text (provider errors) is shown as given. */
export function pixieError(locale: string, message: string): string {
  const match = /^\[(pixie\/[\w-]+)\]\s*/.exec(message);
  const key = match ? PIXIE_ERROR_CODES[match[1] as keyof typeof PIXIE_ERROR_CODES] : undefined;
  return key ? pixieText(locale, key) : message;
}
