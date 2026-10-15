/** Gate result copy shared by trials and execution details. */
const en = {
  verdict: 'Verdict', forward: 'Forward', forwardError: 'Forward error', original: 'Original', subject: 'Final text',
  stages: 'Stages', start: 'Start hook', end: 'End hook', reason: 'Reason', error: 'Error', elapsed: 'Elapsed', skipped: 'Skipped',
  pass: 'Passed', fail: 'Rejected', revise: 'Revised', note: 'Note', skip: 'Skipped', cancelled: 'Cancelled',
  none: 'None', replace: 'Replace', append: 'Append',
  skippedForward: 'The forwarded result cannot be calculated because command stages were skipped in this trial.',
  skippedCommand: 'Command was not executed in this trial.',
} as const;
export type GateTextKey = keyof typeof en;
const ko: Record<GateTextKey, string> = {
  verdict: '판정', forward: '전달', forwardError: '전달 오류', original: '원문', subject: '최종 텍스트',
  stages: '단계', start: '시작 훅', end: '종료 훅', reason: '이유', error: '오류', elapsed: '소요', skipped: '건너뜀',
  pass: '통과', fail: '거부', revise: '수정', note: '메모', skip: '건너뜀', cancelled: '취소',
  none: '없음', replace: '교체', append: '덧붙임',
  skippedForward: '시험 실행에서 명령 단계를 건너뛰어 전달 결과를 계산할 수 없음',
  skippedCommand: '시험 실행에서 명령을 실행하지 않았습니다.',
};
const zh: Record<GateTextKey, string> = {
  verdict: '判定', forward: '传递', forwardError: '传递错误', original: '原文', subject: '最终文本',
  stages: '阶段', start: '开始钩子', end: '结束钩子', reason: '原因', error: '错误', elapsed: '耗时', skipped: '已跳过',
  pass: '通过', fail: '拒绝', revise: '修改', note: '备注', skip: '已跳过', cancelled: '已取消',
  none: '无', replace: '替换', append: '追加',
  skippedForward: '本次试运行跳过了命令阶段，无法计算传递结果。',
  skippedCommand: '本次试运行未执行命令。',
};
export function gateText(locale: string, key: GateTextKey): string {
  return (locale.startsWith('ko') ? ko : locale.startsWith('zh') ? zh : en)[key];
}
