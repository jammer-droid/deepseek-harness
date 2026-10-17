---
kind: implementation-spec
status: draft
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
- 단축키: Studio가 명령을 `ctx.shortcuts.register`로 등록한다. 키 편집·충돌 검사·기본값 복원은 DSH 단축키 설정이 그대로 맡는다. SettingsX 페이지는 Studio 명령 목록, 켜기/끄기, DSH 단축키 설정 열기를 제공한다.
- 세션 이동(이전/다음): session-cycle과 **같은 로직**. 사이드바 저장 상태 `dsh.workspace.view.v5`를 읽기만 하고 배포 버전의 정렬을 독립 구현한다. 알 수 없는 형식이면 차단한다.
- 프로바이더: Studio가 자체 LLM 어댑터(`ctx.llm.registerAdapter`)를 구현한다. 사용자가 SettingsX에서 프로바이더(이름, 경로 ID, 프로토콜, 주소, 인증, 헤더, 모델 목록)를 등록하면 그 경로가 DSH 모델 선택·Pixie·역할 모델에서 보인다. 오픈코드 등은 기본 템플릿으로 제공한다.

**제외**

- DSH 기본 단축키의 기본값 변경, DSH 단축키 설정 화면 교체
- `dsh-plugin-subscriptions`의 코드 재사용·의존. Studio 프로바이더는 독립적이다.
- 데스크톱 네이티브 메뉴 추가(공개 API 없음)

## 공개 API와 제약

| 필요 | 공개 API | 제약 |
| --- | --- | --- |
| 명령 등록 | Client `shortcuts.register` | Inspect 카탈로그에 없음. 패키지 README·타입(`@deepseek-ai/dsh-client-shortcuts`)과 session-cycle의 실사용으로 계약 확인 |
| 세션 열기·사이드바·오른쪽 패널 | `uiWorkspace.openSession`, `layout.toggleSidebar`, `layout.openRightbar` 등 | — |
| 사이드바 순서 | 없음 | `dsh.workspace.view.v5` 읽기는 **사용자가 승인한 비공개 의존**. DSH 업데이트 때 깨질 수 있다. 스키마를 검증하고 알 수 없으면 차단한다 |
| 전체화면 | 없음(데스크톱 메뉴에 보기·전체화면 역할 없음) | 브라우저 `document.documentElement.requestFullscreen()`로 시도. 데스크톱에서 동작 여부 미확인 → S1에서 실험 |
| 어댑터 등록 | Host `llm.registerAdapter`, `LlmAdapter`(`@deepseek-ai/dsh-llm`) | 모든 요청에 `attributionHeaders()` 포함 필수. 경로 이름이 다른 어댑터와 겹치면 로딩 실패 |
| 모델 목록 | `LlmAdapter.listModels` | GUI 선택은 목록에 있는 모델만 가능 |
| 비밀값 | Host `credentials` | 키는 설정 파일에 넣지 않는다(#27 Jev 키와 같은 방식) |

## 결정

- **D1 session-cycle 이관:** 사용자 결정 — 같은 로직(비공개 저장소 읽기)으로 옮긴다. Studio 명령 ID는 `studio.session-cycle.previous/next`. 기존 플러그인과 기본 키(Cmd+Shift+[ / ])가 겹치면 등록이 실패하므로, Studio는 같은 기본값을 쓰고 사용자가 기존 플러그인을 제거한 뒤 쓰는 것으로 안내한다. → 미결정: 기존 플러그인이 있을 때 기본값 없이 등록할지
- **D2 프로바이더 방식:** 사용자 결정 — Studio 자체 연결(어댑터 구현). SettingsX 하위에 둔다.
- **D3 지원 프로토콜:** 미결정. 추천: OpenAI Chat Completions(SSE)부터, 다음 Anthropic Messages. 인증은 API 키(Bearer·헤더)만. OAuth 로그인은 이후 단계
- **D4 기본 단축키 세트:** 미결정. 후보는 다른 하네스(Claude Code·Cursor·Codex 데스크톱 등)에서 흔한 명령 중 Studio가 공개 API로 실행할 수 있는 것만 고른다. S1에서 목록과 기본 키를 표로 확정한다.

## 단계

| ID | 결과 | 선행 | 수용 조건·검증 |
| --- | --- | --- | --- |
| S1 | 단축키 후보·기본 키 표와 전체화면 실험 결과, D1·D3·D4 확정 | — | 명세의 표, 데스크톱 rc.2에서 `requestFullscreen` 실험 기록 |
| S2 | SettingsX 화면 틀(서비스 항목, 하위 페이지, ko·en·zh 문구) | S1 | UI 스냅샷, 라이트·다크·좁은 폭 |
| S3 | 세션 이동 이관: `order` 로직 이식과 테스트, Studio 명령 등록 | S2 | session-cycle 테스트 이식 통과, 설치 런타임에서 키 동작 |
| S4 | 추가 단축키 명령과 SettingsX 단축키 페이지 | S3 | DSH 단축키 설정에 Studio 명령 표시·편집, 비활성화 시 제거 |
| S5 | 프로바이더 저장 계약(정의 파일, 검증, credentials 키) | S1 | 단위 테스트(잘못된 정의 거절, 키 비노출) |
| S6 | Studio LLM 어댑터(D3의 첫 프로토콜), 등록·해제 | S5 | 가짜 서버 스트림 테스트, `attributionHeaders` 포함 |
| S7 | 프로바이더 페이지(템플릿 포함) | S5, S6 | 등록 → 모델 선택·Pixie·역할 모델에 표시 |
| S8 | 독립 설치 검증과 가이드 | 모두 | 수정하지 않은 rc.2 + 패키징 Studio, 격리 프로필 |

현재 단계: S1. 미결정 D1·D3·D4가 남아 있어 `draft`.
