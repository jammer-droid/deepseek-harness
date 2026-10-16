/** Copy for the task-centred gate prototype (ko · en · zh). */
const messages = {
  composition: ['게이트 구성', 'Gate composition', '门控构成'],
  compositionDescription: ['규칙은 훅으로, 판단과 가공은 Pixie로. 게이트는 정해진 순간에 Pixie가 읽고 판단한 결과를 에이전트나 나에게 보냅니다.', 'Rules belong in hooks; judgment and rewriting belong to Pixie. At a set moment, a gate lets Pixie read, decide, and send the result to the agent or to you.', '规则交给钩子，判断与加工交给 Pixie。门控在设定时刻让 Pixie 读取并判断，再把结果交给代理或你。'],
  scope: ['적용 범위', 'Scope', '适用范围'], scopeDescription: ['게이트를 켜고, 어떤 프리셋에 적용할지 정합니다.', 'Turn gates on and choose the presets they apply to.', '启用门控并选择适用的预设。'],
  prototype: ['화면 시안입니다. 아직 저장되지 않고 실제 실행에도 적용되지 않습니다.', 'UI preview. Nothing is saved or applied to runs yet.', '界面预览。尚不会保存，也不会应用于实际运行。'],
  newGate: ['새 게이트', 'New gate', '新建门控'], empty: ['아직 게이트가 없습니다. 템플릿에서 시작해 보세요.', 'No gates yet. Start from a template.', '尚无门控。请从模板开始。'],
  pickTemplate: ['무엇을 하고 싶나요?', 'What should the gate do?', '你想让门控做什么？'], pickHint: ['템플릿을 고른 뒤 문장을 고쳐 쓰면 됩니다.', 'Pick a template, then adjust the wording.', '选择模板后修改文字即可。'],
  blank: ['빈 게이트', 'Blank gate', '空白门控'], blankDescription: ['언제와 할 일을 직접 씁니다.', 'Write when and what yourself.', '自行填写时机和任务。'],
  soon: ['곧 지원', 'Coming soon', '即将支持'], soonHint: ['에이전트를 멈추지 않고 미리 준비하는 작업입니다. 아직 만들 수 없습니다.', 'Prepares work in the background without pausing the agent. Not available yet.', '在后台提前准备，不会暂停代理。暂不可用。'],
  edit: ['편집', 'Edit', '编辑'], duplicate: ['복제', 'Duplicate', '复制'], delete: ['삭제', 'Delete', '删除'], close: ['닫기', 'Close', '关闭'], cancel: ['취소', 'Cancel', '取消'], back: ['뒤로', 'Back', '返回'],
  apply: ['적용', 'Apply', '应用'], applyHint: ['시안에서는 이 화면 안에서만 반영됩니다.', 'In this preview the change stays on this screen.', '在预览中仅在此页面内生效。'],
  on: ['켜짐', 'On', '开启'], off: ['꺼짐', 'Off', '关闭'], presetCount: ['프리셋 {count}개', '{count} presets', '{count} 个预设'], noPreset: ['프리셋 없음', 'No preset', '无预设'],
  sentence: ['{when} → {what}', '{when} → {what}', '{when} → {what}'],
  name: ['이름', 'Name', '名称'],
  when: ['언제', 'When', '何时'], what: ['Pixie가 할 일', 'What Pixie does', 'Pixie 的任务'],
  whatHint: ['{target}을(를) Pixie가 읽습니다. 하고 싶은 일을 문장으로 쓰세요. 통과시킬지, 막을지, 바꾸거나 덧붙일지, 나에게만 남길지를 함께 쓰면 됩니다.', 'Pixie reads {target}. Describe the task in plain words: whether to pass or stop it, what to replace or add, or what to show only to you.', 'Pixie 会读取{target}。用文字描述任务：放行还是拦下，替换或追加什么，或只给你看什么。'],
  'out-verdict': ['결론', 'Verdict', '结论'], 'out-reason': ['이유', 'Reason', '原因'], 'out-replace': ['바꿀 내용', 'Replacement', '替换内容'], 'out-append': ['덧붙일 내용', 'Addition', '追加内容'], 'out-note': ['메모', 'Note', '备注'],
  // when options
  'when-user-message': ['사용자가 지시를 보낼 때', 'When you send an instruction', '当你发送指令时'],
  'when-agent-message': ['에이전트끼리 메시지를 주고받을 때', 'When agents message each other', '当代理之间互发消息时'],
  'when-tool-before': ['도구를 실행하기 전', 'Before a tool runs', '工具运行前'],
  'when-tool-after': ['도구 결과가 나왔을 때', 'When a tool result arrives', '工具结果返回时'],
  'when-turn-end': ['에이전트 답변이 끝났을 때', 'When the agent finishes its answer', '代理完成回答时'],
  'target-user-message': ['보낸 지시', 'your instruction', '你发送的指令'], 'target-agent-message': ['주고받는 메시지', 'the message between agents', '代理之间的消息'], 'target-tool-before': ['도구 호출 내용', 'the tool call', '工具调用内容'], 'target-tool-after': ['도구 결과', 'the tool result', '工具结果'], 'target-turn-end': ['마지막 답변', 'the final answer', '最后的回答'],
  // advanced
  advanced: ['고급', 'Advanced', '高级'], advancedHint: ['대부분의 게이트는 위 두 칸만으로 충분합니다.', 'Most gates only need the two fields above.', '大多数门控只需要上面两项。'],
  script: ['Pixie 훅 스크립트', 'Pixie hook script', 'Pixie 钩子脚本'], scriptHint: ['두 칸으로 표현하기 어려운 흐름을 스크립트로 만듭니다. 아래 폴더의 파일만 고를 수 있습니다.', 'Build flows the two fields cannot express as a script. Only files in the folder below can be picked.', '用脚本构建两项无法表达的流程。只能选择下方文件夹中的文件。'],
  guideLink: ['스크립트 작성 가이드', 'Script guide', '脚本编写指南'],
  scriptEnv: ['DSH에서 bash 프로필을 지원하는 경우에만 사용 가능합니다.', 'Available only when DSH runs with a bash profile.', '仅在 DSH 支持 bash 配置文件时可用。'],
  noScript: ['사용 안 함', 'None', '不使用'], scriptDir: ['스크립트 폴더', 'Script folder', '脚本文件夹'], copyPath: ['경로 복사', 'Copy path', '复制路径'], refresh: ['목록 새로고침', 'Refresh list', '刷新列表'],
  scriptShell: ['입출력 규칙·환경 변수·예시는', 'Contract, environment, and examples:', '规则、环境变量和示例：'],
  variables: ['할 일에서 쓸 수 있는 값', 'Values for the task', '任务中可用的值'], 'var-text': ['스크립트 출력 텍스트', 'script output text', '脚本输出文本'], 'var-data': ['스크립트 출력 데이터(JSON)', 'script output data (JSON)', '脚本输出数据（JSON）'],
  judge: ['판정 모델로 결론 정하기', 'Decide the verdict with the judge model', '用判定模型决定结论'], judgeHint: ['결론을 확률과 기준으로 엄밀하게 정합니다. 할 일의 나머지(바꿀 내용·메모 등)는 그대로 씁니다.', 'Decides the verdict by probability against a threshold. The rest of the task still applies.', '按概率与阈值严格决定结论，任务其余部分照常生效。'],
  judgeQuestion: ['판정 질문 (예일 확률이 높으면 통과)', 'Judge question (passes when “yes” is likely)', '判定问题（“是”的概率高则通过）'], judgeThreshold: ['통과 기준 (0–1)', 'Pass threshold (0–1)', '通过阈值（0–1）'],
  confirmReplace: ['바꾸기 전에 확인', 'Confirm before replacing', '替换前确认'], confirmReplaceHint: ['바꿀 내용을 바로 보내지 않고 Pixie 카드에서 확인 후 보냅니다.', 'Holds the replacement on a Pixie card until you confirm.', '替换内容先保留在 Pixie 卡片，确认后再发送。'],
  onError: ['Pixie가 실패하면', 'If Pixie fails', '若 Pixie 失败'], errorPass: ['그대로 진행', 'Continue as usual', '照常继续'], errorBlock: ['막음', 'Stop it', '拦下'],
  agents: ['대상 에이전트', 'Target agents', '目标代理'], root: ['메인 에이전트', 'Main agent', '主代理'], child: ['서브에이전트', 'Subagents', '子代理'], any: ['모두', 'All', '全部'],
  timeout: ['제한 시간 (초)', 'Time limit (seconds)', '时限（秒）'], maxSteers: ['턴당 다시 하기 상한', 'Redo limit per turn', '每轮重做上限'],
  // trial
  trial: ['시험 실행', 'Try it', '试运行'], trialSample: ['예시 {target}', 'Sample {target}', '示例{target}'], trialRun: ['실행', 'Run', '运行'],
  trialPreview: ['시안에서는 실제 모델을 부르지 않고 결과 모양만 보여 줍니다.', 'The preview does not call a model; it only shows the result shape.', '预览不会调用模型，只显示结果的样式。'],
  trialPass: ['통과', 'Pass', '通过'], trialStop: ['막음', 'Stopped', '已拦下'], trialEmpty: ['(비어 있음)', '(empty)', '（空）'],
  // problems
  'problem-name': ['이름을 입력하세요.', 'Enter a name.', '请输入名称。'], 'problem-instruction': ['Pixie가 할 일을 입력하세요.', 'Describe what Pixie should do.', '请填写 Pixie 的任务。'], 'problem-judge': ['판정 질문과 0–1 사이 기준을 입력하세요.', 'Enter a judge question and a threshold between 0 and 1.', '请输入判定问题和 0–1 之间的阈值。'], 'problem-limits': ['제한 시간과 상한을 확인하세요.', 'Check the time limit and redo limit.', '请检查时限和上限。'],
  // scope
  enabled: ['켜짐', 'Enabled', '启用'], presets: ['적용 프리셋', 'Presets', '适用预设'], presetsHint: ['이 프리셋으로 실행되는 에이전트에만 게이트가 걸립니다.', 'The gate runs only for agents using these presets.', '门控只作用于使用这些预设的代理。'],
  choosePresets: ['프리셋 선택', 'Choose presets', '选择预设'], searchPresets: ['프리셋 검색', 'Search presets', '搜索预设'], done: ['완료', 'Done', '完成'],
  scopeEmpty: ['게이트 구성에서 먼저 게이트를 만드세요.', 'Create a gate in Gate composition first.', '请先在门控构成中创建门控。'],
  // templates
  'tpl-format-check': ['작업 지시 양식 검사', 'Instruction format check', '任务指令格式检查'],
  'tplDesc-format-check': ['지시에 목표·범위·완료 조건이 있는지 보고, 빠지면 돌려보냅니다.', 'Checks that an instruction has a goal, scope, and done criteria; sends it back if not.', '检查指令是否包含目标、范围和完成条件，缺少则退回。'],
  'tplText-format-check': ['이 지시에 목표, 범위, 완료 조건이 모두 있는지 확인해.\n빠진 항목이 있으면 막고, 무엇이 빠졌는지 이유에 쓰고, 양식에 맞게 다시 쓴 지시를 바꿀 내용에 넣어.', 'Check that this instruction has a goal, scope, and done criteria.\nIf any is missing, stop it, list what is missing as the reason, and put a rewritten instruction in the replacement.', '检查该指令是否包含目标、范围和完成条件。\n若缺少，请拦下，在原因中写明缺少项，并把改写后的指令放入替换内容。'],
  'tpl-agent-protocol': ['에이전트 대화 규격 판정', 'Agent message protocol', '代理消息规范判定'],
  'tplDesc-agent-protocol': ['에이전트끼리 주고받는 메시지가 정한 규격을 따르는지 판정합니다.', 'Checks that messages between agents follow the agreed format.', '判定代理之间的消息是否遵循约定格式。'],
  'tplText-agent-protocol': ['이 메시지가 "작업 / 근거 / 다음 행동" 세 부분을 갖췄는지 확인해.\n갖추지 않았으면 막고 이유에 무엇이 빠졌는지 써.', 'Check that this message has three parts: task, evidence, next action.\nIf not, stop it and give what is missing as the reason.', '检查该消息是否包含“任务 / 依据 / 下一步”三部分。\n若不完整，请拦下并在原因中写明缺少的部分。'],
  'tpl-translate-answer': ['최종 답변 한국어 번역', 'Translate the final answer', '翻译最终回答'],
  'tplDesc-translate-answer': ['답변이 영어면 한국어 번역을 나에게만 보여 줍니다.', 'Shows you a Korean translation when the answer is in English.', '回答为英文时，仅向你显示韩文翻译。'],
  'tplText-translate-answer': ['답변이 영어로 쓰여 있으면 한국어로 번역해서 메모에 넣어.\n이미 한국어면 아무것도 하지 마.', 'If the answer is in English, translate it into Korean and put it in the note.\nIf it is already Korean, do nothing.', '若回答为英文，请翻译成韩文并写入备注。\n若已是韩文，则不做任何事。'],
  'tpl-verify-answer': ['최종 답변 검증', 'Verify the final answer', '验证最终回答'],
  'tplDesc-verify-answer': ['답변이 요청을 충족했는지 판정하고, 미달이면 다시 하라고 지시합니다.', 'Judges whether the answer meets the request; asks the agent to redo it if not.', '判定回答是否满足请求，不满足则让代理重做。'],
  'tplText-verify-answer': ['답변이 사용자의 요청을 모두 다뤘는지 확인해.\n빠진 부분이 있으면 막고, 무엇을 더 해야 하는지 이유에 써.', 'Check that the answer covers everything the user asked.\nIf something is missing, stop it and say what still needs doing as the reason.', '检查回答是否涵盖用户的全部请求。\n若有遗漏，请拦下并在原因中写明还需完成的内容。'],
  'tplQuestion-verify-answer': ['이 답변이 사용자의 요청을 모두 충족합니까?', 'Does this answer fully satisfy the user’s request?', '该回答是否完全满足用户的请求？'],
  'tpl-search-digest': ['검색 결과 선별', 'Digest search results', '筛选搜索结果'],
  'tplDesc-search-digest': ['검색·파일 도구 결과가 길면 관련 있는 것만 골라 에이전트에게 줍니다.', 'When search or file tool output is long, gives the agent only what is relevant.', '搜索或文件工具结果过长时，只把相关内容交给代理。'],
  'tplText-search-digest': ['도구 결과에서 현재 작업과 관련 있는 항목만 골라 요약해서 바꿀 내용에 넣어.\n(검색 도구이고 결과가 길 때만 실행되도록 훅 스크립트가 거릅니다.)', 'Pick only the items relevant to the current task from the tool result and put a summary in the replacement.\n(The hook script makes this run only for long search results.)', '从工具结果中只挑选与当前任务相关的条目，并把摘要放入替换内容。\n（钩子脚本会筛选，仅在搜索工具结果较长时运行。）'],
  'tpl-subtitle-prep': ['자막 번역 준비', 'Subtitle translation prep', '字幕翻译准备'],
  'tplDesc-subtitle-prep': ['스크립트로 자막 크기를 재고, 한 번에 처리할 수 있으면 번역 방침을 덧붙입니다.', 'Measures the subtitle with a script and, if it fits, adds a translation plan.', '用脚本测量字幕大小，若可一次处理则追加翻译方针。'],
  'tplText-subtitle-prep': ['측정 결과: {{hooks.measure-subtitle.text}}\n한 번에 번역하기에 너무 크면 막고, 나눠서 요청하라고 이유에 써.\n괜찮으면 구간 분할·용어·말투를 정리한 번역 방침을 덧붙일 내용에 넣어.', 'Measured: {{hooks.measure-subtitle.text}}\nIf it is too large for one pass, stop it and ask to split the request as the reason.\nOtherwise put a translation plan (segments, terms, tone) in the addition.', '测量结果：{{hooks.measure-subtitle.text}}\n若一次翻译过大，请拦下并在原因中要求分批请求。\n否则把翻译方针（分段、术语、语气）放入追加内容。'],
  'tpl-precompact': ['미리 압축', 'Pre-compaction', '预先压缩'], 'tplDesc-precompact': ['대화가 길어지는 동안 미리 요약해 두었다가 압축할 때 바로 씁니다.', 'Summarizes ahead while the conversation grows, then uses it at compaction.', '对话变长时提前总结，压缩时直接使用。'],
  'tpl-file-index': ['파일 사전 인덱싱', 'File pre-indexing', '文件预索引'], 'tplDesc-file-index': ['작업 공간 파일을 미리 색인해 두고, 탐색할 때 검토된 결과만 줍니다.', 'Indexes workspace files ahead and returns reviewed results when searching.', '提前索引工作区文件，搜索时只返回审核过的结果。'],
} as const;
export type GateTaskKey = keyof typeof messages;
/** @returns the localized message for `key`, with `{name}` placeholders replaced from `values`. */
export function gateTaskText(locale: string, key: GateTaskKey, values: Record<string, string | number> = {}): string {
  const text = messages[key][locale.startsWith('ko') ? 0 : locale.startsWith('zh') ? 2 : 1];
  return text.replace(/\{(\w+)\}/g, (match, name: string) => name in values ? String(values[name]) : match);
}
