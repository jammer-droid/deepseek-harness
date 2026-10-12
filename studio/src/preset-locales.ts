/** Locale-owned preset editor controls and save warnings. */
const en = {
  add: 'Add component', remove: 'Remove', undo: 'Undo removal', removed: 'Pending removal', additions: 'Pending additions', catalog: 'Available components',
  available: 'Available for new Agents', broken: 'Saved definition cannot start. Correct the settings or restore inherited settings.', unknown: 'Preset availability could not be verified.',
  title: 'Agent presets', choose: 'Preset', reload: 'Reload saved settings', apply: 'Apply override', cancel: 'Discard draft', reset: 'Restore inherited settings',
  warning: 'Applying replaces the complete plugin list in this profile. Future bundle changes to that list will not merge automatically. Existing Agents keep their current revision; new Agents use the saved definition.',
  limits: 'Edit existing text, numbers, switches and plugin enablement. Arrays and executable expressions are preserved, not edited. Add existing preset components or basic DSH templates; removing a group removes its children, not installed packages. Missing dependencies may prevent startup.',
  loading: 'Loading…', empty: 'No editable profile presets.', failed: 'Could not complete the operation. Reload saved settings before retrying; a lost connection may leave the save outcome unknown.',
  saved: 'Saved. Check preset availability before starting a new Agent.', enabled: 'Enabled', conditional: 'Conditional enablement (read-only)', inherited: 'Inherited', overridden: 'Profile override', dirty: 'Unsaved changes', confirm: 'I understand that applying changes tools and policies for new Agents.',
};
const ko: typeof en = {
  add: '컴포넌트 추가', remove: '제거', undo: '제거 취소', removed: '제거 예정', additions: '추가 예정', catalog: '추가 가능한 컴포넌트',
  available: '새 에이전트에서 사용 가능', broken: '저장된 구성으로 시작할 수 없습니다. 설정을 수정하거나 상속 설정을 복원하세요.', unknown: '프리셋 사용 가능 여부를 확인하지 못했습니다.',
  title: '에이전트 프리셋', choose: '프리셋', reload: '저장된 설정 다시 읽기', apply: '오버라이드 적용', cancel: '편집 취소', reset: '상속 설정 복원',
  warning: '적용하면 현재 프로필의 플러그인 목록 전체를 재정의합니다. 이후 번들 업데이트의 목록 변경은 자동 병합되지 않습니다. 기존 에이전트는 현재 구성을 유지하며 새 에이전트부터 저장한 구성을 사용합니다.',
  limits: '기존 문자열·숫자·스위치와 플러그인 활성화를 편집합니다. 배열과 실행 표현식은 수정하지 않고 보존합니다. 기존 프리셋 컴포넌트나 기본 DSH 구성을 추가할 수 있습니다. 그룹 제거는 하위 구성도 제거하지만 패키지를 삭제하지 않습니다. 의존성이 없으면 시작이 실패할 수 있습니다.',
  loading: '읽는 중…', empty: '편집할 수 있는 프로필 프리셋이 없습니다.', failed: '작업을 완료하지 못했습니다. 재시도 전에 저장된 설정을 다시 읽어 주세요. 연결이 끊겼다면 저장 여부가 불확실할 수 있습니다.',
  saved: '저장했습니다. 새 에이전트를 시작하기 전에 프리셋 사용 가능 여부를 확인하세요.', enabled: '활성화', conditional: '조건부 활성화 (읽기 전용)', inherited: '상속 설정', overridden: '프로필 오버라이드', dirty: '저장하지 않은 변경', confirm: '적용 시 새 에이전트의 도구와 정책이 변경됨을 확인했습니다.',
};
const zh: typeof en = {
  add: '添加组件', remove: '移除', undo: '取消移除', removed: '待移除', additions: '待添加', catalog: '可添加的组件',
  available: '新智能体可用', broken: '已保存的定义无法启动。请修正设置或恢复继承设置。', unknown: '无法验证预设是否可用。',
  title: '智能体预设', choose: '预设', reload: '重新读取已保存设置', apply: '应用覆盖', cancel: '放弃编辑', reset: '恢复继承设置',
  warning: '应用会覆盖当前配置档案的完整插件列表，后续安装包的列表更新不会自动合并。现有智能体保留当前版本，新智能体使用保存的定义。',
  limits: '可编辑已有文本、数字、开关和插件启用状态。数组和可执行表达式保持不变。可添加现有预设组件或基本 DSH 模板。移除组也会移除其子配置，但不会卸载软件包。缺少依赖可能导致启动失败。',
  loading: '正在读取…', empty: '没有可编辑的预设。', failed: '操作未完成。重试前请重新读取设置；连接中断时保存结果可能未知。',
  saved: '已保存。启动新智能体前请检查预设是否可用。', enabled: '启用', conditional: '条件启用（只读）', inherited: '继承设置', overridden: '配置档案覆盖', dirty: '未保存的更改', confirm: '我了解应用将更改新智能体的工具和策略。',
};
/** @param locale Active UI locale. @returns Editor copy. */
export function presetCopy(locale: string): typeof en { return locale.startsWith('ko') ? ko : locale.startsWith('zh') ? zh : en; }
