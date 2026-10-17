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
| sidebarBrowser | address.unknown | The page navigated; this carrier cannot read its new URL. | 페이지가 이동했습니다. 이 캐리어는 새 URL을 읽을 수 없습니다. | 1.29/0.95/0.55 | 캐리어·URL 표현의 자연스러움 미달 |
| sidebarBrowser | error.invalid | That address is invalid or too long. | 주소가 올바르지 않거나 너무 깁니다. | 1.77/0.94/0.28 | 올바른 한국어 문장인데 문체 판정이 계속 낮음 |
| sidebarBrowser | go | Go | 이동 | 1.64/0.92/0.47 | 단어 하나짜리 버튼 라벨의 문체 기준 미달 |
| command | listbox.aria | /{command} matches | /{command} 검색 결과 | 1.46/0.73/0.57 | 슬래시 명령 일치 목록의 aria-label, 후보 모두 자연스러움 미달 |
| command | search.aria | Filter options | 옵션 필터링 | 1.42/0.84/0.66 | 옵션 필터 입력의 aria-label, 후보 모두 자연스러움 미달 |
| sidebarTerminal | control | Take control | 제어권 가져오기 | 1.69/0.96/0.48 | 버튼 라벨 후보 모두 문체 기준 미달 |
| settings.theme | appearance.title | Appearance | 화면 테마 | 1.50/0.55/0.42 | 모양·테마·화면 모드 모두 의미 기준 미달 |
| question | error.resubmit | The answer did not arrive before work continued; submit it again. | 작업이 계속되기 전에 답변이 도착하지 않았습니다. 다시 제출해 주십시오. | 1.21/0.94/0.87 | 시간 관계 안내 문장의 자연스러움 미달 |
| question | nav.cancel | Dismiss all questions | 모든 질문 닫기 | 1.54/0.83/0.40 | 라벨 후보 모두 문체 기준 미달 |
| question | nav.close | Close the panel — reopen it from the tool call | 패널을 닫고 도구 호출에서 다시 여십시오 | 1.2/0.93/0.54 | 설명형 라벨의 자연스러움 미달 |
| question | plan.approve | Approve | 승인 | 1.88/0.97/0.37 | 버튼 라벨 후보 모두 문체 기준 미달 |
| question | plan.decline | Refuse | 거부 | 1.85/0.97/0.48 | 버튼 라벨 후보 모두 문체 기준 미달 |
| question | plan.header | Plan review | 계획 검토 | 1.73/0.96/0.39 | 머리글 라벨 후보 모두 문체 기준 미달 |
| question | reply.answerLabel | Answer:  | 답변:  | 1.79/0.96/0.42 | 이어 붙이는 라벨, 문체 기준 미달 |
| question | reply.close | Close question details | 질문 상세 닫기 | 1.71/0.97/0.40 | 라벨 후보 모두 문체 기준 미달 |
| question | reply.label | Reply to earlier pending questions | 대기 중인 이전 질문에 답장합니다 | 1.39/0.88/0.85 | 긴 동작 라벨의 자연스러움 미달 |
| question | status.sent | Reply sent; the panel could not close. | 답장은 보냈지만 패널을 닫지 못했습니다. | 1.45/0.96/0.57 | 두 동작 안내의 자연스러움 미달 |
| question | wait.continued | Work continued — you can still answer | 답변하지 않아도 작업이 계속되었습니다. 지금도 답변할 수 있습니다. | 1.39/0.77/0.76 | 상태 안내의 자연스러움 미달 |
| cotTranslation | anonymousNotice | Bing and Google need no translation login or API key. Their anonymous endpoints may reject or limit requests. | Bing과 Google은 번역 로그인이나 API 키가 필요하지 않습니다. 익명 엔드포인트가 요청을 거부하거나 제한할 수 있습니다. | 1.71/0.96/0.39 | 두 문장 안내의 문체 판정이 계속 낮음 |
| cotTranslation | saveFailed | The deployment did not accept these values; they were left for you to correct. | 배포에서 이 값을 받아들이지 않았습니다. 값을 수정할 수 있도록 그대로 두었습니다. | 1.32/0.92/0.48 | settings.agentLoop와 같은 문구·같은 미해결 후보 |
| cotTranslation | targetLanguageHint | auto follows the UI language; language codes such as zh, en, and ja also work. | auto는 UI 언어를 따릅니다. zh, en, ja 같은 언어 코드도 사용할 수 있습니다. | 1.78/0.96/0.45 | 세미콜론으로 이어진 안내문의 문체 미달 |
| cotTranslation | unwrap | Unwrap lines | 줄 바꿈을 해제합니다 | 1.46/0.94/0.87 | 줄 바꿈 토글 라벨의 자연스러움 미달 |
| cotTranslation | wrap | Wrap lines | 줄 바꿈 적용 | 1.39/0.9/0.59 | 줄 바꿈 토글 라벨의 자연스러움 미달 |
| settings | connection.restart | Reconnecting, reconnect now | 다시 연결하고 있습니다. 지금 다시 연결하십시오. | 1.38/0.93/0.96 | 두 상태 안내를 한 문장으로 합친 후보 모두 자연스러움 미달 |
| settings | desktop.update.tasksChanged | New tasks have started. Confirm again to stop the tasks and update. | 새 작업이 시작되었습니다. 작업을 중지하고 업데이트하려면 다시 확인하십시오. | 1.45/0.92/0.6 | 확인 요청 안내문의 자연스러움 미달 |
| settings | developerTools.description | Shows trajectory, code diffs, and all Agent presets | Trajectory, 코드 diff, 모든 에이전트 프리셋을 표시합니다 | 1.15/0.9/0.55 | 제품 용어가 섞인 설명문 후보 모두 자연스러움 미달 |
| sidebarRight | command.noFocus | Focus a right sidebar pane first | 먼저 오른쪽 사이드바의 창을 선택하십시오 | 1.36/0.96/0.91 | 4회 미통과 |
| sidebarRight | command.stale | The page changed; focus it again | 페이지가 변경되었습니다. 다시 선택해 주십시오 | 1.41/0.87/0.91 | 4회 미통과 |
| sidebarRight | dock.dockFloat | Send back to the sidebar | 사이드바에 다시 고정 | 1.49/0.89/0.47 | 4회 미통과 |
| sidebarRight | tab.unavailable | Nothing here can view this kind of content yet. | 이 유형의 콘텐츠를 열 수 있는 보기가 아직 없습니다. | 1.29/0.91/0.53 | 4회 미통과 |
| conversation | context.used | of context used | 사용한 컨텍스트 비율 | 1.43/0.31/0.72 | 4회 미통과 |
| conversation | detail.providers.count | {count} inspect providers | Inspect 프로바이더 {count}개 | 1.49/0.97/0.54 | 4회 미통과 |
| conversation | detail.ralph.reportedBlocker | Worker reported a blocker | 작업자가 진행을 막는 문제를 보고했습니다. | 1.36/0.92/0.66 | 4회 미통과 |
| conversation | detail.tasks.nextPage | More tasks available; next cursor is {cursor} | 더 많은 과제를 보려면 다음 커서 {cursor}를 사용하십시오. | 1.46/0.89/0.88 | 4회 미통과 |
| conversation | detail.trace.ancestors | Ancestor sessions | 상위 세션 계보 | 1.43/0.95/0.66 | 4회 미통과 |
| conversation | detail.trace.replacementChain | Replacement chain | 연속된 대체 이력 | 1.38/0.91/0.68 | 4회 미통과 |
| conversation | hero.headline | Into the Unknown | 새로운 가능성을 향한 시작 | 1.26/0.67/0.78 | 4회 미통과 |
| conversation | image.openOriginalLabel | {label}, click to view original | {label}, 원본을 보려면 클릭하십시오. | 1.47/0.94/0.91 | 4회 미통과 |
| conversation | input.send.steer | Steer message | 현재 턴에 메시지 끼워 넣기 | 1.25/0.76/0.61 | 4회 미통과 |
| conversation | placeholder.steerQueue | Cmd/Ctrl+Enter steers all queued messages | Cmd/Ctrl+Enter를 누르면 대기열의 모든 메시지가 현재 실행 중인 턴으로 전송됩니다. | 1.43/0.94/0.83 | 4회 미통과 |
| conversation | settings.enter.description | What Enter and the Send button do while the agent is running; Cmd/Ctrl+Enter uses the other behavior | 에이전트가 실행 중일 때 Enter 키와 전송 버튼으로 수행할 동작을 설정합니다. Cmd/Ctrl+Enter를 누르면 선택하지 않은 쪽의 동작을 수행합니다. | 1.48/0.89/0.81 | 4회 미통과 |
| conversation | shortcut.complementary | Use the complementary Queue / Steer action | 기본 전송 방식 대신 다른 방식(대기열 추가 / 진행 중인 턴으로 전송)을 사용합니다. | 1.47/0.85/0.58 | 4회 미통과 |
| conversation | terminal.sendInput | (send input) | (입력 전송) | 1.29/0.93/0.61 | 4회 미통과 |
| conversation | tool.title.ralph | Run ralph loop | ralph 루프를 실행합니다. | 1.22/0.96/0.84 | 4회 미통과 |
| conversation | tool.title.signalTerminal | Signal terminal | 터미널로 시그널을 보냅니다. | 1.43/0.92/0.86 | 4회 미통과 |
| conversation | 용어 | Steer | 실행 중인 턴에 전달 | — | 번역자 제안 |
| conversation | 용어 | Queue | 대기열에 추가 | — | 번역자 제안 |
| conversation | 용어 | Task | 과제 | — | 번역자 제안 |
| conversation | 용어 | Team task | 팀 과제 | — | 번역자 제안 |
| conversation | 용어 | Reminder | 알림 | — | 번역자 제안 |
| conversation | 용어 | Blocker | 진행 불가 사유 | — | 번역자 제안 |
| conversation | 용어 | Ancestor sessions | 상위 계보 세션 | — | 번역자 제안 |
| conversation | 용어 | Descendant sessions | 하위 계보 세션 | — | 번역자 제안 |
| conversation | 용어 | Diff | 변경 내역 | — | 번역자 제안 |
| conversation | 용어 | Signal | 시그널 | — | 번역자 제안 |
| conversation | 용어 | Revision | 리비전 | — | 번역자 제안 |
| conversation | 용어 | Provisioning | 프로비저닝 | — | 번역자 제안 |
| conversation | 용어 | Worker | 작업자 | — | 번역자 제안 |
| conversation | 용어 | Symbol | 심볼 | — | 번역자 제안 |
| trajectory | column.think | Think | 생각 과정 | 1.47/0.89/0.84 | 4회 미통과 |
| trajectory | details.resize | Resize event details | 이벤트 상세 정보의 크기를 조절하십시오 | 1.36/0.9/0.77 | 4회 미통과 |
| trajectory | kind.sub | Sub | 하위 요소 | 1.17/0.78/0.7 | 4회 미통과 |
| trajectory | request.collapsedSummary | Collapsed {kind} summary, {summary} | 접혀 있는 {kind} 요약: {summary} | 1.31/0.82/0.53 | 4회 미통과 |
| trajectory | request.rowAriaCompaction | Request {request}, compaction | 요청 {request}, 컨텍스트 압축 | 1.3/0.91/0.7 | 4회 미통과 |
| trajectory | request.rowPrefix | Request {request},  | 요청 번호 {request},  | 1.08/0.91/0.63 | 4회 미통과 |
| trajectory | section.betweenTurns | Between turns | 턴 간 구간 | 1.47/0.94/0.74 | 4회 미통과 |
| trajectory | timeline.ttftDecoding | TTFT {ttft} · Decoding {decoding} | TTFT {ttft} · 디코딩 시간 {decoding} | 1.4/0.94/0.63 | 4회 미통과 |
| trajectory | timing.stepStartUnavailable | Step start unavailable | 단계 시작 정보 없음 | 1.47/0.96/0.58 | 4회 미통과 |
| trajectory | toolbar.aria | Trajectory toolbar | Trajectory 도구 모음 영역 | 1.45/0.96/0.71 | 4회 미통과 |
| trajectory | toolbar.useEqualWidth | Use equal-width operations | 각 작업을 동일한 너비로 표시합니다 | 1.15/0.89/0.71 | 4회 미통과 |
| trajectory | usage.sessionCumulative | Session cumulative | 세션 누적 사용량 | 1.37/0.84/0.59 | 4회 미통과 |
| trajectory | 용어 | Assistant | 어시스턴트 | — | 번역자 제안 |
| trajectory | 용어 | Block | 블록 | — | 번역자 제안 |
| trajectory | 용어 | Step | 단계 | — | 번역자 제안 |
| trajectory | 용어 | Subtool | 하위 도구 | — | 번역자 제안 |
| trajectory | 용어 | Parameters | 매개변수 | — | 번역자 제안 |
| trajectory | 용어 | Payload | 페이로드 | — | 번역자 제안 |
| trajectory | 용어 | Schema | 스키마 | — | 번역자 제안 |
| trajectory | 용어 | Timing | 시간 측정 | — | 번역자 제안 |
| trajectory | 용어 | Duration | 소요 시간 | — | 번역자 제안 |
| trajectory | 용어 | Throughput | 처리량 | — | 번역자 제안 |
| trajectory | 용어 | Timestamp | 타임스탬프 | — | 번역자 제안 |
| trajectory | 용어 | Timeline | 타임라인 | — | 번역자 제안 |
| trajectory | 용어 | Round | 라운드 | — | 번역자 제안 |
| trajectory | 용어 | Think/Thinking | 생각 | — | 번역자 제안 |
| trajectory | 용어 | Diff | 변경 사항 | — | 번역자 제안 |
| trajectory | 용어 | Raw | 원본 | — | 번역자 제안 |
