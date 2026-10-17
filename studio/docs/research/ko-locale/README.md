---
kind: reference
description: "#30 한국어 번역 S1: DSH 클라이언트 사전 원문 추출 결과, 버전 차이, 번역 불가 목록, 용어집 초안."
---

# DSH 클라이언트 사전 원문 (S1)

[#30 명세](../../issues/30-korean-locale.md)의 S1 결과다. 원문은 [extract-dsh-locale.mjs](../../../scripts/extract-dsh-locale.mjs)로 git 태그에서 정적으로 추출했다. DSH 코드는 실행하지 않는다.

```sh
node studio/scripts/extract-dsh-locale.mjs dsh-v0.2.0-rc.2 --out studio/docs/research/ko-locale/source-rc2.json
node studio/scripts/extract-dsh-locale.mjs dsh-v0.2.1-alpha.2 --out studio/docs/research/ko-locale/source-alpha2.json
```

## 추출 결과

| 버전 | 태그 커밋 | 네임스페이스 | 키 | 해석 실패 |
| --- | --- | --- | --- | --- |
| 0.2.0-rc.2 | `639ed01539` | 58 | 2,615 | 0 |
| 0.2.1-alpha.2 | `d743267388` | 62 | 2,773 | 0 |

- 대상: `packages/client`, `packages/extensions`, `packages/session-query`, `packages/experimental`의 `src` 안에서 `locale.register(...)`를 부르는 모든 곳. 테스트 파일 제외.
- 파일 형식: `{ ref, commit, namespaces: { <ns>: { sites, keys: { <key>: { zh, en } } } }, unresolved }`. 원문 스냅샷: [source-rc2.json](source-rc2.json), [source-alpha2.json](source-alpha2.json).
- 두 버전 합집합 2,779키를 번역 대상으로 한다. 같은 키의 영어 원문이 바뀐 곳은 4개다.
- `chat.message.stepProcess.sharedPrefix`는 영어 값이 빈 문자열이다(중국어 접두어 "已" 전용). 한국어도 빈 문자열로 둔다.

## 네임스페이스 우선순위

기본 웹 앱 묶음에 포함된 네임스페이스부터 번역한다. `experimental` 패키지는 사용자가 따로 설치해야 보이므로 뒤로 미룬다.

| 묶음 | 네임스페이스(키 수, alpha.2 기준) |
| --- | --- |
| 1. 대화 핵심 | `conversation`(371), `chat`(190), `common`(41), `command`(28), `slash.menu`(9), `approval`(5), `question`(31), `plan`(17), `goal`(12), `model`(23), `feedback`(20), `reference`(11) |
| 2. 세션·사이드바 | `workspace`(116), `sidebar`(5), `sidebarRight`(34), `sidebarFiles`(17), `sidebarTerminal`(28), `sidebarBrowser`(26), `sidebarDocumentPreview`(22), `sidebarCodePreview`(3), `sidebarExcel`(15), `sidebarOffice`(15), `sidebarPdf`(15), `sidebarImage`(11), `documentHtml`(4), `documentMarkdown`(4), `directory-browser`(13), `deliverables`(60), `open-in-app`(45) |
| 3. 실행 기록·작업 | `trajectory`(192), `subagent`(41), `job`(40), `workflowRun`(18), `schedule.catalog`(70), `schedule.manager`(188), `skill`(8), `session-log-download`(10) |
| 4. 설정 | `settings`(34), `settings.locale`(1), `settings.theme`(25), `settings.account`(94), `settings.models`(113), `settings.agentPreset`(47), `settings.agentLoop`(12), `settings.subagent`(35), `settings.shell`(14), `settings.webSearch`(18), `settings.permission`(12), `permission.access`(17), `settings.sessionLog`(4), `settings.plugins`(5), `settings.pluginInventory`(40), `shortcuts`(56), `shortcuts.layout`(1) |
| 5. 플러그인·도구 | `pluginManager`(209), `cordis`(51) |
| 6. 실험 기능 | `voice-input`(109), `session-inspector`(52), `cotTranslation`(32), `agent-team`(25), `inspectorPanel`(5), `claude-code-mods`(4) |

## 번역 불가 목록 (초안)

| 대상 | 이유 | 규모 |
| --- | --- | --- |
| 데스크톱 네이티브 메뉴·대화상자 | `apps/desktop/src/locale.ts`의 앱 소유 사전. 플러그인 API로 등록할 수 없다 | 165키(en·zh 각각) |
| Host 쪽 문구 | 도구 설명, 오류·경고 메시지, 승인 사유 등은 Host가 문자열로 만들어 보낸다. 클라이언트 사전을 거치지 않는다 | 미집계 |
| 사전을 거치지 않는 클라이언트 문구 | 컴포넌트에 직접 쓴 문자열, 사용자 데이터(프리셋 이름·설명, 플러그인 README) | 미집계, 번역 중 발견하면 이 표에 추가 |
| 날짜·숫자 형식 | `schedule.catalog`·`schedule.manager`의 `time.locale` 키(`zh-CN`/`en`)는 번역문이 아니라 `Intl` 로케일 값이다. 한국어 사전에서는 `ko-KR`로 둔다 | 키 2개 |

## 용어집

빈도는 alpha.2 영어 원문에서 단어가 들어간 문구 수다. Studio 열은 Studio가 이미 쓰는 한국어다. Provider·Workspace·Trajectory는 사용자가 정했고, 나머지는 초안대로 쓴다.

| 영어 | 빈도 | 초안 | Studio 사용 | 메모 |
| --- | --- | --- | --- | --- |
| Plugin | 103 | 플러그인 | 플러그인 | |
| Session | 101 | 세션 | 세션 | |
| Model | 89 | 모델 | 모델 | |
| Tool | 57 | 도구 | 도구 | |
| Provider | 42 | 프로바이더 | 제공자(4) | 사용자 결정. Studio의 "제공자"도 맞춰 바꾼다(별도 작은 변경) |
| Agent | 38 | 에이전트 | 에이전트 | |
| Subagent | 38 | 서브에이전트 | 서브에이전트 | |
| Command | 38 | 명령 | — | 슬래시 명령. 터미널 명령도 "명령" |
| Workspace | 34 | 워크스페이스 | 작업 공간(1) | 사용자 결정. Studio의 "작업 공간"도 맞춰 바꾼다 |
| Terminal | 33 | 터미널 | — | |
| Turn | 28 | 턴 | 턴 | "{turn}번째 턴" |
| Plan | 26 | 계획 | — | Plan 모드는 "계획 모드" |
| Goal | 22 | 목표 | — | |
| Shortcut | 22 | 단축키 | — | |
| Permission | 18 | 권한 | — | |
| Preset | 16 | 프리셋 | 프리셋 | |
| Context | 14 | 컨텍스트 | — | |
| Token | 14 | 토큰 | — | |
| Job | 13 | 작업 | — | 백그라운드 작업 |
| Prompt | 12 | 프롬프트 | — | |
| Compaction | 11 | 압축 | — | "컨텍스트 압축" |
| Approval | 9 | 승인 | — | |
| Reasoning | 9 | 추론 | 추론 | |
| Skill | 8 | 스킬 | 스킬 | |
| Attachment | 7 | 첨부 파일 | — | |
| Sandbox | 6 | 샌드박스 | — | |
| Trajectory | 6 | Trajectory | — | 사용자 결정. 탭 이름 Trajectory·Chat은 영어 그대로 두고, 본문의 trajectory는 "Trajectory"로 쓴다 |
| Chat(탭) | — | Chat | — | 탭 이름만. 본문의 chat/conversation은 "대화" |
| Archive | 5 | 보관 | — | |
| Profile | 5 | 프로필 | — | |
| Workflow | 4 | 워크플로 | — | |
| Credential | 4 | 자격 증명 | 자격 증명 | |
| Fork | 3 | 포크 | — | 세션 포크 |
| Pin | 3 | 고정 | — | |

문체: 문장은 합쇼체(-습니다), 버튼·라벨·제목은 짧은 명사구. 제품·코드 이름(DeepSeek, DSH, MCP, Cron, PTC, UTC 등)과 `{name}` 자리 표시자는 그대로 둔다.
