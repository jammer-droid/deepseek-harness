# 미해결 키와 승인 기록 (#30 S5)

판정 기록(`<namespace>.json`)에서 만든 목록이다. 판정 기록이 원본이며, 이 파일은 `--ledger` 대신 검토 때 다시 만든다.

## 검토 결정 (2026-10-17)

사용자가 "에이전트가 재검토해서 결정"하도록 위임했다. 판정을 통과하지 못한 183키를 다음처럼 처리했다.

| 결정 | 키 수 | 기준 |
| --- | --- | --- |
| 최선 후보 채택 | 108 | 의미 ≥ 0.6이고 (문체만 미달) 또는 (자연스러움 1.35–1.5). 문구를 읽고 틀린 곳이 없으면 채택 |
| 조각·화면 역할로 다시 판정해 채택 | 12 | 다른 키와 이어 붙는 조각은 이어 붙인 문장으로, aria·제목은 실제 역할을 넣어 판정. 모두 통과 |
| 다시 번역 후 채택 | 5 | `saveFailed` 5개. 새 번역 3회 모두 기준 미달이라 첫 후보(자연 1.40–1.43, 의미 0.87)를 채택 |
| 영어로 유지 | 58 | 자연스러움 < 1.35, 또는 의미 미달, 또는 조각인데 이어 붙인 문장이 통과하지 못함 |

그 밖에 판정 통과 문구 27개를 되돌렸다. 버튼·라벨(예: "Open configuration file")이 문체 점수 때문에 "구성 파일을 엽니다" 같은 문장으로 바뀐 경우다. 이전 라벨 후보("구성 파일 열기", 자연·의미 통과, 문체만 미달)로 되돌리고 승인으로 기록했다.

용어는 다음처럼 맞췄다. 바꾼 문구는 다시 판정했고, 통과하지 못한 10개는 이전 통과 문구를 그대로 두었다.

| 용어 | 통일안 | 남은 다른 표기 |
| --- | --- | --- |
| Refresh | 새로 고침 | 판정 미통과로 "새로고침" 1개 |
| Preview | 미리 보기 | "미리보기" 8개 |
| Ancestor / Descendant sessions | 상위 세션 계보 / 하위 세션 계보 | 없음 |
| Team task | 팀 작업 | "팀 과제" 1개 |
| Reasoning effort | 추론 강도 | 조사가 깨져 복원한 "추론 수준" 1개 |

번역자가 남긴 용어 제안 149행 중 위 표 말고는 용어집과 충돌하지 않아 그대로 두었다. 제안 원문은 이 파일의 이전 판(git 기록)에 있다.

## 영어로 남은 키 (58)

