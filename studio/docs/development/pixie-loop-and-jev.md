---
kind: reference
description: "Pixie Loop의 생성·실행·판정 경계, Jev/LLM 결정 엔진, 레시피·기록과 실측 운영 한계를 설명한다."
---

# Pixie Loop과 Jev 결정 엔진 내부 구조

이 문서는 Studio 플러그인 유지보수자를 위한 현재 구현 안내다.
명세 작성법과 전체 필드 표는 [Pixie Loop 사용자 가이드](<../../release/docs/appendix/pixie-loop.md>),
게이트 설정법은 [Pixie Gate 사용자 가이드](<../../release/docs/appendix/pixie-gate.md>)에 둔다.
여기서는 판정의 책임, 상태가 이동하는 경로와 수정 지점을 설명한다.
설계 의도는 [#31 결정 D1–D13](<../issues/31-pixie-loop.md#L108-L124>)과
[#27 결정 D2–D5](<../issues/27-jev-decision-engine.md#L99-L102>)를 함께 읽는다.
과거 단계의 계획보다 현재 코드를 우선한다. 예를 들어 #27 D1의 훅 전용 노출 범위는
현재 [judge 도구 등록](<../../src/host/judge-tool.ts#L47-L65>)까지 확장됐다.

## 1. 역할과 책임 경계

| 구성 요소 | 하는 일 | 하지 않는 일 |
| --- | --- | --- |
| Pixie | 출력 생성, 자연어 기준 컴파일, 실패 피드백, observation 축약 | 도구 실행, 최종 합격 판정 변경 |
| Jev 또는 LLM 결정 엔진 | state에 대한 형식화된 질문 판정 | 출력 재작성, 실패 이유 서술 |
| 코드 검사 | 자리표시자·정규식·JSON의 결정적 검사 | 의미·문체·사실성 추론 |
| 루프 엔진 | 위 단계 연결, 항목 스레드, 예산·동시성·결과 관리 | 사용자 파일에 최종 변경 자동 반영 |
| 메인 에이전트 | 명세·예시 작성, escalated 처리, 결과 대조·반영 | 항목별 생성 스레드 공유 |

**합격 여부는 코드 검사와 결정 엔진만 정하고 Pixie 피드백은 판정을 바꾸지 않는다.**
일반 검토에서는 코드 검사를 모두 통과한 뒤 질문별 고정 pass 규칙도 모두 만족해야 한다.
단순 select는 별도 검토 질문 없이 선택 확신도와 코드 검사로 끝날 수 있다.
근거는 [review](<../../src/host/pixie-loop-engine.ts#L109-L119>),
[단순 선택 분기](<../../src/host/pixie-loop-engine.ts#L248-L253>),
[#31 D4·D11](<../issues/31-pixie-loop.md#L115-L122>)다.

Pixie 호출은 세션 밖의 텍스트 스트림이며 tools를 전달하지 않는다.
모든 Pixie 단계는 기본 Pixie 모델을 쓰고, 결정 엔진은 별도 설정을 따른다.
같은 항목의 generate 스레드만 누적한다. 항목끼리나 메인 대화와는 공유하지 않는다.
compile·extract·interpret는 새 메시지로 호출한다.
[#31 D2·D3](<../issues/31-pixie-loop.md#L113-L114>),
[pixieCall](<../../src/host/pixie-loop-engine.ts#L57-L84>),
[항목 스레드](<../../src/host/pixie-loop-engine.ts#L210-L243>)가 이 경계를 만든다.

## 2. 실행 흐름

```text
메인 에이전트 → pixie_loop 명세 검증·항목 로드
  ├─ criteria → Pixie compile → 고정 checks
  └─ checks 직접 지정 ───────────────┘
                      ↓
                calibration pass/fail 검증
                      ↓
       concurrency 개수의 항목별 독립 worker
                      ↓
       Pixie generate / 결정 엔진 select
                      ↓
          [호스트 act → raw observation → extract]
                      ↓
                 codeChecks
              실패 ↙       ↘ 통과
          실패 기록          judge → 고정 pass 규칙
              ↘             ↙ 실패         ↘ 통과
              Pixie interpret               passed
                      ↓
        retry: 같은 입력 재작성 / episode: 다음 행동
                      ↓ 시도 소진
                   escalated
                      ↓
      선택적 결과 JSONL + 요약 + 세션별 실행 기록
```

### 시작 전: compile과 calibrate

[validateLoopSpec](<../../src/pixie-loop-contracts.ts#L325-L386>)은 알 수 없는 필드,
범위 초과, 잘못된 조합을 모델 호출 전에 거부한다.
criteria와 checks는 동시에 줄 수 없다. act 없는 retry select만 둘 다 생략할 수 있다.
검토가 있으면 통과 예시와 실패 예시를 각각 하나 이상 요구한다.

[compileChecks](<../../src/host/pixie-loop-engine.ts#L92-L104>)는 직접 준 checks를 그대로 쓴다.
criteria이면 Pixie가 질문과 pass 규칙 JSON을 만든다.
형식이 틀리면 오류를 알려 한 번만 교정하고, 다시 실패하면 시작 오류로 끝낸다.
질문 개수·타입·pass 규칙은 [validateLoopChecks](<../../src/pixie-loop-contracts.ts#L179-L205>)로 검증한다.
컴파일 프롬프트가 권장하는 질문 수와 계약의 강제 상한은 같지 않으므로 혼동하지 않는다.

[calibrate](<../../src/host/pixie-loop-engine.ts#L121-L135>)는 모든 pass 예시가 통과하고
모든 fail 예시가 실패하는지 실제 review로 병렬 확인한다.
직접 작성한 checks도 예외가 아니다. 예시를 가르지 못하면 항목 처리를 시작하지 않는다.
이때 act는 실행하지 않고 예시에 든 observation을 사용한다.
calibration은 예시 분리 검사이지 전체 입력에 대한 판정 정확도 보증이 아니다.
예시 검토의 Promise.all은 항목 worker의 concurrency 제한과 별개다.
이는 [#31 D5](<../issues/31-pixie-loop.md#L116>)의 실행 조건이다.

### 항목별: 생성, 판정, 피드백

[runItem](<../../src/host/pixie-loop-engine.ts#L210-L278>)은 입력 하나당 스레드를 만든다.
generate 시스템 메시지에는 work와 shared가 들어가고 입력은 user 데이터로 전달한다.
[generateSystem](<../../src/host/pixie-loop-engine.ts#L45-L51>)은 입력을 지시가 아닌 데이터로 다루도록 요청한다.

실제 순서는 **생성 → act/observation → codeChecks → judge**다.
파일 머리말의 간략한 generate→code checks 설명만 보고 act를 검사 뒤로 이해하면 안 된다.
[act 호출](<../../src/host/pixie-loop-engine.ts#L245-L260>)이 review보다 먼저다.
codeChecks를 안전하지 않은 명령 실행의 사전 차단 장치로 사용할 수 없다는 뜻이다.
코드 검사 실패 시 judge를 생략하지만, 이미 실행한 act를 되돌리지는 않는다.
[runCodeChecks](<../../src/pixie-loop-contracts.ts#L389-L417>)의 placeholders는
자리표시자뿐 아니라 인라인 코드·Markdown 링크 대상·태그의 등장 횟수도 보존한다.
regex는 output에만 적용하며, json은 파싱과 선택적 최상위 키 존재만 검사한다.
JSON Schema 전체 검증이나 인용 원문 대조를 대신하지 않는다.

실패하면 [interpretInput](<../../src/host/pixie-loop-engine.ts#L137-L147>)에
이번 input·output·observation, 실패한 코드 검사 메시지,
실패 질문의 instructions·값·임계값 또는 허용 선택지를 담는다.
통과 질문과 과거 판정 값은 전달하지 않는다([#31 D12](<../issues/31-pixie-loop.md#L123>)).
[INTERPRET_SYSTEM](<../../src/host/pixie-loop-engine.ts#L39-L43>)은 이유가 아니라 추정임을 명시한다.

[retryPrompt와 stepPrompt](<../../src/host/pixie-loop-engine.ts#L150-L161>)는 목적이 다르다.
retry는 같은 입력을 다시 작성하라고 하고, episode는 관찰 뒤 다음 행동을 요구한다.
직전 출력과 피드백은 해당 항목의 스레드에 누적한다.
마지막 실패 시도에도 interpret를 호출하므로 최종 escalated 요약에 피드백을 남길 수 있다.
[실패 후 분기](<../../src/host/pixie-loop-engine.ts#L268-L276>)를 바꿀 때 이 비용도 고려한다.

## 3. input, output, observation과 결과 표현

| 값 | 작성 주체와 의미 | 소비 지점 |
| --- | --- | --- |
| input | 호출자가 제공하는 항목 원문·환경 초기 데이터 | generate, act 치환, review, interpret |
| output | Pixie가 생성한 후보 또는 select가 고른 옵션 이름 | act 치환, 코드 검사, review |
| raw observation | 고정 act 명령의 실행 결과 텍스트 | episode의 다음 선택지 출처 |
| observation | raw 결과에 실패 표시·길이 제한·선택적 extract를 적용한 검토용 텍스트 | judge state, interpret, 다음 생성 단계 |

공유 타입은 [LoopState·LoopAttempt](<../../src/pixie-loop-contracts.ts#L83-L101>)에 있다.
일반 judge state는 `{ input, output, observation? }`다.
shared는 generate 시스템 문맥이지 별도의 judge state 필드가 아니다.
select의 pick 질문은 이 객체 대신 **선택지 출처 문자열 자체**를 state로 전달한다.
[review state](<../../src/host/pixie-loop-engine.ts#L110-L118>)와
[choose state](<../../src/host/pixie-loop-engine.ts#L193-L202>)를 구분한다.

[결과 JSONL 작성](<../../src/host/pixie-loop-recording.ts#L18-L25>)은 skipped를 제외하고
`id`, `status`, 선택적 `output`, `bucket`, 시도 **횟수**, 선택적 `error`만 쓴다.
**결과 JSONL에는 observation, 질문별 answers, 피드백, 전체 시도 이력이 없다.**
output은 통과한 결과에만 설정하므로 escalated의 마지막 후보를 이 파일에서 얻을 수 없다.
필요하면 세션 실행 기록의 attempts를 확인한다.

[summarizeRun](<../../src/pixie-loop-contracts.ts#L442-L459>)은 통과 수,
escalated의 id·시도 수·실패 검사/질문 id·마지막 피드백, 오류, skipped, 그룹 수와 usage를 돌려준다.
요약은 전체 후보 목록이 아니며, [renderSummary](<../../src/host/pixie-loop-tool.ts#L70-L80>)는
길이까지 제한한다. 메인 에이전트 문맥을 보호하려는 [#31 D9](<../issues/31-pixie-loop.md#L120>)의 구현이다.

## 4. act: 텍스트 작업자와 실행 권한 분리

act는 Pixie의 도구 호출이 아니다. 명세에 고정한 bash 명령을 호스트가 실행한다.
[validateAct](<../../src/pixie-loop-contracts.ts#L251-L264>)는 bash만 허용하고
`safeToRepeat: true`를 필수로 받는다. 반복 안전성을 자동 증명하는 검사는 아니다.
파괴적 행동이나 공유 상태를 바꾸는 명령은 명세 작성자가 별도로 판단해야 한다.

`{{output}}`, `{{input}}`, `{{id}}`는 각각 **단일 POSIX 셸 단어**로 인용한다.
작은따옴표를 감싸고 값 내부 작은따옴표를 이스케이프하는
[shellWord·actCommand](<../../src/pixie-loop-contracts.ts#L318-L323>)가 치환을 담당한다.
사용자가 다시 따옴표로 감싸거나 주변 문자에 붙인 변수는
[quotedPlaceholder](<../../src/pixie-loop-contracts.ts#L297-L315>)로 거부한다.
이것은 값의 셸 문법 주입을 막는 경계이지 명령 틀 자체를 안전하게 만드는 보장은 아니다.

도구 어댑터는 [nested tools.execute](<../../src/host/pixie-loop-tool.ts#L92-L104>)에
호출자 agent, rootCallId, parent token과 signal을 넘긴다.
[act 어댑터](<../../src/host/pixie-loop-tool.ts#L136-L147>)가 세션 bash를 사용하므로
세션의 파일 정책·샌드박스·승인 규칙을 우회하지 않는다([#31 D7](<../issues/31-pixie-loop.md#L118>)).

`isolated: false`가 기본이며 한 run의 [ActLock](<../../src/host/pixie-loop-engine.ts#L163-L180>)이
항목 간 act를 직렬화한다. true는 항목별 상태가 분리됐다는 선언으로 병렬 실행을 허용한다.
잠금은 run 내부의 act 구간에만 적용된다. 생성·판정이나 다른 run까지 전역 잠금하지 않는다.

명령 비정상 종료와 타임아웃은 보통 `[command failed]`를 붙인 observation이 된다.
stdout·stderr·exit code도 어댑터가 텍스트에 포함한다.
bash가 장기 실행 job으로 승격한 경우 [stopJob](<../../src/host/pixie-loop-tool.ts#L105-L115>)으로
취소하고 종료를 기다려 다음 act와 겹치지 않게 한다.
job 서비스 부재·정지 실패처럼 어댑터 자체가 던지는 오류까지 observation으로 바꾸지는 않는다.

[observe](<../../src/host/pixie-loop-engine.ts#L173-L189>)는 검토 텍스트를
maxObservationChars에서 잘라 표시를 붙인다(기본 8,000, 최대 32,000).
extract가 있으면 그 텍스트를 무상태 Pixie 호출로 축약하고 maxChars를 다시 적용한다.
이는 정보 손실을 동반할 수 있다. 선택지는 축약된 observation이 아니라 raw에서 읽는다.
기본값·상한은 [계약 상수](<../../src/pixie-loop-contracts.ts#L7-L16>)에 모여 있다.

## 5. episode, select, route

episode는 각 출력이 다음 행동인 모드이며 act가 필수다.
완료 질문이 통과할 때까지 관찰을 반영해 진행하되 maxAttempts가 최대 step 수가 된다.
[조합 검증](<../../src/pixie-loop-contracts.ts#L338-L358>)이 extract의 act 의존성과
observation 기반 select의 episode 의존성도 강제한다.

select에서는 Pixie가 후보를 쓰지 않는다. **선택지는 input 또는 최신 raw observation에서만 온다.**
[parseOptions](<../../src/pixie-loop-contracts.ts#L281-L295>)가 JSON의 options 배열을 읽고
2–255개의 고유 이름 또는 `{ name, description }` 항목을 검증한다.
[choose](<../../src/host/pixie-loop-engine.ts#L192-L203>)는 고정 instructions와 그 선택지로
choice 질문을 만들며, 선택된 이름 자체가 output이 된다([#31 D6](<../issues/31-pixie-loop.md#L117>)).

`minConfidence` 미달이면 해당 선택을 기록하고 즉시 escalated로 돌려준다.
이때 선택한 행동의 act를 실행하지 않는다.
observation 선택 episode는 최초 관찰이 없으므로 빈 output으로 act를 한 번 실행해 시작한다.
이 초기 관찰은 시도 횟수에 포함하지 않는다.
[초기화·저확신도 분기](<../../src/host/pixie-loop-engine.ts#L223-L237>)가 그 위치다.
retry select는 같은 선택지를 다시 고르며 낭비하지 않도록 실패 시 바로 반환한다.

route는 실행 경로를 분기시키는 워크플로우가 아니라 **choice 답변별 결과 분류**다.
[bucketOf](<../../src/host/pixie-loop-engine.ts#L205-L208>)와
[항목 bucket 갱신](<../../src/host/pixie-loop-engine.ts#L263-L267>)을 사용한다.
마지막으로 기록된 분류를 요약의 buckets에 집계하며 통과하지 않은 항목에도 bucket이 있을 수 있다.

## 6. Jev와 LLM 결정 엔진

공통 경계는 [JudgeEngine](<../../src/host/pixie-judge.ts#L6-L12>)이다.
요청은 state와 독립 질문들의 집합이고 반환값은 typed answers와 선택적 usage다.
질문 id는 응답 매칭용이다. 판정에 필요한 의미는 instructions에 적는다.

| 형식 | 반환값 | 루프 pass 규칙 |
| --- | --- | --- |
| noul | `type`, yes 확률 `noul`(0–1) | `noul >= min` |
| choice | `type`, `choice`, 옵션별 `probabilities`, `confidence` | choice가 `accept`에 포함 |
| score | `type`, 0부터 시작하는 소수 `score`, 단계별 `probabilities`, `confidence` | `score >= min` |

[checkAnswer](<../../src/host/pixie-judge.ts#L18-L44>)는 값 범위와 확률 분포를 검사한다.
choice·score의 확률 합 허용 오차는 0.02다.
유효 confidence가 없으면 가장 큰 확률을 사용한다. confidence는 정답 보증이 아니다.
noul에는 별도 probabilities 배열이나 confidence를 추가하지 않는다.
[failedQuestions](<../../src/pixie-loop-contracts.ts#L420-L430>)는 위 pass 규칙을 적용한다.
choice의 일반 pass에는 confidence 문턱이 없고, select의 minConfidence와 별개다.

엔진 선택은 [judgeEngineFor](<../../src/host/jev-judge.ts#L87-L94>) 한 곳에 모인다.
설정 `judgeEngine === 'jev'`이면 Jev를 사용한다(기본 모델 `jev-latest`).
그 외에는 `judgeModel ?? model`로 LLM 엔진을 만든다.
[설정 읽기](<../../src/host/judge-tool.ts#L69-L75>)는 프로필의 Studio 설정 저장소를 사용하며
도구 호출마다 현재 설정을 읽는다. 실제 키 값은 문서·로그·실행 예시에 넣지 않는다.

Jev 키는 Studio JSON이 아니라 DSH `credentials` 서비스에서
참조명 `TYPESAFE_API_KEY`로 **호출마다 resolve**한다.
[Jev 상수·자격 증명 경계](<../../src/host/jev-judge.ts#L6-L16>),
[키 조회·HTTP 요청](<../../src/host/jev-judge.ts#L51-L63>),
[#27 D2·D3](<../issues/27-jev-decision-engine.md#L99-L100>)가 근거다.
Jev는 DSH 모델 프로바이더로 등록하지 않고 Host에서 TypeSafe HTTP API를 직접 호출한다.
LLM 엔진은 DSH llm 서비스에 provider/model을 넘겨 그 서비스의 제공자 인증을 사용한다.
[LLM 요청](<../../src/host/pixie-judge.ts#L59-L77>)에서 Jev 키를 읽지 않는다.

[Jev 응답 처리](<../../src/host/jev-judge.ts#L65-L82>)는 429·529만 최대 두 번 재시도한다.
score의 인덱스 키 확률 객체는 [fromWire](<../../src/host/jev-judge.ts#L21-L29>)에서 배열로 맞춘다.
input_tokens/output_tokens는 inputTokens/outputTokens usage로 변환한다.
LLM도 JSON 답변을 같은 검사에 통과시킨다([parseJudgeOutput](<../../src/host/pixie-judge.ts#L47-L55>)).
결정 엔진의 반환 계약에는 이유가 없다. feedback은 별도 Pixie 호출의 추정이다.

**엔진 오류는 fail 판정이 아니라 error다.**
HTTP 오류·잘못된 JSON·누락 답변·비정상 스트림을 낮은 점수로 대체하지 않는다.
[#27 D5](<../issues/27-jev-decision-engine.md#L102>)와
[runJudge](<../../src/host/judge-tool.ts#L38-L44>)는 이 규칙을 공유한다.
루프는 시작 단계 오류를 run error로, 항목 처리 오류를 item error로 기록한다.
[시작 오류 처리](<../../src/host/pixie-loop-engine.ts#L306-L325>)와
[worker 오류 처리](<../../src/host/pixie-loop-engine.ts#L333-L352>)를 함께 본다.
item error가 있어도 나머지를 끝낸 run의 status는 done일 수 있다.

## 7. 한도, 동시성, 취소

[상한 상수](<../../src/pixie-loop-contracts.ts#L7-L16>)는 항목 2,000개,
retry 10회·episode 100step, concurrency 8, 토큰 5천만, 시간 6시간을 강제한다.
기본 maxAttempts는 3, concurrency는 4다. tokens/timeMs 자체는 명세에 필수다.
[runLoop](<../../src/host/pixie-loop-engine.ts#L281-L353>)는 제한된 수의 worker를 만들고
토큰 합계와 전체 실행 타이머를 공유한다.

usage는 Pixie와 judge를 분리한다. [usageTokens](<../../src/pixie-loop-contracts.ts#L433-L440>)는
양쪽 inputTokens와 outputTokens만 더한다. cache·reasoning 세부 수치를 다시 더하지 않는다.
토큰 한도는 보고된 usage를 호출 뒤 확인하는 방식이다.
동시 진행 중인 호출까지 고려하면 사전 예약식의 정확한 과금 상한은 아니다.
시간 한도는 compile·calibrate를 포함한 run 시작부터 측정한다.

| 상태 | 의미 |
| --- | --- |
| passed | 코드 검사와 필요한 판정 조건을 만족한 항목 |
| escalated | 시도 소진, 낮은 선택 확신도 등으로 호출자의 판단이 필요한 항목 |
| error | 모델·결정 엔진·어댑터 오류로 정상 판정을 완료하지 못한 항목/시작 실패 run |
| stopped | 토큰·시간 한도로 중단된 run |
| cancelled | 외부 취소된 run 또는 중단 signal을 받은 진행 중 항목 |
| skipped | 종료 때 아직 결과가 등록되지 않은 미시작 항목 |
| done | 실행기가 정상 종료됐다는 뜻이며 모든 항목 passed라는 뜻은 아님 |

[finish·ended](<../../src/host/pixie-loop-engine.ts#L290-L305>)가 run 상태와 미시작 항목을 정리한다.
한도 중단도 진행 중 항목에는 cancelled로 기록될 수 있어 run의 reason을 함께 읽는다.
[백그라운드 실행](<../../src/host/pixie-loop-tool.ts#L178-L200>)은 소유자가 있는 DSH job이다.
job_kill은 controller를 취소하며 진행 로그와 최종 요약을 job 결과로 돌려준다.
background 반환 자체는 완료가 아니다. item error만 있는 done도 job completed일 수 있다.

## 8. 레시피, 게이트, 훅과 저장 UI

[PixieLoopRecipes.save](<../../src/host/pixie-loop-recipe-store.ts#L38-L55>)는
검토 레시피 저장 시 compile+calibrate를 한 번 수행하고 고정 checks를 함께 저장한다.
실패하면 저장하지 않는다. 직접 checks를 준 경우 컴파일 모델 호출은 생략하지만 calibration은 한다.
단순 선택 레시피에는 검토 자체가 없으므로 이 단계도 없다.
이후 [runLoop의 options.checks 분기](<../../src/host/pixie-loop-engine.ts#L313-L321>)는 재컴파일·재보정을 생략한다.
따라서 엔진·모델 변경 뒤 기존 레시피의 판정 품질이 유지된다고 자동 보장하지 않는다.

도구의 recipe 호출은 items·output·run_in_background 외 추가 덮어쓰기를 거부한다.
[레시피 도구 진입](<../../src/host/pixie-loop-tool.ts#L160-L170>)이 저장된 실행 조건을 보존한다.
[레시피 실행 어댑터](<../../src/host/pixie-loop-recipe-run.ts#L9-L32>)는 게이트·훅 대상 하나를 처리한다.
check는 내부 `outputSource: 'input'` 모드로 대상의 앞뒤 공백을 제거한 값을 판정한다. 이는 이전 echo 스트림에 적용되던 trim을 보존한 것이며 원문 바이트 전체를 그대로 판정하는 계약은 아니다. 생성 모델 호출·사용량은 없고, 실패 피드백에는 기존대로 Pixie를 사용한다. 기존 모델 설정 필수 조건과 기록용 instruction도 유지한다.
repair는 원문을 입력으로 생성·재시도한다. act·episode·select 레시피는 이 경로에서 거부한다.

[recipeGateOutput](<../../src/host/pixie-loop-recipe-run.ts#L34-L38>)은 미통과를 stop,
repair 성공을 pass+replace로 바꾼다.
[게이트 runner](<../../src/host/pixie-gate-task-runner.ts#L123-L135>)가 사용량과 세션 기록을 연결한다.
기존 시점·프리셋·결과 적용 규칙은 유지한다([#31 D10](<../issues/31-pixie-loop.md#L121>)).
`pixie loop --recipe <name> --mode check|repair` 훅 헬퍼도 같은 어댑터를 사용한다.
[헬퍼 계약](<../../src/host/pixie-gate-helper.ts#L23>)과
[요청 처리](<../../src/host/pixie-gate-helper.ts#L160-L195>)에서
실행 중 grant·signal에 묶인 호출임을 확인할 수 있다. 성공 exit 0, 미통과 exit 1이며 `--json`은 세부 정보를 준다.

[PixieLoopStore](<../../src/host/pixie-loop-store.ts#L1-L54>)는 세션별 JSON 기록을 쓴다.
도구 플러그인과 Remote가 별도 플러그인이므로 파일이 공유 경계다.
세션별 쓰기 큐와 임시 파일 rename으로 스냅샷을 교체한다.
최근 50개를 목표로 오래된 비활성 run부터 제거하되 활성 run을 삭제하지 않아 일시 초과할 수 있다.
[prune](<../../src/host/pixie-loop-store.ts#L56-L68>)은 전체 durable 세션 목록에 없는 기록만 삭제하며,
목록 조회 실패 시 아무것도 지우지 않는다.

[throttledWriter](<../../src/host/pixie-loop-store.ts#L84-L96>)는 기본 500ms 병합 쓰기와
30초 heartbeat를 사용한다. 90초 넘게 갱신 없는 활성 기록은
[view](<../../src/host/pixie-loop-store.ts#L10-L37>)에서 interrupted/cancelled로 표시한다.
[Loops UI](<../../src/pixie-loop-runs.tsx#L23-L101>)는 상태·질문·항목별 시도·관찰·선택·피드백을 읽는 창이다.
[레시피 UI 저장 처리](<../../src/pixie-loop-recipes-page.tsx#L39-L46>)는 JSON 파싱 후 Remote 저장 호출을 하고
컴파일·보정 오류를 보여 준다. UI에서 성공처럼 보이도록 오류를 숨기지 않는다.

## 9. 운영 관찰: Studio 0.6.1 E2–E4

이 절은 구현 보장이 아니라 특정 실행의 관찰이다.
[통합 보고서](<../../dist/e2e/0.6.1/report.md#L46-L71>)와
[E2 실행 기록](<../../dist/e2e/0.6.1/e2.md#L21-L29>)을 함께 읽는다.
해당 dist 자료는 로컬 E2E 산출물이므로 배포 저장소에서 제공되지 않을 수 있다.
개인 프로필 절대 경로·인증값은 여기 옮기지 않는다.

### E2: 149항목의 실제 집계

Jev 판정 본 실행 `6b777318-a949-412d-809c-fb5d1b0d3101`은
**passed 133 / escalated 15 / error 1**이었다.
first stream event timeout 1건만 재실행해 통과하여 최종 **134 / 15 / 0**이 됐다.
이 둘을 하나의 run 결과로 혼동하지 않는다.
출처는 [E2 본 실행·재실행](<../../dist/e2e/0.6.1/e2.md#L25-L29>)이다.

아래 분포는 제공된 세션 엔진 기록의 해당 run `items[].attempts.length`를 직접 센 값이다.
원본은 한 줄 JSON이며 파일 복사 없이 읽기 전용으로 집계했다.

| 본 실행 시도 수 | passed | escalated | error | 합계 |
| --- | ---: | ---: | ---: | ---: |
| 0 | 0 | 0 | 1 | 1 |
| 1 | 111 | 0 | 0 | 111 |
| 2 | 14 | 0 | 0 | 14 |
| 3 | 8 | 15 | 0 | 23 |
| 합계 | 133 | 15 | 1 | 149 |

총 기록 시도는 208회다. 별도 재실행 `b7004861…`은 1회 만에 통과해 총 209회가 된다.
0회 error는 출력 생성 전에 실패했다는 뜻이지 “판정 실패 1회”가 아니다.
이 분포는 요약 보고서의 추정이 아니라 엔진 기록의 배열 길이를 집계한 값이다.

### 피드백의 효과와 역효과를 함께 보여 주는 항목

같은 run의 `pluginManager::restartReasonPackageMoved`는 세 번 만에 통과했다.
기록의 기준은 자연스러움 score ≥ 1.5, 의미 noul ≥ 0.6, 문체 noul ≥ 0.5였다.

| 시도 | 자연스러움 / 의미 / 문체 | 판정·피드백 |
| --- | --- | --- |
| 1 | 1.42 / 0.94 / 0.64 | 자연스러움 미달. “다른 디렉터리로 확인되거나”를 “다른 디렉터리를 가리키게 되거나”로 바꾸라고 추정한다 |
| 2 | 1.57 / 0.94 / 0.24 | 자연스러움은 개선됐지만 피드백을 따른 “제거하세요”가 문체 미달이다 |
| 3 | 1.54 / 0.93 / 0.54 | “제거하십시오”로 바꾸어 세 조건을 모두 통과한다 |

첫 피드백이 다른 조건을 깨는 제안을 할 수도 있다.
매번 코드 검사와 고정 질문 전체를 다시 적용해야 하는 이유다.
피드백 문장을 Jev가 제공한 원인으로 해석하면 안 된다.
해당 시도 값의 출처는 위 run의 해당 항목 attempts이며,
처리 규칙은 [interpret와 재검토](<../../src/host/pixie-loop-engine.ts#L260-L276>)다.

### escalated를 무조건 더 돌리지 않는다

[E2 원인 분류](<../../dist/e2e/0.6.1/e2.md#L70-L76>)에는 URL 전용 2개,
자리표시자 전용 2개가 있다. 원문을 올바르게 보존하면 한글이 없으므로
`[가-힣]` match 조건을 구조적으로 만족할 수 없다.
억지로 한글을 추가하거나 자리표시자를 번역하는 것은 해결이 아니다.
실제로 entryMetaAuthor는 세 번 모두 자리표시자를 바꿔 코드 검사에서 실패했다.
URL 항목도 마지막 실패가 항상 regex인 것은 아니며, Markdown 링크를 추가해 placeholders에 걸린 시도가 있다.

보고서는 자연스러움 1.26–1.48의 경계 집중을 기록한다.
엔진 기록의 마지막 시도를 대조하면 자연스러움 미달 10개 중 **8개가 이 구간**에 있고,
emptyDescription 1.05, sourcesDescription 1.08은 더 낮다.
따라서 “미달은 모두 경계값”이라고 일반화하지 않는다.
문체만 미달인 openInstalled는 0.39였다.
재시도 확대보다 입력 종류 분리, 용어집·문맥 보강, calibration 재설계를 먼저 검토한다.

항목 독립성 때문에 같은 영어도 결과가 갈릴 수 있다.
`Show secret`은 “시크릿 보기”와 “비밀값 표시”로 각각 통과했다.
[E2 동일 영어 대조](<../../dist/e2e/0.6.1/e2.md#L50-L69>)는 문체·용어 혼재도 보여 준다.
항목별 pass는 집합 전체의 용어 일관성 보증이 아니므로 메인 에이전트가 후처리로 대조한다.

Jev 질문은 영어로 작성하는 것을 안정적인 운영 기본값으로 삼되 절대 보장으로 표현하지 않는다.
[#27 언어 품질 주의](<../issues/27-jev-decision-engine.md#L175>)는 영어가 가장 정확하다는 제공자 설명을 기록하고,
[실사용 관찰](<../issues/27-jev-decision-engine.md#L60>)은 같은 문구의 점수 변동도 기록한다.
이 E2 기록의 질문은 영어지만 한·영 질문을 통제 비교한 실험은 아니다.

### E3 사실 검증과 E4 제공자 장애

[E3 실행 결과](<../../dist/e2e/0.6.1/e3.md#L26-L31>)는 80항목 중
passed 30 / escalated 46 / error 4였다.
JSON 문자열로 감싼 작업자 출력과 부적절한 no_claims 같은 작업자 실패가 있었고,
통과 30개 중 **9개는 shared에 없는 인용**을 썼다.
검증자는 모든 인용을 스크립트로 원문과 재대조한 뒤 다시 판정했다.
결정 엔진만으로는 인용의 실재·출처 일치를 보장할 수 없다.
[인용 불일치 목록](<../../dist/e2e/0.6.1/e3.md#L73-L75>)의 9건은 다른 결함 분류와 일부 겹친다.

[E4 기록](<../../dist/e2e/0.6.1/report.md#L65-L71>)은 37항목 전부가
OpenCode 무료 티어의 403 FreeTierError로 error가 된 사례다.
판정 기준을 못 맞춘 escalated가 아니라 모델 제공자 차단으로 작업자 호출이 실패했다.
재실행 1건도 같은 원인이었다. 제공자가 복구되면 같은 명세로 재실행할 대상이며,
기준값을 낮춰 해결할 문제는 아니다. 오류 메시지를 낮은 점수로 바꾸면 이 구분을 잃는다.

## 10. 수정 지점과 회귀 테스트

계약을 바꿀 때는 도구 JSON 스키마와 실제 검증 함수를 함께 확인한다.
[LOOP_PARAMETERS](<../../src/host/pixie-loop-tool.ts#L34-L61>)는 호출자 노출 계약이고,
[validateLoopSpec](<../../src/pixie-loop-contracts.ts#L325-L386>)은 실행 시 강제 계약이다.
판정 변경은 엔진과 pass 규칙, 실행 변경은 act 어댑터와 취소 수명,
표시 변경은 기록 모델과 UI를 함께 추적한다.

다음은 관련 테스트 파일과 보장 범위다. 목록은 현재 테스트 코드 기준이며 이 문서 작성 중 재실행한 결과는 아니다.

- [pixie-loop.test.mjs](<../../test/pixie-loop.test.mjs#L18-L195>): 명세·pass 검증, 코드 검사, compile 교정·calibration, 스레드 격리, 피드백, 엔진 오류, 예산·취소·동시성 경계를 확인한다.
- [pixie-loop-phase2.test.mjs](<../../test/pixie-loop-phase2.test.mjs#L25-L164>): 셸 인용, act 직렬화·관찰·extract, episode, raw 선택지·저확신도, route, 오류 시 시도 보존을 확인한다.
- [pixie-loop-tool.test.mjs](<../../test/pixie-loop-tool.test.mjs#L58-L120>): 도구 등록·JSONL·요약, 사전 검증, 소유 job·취소, 타임아웃 act job 정지를 확인한다.
- [pixie-loop-runs.test.mjs](<../../test/pixie-loop-runs.test.mjs#L35-L89>): 실행 UI의 질문·피드백·관찰 표시, 세션 기록 보존·interrupted 표시, 병합 쓰기를 확인한다.
- [pixie-loop-phase3.test.mjs](<../../test/pixie-loop-phase3.test.mjs#L26-L170>): 레시피 저장 시 1회 compile·calibrate, check 원문 보존, repair, 게이트 제약·기록·usage, 훅과 레시피 UI를 확인한다.
- [pixie-loop-guide.test.mjs](<../../test/pixie-loop-guide.test.mjs#L17-L62>): 공개 가이드 JSON 예제의 계약·언어 대응, 번역 예제 실행, 배포 스킬과 훅 예제 bash 문법을 확인한다.

이 문서의 실측은 기존 E2E 기록을 재독해한 것이다.
새 모델 호출, GUI 재검증, 미수정 DSH에 대한 독립 배포 검증을 수행했다는 의미가 아니다.
