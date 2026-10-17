---
kind: implementation-spec
status: ready
---

# #28 SettingsX — 단축키 확장과 사용자 프로바이더 등록

## 요약

Studio에 DSH 기본 설정을 확장하는 **SettingsX** 영역을 만든다. 첫 두 기능은 키보드 단축키 확장과 사용자 프로바이더 등록이다. 둘 다 기존 DSH 설정(단축키 설정, 모델 선택)에 결과가 이어진다.

- GitHub 이슈: [#28](https://github.com/jammer-droid/deepseek-harness/issues/28)
- 기준 브랜치·시작 커밋: `studio/feat/workflow` @ `b288fc95fa`
- 대상 DSH: `0.2.0-rc.2`(설치된 데스크톱 런타임). 본체 수정 없음
- 관련: 별도 플러그인 `@local/dsh-session-cycle`(사용자 소유, `HarnessEngineeringLab/harnesses/dsh/plugins/dsh-session-cycle`), `dsh-plugin-subscriptions@0.9.9`(외부, 수정·의존하지 않음)

## 범위

**포함**

- SettingsX 화면: Studio 서비스 목록(`local.dsh-studio.services`)의 새 항목. 하위에 **단축키**, **프로바이더** 페이지를 둔다.
- 단축키: Studio는 DSH에 없는 명령만 `ctx.shortcuts.register`로 등록한다. 세션 이동 외 명령은 기본 키 없이 등록하고, 키 지정·충돌 검사·기본값 복원은 DSH 단축키 설정이 맡는다. SettingsX 페이지는 Studio 명령 목록, 참고 키(다른 하네스 기준), 켜기/끄기, DSH 단축키 설정 열기를 제공한다.
- 세션 이동(이전/다음): session-cycle과 **같은 로직**. 사이드바 저장 상태 `dsh.workspace.view.v5`를 읽기만 하고 배포 버전의 정렬을 독립 구현한다. 알 수 없는 형식이면 차단한다.
- 프로바이더: Studio는 **통로**만 만든다. 정의 파일 계약, 그 계약을 읽는 Studio LLM 어댑터(`ctx.llm.registerAdapter`), 지원 프로토콜, 자격 증명 공급 방식을 정한다. 사용자는 계약에 맞는 정의 파일과(필요하면) 토큰 공급 스크립트를 직접 만들거나 Studio가 제공하는 스킬로 만든다. 등록된 경로는 DSH 모델 선택·Pixie·역할 모델에서 보인다.
- 프로바이더 작성 스킬: 계약·예시(OAI 구독, 로컬 OpenAI 호환 서버)·검증 방법을 담은 에이전트 스킬. 기존 Pixie 훅 스킬과 같은 방식(`<DSH home>/skills` 설치)으로 배포한다.

**제외**

- DSH 기본 단축키의 기본값 변경, DSH 단축키 설정 화면 교체, DSH에 이미 있는 명령의 재등록
- 프로바이더별 로그인·OAuth GUI. Studio는 토큰을 발급하지 않고 공급받은 값만 쓴다.
- `dsh-plugin-subscriptions`의 코드 재사용·의존. Studio 프로바이더는 독립적이다.
- 모든 프로바이더의 내장 지원. 계약에 맞지 않는 프로토콜은 지원하지 않는다.
- 상대 서비스의 클라이언트 제한·한도를 피하는 우회(클라이언트 위장, 세션 ID 위조, 가짜 도구 주입, IP 돌려쓰기). Studio 코드·스킬·예시에 넣지 않는다. OpenCode 무료 등급은 이 이유로 제외한다(S1 조사 기록).
- 데스크톱 네이티브 메뉴 추가(공개 API 없음)

## 공개 API와 제약

| 필요 | 공개 API | 제약 |
| --- | --- | --- |
| 명령 등록 | Client `shortcuts.register` | Inspect 카탈로그에 없음. 패키지 README·타입(`@deepseek-ai/dsh-client-shortcuts`)과 session-cycle의 실사용으로 계약 확인. 프로필을 생략한 기본값은 키 없음 |
| 세션 열기·사이드바·오른쪽 패널 | `uiWorkspace.openSession`, `layout.toggleSidebar`, `layout.openRightbar` 등 | — |
| 사이드바 순서 | 없음 | `dsh.workspace.view.v5` 읽기는 **사용자가 승인한 비공개 의존**. DSH 업데이트 때 깨질 수 있다. 스키마를 검증하고 알 수 없으면 차단한다 |
| 전체화면 | 없음(DSH에는 패널 전체화면 `pane.fullscreen.toggle`만 있음) | 브라우저 `document.documentElement.requestFullscreen()`로 시도. 데스크톱 창 전체화면과 다를 수 있고, macOS가 ⌃⌘F를 먼저 가져갈 수 있다 → S1에서 실험 |
| 어댑터 등록 | Host `llm.registerAdapter`, `LlmAdapter`(`@deepseek-ai/dsh-llm`) | 모든 요청에 `attributionHeaders()` 포함 필수. 경로 이름이 다른 어댑터와 겹치면 로딩 실패 |
| 모델 목록 | `LlmAdapter.listModels` | GUI 선택은 목록에 있는 모델만 가능. 정의의 모델 목록은 필수 |
| 비밀값 | Host `credentials` | 정적 키는 설정 파일에 넣지 않는다(#27 Jev 키와 같은 방식) |
| 스킬 배포 | `<DSH home>/skills` 파일(skill-filesystem) | 기존 `skill-install.ts` 재사용. 사용자 수정 파일은 덮어쓰지 않음 |

## DSH 기본 단축키(rc.2 번들 확인)

Studio는 아래 명령을 다시 만들지 않는다. 키는 데스크톱 macOS 기본값.

| 영역 | 명령 |
| --- | --- |
| 세션 | 새 세션 ⌘N, 세션 검색 ⌘K, 이름 바꾸기 ⌘⌥G, 포크 ⌘⌥F, 보관 ⌘⇧A |
| 작업 공간 | 폴더 추가 ⌘O, 로컬 앱에서 열기 ⌘⌥O |
| 화면 | 왼쪽 사이드바 ⌘B, 오른쪽 패널 ⌘⌥B, 패널 분할 ⌘\, 패널 전체화면 ⌘⌥Enter, 닫기 ⌘W, 새로고침 ⌘R |
| 열기 | 설정 ⌘,, 단축키 ⌘/, 파일 ⌘P, 새 브라우저 탭 ⌘T, 새 터미널 ⌃` |
| 입력 | 응답 중지 Esc Esc |

## Studio 추가 명령 후보

출처: [Codex 앱 단축키](https://learn.chatgpt.com/docs/reference/commands.md), [Cursor 단축키](https://cursor.com/docs/reference/keyboard-shortcuts). Claude Code는 미확인. S1에서 API 확인 후 확정한다.

| 명령 | 기본 키 | 참고 키 | 구현 근거 |
| --- | --- | --- | --- |
| 이전/다음 세션 | ⌘⇧[ / ⌘⇧] (session-cycle 유지) | Codex ⌘⇧[ / ], Cursor ⌘[ / ] | session-cycle 로직 |
| 세션 1–9로 이동 | 없음 | Codex ⌘1–9 | 같은 사이드바 순서 |
| 창 전체화면 | 없음 | Codex ⌘⌃F | S1 실험 |
| ~~모델 선택 열기~~ | — | Codex ⌃⇧M | 제외: 공개 API 없음 |
| 작업 폴더 경로 복사 | 없음 | Codex ⌘⇧C | `sessions.list` 행의 `cwd` |
| ~~주의가 필요한 다음 세션~~ | — | Codex ⌘⌥A | 제외: 공개 API 없음 |
| SettingsX·Pixie 열기 | 없음 | — | Studio 자체 화면 |

고정·읽지 않음 표시, 글자 크기는 공개 API가 없을 가능성이 높아 제외 후보다.

## 프로바이더 계약(초안)

Studio가 소유하는 것은 계약과 그 계약의 실행이다. 계약은 **정의**(무엇에 어떻게 보낼지)와 **자격 증명 공급**(무엇으로 인증할지)으로 나뉜다.

- **정의 파일:** Studio 데이터 디렉터리의 프로바이더 폴더에 경로당 파일 하나. 필드는 경로 ID, 표시 이름, 프로토콜, 기본 주소, 추가 헤더, 모델 목록(ID·이름·컨텍스트·출력 한도·입력 형식), 자격 증명 공급 방식. 비밀값은 넣지 않는다.
- **프로토콜:** 계약이 열거하는 값만 받는다. 첫 값은 `openai-responses`(OAI 구독, S6), 다음 `openai-chat`(OpenAI 호환 서버·API, S9).
- **자격 증명 공급:** D5 — 첫 구현은 `none`. 이후 `credential`(DSH credentials에 저장한 키), `command`(사용자 명령이 표준 출력으로 `{ token, expiresAt?, headers? }` JSON을 반환; Studio는 만료까지 캐시하고 만료·401 때 다시 실행). OAuth 발급·갱신은 사용자 명령이 맡는다.
- **검증:** 알 수 없는 프로토콜·필드, 빈 모델 목록, 다른 어댑터와 겹치는 경로 ID는 등록 전에 거절하고 SettingsX에 이유를 표시한다. 토큰과 키는 로그·UI·오류 메시지에 노출하지 않는다.
- **약관:** 구독·무료 경로의 이용 약관 위험은 사용자가 감수한다. SettingsX와 스킬에 안내한다.

## S1 조사 기록 (2026-10-17)

- **후보 명령 API(Client Inspect):** 세션 1–9 이동·이전/다음은 `uiWorkspace.openSession`과 사이드바 순서로 가능. 작업 폴더 경로 복사는 `sessions.list` 행의 `cwd`로 가능. 모델 선택 열기·주의가 필요한 다음 세션은 공개 서비스에 대응 메서드가 없어 제외. 창 전체화면은 미실험(데스크톱 수동 확인 필요).
- **session-cycle 웹 동작(rc.2 웹, 격리 홈에 `@local/dsh-session-cycle` 0.1.0 링크 설치):** 웹에는 기본 키가 없어(데스크톱 macOS만 지정) 사용자가 DSH 단축키 설정에서 키를 지정했고, 사이드바 순서대로 이전/다음 세션 이동이 동작함을 사용자가 확인했다. Studio 이관(S3)의 기준 동작으로 쓴다. Chrome은 ⌘⇧[ / ]를 탭 전환에 먼저 쓸 수 있어 웹 기본 키로는 부적합하다.
- **OAI 구독 경로:** pi-ai `openai-codex-responses` 기준 `https://chatgpt.com/backend-api/codex/responses`, `Authorization: Bearer <token>`, `chatgpt-account-id`, `OpenAI-Beta: responses=experimental`, `store: false`, SSE. 토큰 발급은 사용자 몫(S11).
- **OpenCode 무료 모델:** `GET https://opencode.ai/zen/v1/models`는 키 없이 200. 그러나 키 없는 `POST /zen/v1/chat/completions`는 403 `FreeTierError`("OpenCode 안에서만 사용 가능"). 즉 직접 HTTP로 `none` 호출은 불가하다. 요청 헤더·본문을 OpenCode처럼 꾸미는 위장은 하지 않는다. API 키(`credential`)로 무료 모델을 호출할 수 있는지는 미확인.
- **opencode2dsh 방식([FishBottle7/opencode2dsh](https://github.com/FishBottle7/opencode2dsh) 0.3.12 소스):** 무료 등급 판정을 OpenCode 클라이언트 위장으로 통과한다. `ses_` 세션 ID를 OpenCode 생성기 그대로 만들어 헤더에 넣고, `stream: true`, 호출 금지 가짜 `bash`·`read` 도구와 `tool_choice: 'none'`을 주입한다. OpenCode의 판정 강화 때마다 우회를 갱신해 왔고, IP 풀로 IP별 한도를 피한다. 제외 범위에 따라 채택하지 않는다.
- **OpenCode 클라이언트 경유(격리 XDG 디렉터리, 자격 증명 0개):**
  - 설치된 OpenCode 1.1.8 `opencode run`: 403 `FreeTierError`(구버전 거절).
  - 최신 `opencode-ai@1.19.3` `opencode run -m opencode/big-pickle`: 키 없이 `PONG` 응답.
  - 1.19.3 `opencode serve`(로컬 HTTP API) `POST /session/{id}/message`: 기본 요청·`system` 지정은 성공, `tools: {"*": false}`로 도구를 끄면 403. 무료 등급 판정이 OpenCode의 실제 에이전트 요청 형태에 묶여 있다.
  - 결론: 실제 OpenCode를 실행해 그 서버에 위임하면 사용은 가능하다. 다만 이 경로의 입출력은 DSH 메시지·도구 호출이 아니라 **OpenCode 세션**(OpenCode 자체 시스템 프롬프트·도구·작업 폴더 접근)이다. DSH 어댑터 계약(`messages`·`tools` → 스트림 청크)과 맞지 않아 DSH 모델 경로로 쓰면 DSH 도구 호출이 동작하지 않고, OpenCode 도구가 사용자 파일에 접근한다. 무료 등급은 "OpenCode 안에서만" 조건이다.

## 결정

- **D1 session-cycle 이관:** 확정 — 같은 로직(비공개 저장소 읽기)으로 옮긴다. 명령 ID는 `studio.session-cycle.previous/next`, 기본 키 ⌘⇧[ / ⌘⇧]를 유지한다. 기존 플러그인과 키가 겹치면 등록이 실패하므로, 사용자가 기존 플러그인을 제거한 뒤 쓰도록 안내한다.
- **D2 프로바이더 방식:** 확정 — Studio 자체 어댑터. SettingsX 하위에 둔다. 프로바이더별 인증 GUI는 만들지 않고, 계약에 맞는 데이터를 받으면 모델로 표시한다.
- **D3 지원 프로토콜:** 확정 — 첫 대상은 OAI 구독(`openai-responses`), 다음 OpenAI 호환(`openai-chat`). OpenCode 무료 등급은 제외(우회 필요).
- **D4 단축키 세트:** 확정 원칙 — DSH에 있는 명령은 DSH를 따르고, 없는 명령만 추가한다. 세션 이동 외에는 기본 키 없이 등록한다. 명령 목록은 S1에서 위 후보 표로 확정한다.
- **D5 자격 증명 공급:** 확정 — 계약은 `none`·`credential`·`command` 세 방식을 열거하되, 첫 구현은 `none`만 받는다(S5). 다른 값은 "아직 지원하지 않음"으로 거절한다. `credential`·`command`는 S11에서 추가한다. `command`가 구독 토큰 갱신을 사용자 스크립트에 맡기는 통로다. 따라서 OAI 구독의 실제 사용은 S11 이후이고, S6의 `openai-responses`는 가짜 서버로 검증한다. `none` 단계(S5·S6·S9)는 가짜 서버로만 검증하고, 실제 응답 확인은 S11에서 한다. 로컬 서버(Ollama·LM Studio)는 이 Mac에 없어 선택 사항으로 둔다.
- **D6 작성 지원:** 확정 — Studio는 계약·예시·검증 절차를 담은 프로바이더 작성 스킬을 제공한다.

## 단계

| ID | 결과 | 선행 | 수용 조건·검증 |
| --- | --- | --- | --- |
| S1 | 추가 명령 표와 전체화면 실험 결과, OAI 구독 경로 사실 확인 | — | 명세의 표, 데스크톱 rc.2에서 `requestFullscreen`·⌃⌘F 전달 실험 기록, Codex 백엔드 요청 형식 기록 |
| S2 | SettingsX 화면 틀(서비스 항목, 하위 페이지, ko·en·zh 문구) | S1 | UI 스냅샷, 라이트·다크·좁은 폭 |
| S3 | 세션 이동 이관: `order` 로직 이식과 테스트, Studio 명령 등록 | S2 | session-cycle 테스트 이식 통과, 설치 런타임에서 키 동작 |
| S4 | 추가 단축키 명령(기본 키 없음)과 SettingsX 단축키 페이지 | S3 | DSH 단축키 설정에 Studio 명령 표시·편집, 비활성화 시 제거 |
| S5 | 프로바이더 계약(정의 파일, 검증, 자격 증명 `none`) | S1 | 단위 테스트(잘못된 정의 거절, 미지원 공급 방식 거절) |
| S6 | Studio LLM 어댑터와 `openai-responses`, 등록·해제 | S5 | 가짜 서버 스트림 테스트, `attributionHeaders` 포함 |
| S7 | 프로바이더 페이지(등록 목록, 검증 결과, 다시 읽기) | S5, S6 | 등록 → 모델 선택·Pixie·역할 모델에 표시 |
| S8 | 독립 설치 검증과 가이드 | 모두 | 수정하지 않은 rc.2 + 패키징 Studio, 격리 프로필 |
| S9 | `openai-chat` 프로토콜과 로컬 서버 예시 | S6 | 가짜 서버 스트림 테스트, 예시 정의 검증 통과 |
| S10 | 프로바이더 작성 스킬(계약, 로컬 서버 예시, 검증 절차; OAI 예시는 S11 뒤 추가) | S5 | 스킬 설치 테스트, 예시 정의가 S5 검증 통과 |
| S11 | 자격 증명 `credential`·`command`와 OAI 구독 예시 | S6 | 단위 테스트(키·토큰 비노출, `command` 캐시·만료·401 재실행), 실제 프로바이더 응답 확인 |

현재 단계: S1 진행 중. 남은 일: 창 전체화면 데스크톱 실험(수동). 이 실험은 S4 명령 목록에만 영향을 주므로 S2·S5는 시작할 수 있다.
