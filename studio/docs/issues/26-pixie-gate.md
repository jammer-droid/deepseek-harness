---
kind: implementation-spec
status: ready
---

# #26 Pixie Gate — 여러 단계로 조립하는 런타임 게이트

## 요약

Pixie Gate는 #25의 Pixie 모델을 DSH 런타임 개입 지점([조사](../research/dsh-runtime-control-points.md))에 연결해, **사용자가 직접 게이트를 조립**할 수 있게 하는 Studio 기능이다. 게이트 하나는 **개입 지점(point)** 하나에 묶인 **여러 단계(stage)의 파이프라인**이다. 단계는 1–N개(이번 범위 상한 5개)이며 명령(command) 단계, Pixie 일반(converse) 단계, Pixie 판정(judge) 단계를 `명령 → 판정 → 일반`처럼 자유롭게 섞어 순서대로 실행한다. 게이트 결과의 `forward` 설정이 무엇을 다음 모델 입력으로 넘길지 정한다. 파이프라인 결과는 개입 지점이 허용하는 동작(통과·교체·거부·교정 지시·주석)으로 바뀐다.

게이트는 **Studio UI로 정의**한다. 사용자는 Studio → Pixie 설정에서 개입 지점을 고르고, 단계를 추가·정렬·편집하고, 샘플 입력으로 시험 실행한 뒤 프리셋에 붙인다. 코드 확장 API는 이번 범위가 아니다.

Studio는 특정 기능(양식 검증, 번역, 검색 요약, 선압축)을 직접 만들어 넣지 않는다. 그런 기능을 **만드는 재료**, 곧 개입 지점 바인딩, 단계 실행기, 결과 매핑, 실패 정책, 실행 기록을 제공한다. 예시 기능은 이 재료로 조립한 **레시피**로 검증한다.

