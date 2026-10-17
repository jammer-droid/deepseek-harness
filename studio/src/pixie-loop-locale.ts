/** Copy for the Pixie tab › Loops view (#31). */
const en = {
  loops: 'Loops', allLoops: 'All loop runs', emptyLoops: 'No loop runs yet. Agents start one with the pixie_loop tool.', refresh: 'Refresh',
  compiling: 'Preparing checks', running: 'Running', done: 'Done', stopped: 'Stopped early', error: 'Failed to start', cancelled: 'Cancelled',
  passed: 'Passed', escalated: 'Escalated', itemError: 'Error', itemCancelled: 'Cancelled', skipped: 'Skipped',
  progress: '{done}/{total} items', counts: 'passed {passed} · escalated {escalated} · errors {errors}', reason: 'Reason', checks: 'Checks',
  compiledPixie: 'compiled by Pixie from the criteria', compiledSpec: 'given in the spec', passRule: 'Passes when', min: '≥ {value}', accept: 'one of {value}',
  items: 'Items', attempt: 'Attempt {n}', attempts: '{n} attempt(s)', attemptFailed: 'Did not pass', output: 'Output', codeFailures: 'Exact checks failed', answers: 'Decision engine', feedback: 'Pixie feedback (a guess, not the verdict)',
  usage: 'Pixie {pixieIn}/{pixieOut} · judge {judgeIn}/{judgeOut} tokens', results: 'Results file', back: 'All loop runs',
} as const;
export type LoopTextKey = keyof typeof en;
const ko: Record<LoopTextKey, string> = {
  loops: '루프', allLoops: '모든 루프 실행', emptyLoops: '루프 실행 기록이 없습니다. 에이전트가 pixie_loop 도구로 시작합니다.', refresh: '새로고침',
  compiling: '검사 준비 중', running: '진행 중', done: '완료', stopped: '중간에 멈춤', error: '시작하지 못함', cancelled: '취소됨',
  passed: '통과', escalated: '넘김', itemError: '오류', itemCancelled: '취소됨', skipped: '건너뜀',
  progress: '{done}/{total}개 항목', counts: '통과 {passed} · 넘김 {escalated} · 오류 {errors}', reason: '이유', checks: '검사',
  compiledPixie: '기준을 Pixie가 질문으로 바꿈', compiledSpec: '명세에 직접 지정', passRule: '통과 조건', min: '{value} 이상', accept: '{value} 중 하나',
  items: '항목', attempt: '{n}번째 시도', attempts: '시도 {n}회', attemptFailed: '통과 못 함', output: '출력', codeFailures: '실패한 코드 검사', answers: '결정 엔진', feedback: 'Pixie 피드백 (판정이 아닌 추정)',
  usage: 'Pixie {pixieIn}/{pixieOut} · 판정 {judgeIn}/{judgeOut} 토큰', results: '결과 파일', back: '모든 루프 실행',
};
const zh: Record<LoopTextKey, string> = {
  loops: '循环', allLoops: '全部循环运行', emptyLoops: '还没有循环运行。代理通过 pixie_loop 工具启动。', refresh: '刷新',
  compiling: '准备检查', running: '运行中', done: '完成', stopped: '提前停止', error: '未能开始', cancelled: '已取消',
  passed: '通过', escalated: '移交', itemError: '错误', itemCancelled: '已取消', skipped: '已跳过',
  progress: '{done}/{total} 项', counts: '通过 {passed} · 移交 {escalated} · 错误 {errors}', reason: '原因', checks: '检查',
  compiledPixie: '由 Pixie 将标准转为问题', compiledSpec: '在规格中直接给出', passRule: '通过条件', min: '≥ {value}', accept: '{value} 之一',
  items: '项目', attempt: '第 {n} 次尝试', attempts: '尝试 {n} 次', attemptFailed: '未通过', output: '输出', codeFailures: '未通过的代码检查', answers: '决策引擎', feedback: 'Pixie 反馈（推测，不是判定）',
  usage: 'Pixie {pixieIn}/{pixieOut} · 判定 {judgeIn}/{judgeOut} 词元', results: '结果文件', back: '全部循环运行',
};

export function loopText(locale: string, key: LoopTextKey, values: Record<string, string | number> = {}): string {
  const template = (locale.startsWith('ko') ? ko : locale.startsWith('zh') ? zh : en)[key];
  return template.replace(/\{(\w+)\}/g, (match, name: string) => name in values ? String(values[name]) : match);
}