| 네임스페이스 | 키 | 영어 | 최선 후보 | 점수(자연/의미/문체) |
| --- | --- | --- | --- | --- |
| agent-team | blockedBy | Blocked by | 차단 요인 | 1.33/0.81/0.61 |
| chat | message.failure.accountSignInRequired | Sign in to DeepSeek and ensure the request destination supports account authentication. | DeepSeek에 로그인하고 요청 대상이 계정 인증을 지원하는지 확인하십시오. | 1.23/0.96/0.89 |
| chat | message.turnUsage.reasoning |  ({tokens} reasoning) |  (추론 {tokens}) | 1.33/0.93/0.66 |
| claude-code-mods | band | Claude Code mods | Claude Code 모듈 | 1.19/0.86/0.86 |
| claude-code-mods | press.stale | That button belonged to an earlier drawing; the band has refreshed | 이 버튼은 이전 화면의 버튼입니다. 표시줄이 갱신되었습니다. | 1.08/0.79/0.57 |
| conversation | detail.tasks.nextPage | More tasks available; next cursor is {cursor} | 더 많은 과제를 보려면 다음 커서 {cursor}를 사용하십시오. | 1.46/0.89/0.88 |
| conversation | hero.headline | Into the Unknown | 새로운 가능성을 향한 시작 | 1.26/0.67/0.78 |
| conversation | input.send.steer | Steer message | 현재 턴에 메시지 끼워 넣기 | 1.25/0.76/0.61 |
| conversation | terminal.sendInput | (send input) | (입력 전송) | 1.29/0.93/0.61 |
| conversation | tool.title.ralph | Run ralph loop | ralph 루프를 실행합니다. | 1.22/0.96/0.84 |
| cotTranslation | wrap | Wrap lines | 줄 바꿈을 적용합니다 | 1.15/0.86/0.94 |
| deliverables | presented.directoryOpened | Requested opening containing folder | 해당 파일의 폴더를 여는 요청을 보냈습니다. | 1.15/0.86/0.9 |
| deliverables | presented.opened | Open requested | 열기 요청 완료 | 1.25/0.94/0.66 |
| deliverables | row.title | Present files | 파일 전달 | 1.2/0.85/0.69 |
| inspectorPanel | close | Collapse | 패널을 접습니다 | 1.19/0.63/0.97 |
| permission.access | auto.description | Run without a sandbox after an experimental same-model review of every native tool call and PTC inner call. | 모든 네이티브 도구 호출과 PTC 내부 호출을 실험적인 동일 모델 검토로 확인한 뒤 샌드박스 없이 실행합니다. | 1.16/0.93/0.85 |
| pluginManager | installApplyingCancellationError | Cancellation was not confirmed. Installation is being applied; wait for its result. {reason} | 설치 취소가 확인되지 않았습니다. 현재 설치 작업을 반영하고 있습니다. 완료 결과를 기다려 주십시오. {reason} | 1.18/0.92/0.74 |
| pluginManager | installAttempt | {previous} could not serve the package; retrying through {registry} (registry {index} of {total}) | {previous}에서 패키지를 가져올 수 없어 {registry}(레지스트리 {index}/{total})를 통해 다시 시도하고 있습니다. | 1.32/0.93/0.63 |
| pluginManager | installCancelUnconfirmed | Installation has not been confirmed stopped. Retry cancellation or wait for the installation result. {reason} | 설치 중지 여부가 아직 확인되지 않았습니다. 취소를 재시도하거나 설치 결과를 기다리십시오. {reason} | 1.25/0.96/0.67 |
| pluginManager | installResultUnconfirmed | The installation result was not received. Check installation status. {reason} | 설치 결과를 받지 못했습니다. 설치 상태를 확인하십시오. {reason} | 1.34/0.96/0.76 |
| pluginManager | installUpgradeNotice | On-demand Official plugins offer Update when their version differs from DSH. To update other plugins, uninstall and reinstall them. | 온디맨드 공식 플러그인은 DSH와 버전이 다를 때 업데이트할 수 있습니다. 그 밖의 플러그인은 제거 후 다시 설치하여 업데이트하십시오. | 1.29/0.16/0.9 |
| pluginManager | reasonAmbiguousInstall | Which package was installed cannot be told from the dependency change. | 의존성이 변경된 내역만으로는 설치된 패키지를 확인할 수 없습니다. | 1.2/0.95/0.54 |
| pluginManager | reasonUnaddressable | The profile patch cannot address this one uniquely. | 프로필 패치가 이 항목을 다른 항목과 구분할 수 없습니다. | 1.26/0.95/0.43 |
| question | error.resubmit | The answer did not arrive before work continued; submit it again. | 작업이 계속되기 전에 답변이 도착하지 않았습니다. 다시 제출해 주십시오. | 1.21/0.94/0.87 |
| question | nav.cancel | Dismiss all questions | 모든 질문을 닫습니다 | 1.15/0.88/0.93 |
| question | nav.close | Close the panel — reopen it from the tool call | 패널을 닫습니다 — 도구 호출에서 다시 여십시오 | 1.11/0.94/0.79 |
| question | reply.label | Reply to earlier pending questions | 이전에 대기 중이던 질문에 답장합니다 | 1.33/0.94/0.9 |
| schedule.catalog | cron.day.both | Day {days} of every month or {weekdays}{months} | 매월 {days}일 또는 {weekdays}{months} | 1.06/0.93/0.56 |
| schedule.catalog | cron.day.bothStarred | Day {days} of every month and {weekdays}{months} | 매월 {days}일이면서 {weekdays}인 날{months} | 1.09/0.94/0.53 |
| schedule.catalog | unit.day.other | days | 일 | 1.39/0.67/0.66 |
| schedule.manager | cron.day.both | Day {days} of every month or {weekdays}{months} | 매월 지정일({days}일) 또는 {weekdays}{months} | 1.04/0.9/0.63 |
| schedule.manager | cron.day.bothStarred | Day {days} of every month and {weekdays}{months} | 매월 {days}일이면서 {weekdays}{months} | 0.99/0.96/0.6 |
| schedule.manager | cron.time.hoursEveryMinutes | every {step} minutes during hours {hours} | {hours}시에는 {step}분마다 실행합니다 | 1.33/0.92/0.95 |
| schedule.manager | cronForm.atMinute | At minute | 분 지정 | 1.28/0.64/0.76 |
| schedule.manager | cronForm.minuteDecrease | Decrease minute | 분 값 줄이기 | 1.29/0.93/0.74 |
| schedule.manager | rule.error.conflict | This task changed before the update was saved. The row shows the saved rule; try again. | 저장하기 전에 다른 변경 사항이 적용되었습니다. 이 행에는 저장된 규칙이 표시되어 있습니다. 다시 시도하십시오. | 1.3/0.85/0.87 |
| session-inspector | object.accessor | [Getter / Setter, not evaluated] | [Getter / Setter, 아직 평가하지 않음] | 1.13/0.94/0.78 |
| settings | desktop.update.tasksChanged | New tasks have started. Confirm again to stop the tasks and update. | 새 작업이 시작되었습니다. 작업을 중지하고 업데이트하려면 다시 확인해 주십시오. | 1.27/0.91/0.84 |
| settings | developerTools.description | Shows trajectory, code diffs, and all Agent presets | Trajectory와 코드 diff, 에이전트 프리셋 전체를 표시합니다. | 1.15/0.89/0.87 |
| settings.models | addCustomUnavailable | No API protocol is available to declare. | 설정 가능한 API 프로토콜이 없습니다. | 1.23/0.89/0.68 |
| settings.pluginInventory | globalSubtitle | Shared by the system and every session | 시스템 전체와 모든 세션이 공유합니다 | 1.21/0.93/0.8 |
| settings.subagent | subagentModelSelectionPartial | Some model providers could not be loaded; saved choices remain removable. | 일부 모델 프로바이더를 불러오는 데 실패했습니다. 저장해 둔 모델 선택 항목을 제거하는 것은 가능합니다. | 1.2/0.81/0.85 |
| shortcuts | invalid | Shortcut configuration in {location} is damaged. Back up and repair this configuration, then {reload}. | {location}의 단축키 설정이 손상되었습니다. 먼저 설정을 백업하고 복구하십시오. 그런 다음 {reload}. | 1.31/0.93/0.85 |
| shortcuts | review | I have reviewed the latest configuration | 변경된 최신 설정을 검토했습니다 | 1.24/0.94/0.85 |
| sidebarBrowser | address.unknown | The page navigated; this carrier cannot read its new URL. | 페이지가 이동했습니다. 이 캐리어는 새 URL을 읽을 수 없습니다. | 1.29/0.95/0.55 |
| sidebarDocumentPreview | error.tooLarge | This page exceeds the {limit} limit and cannot be read. | 이 페이지는 {limit} 제한을 초과했습니다. 읽을 수 없습니다. | 1.21/0.91/0.74 |
| sidebarRight | tab.unavailable | Nothing here can view this kind of content yet. | 이 유형의 콘텐츠를 열 수 있는 보기가 아직 없습니다. | 1.29/0.91/0.53 |
| sidebarTerminal | control | Take control | 제어권을 가져옵니다 | 1.31/0.96/0.91 |
| slash.menu | suggestions.aria | Trigger suggestions | 입력 제안 | 1.02/0.64/0.67 |
| trajectory | kind.sub | Sub | 하위 요소 | 1.17/0.78/0.7 |
| trajectory | request.collapsedSummary | Collapsed {kind} summary, {summary} | 접혀 있는 {kind} 요약: {summary} | 1.31/0.82/0.53 |
| trajectory | request.rowAriaCompaction | Request {request}, compaction | 요청 {request}, 컨텍스트 압축 | 1.3/0.91/0.7 |
| trajectory | request.rowPrefix | Request {request},  | 요청 번호 {request},  | 1.08/0.91/0.63 |
| trajectory | toolbar.useEqualWidth | Use equal-width operations | 각 작업을 동일한 너비로 표시합니다 | 1.15/0.89/0.71 |
| voice-input | preparation.waking | Waking local speech recognition… | 로컬 음성 인식 서비스를 대기 상태에서 복구합니다… | 1.32/0.91/0.72 |
| voice-input | wakingShort | Waking… | 깨우는 중… | 1.29/0.95/0.66 |
| workspace | archive.confirm.other.one | {n} other item of work ({kind}) | 기타 작업 {n}개({kind}) | 1.07/0.85/0.68 |
| workspace | archive.confirm.other.other | {n} other items of work ({kind}) | 기타 작업 항목 {n}개 ({kind}) | 1.33/0.9/0.66 |

