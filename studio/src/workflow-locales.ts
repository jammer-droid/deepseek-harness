/** Locale-owned copy for the Studio workflow draft editor. */
const en = {
  select: 'Select draft', create: 'New draft', draftName: 'Draft name', save: 'Save draft', saved: 'Saved', saving: 'Saving',
  discard: 'Discard unsaved changes?', confirm: 'Discard and continue', cancel: 'Keep editing',
  saveFailed: 'Save was not confirmed. Your edits are kept. Read again; editing stays blocked until a newer saved revision confirms the outcome.',
  restart: 'Storage could not confirm the saved state. Writes are stopped. Restart the workflow plugin, then read again.',
  invalid: 'The draft contains invalid component settings. Correct the fields before saving.',
  closed: 'The workflow service stopped. Enable it again, then read the saved drafts.',
  readFailed: 'Could not read saved drafts. Your edits are kept. Try reading again.',
  conflict: 'This draft changed elsewhere. Read the saved version before saving again.',
  reloadConfirm: 'Replace your edits with the saved version?', empty: 'No saved drafts yet.',
  add: 'Add instructions', unknown: 'Unavailable component configuration is preserved.',
  title: 'Workflow drafts', mainRole: 'Main role', name: 'Role name', instructions: 'Instructions',
  draftOnly: 'Editing a draft does not change running agents or presets.',
  unsaved: 'Unsaved draft', loading: 'Loading workflow components',
  loadFailed: 'Could not load workflow components. Try reading again.', retry: 'Read again',
  unavailable: 'The instructions component is unavailable. Read again after enabling its plugin.',
};
const ko: typeof en = {
  select: '초안 선택', create: '새 초안', draftName: '초안 이름', save: '초안 저장', saved: '저장됨', saving: '저장 중',
  discard: '저장하지 않은 변경을 버릴까요?', confirm: '버리고 계속', cancel: '계속 편집',
  saveFailed: '저장을 확인하지 못했습니다. 편집 내용은 유지됩니다. 다시 읽어 주세요. 더 최신의 저장 버전으로 결과를 확인할 때까지 저장과 전환은 차단됩니다.',
  restart: '저장 상태를 확인할 수 없어 쓰기를 중단했습니다. 워크플로 플러그인을 다시 시작한 뒤 다시 읽어 주세요.',
  invalid: '컴포넌트 설정이 올바르지 않습니다. 입력을 수정한 뒤 저장해 주세요.',
  closed: '워크플로 서비스가 중지되었습니다. 다시 켠 뒤 저장된 초안을 읽어 주세요.',
  readFailed: '저장된 초안을 읽지 못했습니다. 편집 내용은 유지됩니다. 다시 읽어 주세요.',
  conflict: '다른 곳에서 초안이 변경되었습니다. 저장 내용을 다시 읽어 주세요.',
  reloadConfirm: '편집 내용을 저장된 내용으로 바꿀까요?', empty: '저장된 초안이 없습니다.',
  add: '지침 추가', unknown: '사용할 수 없는 컴포넌트 설정도 보존됩니다.',
  title: '워크플로 초안', mainRole: '메인 역할', name: '역할 이름', instructions: '지침',
  draftOnly: '초안을 편집해도 실행 중인 에이전트나 프리셋은 변경되지 않습니다.',
  unsaved: '저장하지 않은 초안', loading: '워크플로 컴포넌트 불러오는 중',
  loadFailed: '워크플로 컴포넌트를 불러오지 못했습니다. 다시 읽어 주세요.', retry: '다시 읽기',
  unavailable: '지침 컴포넌트를 사용할 수 없습니다. 플러그인을 켠 뒤 다시 읽어 주세요.',
};
/** @param locale Active application locale. @returns Localized editor copy. */
export function workflowText(locale: string): typeof en { return locale.startsWith('ko') ? ko : en; }
