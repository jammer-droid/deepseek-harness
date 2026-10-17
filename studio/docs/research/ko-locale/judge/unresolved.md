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