## 승인한 문구 (161)

판정 기준을 통과하지 못했지만 사용자 또는 검토가 채택한 문구다. 판정 스크립트는 승인한 문구를 다시 판정하지 않으며, 문구를 바꾸면 다시 판정한다.

| 네임스페이스 | 키 | 영어 | 한국어 | 승인 | 이유 |
| --- | --- | --- | --- | --- | --- |
| agent-team | open | Open member conversation | 멤버 대화 열기 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| agent-team | task.collapse | Show less | 줄여서 보기 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| approval | escalation | Tool {toolName} requests privileged execution | {toolName} 도구가 높은 권한의 실행을 요청합니다 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| chat | chat.turnNavigation.jump | Jump to turn {turn} | {turn}번째 턴으로 이동합니다 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| chat | chat.turnNavigation.jumpLoad | Load and jump to turn {turn} | {turn}번째 턴 불러오기 및 이동 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| chat | duration.hourUnit | h  | h  | 사용자 | 판정 미통과 문구를 사용자가 그대로 승인(단위·제품 이름) |
| chat | message.context.catalog.replaced | Replacement catalog | 대체할 카탈로그 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| chat | message.retry.status | {label} ({retry}/{maximum}) · {seconds}s | {label} ({retry}/{maximum}) · {seconds}초 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| chat | message.stepProcess.prepare.subagents | Preparing to coordinate subagents | 서브에이전트 조율 준비 단계 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| chat | message.trigger.explanation | This notification triggered this response. | 이 알림이 응답을 시작하는 계기가 되었습니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| chat | message.trigger.goal | Continuing goal | 목표 계속 수행 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| chat | message.turnProcess.thoughtForAWhile | Thought for a while | 잠시 생각함 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| chat | message.turnProcess.took | Completed in  | 완료, 소요 시간  | 검토 | 조각·화면 역할을 넣어 판정 통과; 이어 붙인 문장 완료, 소요 시간 2분 13초 ↔ Completed in 2m 13s 1.8/0.97/0.66 |
| chat | message.unknownSurface | Unknown surface event: {type} | 알 수 없는 화면 이벤트: {type} | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| command | listbox.aria | /{command} matches | /{command} 검색 결과 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| command | search.aria | Filter options | 옵션 필터링 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| common | copy.optionsHint | {action}; right-click for copy options | {action}; 우클릭하면 복사 옵션이 나타납니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| conversation | attachment.scrollLeft | Scroll attachments left | 첨부 파일 왼쪽으로 스크롤 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| conversation | attachment.scrollRight | Scroll attachments right | 첨부 파일 오른쪽으로 스크롤 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| conversation | context.used | of context used | 컨텍스트 사용량 | 검토 | 조각·화면 역할을 넣어 판정 통과; 이어 붙인 문장 aria-label of the context-usage dialog ↔ Context used 1.75/0.92/0.74 |
| conversation | detail.providers.count | {count} inspect providers | Inspect 프로바이더 {count}개 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| conversation | detail.ralph.reportedBlocker | Worker reported a blocker | 작업자가 진행을 막는 문제를 보고했습니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| conversation | detail.trace.ancestors | Ancestor sessions | 상위 세션 계보 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택. 치환안 "상위 세션"은 1.5 미달 |
| conversation | detail.trace.replacementChain | Replacement chain | 연속된 대체 이력 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| conversation | diff.expandAria | Expand {count} more diff lines | 변경 내역 {count}행 더 펼치기 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| conversation | image.openOriginalLabel | {label}, click to view original | {label}, 원본을 보려면 클릭하십시오. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| conversation | placeholder.steerQueue | Cmd/Ctrl+Enter steers all queued messages | Cmd/Ctrl+Enter를 누르면 대기열의 모든 메시지가 현재 실행 중인 턴으로 전송됩니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| conversation | settings.enter.description | What Enter and the Send button do while the agent is running; Cmd/Ctrl+Enter uses the other behavior | 에이전트가 실행 중일 때 Enter 키와 전송 버튼으로 수행할 동작을 설정합니다. Cmd/Ctrl+Enter를 누르면 선택하지 않은 쪽의 동작을 수행합니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| conversation | shortcut.complementary | Use the complementary Queue / Steer action | 기본 전송 방식 대신 다른 방식(대기열 추가 / 진행 중인 턴으로 전송)을 사용합니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| conversation | tool.preparing.content | {kilobytes}KB | {kilobytes}KB | 사용자 | 판정 미통과 문구를 사용자가 그대로 승인(단위·제품 이름) |
| conversation | tool.title.signalTerminal | Signal terminal | 터미널로 시그널을 보냅니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| cordis | a11y.preparing | Preparing a Cordis tool call | Cordis 도구 호출을 준비하고 있습니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| cordis | panel.approvals.aria | Cordis approvals | Cordis 승인 요청 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| cordis | panel.hint | Run controls live in the Cordis panel above Settings | 실행 제어는 설정 상단의 Cordis 패널에서 가능합니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| cordis | render.failedAbdicated | Rendering failed in {slot}; the default UI was restored: | {slot}에서 렌더링에 실패하여 기본 UI를 복원했습니다: | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| cotTranslation | anonymousNotice | Bing and Google need no translation login or API key. Their anonymous endpoints may reject or limit requests. | Bing과 Google은 번역 로그인이나 API 키가 필요하지 않습니다. 익명 엔드포인트가 요청을 거부하거나 제한할 수 있습니다. | 검토 | 문체 점수만 미달(짧은 라벨) |
| cotTranslation | saveFailed | The deployment did not accept these values; they were left for you to correct. | 배포 환경이 이 값을 받아들이지 않았습니다. 고칠 수 있도록 입력값을 그대로 두었습니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 (1.41/0.87/0.84) |
| cotTranslation | targetLanguageHint | auto follows the UI language; language codes such as zh, en, and ja also work. | auto는 UI 언어를 따릅니다. zh, en, ja 같은 언어 코드도 사용할 수 있습니다. | 검토 | 문체 점수만 미달(짧은 라벨) |
| deliverables | diff.missing | The contents of this turn’s changes are no longer available | 이번 턴의 변경 사항은 더 이상 내용을 볼 수 없습니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| deliverables | presented.directoryOpening | Opening containing folder… | 파일이 들어 있는 폴더를 열고 있습니다… | 검토 | 문체 점수만 미달(짧은 라벨) |
| deliverables | presented.expandAria | Show all {count} delivered files | 전달받은 파일 {count}개 모두 보기 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| deliverables | presented.hostError | Could not read the Host desktop information | Host 데스크톱 정보 읽기에 실패했습니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| deliverables | presented.revealError | Could not show in file manager. Try again. | 파일 관리자에서 표시하는 데 실패했습니다. 다시 시도하십시오. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| deliverables | presented.revealed | Requested display in file manager | 파일 관리자에 표시하는 요청을 보냈습니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| model | action.reload | Reload | 새로 고침 | 검토 | 문체 점수만 미달(짧은 라벨) |
| model | menu.aria | Model and reasoning effort | 모델 및 추론 강도 | 검토 | 문체 점수만 미달(짧은 라벨) |
| model | menu.effort | Effort | 강도 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| model | search.clear | Clear search | 검색 지우기 | 검토 | 문체 점수만 미달(짧은 라벨) |
| permission.access | auto.confirm.description | Auto review runs without a sandbox. Before every native tool call and PTC inner call, the same model as the current agent reviews whether to allow it; you approve or reject each call it denies. This feature is experimental, can falsely allow or deny actions, and uses additional tokens. | 자동 검토는 샌드박스 없이 실행됩니다. 모든 네이티브 도구 호출과 PTC 내부 호출 전에 현재 에이전트와 같은 모델이 허용 여부를 검토하며, 거부된 각 호출은 사용자가 승인하거나 거부합니다. 이 기능은 실험적이어서 작업을 잘못 허용하거나 거부할 수 있고 추가 토큰을 사용합니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| pluginManager | bundlesTitle | Installed plugins | 설치된 플러그인 | 검토 | 조각·화면 역할을 넣어 판정 통과; 이어 붙인 문장 section title ↔ Installed plugins 1.88/0.93/0.69 |
| pluginManager | installApprovalConsequence | Once allowed, the scripts run here with your permissions, and the permission is saved in this profile. | 스크립트 실행을 허용하면 여기에서 사용자와 동일한 권한으로 실행됩니다. 이 권한 설정은 현재 프로필에 저장됩니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| pluginManager | installAwaitingAcceptance | Waiting for the Host to accept installation. Cancellation will retry automatically after confirmation. | Host가 설치 요청을 수락하기를 기다리는 중입니다. 확인 후 취소를 자동으로 다시 시도합니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| pluginManager | installFailureNetworkHost | {host} could not be reached. A GitHub address or a .tgz link is not fetched through the registry: this machine must reach it directly or through a proxy. If the plugin is also published to npm, enter its package name instead. | {host}에 연결할 수 없습니다. GitHub 주소와 .tgz 링크는 레지스트리를 거치지 않으므로 이 컴퓨터에서 직접 연결하거나 프록시를 통해 연결해야 합니다. npm에도 게시된 플러그인이라면 주소 대신 패키지 이름을 입력하십시오. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| pluginManager | installGuideFill | Use example | 예제 사용 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| pluginManager | installGuideFillAria | Use the example {example} | 예시 {example} 사용 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| pluginManager | reasonNotRemovable | This package is not owned by the profile, or plugin management needs it. | 이 프로필에 속한 패키지가 아니거나 플러그인 관리에 필요한 패키지입니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| pluginManager | terminalExpandAria | Expand the remaining {n} output lines | 나머지 출력 {n}줄 펼치기 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| pluginManager | chooseAddMethod | Choose how to add a plugin | 플러그인 추가 방법 선택 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| pluginManager | installDoneOtherVersion | Under pnpm's supply-chain security policy (minimumReleaseAge), versions published more recently than the required age are not installed automatically, so this installation used {installed} instead of the latest version {version}. A newly published version has not completed this waiting period and may contain undetected malicious code or defects. If you need {version}, uninstall the current version and then install {exact} to request that version. | pnpm의 공급망 보안 정책(minimumReleaseAge)에 따라, 출시 후 정해진 기간이 지나지 않은 버전은 자동 설치 대상에서 제외됩니다. 이 때문에 최신 버전 {version}이 아닌 {installed} 버전이 설치되었습니다. 새로 출시된 버전은 대기 기간이 끝나지 않았으며, 발견되지 않은 악성 코드나 결함이 포함되어 있을 수 있습니다. {version} 버전이 꼭 필요하면 기존 버전을 제거한 뒤 {exact}을(를) 설치해 원하는 버전을 명시하십시오. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| pluginManager | sourceTargetSpec | Source for this DSH | 현재 DSH에 맞는 소스 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| question | plan.approve | Approve | 승인하기 | 검토 | 문체 점수만 미달(짧은 라벨) |
| question | plan.decline | Refuse | 거부 | 검토 | 문체 점수만 미달(짧은 라벨) |
| question | plan.header | Plan review | 계획을 검토합니다 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| question | reply.answerLabel | Answer:  | 답변:  | 검토 | 조각·화면 역할을 넣어 판정 통과; 이어 붙인 문장 답변: 예 ↔ Answer: Yes 1.64/0.97/0.71 |
| question | reply.close | Close question details | 질문 상세를 닫습니다 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| question | reply.open | Open question details | 질문 상세 열기 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| question | status.sent | Reply sent; the panel could not close. | 답장을 보냈습니다. 하지만 패널을 닫지 못했습니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| question | wait.continued | Work continued — you can still answer | 작업이 계속되었습니다. 그래도 답변할 수 있습니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| schedule.catalog | cron.day.every | Every day{months} | 매일{months} | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| schedule.catalog | cron.months |  in {months} |  실행 ({months}) | 검토 | 조각·화면 역할을 넣어 판정 통과; 이어 붙인 문장 매일 실행 (3월, 4월) ↔ Every day in March, April 1.64/0.98/0.68 |
| schedule.catalog | cron.time.hoursEveryMinute | every minute during hours {hours} | {hours}시에는 매분 실행합니다 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| schedule.catalog | relative.overdue | {value} {unit} overdue | {value}{unit} 지남 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| schedule.manager | cron.day.every | Every day{months} | 매일 실행{months} | 검토 | 문체 점수만 미달(짧은 라벨) |
| schedule.manager | cron.day.monthDays | Day {days} of every month{months} | 매월 {days}일에 실행{months} | 검토 | 문체 점수만 미달(짧은 라벨) |
| schedule.manager | cron.months |  in {months} |  실행 ({months}) | 검토 | 조각·화면 역할을 넣어 판정 통과; 이어 붙인 문장 매일 실행 (3월, 4월) ↔ Every day in March, April 1.64/0.98/0.68 |
| schedule.manager | detail.openSession | Linked session: open original session | 연결된 원래 세션 열기 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| schedule.manager | detail.records | Records | 실행 기록 | 검토 | 조각·화면 역할을 넣어 판정 통과; 이어 붙인 문장 detail tab title ↔ Records 1.57/0.73/0.71 |
| schedule.manager | rule.error.unknown | Could not confirm the rule update. The row shows the saved rule. | 규칙 업데이트를 확인하지 못했습니다. 행에는 저장된 규칙이 표시됩니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| schedule.manager | timing.notFound | This task is no longer available. Your draft is retained; cancel to close the editor. | 이 작업은 더 이상 사용할 수 없습니다. 작성 중인 내용은 유지됩니다. 편집기를 닫으려면 취소하십시오. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| schedule.manager | timing.unit.hour | hours | 시간 | 사용자 | 판정 미통과 문구를 사용자가 그대로 승인(단위·제품 이름) |
| schedule.manager | unit.day.other | days | 일 | 사용자 | 판정 미통과 문구를 사용자가 그대로 승인(단위·제품 이름) |
| schedule.manager | unit.minute.other | minutes | 분 | 사용자 | 판정 미통과 문구를 사용자가 그대로 승인(단위·제품 이름) |
| session-inspector | filter.context | Parent context of a matching record | 검색 조건에 맞는 레코드의 상위 컨텍스트 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| session-inspector | filter.noCandidates | No suggestions. You can still apply this keyword. | 제안이 없습니다. 이 키워드는 그대로 적용할 수 있습니다. | 검토 | 문체 점수만 미달(짧은 라벨) |
| session-inspector | object.navigation | Raw data navigation | 원시 데이터 탐색 메뉴 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| session-inspector | table.location | T/S | T/S | 사용자 | 판정 미통과 문구를 사용자가 그대로 승인(단위·제품 이름) |
| settings.account | bonusBalance | Granted balance | 지급된 크레딧 잔액 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| settings.account | browserDescription | , then open it in your browser to finish signing in. | 를 눌러 브라우저에서 열고 로그인을 마치십시오. | 검토 | 조각·화면 역할을 넣어 판정 통과; 이어 붙인 문장 페이지가 자동으로 열리지 않는 경우: 로그인 링크 복사를 눌러 브라우저에서 열고 로그인을 마치십시오. 1.62/0.95/0.71 |
| settings.account | onboardingPurposePrefix | What would you like |  | 검토 | 조각·화면 역할을 넣어 판정 통과; 이어 붙인 문장 (빈 앞 조각) DeepSeek Harness 도움이 필요하십니까? ↔ What would you like DeepSeek Harness to help with? 1.5/0.87/0.75 |
| settings.account | onboardingWelcome | Welcome to | 환영합니다,  | 검토 | 조각·화면 역할을 넣어 판정 통과; 이어 붙인 문장 환영합니다, DeepSeek Harness ↔ Welcome to DeepSeek Harness 1.52/0.97/0.59 |
| settings.account | signOutUnknownDescription | Could not check running tasks. Signing out may interrupt tasks using this account. Sign out now? | 실행 중인 작업을 확인할 수 없습니다. 로그아웃하면 이 계정을 이용하는 작업이 중단될 수 있습니다. 지금 로그아웃하겠습니까? | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| settings.agentLoop | saveFailed | The deployment did not accept these values; they were left for you to correct. | 배포 환경이 이 값을 받아들이지 않았습니다. 고칠 수 있도록 입력값을 그대로 두었습니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 (1.4/0.88/0.82) |
| settings | connection.restart | Reconnecting, reconnect now | 다시 연결하고 있습니다. 지금 다시 연결하십시오. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| settings | developerTools.title | Show coding view | 코딩 보기 표시 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| settings | openDocument | Open configuration file | 구성 파일 열기 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| settings.models | keyPlaceholder | Enter your API key | API 키 입력 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| settings.models | modelsEmpty | No models will be shown in the selector. Unlisted IDs can still be sent directly. | 선택기에 모델이 표시되지 않습니다. 목록에 없는 ID도 직접 전송할 수 있습니다. | 검토 | 문체 점수만 미달(짧은 라벨) |
| settings.models | onboardingTitle | Add an API key to get started | 시작하려면 API 키 추가 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| settings.models | protocolAnthropicMessages | Anthropic Messages | Anthropic Messages | 사용자 | 판정 미통과 문구를 사용자가 그대로 승인(단위·제품 이름) |
| settings.models | settingsPathUnresolvable | unresolvable settings path | 설정 파일 경로 확인 실패 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| settings.pluginInventory | loading | Reading plugins… | 플러그인 읽는 중… | 검토 | 문체 점수만 미달(짧은 라벨) |
| settings.pluginInventory | matchesInOtherPresets | {count} more matches in other presets:  | 다른 프리셋에서 {count}개 더 찾음:  | 검토 | 조각·화면 역할을 넣어 판정 통과; 이어 붙인 문장 다른 프리셋에서 3개 더 찾음: Master, Optimized 1.5/0.96/0.62 |
| settings.pluginInventory | presetProvidedDetail | Disabled globally; agent presets provide it per session | 전역에서는 사용하지 않습니다. 에이전트 프리셋을 통해 각 세션에 제공됩니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| settings.pluginInventory | presetSubtitle | Composed per session by agent presets | 에이전트 프리셋이 각 세션의 구성을 결정합니다 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| settings.pluginInventory | switcherLabel | Choose the agent preset to inspect | 확인할 에이전트 프리셋 선택 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| settings.plugins | tabs | Plugin views | 플러그인 뷰 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| settings.shell | saveFailed | The deployment did not accept these values; they were left for you to correct. | 배포 환경이 이 값을 받아들이지 않았습니다. 고칠 수 있도록 입력값을 그대로 두었습니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 (1.43/0.87/0.85) |
| settings.subagent | saveFailed | The deployment did not accept these values; they were left for you to correct. | 배포 환경이 이 값을 받아들이지 않았습니다. 고칠 수 있도록 입력값을 그대로 두었습니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 (1.42/0.87/0.82) |
| settings.subagent | subagentCapacityHelp | Total live Subagents under the same main Agent, across all recursion levels. The main Agent is excluded. New start requests are rejected when the limit is reached. | 하나의 메인 에이전트가 실행할 수 있는 서브에이전트의 총수입니다. 모든 재귀 단계의 서브에이전트를 포함하되 메인 에이전트는 제외합니다. 한도를 채우면 추가 실행 요청은 거부됩니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| settings.subagent | subagentModelSelectionAllowed | Models agents may choose | 에이전트용 선택 가능 모델 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| settings.theme | appearance.title | Appearance | 화면 | 검토 | 조각·화면 역할을 넣어 판정 통과; 이어 붙인 문장 settings section title ↔ Appearance 1.62/0.87/0.77 |
| settings.theme | fontSize.increase | Increase font size | 글꼴 크기 키우기 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| settings.theme | fontSize.code.decrease | Decrease code font size | 코드 글꼴 크기 줄이기 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| settings.theme | fontSize.code.increase | Increase code font size | 코드 글꼴 크기 키우기 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| settings.theme | fontSize.terminal.decrease | Decrease terminal font size | 터미널 글꼴 크기 줄이기 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| settings.theme | fontSize.text.decrease | Decrease font size | 글꼴 크기 줄이기 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| settings.theme | fontSize.text.increase | Increase font size | 글꼴 크기 키우기 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| settings.webSearch | apiKeyUnset | No key is configured; only conversations using a DeepSeek Account model can search, through the default endpoint. | 설정된 키가 없습니다. 기본 엔드포인트를 통해서는 DeepSeek 계정 모델을 사용하는 대화만 검색할 수 있습니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| settings.webSearch | saveFailed | The deployment did not accept these values; they were left for you to correct. | 배포 환경이 이 값을 받아들이지 않았습니다. 고칠 수 있도록 입력값을 그대로 두었습니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 (1.42/0.87/0.84) |
| shortcuts | close-confirmation | Close confirmation | 확인 메시지 닫기 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| shortcuts | description | View and edit available shortcuts and input actions | 단축키 및 입력 동작 조회와 편집 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| shortcuts | macos-web-help | Use Command+/, Command+,, Command+Backslash, Control+Backquote, Command+Option+key, or Command+Shift+key. Combinations with three or four distinct modifiers are also supported. Browser or system shortcuts may not reach the page. | Command+/, Command+,, Command+Backslash, Control+Backquote, Command+Option+key 또는 Command+Shift+key를 사용하십시오. 서로 다른 보조 키를 3개 또는 4개 함께 누르는 조합도 지원합니다. 브라우저나 시스템의 단축키 입력은 페이지로 전달되지 않을 수 있습니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| shortcuts | move | Move menu selection | 메뉴 선택 이동 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| shortcuts | web-document | this site’s localStorage entry dsh.keybindings.v1 | 현재 사이트의 localStorage 항목(dsh.keybindings.v1) | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| shortcuts | web-help | Browser combinations: Mod+/, Mod+Shift+,, Mod+Shift+.. Mod is Command on Mac and Ctrl elsewhere. | 브라우저에서는 Mod+/, Mod+Shift+,, Mod+Shift+. 조합을 사용합니다. 여기서 Mod는 Mac의 Command 키 또는 다른 환경의 Ctrl 키를 의미합니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| shortcuts | windows-web-help | Use Ctrl+/, Ctrl+,, Ctrl+Alt+key, or Ctrl+Shift+key. Combinations with three or four distinct modifiers are also supported. Browser or system shortcuts may not reach the page. | Ctrl+/, Ctrl+,, Ctrl+Alt+key 또는 Ctrl+Shift+key를 사용하십시오. 서로 다른 보조 키를 3개 또는 4개 함께 누르는 조합도 지원합니다. 브라우저나 시스템의 단축키 입력은 페이지로 전달되지 않을 수 있습니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| sidebarBrowser | address.placeholder | Enter an HTTP(S) address | HTTP(S) 주소 입력 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| sidebarBrowser | error.invalid | That address is invalid or too long. | 주소가 유효하지 않거나 너무 깁니다 | 검토 | 문체 점수만 미달(짧은 라벨) |
| sidebarBrowser | external | Open in system browser | 시스템 브라우저에서 열기 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| sidebarBrowser | go | Go | 이동 | 검토 | 문체 점수만 미달(짧은 라벨) |
| sidebarBrowser | sandbox.disable | Disable sandbox restrictions | 샌드박스 제한 해제 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| sidebarDocumentPreview | rendererUnavailable | The {name} preview is unavailable. | {name} 미리보기를 사용할 수 없습니다. | 검토 | 문체 점수만 미달(짧은 라벨), 용어 치환 전 문구 유지 |
| sidebarFiles | autoRefresh.disable | Disable auto refresh | 자동 새로 고침 끄기 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| sidebarFiles | autoRefresh.enable | Enable auto refresh | 자동 새로 고침 켜기 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| sidebarPdf | retry | Retry | 다시 시도 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| sidebarRight | command.close | Close current page or window | 현재 페이지 또는 창 닫기 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| sidebarRight | command.noFocus | Focus a right sidebar pane first | 먼저 오른쪽 사이드바의 창을 선택하십시오 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| sidebarRight | command.stale | The page changed; focus it again | 페이지가 변경되었습니다. 다시 선택해 주십시오 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| sidebarRight | dock.dockFloat | Send back to the sidebar | 사이드바에 다시 고정 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| slash.menu | subagent | Subagents | 서브에이전트 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| subagent | branch.collapse | Collapse {label} descendants | {label} 하위 항목 접기 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| subagent | open.sidebar.aria | Open {label} in sidebar | 사이드바에서 {label} 열기 | 검토 | 버튼·라벨을 문장으로 바꾼 재작성 대신 이전 라벨 후보로 되돌림(자연·의미 통과, 문체만 미달) |
| subagent | readonly.unknown.body | Read the child session to determine whether it can be continued. | 하위 세션의 내용을 확인하여 이어서 진행할 수 있는지 판단하십시오. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| trajectory | column.think | Think | 생각 과정 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| trajectory | details.resize | Resize event details | 이벤트 상세 정보의 크기를 조절하십시오 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| trajectory | section.betweenTurns | Between turns | 턴 간 구간 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| trajectory | timeline.ttftDecoding | TTFT {ttft} · Decoding {decoding} | TTFT {ttft} · 디코딩 시간 {decoding} | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| trajectory | timing.stepStartUnavailable | Step start unavailable | 단계 시작 정보 없음 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| trajectory | toolbar.aria | Trajectory toolbar | Trajectory 도구 모음 영역 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| trajectory | usage.sessionCumulative | Session cumulative | 세션 누적 사용량 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| voice-input | downloadAdvice.network | Check that the machine running DSH can reach the download source and its model download services. Configure a proxy on that machine if needed, then retry. | DSH를 실행하는 컴퓨터에서 다운로드 출처와 모델 다운로드 서비스에 접속할 수 있는지 확인하십시오. 필요하면 해당 컴퓨터에 프록시를 설정하고 다시 시도하십시오. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| voice-input | local | Audio is recognized on the machine running DSH. If models need downloading, that machine must be able to reach the selected source and its file services. Configure a proxy on that machine if needed. | 음성 인식은 DSH를 실행하는 컴퓨터에서 처리합니다. 모델 다운로드가 필요할 때는 이 컴퓨터에서 선택한 다운로드 출처와 파일 서비스에 접속할 수 있어야 합니다. 필요하면 이 컴퓨터에 프록시를 설정하십시오. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| voice-input | sourceHuggingFace | Hugging Face | Hugging Face | 사용자 | 판정 미통과 문구를 사용자가 그대로 승인(단위·제품 이름) |
| workspace | actions.workspace.aria | Workspace actions for {name} | “{name}” 워크스페이스의 사용 가능한 작업 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| workspace | archive.confirm.activity | Work that will be stopped | 중지 대상 작업 | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| workspace | archive.confirm.desc | “{title}” still has work in progress. Archiving stops it first; you can restore the session later from the “All conversations (show archived)” filter in the sidebar, and the stopped work will not resume on its own. | “{title}”에서 아직 작업이 진행 중입니다. 보관하기 전에 이 작업을 중지합니다. 세션은 나중에 사이드바의 “모든 대화(보관된 대화 포함)” 필터에서 복원할 수 있습니다. 중지된 작업은 자동으로 다시 시작되지 않습니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| workspace | groupBy.workspace | WorkSpace | 워크스페이스 | 사용자 | 판정 미통과 문구를 사용자가 그대로 승인(단위·제품 이름) |
| workspace | shortcut.directoryBusy | Selecting or adding a workspace | 워크스페이스 선택 또는 추가 작업이 진행 중입니다. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
| workspace | status.compact.approval | Approval | 승인 | 사용자 | 판정 미통과 문구를 사용자가 그대로 승인(단위·제품 이름) |
| workspace | time.days | {n}d | {n}일 | 사용자 | 판정 미통과 문구를 사용자가 그대로 승인(단위·제품 이름) |
| workspace | toast.forkRequiresOpen | Open the original session to complete migration before creating a branch. | 분기를 만들기 전에 원본 세션을 열어 마이그레이션을 완료하십시오. | 검토 | 자연스러움 1.35–1.5, 검토 후 채택 |
