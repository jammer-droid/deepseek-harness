---
kind: implementation-spec
status: closed-with-limitations
---

# #25 Pixie — 주요 컨텍스트와 분리된 보조 모델

## 요약

Pixie는 사용자와 세션 에이전트·서브에이전트(이하 **주요 컨텍스트**)를 오염시키지 않고 별도 모델을 호출하는 Studio 기능이다. MVP는 **따로 묻기(side)**다. 사용자는 `/pixie` 슬래시 커맨드나 Trajectory 오른쪽 Pixie 탭에서 Studio에 설정한 Pixie 모델에 요청한다. 대화형 엔진과 판정형 엔진을 분리해, 이후 Jev 같은 System One 모델을 같은 판정 인터페이스로 연결한다.

- GitHub 이슈: [jammer-droid/deepseek-harness#25](https://github.com/jammer-droid/deepseek-harness/issues/25)
- 기준 브랜치·시작 커밋: `studio/feat/workflow` @ `34f807452c`
- 대상 DSH: Studio peer 범위 `0.2.0-rc.2 || 0.2.1-alpha.2`. 사용할 공개 API의 버전별 존재 여부는 S1에서 확인한다.
- 본체 수정: 없음. 공개 Service·Event·Slot만 사용한다.

## 현재 진행 상황

**마무리됨(제한 사항 포함).** 사용자가 기능을 확인하고 이슈 마무리를 승인했다. 사용자 앱 배포는 후속 작업 이후로 미뤘다. 아래 미검증 항목은 통과로 바꾸지 않고 제한으로 남긴다.

| 범위 | 상태 | 근거·남은 확인 |
|---|---|---|
| S1–S5 MVP | 구현 완료 | 최초 구현 `6392f1988d`, 첫 사용자 피드백 `60010a373e` |
| 완료 후에도 답변 중으로 남는 문제 | 수정 완료 | 시작 이벤트 누락 회귀 테스트에서 수정 전 실패·수정 후 통과 |
| 중간 구독·재연결 복구 | 구현 완료 | Host 프레임 재전송, Client 중복 텍스트 방지·오프라인 완료 복구 테스트 통과 (`69ec47336a`) |
| 개별 응답 토큰·컨텍스트 표시 | 제거 완료 | UI 통일 후속에서 세션 누적·컨텍스트 한도 표시까지 제거. 내부 집계는 유지 |
| UI 통일·스레드 관리형 탭 (2–4차 사용자 피드백) | 구현·로컬 검증 완료 | 아래 [UI 통일 후속](#ui-통일-후속) |
| 판정(S5) 실제 모델 확인 | 사용자 확인 | 사용자가 판정 탭에서 실제 모델로 동작을 확인했다(입력·결과 값은 수집하지 않음) |
| S6 독립 설치 검증 | 부분 완료 | rc.2 격리 프로필에서 확인. **alpha.2 미검증**(제한) |
| 사용자 앱 배포 | 보류 | 사용자 결정으로 후속 작업 이후 진행 |

## 완료 기록

- 사용자 승인: 기능 확인 후 "이번 이슈는 기능은 다 확인해서 우선 마무리 처리해줘 (배포는 후속 작업 이후에 진행할 예정)".
- 최종 검증: Studio 타입 검사·빌드·전체 테스트 179개 통과, `git diff --check` 통과. 설치 DSH `0.2.0-rc.2` 격리 프로필에서 headless Chrome으로 설정·탭 화면을 라이트·다크·넓은/좁은 폭으로 확인했다.
- 남은 제한: `0.2.1-alpha.2` 설치 검증 없음, 최신 변경의 사용자 앱 배포·사용자 시각 확인 없음, 요청·판정 타임아웃 없음(취소는 동작), 판정 시험은 내부 JSON 형식 직접 입력.
- 후속으로 넘긴 작업: 판정 전용 모델·시스템 프롬프트 분리, `pixie-gate`(판정 훅) 연결, 사용량 시각 표현, 기존 스레드 모델 변경 UI, 설정의 `이어받기` 문구를 `세션 대화 복사`로 맞출지 결정, 사용자 앱 배포. 범위 밖 목록은 [범위 밖 (후속 이슈)](#범위-밖-후속-이슈) 참조.
- 브랜치 병합·푸시·배포는 이 마무리에서 수행하지 않았다.

### UI 통일 후속

사용자 피드백(서비스 간 디자인 이질감, 단순 사이드 채팅 위주 UX, 텍스트로 덧붙인 사용량)에 따라 다음을 바꿨다. 규칙은 [디자인 시스템](../development/design-system.md#서비스-간-일관성)에 기록했다.

- Studio 서비스 메뉴에서 `DSH Studio` 제목과 `에이전트 프리셋 편집기` 부제를 없앴다(`DetailLayout`에서 `title`·`subtitle` 제거).
- Pixie 설정은 프리셋과 같은 `DetailLayout` 틀(왼쪽 메뉴 + 하단 버전 + 960px 본문)을 쓴다. 페이지는 설정 › 모델 / 스레드 / 시스템 프롬프트이며 페이지마다 `PageHead`와 저장 버튼을 둔다. 별도 `StudioSurface`·여백은 제거했다.
- Pixie 탭은 `스레드 / 판정` 탭으로 바꾸고, 스레드 탭은 **전체 스레드 카드 목록 + 열린 스레드 상세** 구성이다. 카드에는 제목과 `/pixie` 대상 핀, 답변 중·실패 `Badge`, 마지막 질문 미리보기, 모델·시작 방식·질문 수를 둔다. 스레드를 여는 것은 보기만 바꾸며 `/pixie` 대상 변경은 상세 제목 옆 핀으로 한다. 상세의 질문은 열린 스레드로 보낸다. 탭 폭 560px 이하에서는 목록과 상세를 하나씩 보인다.
- 컨텍스트 크기/한도, 세션 누적 요청·입출력 토큰 표시를 Pixie 탭에서 제거했다. Host는 여전히 사용량을 집계·저장하며(`view.total`, `contextWindow`) 화면 표현은 후속으로 미룬다.
- 향후 `pixie-gate`([런타임 개입 지점 조사](../research/dsh-runtime-control-points.md))로 하네스 흐름 제어에 쓰일 때 판정 실행도 같은 카드 목록에 상태 `Badge`로 붙이는 것을 전제로 한다. 게이트 자체는 구현하지 않았다.
- 3차 피드백: 설정 저장에 프리셋 저장과 같은 피드백을 붙였다(변경 없으면 `저장됨` 비활성, 변경 시 `저장` 활성, `저장 중…`, 성공 시 `저장됨`으로 복귀, 실패 시 편집 유지 `Notice`. 미저장·저장 완료 안내 줄은 사용자 요청으로 제거해 버튼 상태로만 보인다). `/pixie 대상으로` 버튼은 삭제 버튼 옆에서 스레드 제목 아래 모델 줄 오른쪽으로 옮겼다. 판정 탭은 사용자가 실제 모델로 동작을 확인했다. 판정 전용 모델·시스템 프롬프트 분리는 후속으로 둔다.
- 4차 피드백: `/pixie` 대상 지정을 스레드 제목 오른쪽 핀 아이콘으로 바꿨다(상세: 누를 수 있는 토글, 채워진 핀 = 현재 대상 / 목록 카드: 대상에만 채워진 핀). `/pixie 대상` 텍스트 배지는 없앴다. 대상과 헷갈리던 `이어받음` 배지는 메타 줄의 `빈 상태로 시작` / `세션 대화 복사` 텍스트로 바꿔, 배지는 답변 중·실패 같은 실행 상태에만 쓴다.
- 검증: Studio 타입 검사·빌드·전체 테스트 **179개 통과**(4차 피드백 반영 후). 설치 DSH `0.2.0-rc.2` 격리 프로필(`node studio/dev.mjs --skip-test --port 19391`)에서 headless Chrome으로 프리셋·Pixie 설정 화면, Pixie 탭의 넓은 폭(목록+상세)과 좁은 폭(목록/상세 전환)을 라이트·다크 모드로 확인했다. 사용자 앱 배포와 사용자 시각 확인은 하지 않았다.

### 이번에 제외한 작업

- 기존 스레드의 모델 변경 UI: 현재 선택은 `+`의 **새 스레드 생성 시에만** 가능하다. 설정의 허용 토글이 기존 스레드 변경 UI를 제공하지는 않는다.
- 메인과 동일한 채팅 컴포넌트·입력창 배치: 조사만 했다. 서브에이전트는 실제 DSH 세션을 `SessionProvider`와 `conversation.content` embedded Factory에 연결한다. 현재 Pixie의 별도 저장소·전송 함수를 그대로 주입할 공개 계약은 확인하지 못했으며, 재사용 구현이나 본체 수정은 하지 않았다.
- Pixie↔메인 에이전트 자동 대화: 미구현·MVP 밖이다. fork는 생성 시 텍스트를 한 번 복사할 뿐이며 Pixie 응답 카드 표시가 주요 모델 컨텍스트 전달을 의미하지 않는다.

## 구현·검증 이력 (S1–S5 구현, S6 부분 검증)

- 진행: S1·S2·S3·S4·S5 구현 완료. S6은 수정하지 않은 설치 DSH `0.2.0-rc.2`의 격리 프로필(`studio/.dsh-home`, `npm --prefix studio run dev -- --skip-test --port 19391`)에서 확인했다. `0.2.1-alpha.2` 설치 검증은 하지 않았다.
- S1 확인 결과(rc.2 설치본): `commands.register`, `sessionController.inspect/list/modelCatalog`, `llm.resolveModelInfo`, Client `sidebarRightTabs`·`sidebarRight.openTab`이 있다. `/pixie`는 커맨드 목록에 나타나고, 실행 뒤 세션 로그에는 `command/run`·`command/done`만 남았다(`user/message`·`assistant/message` 없음). Pixie 기록은 `<profile>/studio-data/pixie/<sessionId>.json`에 생겼다.
- 런타임 제약: DSH는 패키지당 Remote contribution을 하나만 받는다. 두 번째 `$mount`는 Client 활성화를 실패시키므로 Pixie 서술자는 셸의 한 번의 `$mount`에 합친다(`lean-shell` 테스트가 회귀를 막는다).
- 최초 MVP 검증 당시: Studio 타입 검사·빌드·전체 테스트 통과. 브라우저(headless Chrome)로 Studio → Pixie 설정, `/pixie` 커맨드 실행, 오른쪽 Pixie 탭(대화·판정)을 라이트·다크·좁은 폭에서 확인했다. 격리 프로필에 모델 API 키가 없어 **실제 모델 답변 스트리밍은 확인하지 못했다**. 키 없음 오류가 실패 턴으로 기록·표시되는 것까지 확인했다. 사용자의 시각 확인은 별도다.

### 후속 수정 (사용자 피드백)

- 두 번째 요청부터 `Cannot read properties of undefined (reading 'replayState')`가 나던 문제: 이전 답변을 `source` 없는 assistant 메시지로 보내 어댑터의 replay 검사가 실패했다. 이제 이전 답변은 답한 모델의 `{ kind: 'model', provider, model }` source를 가진 완전한 메시지로 보낸다. 격리 프로필에서 실제 모델로 2턴 대화(기억한 숫자 되묻기)가 정상 동작함을 확인했다.
- 메인 대화창의 `/pixie` 행이 완료 뒤에도 "답변 중"으로 남는 문제를 수정했다. 커맨드 성공 뒤 구독하면 이미 발생한 `start`를 놓칠 수 있는데, 기존에는 해당 시작을 받은 행만 `end`에서 저장된 답변을 다시 읽었다. 이제 종료 프레임을 받으면 자기 command id로 기록을 재조회한다. 시작 이벤트를 놓친 실제 React 행의 회귀 테스트는 수정 전 실패·수정 후 통과했고, Pixie UI 테스트 11개 및 Studio 타입 검사·빌드를 통과했다. 후속으로 `follow`가 구독 시 `sync`와 진행 중 요청의 기존 프레임을 재전송하도록 했다. Client는 재연결 시 이전 live 텍스트를 초기화하고 저장 상태를 다시 읽으므로, 중간 접속·재연결에서 텍스트 중복을 막고 연결이 끊긴 동안의 완료를 복구한다. Host 재전송과 Client 재연결 회귀 테스트를 포함한 Studio 전체 테스트 178개 및 타입 검사·빌드가 통과했다. 격리 서버(19391)에서 브라우저 로딩은 확인했으나 기존 세션의 `session/writer-held` 오류와 새 세션 커맨드 자동화 미완료로 실제 모델 요청의 종단간 검증은 통과하지 못했다. 사용자 프로필에는 배포하지 않았으며 검증 서버는 종료했다.
- 사용자 요청으로 메인 `/pixie` 응답 카드·패널 개별 답변의 토큰 사용량과 응답 카드·입력창의 컨텍스트 제외 문구를 숨겼다. 내부 사용량 집계, 세션 누적 표시, 컨텍스트 한도, 오류·취소·잘림 표시는 유지한다. Pixie UI 테스트 12개와 타입 검사·빌드 통과. 이번 문구 제거의 배포 브라우저 시각 확인은 하지 않았다.
- 스레드 삭제를 추가했다. 답변 중인 스레드는 지울 수 없고, 지우면 남은 마지막 스레드가 활성이 된다.
- `/pixie`의 답변을 대화창 행에도 보여 준다(G1 확장). 답변은 Pixie 기록에서 커맨드 id로 찾아 표시하며 세션 로그와 모델 컨텍스트에는 여전히 들어가지 않는다. 이 변경 전 기록에는 커맨드 id가 없어 "답변은 Pixie 탭에 있습니다"로 표시한다.
- 설정 화면을 DSH 설정처럼 카드 하나와 행(왼쪽 설명, 오른쪽 컨트롤)으로 바꿨다. 모드는 분할 선택, 스레드별 모델은 스위치다. Pixie 탭의 스레드 목록은 작은 선택 상자와 새 스레드·삭제 아이콘으로, 입력 영역은 DSH 입력창 형태로 줄였다.

### 명세와 달라진 점

- fork 스냅샷은 `sessionController.page()` 대신 `inspect()`의 이벤트를 쓴다. `page()`는 화면용 레코드 묶음이라 surface 교체(compaction) 재생에 필요한 `surfaceOp`를 그대로 쓰기 어렵다. 둘 다 Agent를 활성화하지 않는다.
- 세션 삭제 추적(G2)은 `api-session/removed`를 쓰지 않는다. 이 이벤트는 실행 중인 세션이 레지스트리에서 빠질 때(`session/disposed`)도 발생해 삭제와 구분할 수 없다. 대신 `sessionController.list()`(보관 세션 포함)에 없는 세션의 기록을 시작 시와 10분마다 지운다. 목록 조회가 실패하면 아무것도 지우지 않는다.
- 대화형 엔진은 별도 `ConverseEngine` 클래스 대신 `PixieRuntime`이 `llm.stream`을 직접 호출한다. 판정형은 `JudgeEngine` 포트와 `LlmJudgeEngine`으로 분리했다. Jev 엔진은 같은 포트를 구현하면 된다.
- 탭 kind는 다른 플러그인과 겹치지 않도록 `studio-pixie`다. `/pixie` 행은 질문·답변·"Pixie 열기" 버튼을 보여 주며, 커맨드 실행만으로 탭을 자동으로 열지는 않는다(커맨드 핸들러는 Host에서 실행되어 Client 탭을 직접 열 수 없다).
- 파일 배치는 `src/pixie-*.ts(x)`, `src/host/pixie-*.ts` 평면 구조다(테스트·tsconfig include 규칙에 맞춤).

### 남은 제한 (후속)

- 아직 보내지 않은 스레드의 컨텍스트 크기 추정(`tokenMeter.estimateMessage`)은 없다. 컨텍스트 표시는 마지막 요청의 usage 기준이며, 첫 요청 전에는 "—"다.
- 요청·판정 타임아웃이 없다. 취소(회수)는 동작한다.
- 판정 JSON은 프롬프트로 요구하고 결과를 엄격히 검증한다. 제공자 구조화 출력 옵션은 쓰지 않는다.
- 저장 결과는 화면 안 상태 문구로 알린다. 디자인 시스템의 `Toast`는 셸 전용 브랜치에 띄울 호스트가 없다.
- 판정 시험 화면은 내부 형식(질문 JSON)을 직접 입력받는다.

## 용어

- **주요 컨텍스트**: 세션 로그에서 모델 요청 표면을 이루는 메시지 이벤트(`user/message`, `assistant/message`, `tool/result` 등)와 그것을 소비하는 에이전트·서브에이전트.
- **Pixie 스레드**: 한 세션에 속한 Pixie 대화 단위. 세션당 여러 개를 두며 그중 하나가 활성이다.
- **fresh / fork**: 스레드를 시작하는 방식. fork는 스레드를 만들 때 주요 컨텍스트를 한 번 스냅샷한다.
- **대화형 엔진(Converse)**: 메시지를 받아 텍스트를 스트리밍한다.
- **판정형 엔진(Judge)**: `state`와 질문 ID별 `questions`를 받아 Jev 형식의 `answers`를 반환한다.

## 확정된 결정

| ID | 결정 |
|---|---|
| D1 | 따로 묻기(`/pixie`, Pixie 탭)는 전역에서 사용할 수 있다. 에이전트에 개입하는 Pixie 도구(relay 도구·판정 훅)는 **프리셋 단위**로 활성화한다(MVP 밖). |
| D2 | MVP 범위는 **따로 묻기**다. 전달(translate-in)과 답변 다듬기(relay-out)는 후속 이슈로 분리한다. |
| D3 | 스레드 컨텍스트 모드는 fresh/fork 중에서 선택한다. Studio 설정에 기본값을 둔다. |
| E1 | 정리 = 새 스레드 시작(기존 기록은 보존). 회수 = 진행 중인 요청 취소. |
| E2 | 세션당 여러 스레드를 두며 하나가 활성이다. `/pixie`는 활성 스레드에 이어서 요청한다. |
| E3 | 기록은 Studio가 관리하는 별도 저장소(sessionId별 파일)에 둔다. 세션 로그에는 Pixie 본문을 쓰지 않는다. |
| E4 | fork는 스레드를 만들 때 **한 번만 스냅샷**한다. 최신 내용이 필요하면 새 스레드를 다시 fork한다. |
| E5 | `/pixie` 답변은 Pixie 탭과 대화창 커맨드 행에 표시·스트리밍한다. 본문은 Pixie 기록에서 읽으며 세션 로그·주요 모델 컨텍스트에는 넣지 않는다(사용자 피드백으로 원안 확장). |
| E6 | fork 스냅샷에는 사용자와 어시스턴트의 **텍스트만** 담는다. 도구 호출·결과, 추론, 시스템 프롬프트는 제외한다. |
| E7 | Studio의 Pixie 설정(프리셋과 별도): 기본 provider/model, 추론 강도, 최대 토큰, 기본 컨텍스트 모드, Pixie 시스템 프롬프트, 스레드별 모델 변경 허용. |
| E8 | 사용량 표시: 마지막 요청 usage 기준의 컨텍스트 크기와 모델 컨텍스트 한도, 세션별 Pixie 누적 사용량. 요청별 토큰은 내부에 보존한다. 화면 표시는 UI 통일 후속에서 모두 제외했으며 의미 있는 표현이 정해지면 다시 다룬다. 비용 추정은 표시하지 않는다. |
| D9 | 엔진은 Converse와 Judge로 나눈다. LLM이 Judge를 구현하더라도 출력은 Jev 형식(Choice/Score/Noul)과 같다. |
| F1 | 판정형은 MVP에서 인터페이스와 `LlmJudgeEngine`, 그리고 Pixie 탭의 수동 시험 화면까지 만든다. 에이전트 훅에는 연결하지 않는다. |
| F2 | fork 대상은 MVP에서 현재 루트 세션만이다. 구조는 sessionId 기준이므로 나중에 서브에이전트 세션으로 넓힐 수 있다. |

## 공개 API 근거 (실행 중인 Host/Client Inspect로 확인)

| 필요 | API | 비고 |
|---|---|---|
| 세션 밖 모델 호출 | `ctx.llm.stream(GenerateOptions)` | [auto-review](../../../packages/experimental/auto-review/src/index.ts)가 같은 방식으로 세션 로그 없이 리뷰 모델을 호출한다. `usage` 청크로 토큰을 받는다. |
| 모델 목록 | `sessionController.modelCatalog()` | 기존 `studioCatalog.roleModels()`가 사용 중이다. |
| 모델 한도·기능 | `llm.resolveModelInfo(provider, model)` | 컨텍스트 한도와 추론 강도 지원 여부를 확인한다. |
| fork 스냅샷 | `sessionController.page()` | 콜드 상태에서도 안전하게 읽으며 Agent를 활성화하지 않는다. |
| `/pixie` | `commands.register({ name: 'pixie', input, handler })` | 로그에는 `command/run`과 `command/done`만 남는다. 둘은 메시지 이벤트가 아니므로 모델 요청 표면에 들어가지 않는다(S1에서 검증). |
| 탭 | Client `sidebarRightTabs.register({ kind: 'pixie' })`, `sidebar.right.pane.tab` keyed slot, `sidebarRight.openTab` | [ui-plan](../../../packages/client/ui-plan/src/client/index.ts)이 같은 방식으로 탭을 등록한다. |
| Host↔Client | `TypertRemoteService`의 `@Remote`와 `@Remote({ mode: 'stream' })` | 기존 `studioCatalog`와 같은 방식이다. |
| 토큰 추정 | `tokenMeter.estimateMessage(message)` | 아직 보내지 않은 스레드의 크기를 추정한다. `measure()`는 Session 전용이라 쓰지 않는다. |

## 구조

```
studio/src/pixie/
  contracts.ts          # PixieThread·PixieTurn·Usage·Settings, ConverseEngine/JudgeEngine 포트, Jev 질문·답 타입
  engines/llm-converse.ts
  engines/llm-judge.ts  # JSON 출력 강제, Jev 스키마 검증, 실패를 정상 판정으로 바꾸지 않음
  host/pixie-service.ts # TypertRemoteService 'pixie'
  host/pixie-store.ts   # <studio store dir>/pixie/<sessionId>.json
  host/pixie-command.ts # /pixie 등록
  host/fork-snapshot.ts # page() → 텍스트 메시지
  client/pixie-tab.tsx  # 스레드 카드 목록·열린 스레드 대화·입력·취소·판정 시험
  client/pixie-settings.tsx # Studio 서비스 화면
```

```ts
interface ConverseEngine {
  readonly kind: 'converse'
  converse(req: { system?: string; messages: PixieMessage[]; signal: AbortSignal }): AsyncIterable<PixieChunk>
}
interface JudgeEngine {
  readonly kind: 'judge'
  judge(req: { state: unknown; questions: Record<string, JudgeQuestion>; signal: AbortSignal }): Promise<JudgeResult>
}
type JudgeQuestion =
  | { type: 'choice'; options: Record<string, string> }
  | { type: 'score'; levels: string[] }          // 2–10
  | { type: 'noul'; question: string; criteria?: { true?: string; false?: string } }
type JudgeAnswer =
  | { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: 'score'; score: number; probabilities: number[]; confidence: number }
  | { type: 'noul'; noul: number }
type JudgeResult = { ok: true; answers: Record<string, JudgeAnswer> } | { ok: false; error: string }
```

Remote `pixie` 서비스 메서드(초안): `settings()`, `saveSettings()`, `models()`, `threads(sessionId)`, `createThread(sessionId, { mode, model? })`, `activate(sessionId, threadId)`, `ask(sessionId, threadId, text)`(stream), `cancel(requestId)`, `usage(sessionId)`, `judge(request)`.

## 불변 조건

- Pixie는 세션 로그에 메시지 이벤트를 쓰지 않는다. `/pixie`도 `command/*` 이벤트만 남긴다.
- fork는 읽기 전용이며 Agent를 활성화하거나 재개하지 않는다.
- 회수(취소) 뒤에 늦게 도착한 청크는 기록하지 않는다. 취소된 턴은 `cancelled`로 저장한다.
- 엔진 오류, 잘못된 판정 출력, 타임아웃은 오류로 표시한다. 기본값이나 낮은 점수로 바꾸지 않는다.
- Pixie 사용량은 DSH 세션 사용량과 섞지 않는다. 화면에 표시할 때는 별도 항목으로 표시한다.
- 모델 자격 증명은 DSH llm 라우팅을 그대로 쓴다. Studio는 키를 저장하지 않는다(Jev는 후속 이슈에서 `credentials` 서비스로 처리).

## 구현 단계

### S1 — 공개 API 계약 검증 (첫 단계)

- 선행: 없음.
- 책임: 대상 DSH 버전에 `commands.register`, Client `sidebarRightTabs`·`sidebarRight`, `llm.stream`의 usage 청크, `page()` 레코드 형식, `resolveModelInfo`의 컨텍스트 한도가 있는지 확인한다.
- 수용: `/pixie` 실행 뒤 다음 에이전트 요청 표면에 Pixie 텍스트가 들어가지 않음을 확인한다. Studio의 client inject에 오른쪽 사이드바 서비스를 추가해도 로딩되는지 확인한다.
- 검증: 격리 runtime 계약 테스트와 Inspect 결과 기록. 버전 간 차이는 제약으로 남긴다.

### S2 — 계약·저장소·LLM 엔진

- 선행: S1.
- 책임: `contracts.ts`, `pixie-store`(스레드·턴·usage, 원자적 쓰기), `LlmConverseEngine`, `fork-snapshot`.
- 수용: fresh/fork 스레드 생성, 활성 전환, 취소 후 늦은 청크 폐기, 세션별 누적 사용량.
- 검증: 가짜 llm으로 하는 단위 테스트(스트림, 취소, 오류, usage 누락).

### S3 — Remote 서비스와 `/pixie`

- 선행: S2.
- 책임: `pixie` Remote, `/pixie <질문>` 커맨드(활성 스레드가 없으면 기본 모드로 새로 만듦, 탭 열기 신호), 설정 저장.
- 수용: `/pixie`가 활성 스레드에 요청을 추가하고, 대화창에는 커맨드 행만 남는다.
- 검증: Loader 조합 테스트. 세션 로그에 메시지 이벤트가 없는지 확인한다.

### S4 — Pixie 탭과 설정 화면

- 선행: S3.
- 책임: 스레드 목록과 새 스레드(정리), 스트리밍 대화, 취소(회수), Studio의 Pixie 설정 서비스 화면. (컨텍스트 크기/한도와 사용량 표시는 UI 통일 후속에서 화면에서 제외했다.)
- 수용: 디자인 시스템과 ko·en·zh 문구를 따르고, 라이트·다크 모드와 좁은 폭에서 동작한다.
- 검증: UI 단위 테스트와 Web 배포 후 확인(사용자 시각 확인은 따로 기록).

### S5 — 판정형 엔진과 수동 시험

- 선행: S2(엔진). UI는 S4 이후.
- 책임: `LlmJudgeEngine`(JSON 스키마 강제, 검증 실패는 오류), 탭의 판정 시험 화면(state·질문 입력 → answers 표시).
- 수용: Choice/Score/Noul 출력이 Jev 스키마를 통과한다. 잘못된 출력은 오류로 표시한다.
- 검증: 스키마 검증 단위 테스트와 실제 모델 1회 수동 확인.

### S6 — 독립 설치 검증

- 선행: S1–S5.
- 책임: 수정하지 않은 지정 DSH 버전과 격리 프로필에 패키지를 설치해 `/pixie`, 탭, 설정, 판정 시험 흐름을 확인한다.

## 범위 밖 (후속 이슈)

- 전달(translate-in): 사용자 확인 뒤 `sessionController.prompt(queue|steer)`로 넣기와 출처 표시 방식.
- 답변 다듬기(relay-out): 프리셋 단위 `pixie_relay` 도구와 턴 종료 후 요약.
- 판정 훅: `agent/pre-step`, `tools/pre-execute`, `agent/turn-stopping` 연결, 실패 정책, 예산·횟수 상한.
- `JevJudgeEngine`(HTTP `POST /v1/systemone`)과 자격 증명. 입출력 형식은 [보관 명세](../archive/workflow/workflow-specification.md#후속-결정-컴포넌트)를 따른다.
- 서브에이전트 세션 fork, 스레드 압축 요약, 비용 추정.

## 추가 확정 사항

- G1: `/pixie`의 `command/done.text`에는 짧은 상태 문구(예: "Pixie에 요청함 · 스레드 N")를 넣는다. Pixie 답변 본문은 넣지 않는다.
- G2: Pixie 기록은 세션 수명을 따른다. 세션을 보관하면 Pixie 기록도 보관 상태로 남아 보관 해제 시 다시 보이고, 세션을 삭제하면 Pixie 기록도 삭제한다. 저장소는 sessionId 기준 파일이므로 보관은 별도 이동 없이 세션 존재 여부로 따라간다. 삭제 감지는 공개 이벤트(`api-session/removed`)를 S1에서 확인해 연결하고, 이벤트가 없으면 고아 파일 정리(목록 대조)로 대체한다.