- GitHub 이슈: **아직 만들지 않음**(번호 26은 가정. 만들면 파일명·링크를 맞춘다)
- 선행: [#25 Pixie](25-pixie.md)(마무리, 제한 포함)
- 기준 브랜치·시작 커밋: `studio/feat/workflow` @ `f989f09b61`
- 대상 DSH: Studio peer 범위 `0.2.0-rc.2 || 0.2.1-alpha.2`. 공개 API 존재 여부는 S1에서 확인한다.
- 본체 수정: 없음. 공개 Service·Event·Slot만 쓴다.
- 판정(Judge) 엔진: 단계 계약과 파이프라인은 `judge` 단계를 처음부터 같은 자리에 둘 수 있게 설계한다. **이번 구현은 일반 모델(converse) 단계로 완성**하고, `judge` 단계 실행은 마지막 확장 단계(S8)에서 #25의 `JudgeEngine` 포트로 연결한다.

## 현재 진행 상황

`ready`. 사용자 결정 U1–U8을 [확정된 결정](#확정된-결정)에 기록했다. 첫 단계는 **S1(설치 런타임 계약 확인)**이다. GitHub 이슈는 아직 만들지 않았다.

## 사용자 목표와 레시피

사용자가 든 예시를 개입 지점과 동작으로 옮기면 다음과 같다. 이 표는 이번 이슈가 **직접 만드는 기능 목록이 아니다**. 프레임워크가 표현할 수 있어야 하는 범위다.

| 레시피 | 개입 지점 | 단계 구성 예 | 결과 동작 | 이번 범위 |
|---|---|---|---|---|
| R1 작업 지시 양식 검증 | `input`(`agent/pre-step`, source `user`) | 일반(check): 양식 항목 누락·모호함 판정 → 일반(revise): 양식에 맞게 다시 쓰기 → (확장) 판정: 다시 쓴 결과 승인 | 통과 / 다시 쓴 메시지로 교체 / 거부하고 이유 표시 | 포함(첫 종단간 목표) |
| R2 에이전트 간 대화 중계 검증 | `input`(source `agent-message`) | R1과 같고 대상만 다름 | 통과 / 교체 / 거부 | 포함(R1과 같은 바인딩) |
| R3 최종 출력 번역·교정 | `turn-end`(`agent/turn-stopping`) | 일반(check): 영어 출력인지 → 일반(note): 한국어 번역 / 일반(check): 출력 검증 | 주석(번역을 Pixie 카드로) / 교정 지시(`steer`, 횟수 상한) | 포함 |
| R4 대량 검색 결과 선검수 | `tool-after`(`tools/post-execute`) | 일반(revise): 결과 요약·선별 (인덱스 기준 선별은 후속) | 결과 교체 / 그대로 통과 | 지점 바인딩만. **인덱스 제공자는 후속** |
| R5 선압축 | `compaction`(`llm/stream`, `purpose: 'compaction'`) | 백그라운드에서 미리 요약 → 압축 요청 시 범위가 맞으면 반환 | 미리 만든 요약을 반환 / 기본 요약 | 후속(S1에서 가능성만 확인) |

R1·R2는 같은 지점, R3는 출력 쪽, R4·R5는 데이터 준비(인덱스·사전 요약)가 따로 필요하다. 그래서 이번 범위는 **R1–R3 종단간 + R4 지점 바인딩**으로 잡는다. R4의 인덱스와 R5는 같은 단계 계약 위에 후속 이슈로 올린다.

## 기준 예시: 자막 번역 요청

사용자가 "이 영화 자막을 한국어로 번역해 줘"라고 입력한 경우다. 사용자가 말하는 "첫 번째·두 번째 게이트"는 이 문서에서 한 게이트 안의 **단계 1·2·3**이다.

| 단계 | 종류 | 하는 일 | 결과 |
|---|---|---|---|
| 1 | `command` | bash 명령이 입력에서 자막 파일 경로를 찾아 줄 수·글자 수·인코딩을 잰다 | stdout JSON `{ "data": { "lines": 1820, "chars": 64000 } }` → 단계 1 결과 |
| 2 | `judge` | 판정 모델이 `{{stages.measure.data}}`를 보고 한 번에 번역할 크기인지 판단 | 승인이면 다음 단계, 거부면 게이트 `fail`(입력 거부 + 이유 카드) |
| 3 | `converse`(`note`) | 일반 모델이 번역 방침(구간 분할, 용어, 말투)을 만든다 | 단계 3 텍스트 |
| 출력 | `forward` | `append`: 원문 뒤에 단계 3 텍스트를 컨텍스트로 붙여 메인 모델에 전달 | 메인 모델은 원문 + 번역 방침을 받는다 |

판정 단계는 S8에서 연결하므로, 그 전에는 단계 2를 `converse`(`check`)로 바꿔 같은 흐름을 검증한다.

## 확인한 런타임 사실 (checkout 소스 기준, 설치본은 S1에서 재확인)

| 사실 | 영향 | 근거 |
|---|---|---|
| `pre-step`의 payload는 inbox에서 꺼낸 메시지들이다. `reject`하면 턴이 `blocked`로 끝나고, 꺼낸 메시지는 `user/message`로 **기록되지 않는다**. | 입력 게이트가 거부하면 사용자 원문이 사라진다. 게이트 실행 기록에 원문을 보존하고 다시 보내기를 제공해야 한다(U3). | [preStep·turn](<../../../packages/core/agent-loop/src/agent.ts#L265-L321>), [기록 시점](<../../../packages/core/agent-loop/src/agent.ts#L425-L440>) |
| 메시지 source `kind`로 출처를 구분한다. 사용자 입력은 `user`, 에이전트 간 메시지는 `agent-message`(`form: 'relay'`, `senderSessionId`), 자식 종료 알림은 `subagent-settled`, 런타임 컨텍스트는 `runtime-context`다. | 하나의 `input` 바인딩이 source 필터로 R1·R2를 함께 다룬다. `runtime-context`·`model-selection`처럼 런타임이 붙인 메시지는 기본으로 건드리지 않는다. | [MessageSourceMap](<../../../packages/llm/llm/src/message.ts#L103-L115>), [agent-message](<../../../packages/subagent/subagent/src/continuation-messages.ts#L13-L71>), [관리자 전달](<../../../packages/subagent/subagent/src/manager.ts#L620-L692>) |
| `pre-step` 기본 동작(`next()`)이 런타임 컨텍스트 메시지를 덧붙인다. 다른 리스너(`model-selection`)도 `next()` 결과에 메시지를 더한다. | 게이트는 `next()`를 먼저 부르고 그 결과에서 **대상 메시지만** 바꾼다. 다른 메시지는 그대로 둔다. | [기본 enter](<../../../packages/core/agent-loop/src/agent.ts#L274-L283>), [model-selection](<../../../packages/core/agent/src/model-selection.ts#L113-L126>) |
| `turn-stopping`은 이미 스트리밍된 답변을 숨기거나 바꾸지 못한다. 계속 실행은 `agent.steer()`로만 요청한다. | R3의 번역은 **원문을 대체하지 않고** Pixie 쪽에 덧붙인다. 교정은 steer이며 무한 반복을 막는 상한이 필요하다. | [조사 §3](../research/dsh-runtime-control-points.md#3-완료-검사와-최종-답변-표시의-경계) |
| `tools/post-execute`는 content/value 교체·block·추가 컨텍스트를 받는다. `pre-execute`는 인자 rewrite를 받지 않는다. | R4는 실행 후 결과 교체로만 만든다. 실행 전 검색 범위 축소는 deny + 이유로만 가능하다. | [결정 타입](<../../../packages/core/tools/src/index.ts#L600-L621>) |
| 압축 요약은 `ctx.llm.stream({ purpose: 'compaction', sessionId, … })` 한 번으로 만든다. `llm/stream` waterfall은 자기 청크를 yield해 short-circuit할 수 있다. | R5는 압축 서비스를 교체하지 않고 `llm/stream`에서 미리 만든 요약을 돌려주는 방식이 가능해 보인다. 요청 메시지 범위가 사전 요약 범위와 정확히 같을 때만 쓴다. | [summarizer](<../../../packages/compaction/compaction-basic/src/summarizer.ts#L140-L176>), [llm/stream 계약](<../../../packages/llm/llm/src/index.ts#L62-L75>) |
| 공개 `ctx.shell`(`resolve` → `execute` → `result()`)이 명령·stdin·workdir·timeout·signal·env를 받고 exit code·stdout·stderr·timedOut을 돌려준다. 실패한 종료도 결과로 돌아오며 인프라 오류만 reject한다. Claude Code·Codex 훅 브리지도 같은 서비스로 명령 훅을 실행한다. | 명령 단계는 이 서비스로 만든다. 훅 브리지 패키지(`dsh-hook-protocol`)는 Studio peer가 아니므로 가져오지 않고 같은 규칙을 Studio에서 구현한다. | Host Inspect `shell`, [훅 실행기](<../../../packages/experimental/hook-protocol/src/runner.ts#L75-L110>) |
| 같은 지점의 리스너는 Cordis waterfall 순서(등록 순서, `prepend`는 앞)로 감싼다. Claude Code 브리지의 `pre-step`은 `next()` 결과 뒤에 자기 컨텍스트 메시지(source `hooks-claude-code`)를 붙이고, deny면 `next()` 없이 `reject`한다. `post-execute`는 `additionalContexts`에 붙인다. | 게이트가 바깥쪽에 있으면 `next()` 결과에서 일반 훅의 결정·컨텍스트를 **입력으로 읽을 수 있다**. 순서는 로드 순서에 달려 있어 S1에서 확인한다. | [Claude 브리지 pre-step·tool](<../../../packages/experimental/hooks-claude-code/src/index.ts#L225-L270>), [waterfall](<../../../vendor/cordis/src/events.ts#L225-L260>) |
| waterfall 리스너는 모델 요청을 기다리는 동안 에이전트를 붙잡는다. #25 Pixie 요청에는 타임아웃이 없다. | 게이트 단계에는 **타임아웃·예산이 반드시** 있어야 한다. 이번 이슈에서 Pixie 호출 타임아웃을 함께 넣는다. | [#25 남은 제한](25-pixie.md#남은-제한-후속) |

## 용어

- **게이트(gate)**: 개입 지점 하나, 대상 조건(match), 단계 목록, 실패 정책을 가진 정의.
- **개입 지점(point)**: `input`, `tool-before`, `tool-after`, `turn-end`, `compaction`. DSH 이벤트 하나에 대응한다.
- **단계(stage)**: 파이프라인의 한 칸. 종류는 `command`(bash 명령 훅), `converse`(Pixie 일반 모델), `judge`(Pixie 판정 모델). 게이트당 1–5개. `judge` 실행 연결은 S8.
- **일반 훅**: Claude Code·Codex 명령 훅 브리지나 다른 네이티브 플러그인이 같은 개입 지점에 건 리스너.
- **게이트 훅**: 게이트 시작·종료 때 실행하는 명령(`hooks.start`, `hooks.end`)과 다른 플러그인용 Cordis 이벤트(`pixie-gate/start`, `pixie-gate/end`).
- **역할(role)**: converse 단계가 결과를 내는 방식. `check`(통과/실패 판정), `revise`(작업 텍스트 다시 쓰기), `note`(작업 텍스트를 두고 결과만 덧붙이기).
- **작업 텍스트(subject)**: 단계가 검사·변환하는 텍스트. 지점마다 정해진다(입력 메시지 텍스트, 도구 결과 텍스트, 마지막 답변 텍스트).
- **게이트 실행(gate run)**: 게이트 한 번의 실행 기록. 단계별 결과, 최종 판정, 적용된 동작, 원문을 담는다.

## 설계

### 게이트 정의

```ts
type GatePoint = 'input' | 'tool-before' | 'tool-after' | 'turn-end'   // 'compaction'은 후속

interface GateDefinition {
  id: string
  name: string
  enabled: boolean
  point: GatePoint
  match: {
    agents?: 'root' | 'child' | 'any'          // 기본 root
    sources?: string[]                         // input: 기본 ['user'], 'agent-message' 등
    tools?: string[]                           // tool-*: 도구 이름
  }
  stages: StageDefinition[]                    // 1–5개(MAX_GATE_STAGES = 5), 순서대로 실행
  onError: 'pass' | 'block'                    // 기본 'pass'(U4)
  confirmRevision: boolean                     // input 교체 전 사용자 확인, 기본 false(U5)
  forward: ForwardSpec                         // 통과 시 다음 모델 입력으로 무엇을 넘길지
  hooks?: { start?: CommandSpec; end?: CommandSpec }   // 게이트 시작·종료 훅
  limits: { stageTimeoutMs: number; maxSteersPerTurn: number }
}

interface CommandSpec { command: string; timeoutMs?: number }   // 작업 디렉터리 = 에이전트 cwd

type ForwardSpec =
  | { kind: 'original' }                              // 원문 그대로(결과는 기록만)
  | { kind: 'replace'; from: 'subject' | StageId }    // 최종 작업 텍스트 또는 지정 단계 텍스트로 교체
  | { kind: 'append'; from: StageId[] }               // 원문 + 지정 단계 텍스트를 컨텍스트 메시지로 덧붙임

type StageDefinition =
  | { id: string; kind: 'command'; role: 'check' | 'revise' | 'note'; command: CommandSpec }
  | { id: string; kind: 'converse'; role: 'check' | 'revise' | 'note'; model?: PixieModel; system?: string; prompt: string }
  | { id: string; kind: 'judge'; model?: PixieModel; questions: Record<string, JudgeQuestion>; pass: JudgePassRule }

/** 단계 결과는 종류와 상관없이 같은 모양이다. 파이프라인은 이 모양만 본다. */
interface StageResult {
  verdict: 'pass' | 'fail' | 'revise' | 'note'
  text?: string          // revise: 새 작업 텍스트, note: 덧붙일 내용, fail: 교정 지시·이유
  reason?: string
  data?: unknown         // check JSON 원본, judge answers
  error?: string         // 오류·타임아웃·잘못된 출력
}
```

- **조립 방식:** 단계 1–5개를 사용자가 정한 순서대로 실행한다. 각 단계는 직전까지의 작업 텍스트를 받는다. `revise`는 작업 텍스트를 바꾸고, `note`는 결과만 쌓고, `fail`은 그 자리에서 파이프라인을 멈춘다. 모든 단계가 끝나면 원문과 최종 텍스트가 다르면 `revise`, 아니면 `pass`로 정리하고 쌓인 `note`를 함께 넘긴다.
- **프롬프트 변수:** `{{subject}}`(현재 작업 텍스트), `{{original}}`(원문), `{{stages.<id>.text}}`, `{{stages.<id>.reason}}`, `{{stages.<id>.data}}`(JSON 문자열), `{{hooks.context}}`(일반 훅이 붙인 컨텍스트). 알 수 없는 변수는 저장 시 오류다.
- **게이트 출력(`forward`):** 파이프라인이 `fail`이면 `forward`와 상관없이 지점의 fail 동작을 한다. 통과하면 `forward`가 다음 모델 입력을 정한다. `append`는 원문 메시지를 그대로 두고 단계 텍스트를 별도 컨텍스트 메시지(source `studio-pixie-gate`)로 붙인다. `replace`는 대상 메시지 텍스트만 바꾼다. 지점이 지원하지 않는 `forward`(예: `turn-end`의 `replace`)는 저장 시 거부한다.
- **converse `check` 출력:** JSON `{ "pass": boolean, "reason"?: string, "fix"?: string }`을 요구하고 엄격히 검증한다. 잘못된 출력은 `error`이며 통과로 바꾸지 않는다(#25 판정 검증과 같은 원칙). `fix`는 fail일 때 교정 지시·다시 쓰기 제안으로 쓴다.
- **judge 단계(확장):** #25 `JudgeEngine.judge({ state, questions })`를 그대로 쓴다. `state`는 `{ subject, original, stages }`. `pass` 규칙(예: noul ≥ 0.7, choice ∈ 허용 목록, score ≥ n)이 answers를 `pass`/`fail`로 바꾼다. 파이프라인은 `StageResult`만 보므로 judge 추가가 파이프라인·지점 매핑을 바꾸지 않는다. S8 전까지 정의 검증은 judge 단계를 "아직 지원하지 않음"으로 거부한다.
- 조건부 건너뛰기, 병렬 그룹, 분기 그래프는 후속이다.

### 훅 계약

명령 단계와 게이트 훅은 같은 입출력 계약을 쓴다. Claude Code·Codex 명령 훅과 같은 방식(stdin JSON, exit code, stdout JSON)이라 기존 훅 스크립트를 조금만 고쳐 쓸 수 있다. 다만 **같은 스크립트가 그대로 동작하는 호환은 아니다**(필드 이름이 다르다).

**stdin** (한 줄 JSON):

```json
{
  "pixie_gate": "1",
  "event": "stage",               // "start" | "stage" | "end"
  "gate": { "id": "…", "name": "…", "point": "input" },
  "session_id": "…", "cwd": "/…", "turn": 3,
  "source": "user",              // input: 메시지 source kind
  "tool": { "name": "…", "call_id": "…", "arguments": "…" },  // tool-*에서만
  "original": "원문", "subject": "현재 작업 텍스트",
  "stages": { "measure": { "verdict": "note", "text": "…", "data": { } } },
  "hooks": { "context": ["일반 훅이 붙인 컨텍스트"], "decision": "none" },
  "result": { "verdict": "pass", "forwarded": "append" }      // end에서만
}
```

**결과** (단계·start 훅):

| 종료 | 의미 |
|---|---|
| exit 0, stdout 비었음 | `pass` (`note` 역할이면 텍스트 없음) |
| exit 0, stdout이 JSON 아님 | 텍스트 결과: `revise`면 새 작업 텍스트, `note`면 덧붙일 텍스트, `check`면 오류(형식 위반) |
| exit 0, stdout JSON | `{ "verdict"?: "pass"\|"fail"\|"revise"\|"note", "text"?: string, "reason"?: string, "data"?: unknown }`. 역할이 허용하지 않는 verdict는 오류 |
| exit 2 | `fail`, stderr가 이유 |
| 그 밖의 exit, 타임아웃, 실행 불가 | 오류 → `onError` 정책 |

- **start 훅:** 단계 실행 전에 한 번. `fail`이면 단계를 실행하지 않고 게이트 `fail`. `{"verdict":"pass","data":{"skip":true}}`이면 게이트를 건너뛰고 지점의 `next()` 결과를 그대로 돌려준다. `data`는 `{{stages.start.data}}`로 단계에 넘어간다.
- **end 훅:** 결과 동작을 적용하기 직전에 한 번. stdin에 최종 `result`가 들어간다. 관찰·알림용이며 결과를 바꾸지 않는다(결과를 바꾸려면 마지막 단계를 명령 단계로 둔다). 실패는 기록만 한다.
- **실행 환경:** `ctx.shell`로 에이전트 작업 디렉터리에서 실행하며 세션의 샌드박스 정책을 따른다. 기본 타임아웃은 게이트 `stageTimeoutMs`. 환경 변수 `DSH_PIXIE_GATE_ID`, `DSH_SESSION_ID`를 준다. 명령은 사용자가 Studio에서 직접 정의한 신뢰된 설정으로 취급한다(프리셋 공유 시 경고 표시).
- **출력 상한:** stdout은 상한(초안 256KB)을 넘으면 오류다. `subject`·`text`는 다음 단계 프롬프트에 그대로 들어가므로 크기를 기록에 남긴다.

### 일반 훅과의 연결

- **일반 훅 → 게이트 입력:** 게이트 리스너는 같은 지점에서 **바깥쪽**(`prepend`)에 등록하고 먼저 `next()`를 부른다. 그 결과에서 일반 훅이 남긴 것을 읽어 `hooks`로 넘긴다.
  - `input`: 결정이 `reject`이면 게이트는 실행하지 않고 그대로 돌려준다. `enter`이면 대상 외 메시지 중 source가 `hooks-claude-code`·`hooks-codex`인 것을 `hooks.context`로 읽는다.
  - `tool-after`: `block`이면 그대로 돌려준다. `additionalContexts`를 `hooks.context`로 읽는다.
  - `tool-before`: `next()`가 `deny`·`cancel`이면 그대로, `ask`이면 `hooks.decision = "ask"`로 넘긴다.
  - `turn-end`(serial): 다른 리스너가 이미 steer했는지 읽을 공개 방법은 S1에서 확인한다. 없으면 `hooks`는 비어 있다.
  - 다른 플러그인이 더 바깥쪽에 등록되면 게이트가 그 결과를 볼 수 없다. 순서를 보장하지 않는 지점은 UI와 기록에 "일반 훅 입력: 확인 안 됨"으로 표시한다.
- **게이트 → 일반 훅:** 두 가지를 제공한다.
  1. 게이트 정의의 `hooks.start`·`hooks.end` 명령(위 계약).
  2. 다른 네이티브 플러그인이 들을 수 있는 Cordis 이벤트. `pixie-gate/start`(emit: gate, point, sessionId, original), `pixie-gate/end`(emit: 위 + 단계 결과, 최종 verdict, forward). 관찰용이며 게이트 결과를 바꾸지 않는다. 이벤트 계약은 Studio가 선언하고 소유한다.
- **한계:** Claude Code·Codex 훅 브리지의 `hooks.json`에는 Pixie 게이트용 새 이벤트 이름을 추가할 수 없다(브리지가 고정된 지점만 매핑한다). 그 훅들을 게이트 시작·종료에 거는 대신, 같은 스크립트를 게이트의 `hooks.start`·`hooks.end`나 명령 단계에 등록한다.

### 지점별 결과 매핑

| 지점 | pass | revise(최종 텍스트 변경) | fail | note |
|---|---|---|---|---|
| `input` | `next()` 결과 그대로 | 대상 메시지만 같은 source로 텍스트 교체한 `enter` | `reject` + 원문 보존 실행 기록 | 실행 기록에만 |
| `tool-before` | `next()` | 지원 안 함(인자 rewrite 불가) | `deny`(reason) 또는 `ask` | 실행 기록에만 |
| `tool-after` | `next()` | `accept` + content 교체 | `block`(feedback) | `accept` + `additionalContexts`(선택) |
| `turn-end` | 아무것도 안 함 | 지원 안 함(표시된 답변 교체 불가) | `steer`(교정 지시), 턴당 상한 초과 시 기록만 | Pixie 카드로 표시(번역) |

정의 검증은 지점이 지원하지 않는 역할(예: `turn-end`·`tool-before`에 `revise`)과 단계 수 0개·6개 이상을 저장 전에 거부한다. UI는 지점을 고르면 그 지점에서 가능한 역할만 보여 준다.

`input`의 `revise`는 `confirmRevision`이 켜져 있으면 바로 교체하지 않고 거부한 뒤 Pixie 카드에 다시 쓴 제안을 "이대로 보내기 / 수정해서 보내기"로 보여 준다.

### 불변 조건

- 게이트는 다른 리스너의 결정을 지우지 않는다. 항상 `next()`를 먼저 부르고, `next()`가 이미 `reject`/`block`/`deny`이면 그대로 돌려준다. 일반 훅이 붙인 컨텍스트 메시지는 `forward`와 상관없이 보존한다.
- 명령 단계·게이트 훅은 세션 로그에 `hook/*` 이벤트를 쓰지 않는다(그 이벤트는 브리지 전용 형식이다). 기록은 게이트 실행 기록에만 남긴다.
- 거부·교체는 **반드시** 원문과 함께 게이트 실행 기록에 남는다. 사용자 입력이 아무 흔적 없이 사라지지 않는다.
- 게이트 단계의 Pixie 호출도 세션 로그에 메시지를 쓰지 않는다. 모델에 보이는 변화는 지점의 공식 결정(교체된 메시지, steer, 도구 결과)뿐이다.
- 모든 단계에 타임아웃이 있다. 타임아웃·오류는 `onError` 정책대로 처리하고, 정책 결과를 실행 기록에 표시한다. 오류를 `pass` 판정으로 기록하지 않는다(`error → pass 적용`처럼 구분).
- `turn-end`의 steer는 게이트·턴별 횟수 상한을 넘지 않는다.
- 취소된 턴(`signal.aborted`)에서는 단계를 시작하지 않고, 진행 중 호출은 취소한다.
- 게이트 Pixie 사용량은 세션 사용량, #25 따로 묻기 사용량과 분리해 집계한다.

### 실행 기록과 화면

- 실행 기록은 #25 Pixie 저장소 옆에 sessionId별로 둔다(`<studio-data>/pixie/gates/<sessionId>.json`). 세션 수명 규칙(G2)을 따른다.
- Pixie 탭의 카드 목록에 게이트 실행을 `Badge`(통과·교체·거부·교정·오류)로 붙인다([#25 UI 통일 후속](25-pixie.md#ui-통일-후속)에서 전제한 방식).
- 거부된 입력 카드에는 원문, 실패 이유, 다시 쓴 제안(있으면)과 "수정해서 보내기"를 둔다(U3 결과에 따름).
- 게이트 정의는 Studio → Pixie 설정에 `게이트` 페이지로 둔다. 단계 목록 편집, 지점별로 허용되는 결과 표시, 샘플 텍스트로 **시험 실행**(에이전트에 연결하지 않고 파이프라인만 실행)을 제공한다.

## 확정된 결정

| ID | 결정 |
|---|---|
| U1 | 게이트는 **Studio UI로 정의**한다. DSH 런타임 개입 지점 중 들어갈 수 있는 곳(`input`, `tool-before`, `tool-after`, `turn-end`)을 대상으로 한다. 코드 확장 API는 범위 밖이다. |
| U2 | 적용 범위는 **프리셋 단위**이며 게이트별 `match`(에이전트·source·도구)로 좁힌다(#25 D1과 같음). |
| U3 | `input` 거부 시 Pixie 탭 카드에 원문·이유·다시 쓴 제안을 보여 주고 "수정해서 보내기"를 제공한다. 원문은 실행 기록에 보존한다. |
| U4 | 단계 오류·타임아웃의 기본 정책은 `pass`(fail-open)이며 게이트별로 `block`을 고를 수 있다. 오류는 기록에 통과와 구분해 표시한다. |
| U5 | `input`의 다시 쓴 텍스트는 기본으로 확인 없이 교체하고 원문을 카드에 보존한다. 게이트 설정 `confirmRevision`으로 확인을 켤 수 있다. |
| U6 | 게이트는 **1–N개 단계의 순차 파이프라인**이다. 명령·일반·판정 단계를 `판정 → 일반 → 판정`처럼 자유롭게 섞는다. 이번 상한은 **5개**다. 판정 단계 실행은 일반 단계 완성 뒤 S8에서 연결한다. |
| U7 | 단계 종류에 **명령(bash) 단계**를 더한다. 명령 단계·게이트 시작/종료 훅은 [훅 계약](#훅-계약)을 따르고, 게이트는 같은 지점의 일반 훅 결과를 입력으로 읽고 시작·종료를 명령 훅과 Cordis 이벤트로 알린다. |
| U8 | 게이트 출력 `forward`(original / replace / append)가 다음 모델 입력을 정한다. 자막 번역 예시(명령 → 판정 → 일반 → append)를 기준 시나리오로 삼는다. |

## 구현 단계

### S1 — 설치 런타임 계약 확인

- 선행: 없음.
- 책임: `rc.2`(가능하면 `alpha.2`)에서 다음을 확인한다. `pre-step` 리스너 등록과 reject 시 사용자 화면 표시(원문이 보이는지 사라지는지), 사용자·`agent-message` 메시지의 source 형태, 같은 source로 텍스트를 바꾼 메시지가 기록·표시되는 모양, `turn-stopping`에서 마지막 답변 텍스트를 읽는 방법, `post-execute` content 교체, 프리셋 scope 리스너가 그 프리셋의 에이전트에만 걸리는지, `prepend` 등록 시 Claude Code 훅 브리지·`model-selection`과의 실제 waterfall 순서, `ctx.shell`로 에이전트 cwd·샌드박스 정책 아래 stdin 명령을 실행하는 방법, `turn-stopping`에서 다른 리스너의 steer를 읽을 수 있는지, 리스너가 pre-step에서 Pixie 호출을 기다리는 동안 입력창·상태 표시가 어떻게 보이는지. (R5용 `llm/stream` `purpose: 'compaction'` short-circuit 가능성은 기록만 한다.)
- 수용: 각 항목의 결과와 버전 차이를 이 문서에 기록한다. 불가능한 항목은 해당 레시피·지점을 범위 밖으로 옮긴다.
- 검증: 격리 프로필 + 최소 시험 리스너(커밋하지 않는 실험 또는 테스트 전용).

### S2 — 게이트 계약과 파이프라인 실행기

- 선행: S1.
- 책임: `GateDefinition`·`StageDefinition`·`StageResult` 계약과 정의 검증(단계 1–5개, 지점별 허용 역할, 프롬프트 변수), 단계 실행기 포트(`StageRunner`: command·converse 구현, judge 자리), 훅 계약(stdin 생성, exit code·stdout 해석, 출력 상한), start/end 게이트 훅, `forward` 처리, 순차 파이프라인 실행기, check JSON 엄격 검증, 단계 타임아웃·취소, `onError` 처리. #25 Pixie 호출 경로에 타임아웃을 추가한다.
- 수용: 자막 번역 예시(명령 → check → note → append)를 가짜 shell·llm으로 실행해 단계별 결과와 forward 결과가 맞는다. exit 0/2/기타/타임아웃, 잘못된 JSON, 역할에 맞지 않는 verdict, start 훅 skip·fail이 기대대로 처리된다. 1개·3개·5개 단계 파이프라인을 가짜 llm으로 실행해 pass/revise/fail/note와 fail 즉시 중단, 오류·타임아웃·취소 결과가 기대대로 나온다. 6개 단계와 judge 단계는 저장 시 거부된다. 가짜 `StageRunner`로 judge 자리에 다른 실행기를 넣어도 파이프라인 코드가 바뀌지 않음을 테스트한다.
- 검증: Node 단위 테스트.

### S3 — 실행 기록 저장소

- 선행: S2.
- 책임: 게이트 실행 기록 저장(원문·단계 결과·적용 동작·사용량), 세션 수명 정리, Remote 조회·구독.
- 검증: 단위 테스트(원자적 쓰기, 정리, 늦은 결과 폐기).

### S4 — `input` 지점 연결 (R1·R2)

- 선행: S3.
- 책임: `agent/pre-step` 바인딩(바깥쪽 등록), source·에이전트 필터, `next()` 결과에서 일반 훅 컨텍스트 읽기, 대상 메시지 교체·append·거부, `pixie-gate/start`·`end` 이벤트, 프리셋 범위 적용.
- 수용: 자막 번역 예시와 양식 레시피로 통과·교체·append·거부가 모두 동작하고, Claude Code 훅 브리지를 함께 켠 경우 그 컨텍스트가 `hooks.context`로 들어가며 그 reject는 그대로 유지된다. 그리고 거부된 원문이 실행 기록에 남는다. 다른 리스너의 메시지(런타임 컨텍스트 등)는 보존된다.
- 검증: Loader 조합 테스트 + 격리 프로필 실제 모델 1회.

### S5 — `turn-end` 지점 연결 (R3)

- 선행: S4.
- 책임: 마지막 답변 읽기, `note`(번역 카드)와 `fail → steer`(턴당 상한), 상한 초과 기록.
- 수용: 번역 레시피가 원문을 바꾸지 않고 카드로 붙는다. 교정 레시피가 상한 안에서만 steer한다.
- 검증: 단위 + Loader 테스트(무한 continuation 방지 포함).

### S6 — `tool-before`·`tool-after` 지점 연결 (R4 바인딩)

- 선행: S4.
- 책임: 도구 이름 필터, `post-execute` content 교체·block, `pre-execute` deny/ask.
- 수용: 큰 검색 결과를 Pixie 요약으로 바꾸는 단순 레시피가 동작한다(인덱스 없이). 원래 tool call id가 유지된다.

### S7 — 설정·탭 UI

- 선행: S3(카드), S2(시험 실행).
- 책임: Pixie 설정의 `게이트` 페이지(게이트 목록, 지점·match·실패 정책 선택, 단계 1–5개 추가·삭제·순서 변경·종류(명령/일반)·역할·프롬프트·명령 편집, 시작·종료 훅 명령, `forward` 선택, 프리셋 연결, 샘플 텍스트 시험 실행과 단계별 결과 표시), Pixie 탭의 게이트 실행 카드(통과·교체·거부·교정·오류 `Badge`, 거부 카드의 수정해서 보내기). 디자인 시스템과 ko·en·zh 문구를 따른다.
- 검증: UI 단위 테스트, Web 배포 후 라이트·다크·좁은 폭 확인.

### S8 — 판정 단계 연결

- 선행: S2, S7.
- 책임: `judge` `StageRunner`(#25 `LlmJudgeEngine`), `pass` 규칙 계약·검증, UI의 판정 단계 편집(질문·통과 규칙). 판정 전용 모델·시스템 프롬프트 분리는 이 단계에서 함께 결정한다.
- 수용: `판정 → 일반 → 판정` 게이트가 시험 실행과 `input` 지점에서 동작한다. 잘못된 판정 출력은 오류다.
- 검증: 단위 테스트 + 실제 모델 1회.

### S9 — 독립 설치 검증

- 선행: S1–S8.
- 책임: 수정하지 않은 지정 DSH 버전 격리 프로필에서 R1–R3 흐름 확인. 버전·경로·명령·결과 기록.

## 범위 밖 (후속)

- `JevJudgeEngine`(HTTP)과 자격 증명.
- Claude Code·Codex `hooks.json` 스크립트를 수정 없이 실행하는 호환 모드(필드 이름 변환).
- 게이트 결과를 바꿀 수 있는 waterfall 이벤트(다른 플러그인이 게이트 결과 개입).
- 조건부 건너뛰기, 단계 수 상한(5개) 상향.
- R4의 사전 인덱스 제공자(백그라운드 인덱싱, 변경 추적, 인덱스 검수 단계).
- R5 선압축(백그라운드 사전 요약, 범위 일치 확인, `llm/stream` short-circuit).
- 병렬 단계 그룹·분기 그래프, 같은 지점 게이트 여러 개의 순서 지정.
- 코드 확장 API(다른 플러그인이 단계 종류·게이트를 등록).
