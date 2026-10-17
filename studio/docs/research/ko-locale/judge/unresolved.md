# 미해결 키와 용어집 제안 (#30 S5)

판정에서 통과하지 못해 영어 fallback으로 남긴 키와 용어집 제안을 기록한다.

| 네임스페이스 | 키 | 영어 | 최선 후보 | 점수(자연/의미/문체) | 메모 |
| --- | --- | --- | --- | --- | --- |
| claude-code-mods | band | Claude Code mods | Claude Code 모드 | 1.23/0.91/0.74 | 모드·모듈·모드 밴드·모드 영역 모두 자연스러움 1.5 미만 |
| claude-code-mods | press.stale | That button belonged to an earlier drawing; the band has refreshed | 이 버튼은 이전 화면의 버튼입니다. 표시줄이 갱신되었습니다. | 1.08/0.79/0.57 | 기술 문장이 길어 자연스러움 미달 |
| approval | escalation | Tool {toolName} requests privileged execution | {toolName} 도구가 특권 실행을 요청합니다 | 1.47/0.95/0.78 | 세 후보 모두 자연스러움 1.5 미만, 자리 표시자 뒤 조사 회피 |
| inspectorPanel | close | Collapse | 접기 | 1.37/0.54/0.73 | 버튼 라벨인데 의미 일치가 0.6 미만 |
| settings.plugins | tabs | Plugin views | 플러그인 뷰 | 1.44/0.97/0.68 | 뷰·화면·뷰 탭 모두 자연스러움 1.5 미만 |
| sidebar | 용어 | Sidebar | 사이드바 | — | sidebar 계열 네임스페이스 전체에서 '사이드바'로 통일 제안 |
| slash.menu | subagent | Subagents | 서브에이전트 목록 | 1.47/0.81/0.58 | 메뉴 묶음 제목의 짧은 복수형이 자연스러움 1.5 미만 |
| slash.menu | suggestions.aria | Trigger suggestions | 입력 제안 | 1.02/0.64/0.67 | 트리거로 여는 제안 목록의 aria-label, 후보 모두 자연스러움 미달 |
| settings.agentLoop | saveFailed | The deployment did not accept these values; they were left for you to correct. | 배포에서 이 값을 받아들이지 않았습니다. 값을 수정할 수 있도록 그대로 두었습니다. | 1.32/0.92/0.48 | 두 문장 안내의 자연스러움 미달 |
| settings.shell | saveFailed | The deployment did not accept these values; they were left for you to correct. | 배포에서 이 값을 받아들이지 않았습니다. 값을 수정할 수 있도록 그대로 두었습니다. | 1.32/0.92/0.48 | settings.agentLoop와 같은 문구·같은 미해결 후보 |
| permission.access | auto.confirm.description | Auto review runs without a sandbox. Before every native tool call and PTC inner call, the same model as the current agent reviews whether to allow it; you approve or reject each call it denies. This feature is experimental, can falsely allow or deny actions, and uses additional tokens. | 자동 검토는 샌드박스 없이 실행됩니다. 모든 네이티브 도구 호출과 PTC 내부 호출 전에 현재 에이전트와 같은 모델이 허용 여부를 검토하며, 거부된 각 호출은 사용자가 승인하거나 거부합니다. 이 기능은 실험적이어서 작업을 잘못 허용하거나 거부할 수 있고 추가 토큰을 사용합니다. | 1.39/0.93/0.8 | 길고 기술적인 안내문, 후보 4개 모두 자연스러움 미달 |
| permission.access | auto.description | Run without a sandbox after an experimental same-model review of every native tool call and PTC inner call. | 모든 네이티브 도구 호출과 PTC 내부 호출을 실험적인 동일 모델 검토로 확인한 뒤 샌드박스 없이 실행합니다. | 1.16/0.93/0.85 | 문장 구조 후보 모두 자연스러움 미달 |
| settings.webSearch | apiKeyUnset | No key is configured; only conversations using a DeepSeek Account model can search, through the default endpoint. | 설정된 키가 없습니다. 기본 엔드포인트를 통해서는 DeepSeek 계정 모델을 사용하는 대화만 검색할 수 있습니다. | 1.45/0.94/0.69 | 조건이 겹친 두 문장, 네 후보 모두 자연스러움 미달 |
| settings.webSearch | saveFailed | The deployment did not accept these values; they were left for you to correct. | 배포에서 이 값을 받아들이지 않았습니다. 값을 수정할 수 있도록 그대로 두었습니다. | 1.32/0.92/0.48 | settings.agentLoop와 같은 문구·같은 미해결 후보 |
| sidebarDocumentPreview | error.tooLarge | This page exceeds the {limit} limit and cannot be read. | 이 페이지는 {limit} 제한을 초과하여 읽을 수 없습니다. | 1.36/0.93/0.49 | 제한 초과 안내의 자연스러움 미달 |
| sidebarDocumentPreview | rendererUnavailable | The {name} preview is unavailable. | {name} 미리보기를 사용할 수 없습니다. | 1.75/0.96/0.41 | 자연스러움은 높지만 문체 기준 미달 |
| model | action.reload | Reload | 새로 고침 | 1.86/0.95/0.47 | 짧은 라벨 후보 모두 문체 기준 미달 |
| model | menu.aria | Model and reasoning effort | 모델 및 추론 강도 | 1.7/0.96/0.43 | '강도' 결합 표현의 문체·자연스러움 미달 |
| model | menu.effort | Effort | 추론 강도 | 1.49/0.68/0.67 | 단독 'Effort' 라벨의 자연스러움 미달 |
| model | search.clear | Clear search | 검색 지우기 | 1.88/0.97/0.46 | 검색 지우기·검색어 지우기 모두 문체 기준 미달 |
| agent-team | blockedBy | Blocked by | 차단 요인 | 1.33/0.81/0.61 | 머리글 라벨 후보 모두 자연스러움 미달 |
| agent-team | task.collapse | Show less | 줄여서 보기 | 1.43/0.94/0.52 | 접기 토글 라벨 후보 모두 자연스러움 미달 |
