/** Apply lifecycle copy; persistence is never described as execution success. */
const en = {
  targeted: 'At apply time: experiments target main agents.', notTargeted: 'At apply time: experiments do not target main agents.', experimentsUnknown: 'Experiment targeting at apply time is unknown.',
  apply: 'Apply saved revision', query: 'Re-query application', title: 'Apply workflow preset', confirm: 'Apply', cancel: 'Cancel',
  notice: 'Only the saved revision is applied. Select this Studio preset when starting a new conversation. Only the main role executes; other roles are stored but do not run. Instructions are appended; the default persona and permissions stay intact. The requested model is recorded, not automatically selected. Choose it in the conversation model picker. Studio experiments may also target these agents; their current targeting is not verified here. Existing conversations keep their bound revision. After restart, resume uses the current preset definition—not necessarily its historical configuration.',
  dirty: 'Save your changes before applying. Applying and re-querying never discard editor input.',
  unknown: 'Application outcome is unknown. Re-query before another apply; do not retry blindly.',
  failure: 'Application could not be confirmed. Re-query to inspect the persisted revision and registration.',
  conflict: 'The draft or applied revision changed. Refresh the saved draft and re-query before applying again.',
  storage: 'Storage outcome is uncertain. Writes and activation are suspended until the workflow plugin restarts.',
  invalid: 'The saved configuration cannot execute. Check model choices, required fields and supported component adapters.',
  changed: 'The catalog changed during validation. Refresh the catalog and try again.',
  active: 'Preset registered; execution has not been proven by registration alone.', failed: 'Snapshot saved, but preset activation failed.', inactive: 'Snapshot saved; activation is unknown.',
  mismatch: 'The actual request route differs from the requested model/reasoning. Use the conversation model picker; Studio has not overridden your route.',
  match: 'Observed request route matches the requested model/reasoning.', empty: 'No applied snapshot.', revision: 'Applied revision', draft: 'Saved draft revision',
};
type Copy = typeof en;
const ko: Copy = {
  targeted: '적용 시점: 실험 설정이 메인 Agent를 대상으로 합니다.', notTargeted: '적용 시점: 실험 설정이 메인 Agent를 대상으로 하지 않습니다.', experimentsUnknown: '적용 시점의 실험 대상 여부를 확인하지 못했습니다.',
  apply: '저장된 버전 적용', query: '적용 상태 다시 조회', title: '워크플로 프리셋 적용', confirm: '적용', cancel: '취소',
  notice: '저장된 버전만 적용합니다. 새 대화를 시작할 때 이 Studio 프리셋을 선택하세요. 메인 역할만 실행하며 다른 역할은 저장되지만 실행하지 않습니다. 지침은 추가되며 기본 persona와 권한은 유지됩니다. 요청 모델은 기록만 하며 자동 선택하지 않습니다. 대화의 모델 선택기에서 선택하세요. Studio 실험이 이 Agent에도 적용될 수 있으며 현재 대상 여부는 여기서 확인되지 않았습니다. 기존 대화는 연결된 버전을 유지합니다. 재시작 후 재개는 과거 구성이 아니라 현재 프리셋 정의를 사용합니다.',
  dirty: '변경 내용을 먼저 저장하세요. 적용과 다시 조회는 편집 내용을 버리지 않습니다.',
  unknown: '적용 결과를 알 수 없습니다. 재적용 전에 상태를 다시 조회하세요. 무조건 재시도하지 마세요.',
  failure: '적용을 확인하지 못했습니다. 저장된 적용 버전과 등록 상태를 다시 조회하세요.',
  conflict: '초안 또는 적용 버전이 바뀌었습니다. 저장된 초안을 새로 읽고 적용 상태를 다시 조회하세요.',
  storage: '저장 결과가 불확실합니다. 워크플로 플러그인을 재시작하기 전까지 쓰기와 활성화를 중단합니다.',
  invalid: '저장된 구성을 실행할 수 없습니다. 모델, 필수 항목과 지원되는 컴포넌트 어댑터를 확인하세요.',
  changed: '검증 도중 카탈로그가 바뀌었습니다. 카탈로그를 새로 읽고 다시 시도하세요.',
  active: '프리셋 등록됨 · 등록만으로 실행 성공을 뜻하지 않습니다.', failed: '적용본 저장됨 · 프리셋 활성화 실패', inactive: '적용본 저장됨 · 활성화 상태 미확인',
  mismatch: '실제 요청 모델·추론 수준이 요청값과 다릅니다. 대화의 모델 선택기를 사용하세요. Studio는 실행 경로를 강제로 바꾸지 않습니다.',
  match: '관측된 요청 모델·추론 수준이 요청값과 같습니다.', empty: '저장된 적용본이 없습니다.', revision: '적용 버전', draft: '저장된 초안 버전',
};
const zh: Copy = {
  targeted: '应用时：实验设置作用于主 Agent。', notTargeted: '应用时：实验设置不作用于主 Agent。', experimentsUnknown: '应用时的实验目标状态未知。',
  apply: '应用已保存版本', query: '重新查询应用状态', title: '应用工作流预设', confirm: '应用', cancel: '取消',
  notice: '仅应用已保存版本。启动新对话时请选择此 Studio 预设。仅主角色执行，其他角色保留但不会运行。指令追加到默认 persona，权限保持不变。所请求的模型只会记录，不会自动选择；请使用对话模型选择器。Studio 实验也可能作用于这些 Agent，此处尚未确认当前目标状态。现有对话保留绑定版本。重启后恢复使用当前预设定义，不保证恢复历史配置。',
  dirty: '请先保存更改。应用和重新查询不会丢弃编辑内容。', unknown: '应用结果未知。再次应用前请重新查询，不要盲目重试。',
  failure: '无法确认应用。请重新查询已保存版本和注册状态。', conflict: '草稿或应用版本已更改。请刷新已保存草稿并重新查询。',
  storage: '存储结果不确定。工作流插件重启前暂停写入和激活。', invalid: '已保存配置无法执行。请检查模型、必填字段和支持的组件适配器。',
  changed: '验证期间目录已更改。请刷新目录后重试。', active: '预设已注册；注册本身不代表执行成功。', failed: '应用快照已保存，但预设激活失败。', inactive: '快照已保存；激活状态未知。',
  mismatch: '实际请求的模型或推理级别与请求值不同。请使用对话模型选择器；Studio 不会强制更改路由。', match: '观察到的模型和推理级别与请求值一致。',
  empty: '没有已应用的快照。', revision: '应用版本', draft: '已保存草稿版本',
};
export function applyText(locale: string): Copy { return locale.startsWith('ko') ? ko : locale.startsWith('zh') ? zh : en; }
