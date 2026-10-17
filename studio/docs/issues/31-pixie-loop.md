---
kind: implementation-spec
status: ready
---

# #31 Pixie Loop — 메인 컨텍스트 밖에서 도는 Pixie·Jev 반복 작업

## 요약

메인 에이전트가 반복 작업을 **선언형 루프 명세**로 넘기면, Studio 호스트가 기본 Pixie 모델과 결정 엔진(Jev 또는 LLM)으로 항목마다 작업 → 판정 → 해석 → 재시도를 돌리고 요약과 예외 항목만 돌려준다. 루프 엔진은 Studio 호스트 모듈 하나이며, 에이전트 도구 `pixie_loop`, Pixie Gate 판정 방식, 훅 스크립트 헬퍼 `pixie loop`이 같은 엔진을 쓴다.

현재 `judge` 도구와 Pixie Gate는 한 번씩만 쓰도록 되어 있다. 그래서 대량 번역처럼 "판정 → 거부 → 수정 → 재판정"을 반복하면 모든 판정 결과와 수정 과정이 메인 컨텍스트에 쌓인다. 이 기능은 그 반복을 메인 컨텍스트 밖으로 옮긴다.

- GitHub 이슈: [#31](https://github.com/jammer-droid/deepseek-harness/issues/31)
- 선행: [#25 Pixie](25-pixie.md), [#26 Pixie Gate](26-pixie-gate.md), [#27 Jev 결정 엔진](27-jev-decision-engine.md)
- 첫 사용처: [#30 DSH 전체 한국어 번역](30-korean-locale.md)의 judge 검수 번역 스킬
- 기준 브랜치·시작 커밋: `studio/feat/workflow` @ `da3aba95cb`
- 대상 DSH: Studio peer 범위 `0.2.0-rc.2 || 0.2.1-alpha.2`. 본체 수정 없음. 필요한 공개 API는 S1에서 확인한다

## 현재 진행 상황

1차·2차·3차(S1–S16) 구현과 검증을 마쳤다. S8의 #30 번역 스킬 비교만 사용자 DSH 홈 스킬 수정 승인이 필요해 남겼다.

| 단계 | 상태 | 커밋 |
| --- | --- | --- |
| S1 공개 API 확인 | 완료 (아래) | — |
| S2 루프 계약과 검증 | 완료 | `f22e14b34b` |
| S3 compile과 calibration | 완료 | `f22e14b34b` |
| S4 루프 엔진 | 완료 | `f22e14b34b` |
| S5 도구 `pixie_loop` | 완료, 실세션 확인 | `f22e14b34b` |
| S6 실행 기록과 Pixie 탭 › 루프 | 완료, Web 확인 | `f22e14b34b` |
| S7 가이드와 스킬 | 완료, 에이전트가 스킬을 읽고 명세 작성 | `1d7dfadc92` |
| S8 1차 검증 | Studio 검증 완료. #30 스킬 비교 미실행 | `d4e5c1574d` |
| S9 `act` | 완료, 실세션 DOM 실험 확인 | `0d46a508d8` |
| S10 `extract` | 완료 (단위 테스트) | `0d46a508d8` |
| S11 `route` | 완료 (단위 테스트) | `0d46a508d8` |
| S12 `until` (재시도형·에피소드형 `mode: episode`) | 완료 (단위 테스트) | `0d46a508d8` |
| S13 선택 모드 | 완료 (단위 테스트) | `0d46a508d8` |
| S14 저장된 레시피 | 완료, Web 저장 확인 | `cbfa654370` |
| S15 게이트 판정 방식 | 완료, 실세션 고치기 확인 | `cbfa654370`, 기록 위치 수정은 이 커밋 |
| S16 훅 헬퍼 `pixie loop` | 완료, 가이드 예시를 실제 헬퍼로 실행 | `cbfa654370` |

### 2차·3차에서 정한 것

- `act`는 `bash` 하나만 허용하고 `safeToRepeat: true`를 필수로 받는다. 값은 셸 단어 하나로 감싼다. `isolated: false`(기본)이면 act를 항목 사이에서 한 번에 하나씩 실행한다. calibration 예시는 `observation`을 직접 주고, 확인 단계에서는 명령을 실행하지 않는다.
- 2차 "until"은 별도 필드 대신 `mode: retry | episode`로 정했다. 재시도형은 기존 `retry`, 에피소드는 `act`가 필수이며 단계 상한은 100이다.
- 선택 모드의 보기는 항목 입력이나 마지막 실행 결과의 JSON `options`에서만 읽는다(D6). 기준 없는 한 번 고르기만 calibration 없이 허용한다. `minConfidence` 미만은 넘긴다.
- 레시피는 저장할 때 compile과 calibration을 한 번 하고 질문을 고정한다. 게이트와 훅 스크립트는 `act`·연속 실행·선택 레시피를 거부한다. 게이트는 훅 스크립트와 레시피를 함께 쓸 수 없다(스크립트 안에서 `pixie loop` 사용). `pixie loop` 한 번은 헬퍼 호출 1회로 센다(O5).

### S1 결과

`dsh-v0.2.0-rc.2`와 `dsh-v0.2.1-alpha.2` 태그 소스에서 확인했다.

| API | 결과 |
| --- | --- |
| `jobs` `start`·`wait`·`kill`·`get`·`read`, `JobOutcome.result`, `JobHandle.append`·`updateProgress` | 두 버전에 같음. `result`는 정산 뒤 첫 `job_output`에 한 번 전달된다 |
| `tools.execute`(`parent`·`rootCallId`·`agent`), `ToolExecutionSuccess.value` | 두 버전에 같음. 항목 파일은 `read` 결과의 `lines`·`totalLines`로, 결과는 `write`로 쓴다 |
| `llm.stream` | 기존 Pixie·판정에서 쓰는 것과 같다 |
| `credentials` | #27에서 확인함 |

`pixie_loop`은 `tools`만 주입받고 `jobs`·`llm`·`credentials`는 호출 때 `ctx.get`으로 읽는다. 기록은 `<profile>/studio-data/pixie/loops/`에 도구 플러그인이 쓰고 Studio Remote `loopRuns`가 읽는다. 실행 중인 기록은 30초마다 다시 쓰며(heartbeat), 90초 넘게 갱신이 없으면 중단된 것으로 표시한다.

### 검증 기록

- **로컬:** `npm run typecheck`, `npm test`(빌드 포함) 658/658 통과, `git diff --check` 통과. 새 테스트는 `test/pixie-loop.test.mjs`(계약·코드 검사·엔진, 가짜 모델), `test/pixie-loop-tool.test.mjs`(실제 DSH `ToolRuntime`), `test/pixie-loop-runs.test.mjs`(화면·저장소), `test/pixie-loop-guide.test.mjs`(가이드 예시 명세를 추출해 검증하고 엔진으로 실행).
- **독립 설치·실세션:** 수정하지 않은 DSH `0.2.0-rc.2`에 pack한 `@matamt-dbg/dsh-studio@0.5.0`을 격리 프로필 `loop-e2e`로 설치했다. Studio Master 세션에서 foreground 5/5 통과(재시도 1건 포함)와 background job 정산을 확인했다. 세션 로그에 항목별 시도와 피드백이 없음을 확인했다. 기록: [#31 검증](../verification/pixie-loop-31/README.md).
- **2차·3차:** `npm test` 676/676. 실세션에서 `act` DOM 실험, Web 레시피 저장, 사용자 지시 시점 고치기 게이트를 확인했다. 기록: [#31 검증](../verification/pixie-loop-31/README.md#2차3차-실동작-확인).
- **코드 리뷰 (마무리 절차 2단계):** `subagent_role` Reviewer가 `4dd9191aed..d7db341fe3`를 읽기 전용으로 검토했다(엔진·계약·실행 정확성 중심). 차단 2건, 수정 권장 4건을 모두 `09abaeb6e1`에서 고치고 회귀 테스트를 더했다.
  - 차단: 제한 시간을 넘긴 `act` 명령이 bash job으로 남아 다음 실행과 겹치고 취소되지 않음 → job을 멈추고 끝날 때까지 기다린 뒤 결과로 판정. 따옴표 안 자리(`"{{output}}"`)에서 셸 치환이 실행됨 → 따옴표 안이나 다른 글자에 붙은 자리를 거부.
  - 수정 권장: `extract`가 줄인 글에서 보기를 읽음(D6 위반) → 보기는 명령 원래 출력에서만 읽음. 기준 없는 한 번 고르기가 코드 검사를 건너뜀 → 실행. 토큰 상한을 시도 끝에만 확인 → 호출마다 확인하고 상한과 같으면 멈춤. 판정·피드백 오류 때 시도 기록이 사라짐 → 판정 전에 시도를 기록하고 오류를 붙임.
  - UI·범위 기준은 메인 에이전트가 확인했다: `studio/` 밖 변경 없음, 새 화면에 인라인 스타일·색 값 없음, 화면 문구 ko·en·zh.
- **미검증:** background `job_kill`, 상한 도달·calibration 거부·엔진 오류의 실모델 재현, 연속 실행·선택·route·extract의 실모델 실행, 게이트 판정 모드와 다른 시점, `0.2.1-alpha.2`, #30 스킬과의 비교.

## 범위

**포함 (단계적)**

- 1차: 루프 엔진, `compile`(검증 포함)·`generate`·내장 코드 검사·`check`·`interpret`·항목 재시도, `forEach`, 도구 `pixie_loop`(foreground/background), 실행 기록, 작성 가이드와 에이전트 스킬. 번역으로 검증한다.
- 2차: `act`(화이트리스트 도구 1회 실행)·`extract`·`route`, `until`(재시도형·에피소드형), 선택 모드, 가이드에 `act` 어댑터 스크립트 작성법 추가. DOM 실험으로 검증한다.
- 3차: 저장된 레시피와 편집 화면, 게이트 판정 방식(`check`·`repair`), 훅 헬퍼 `pixie loop`, Pixie Gate 가이드와 훅 스킬 갱신.

**제외 (비목표)**

- Pixie가 스스로 도구를 골라 쓰는 다단계 탐색. `subagent_role`이 맡는다.
- 항목 사이 공유 상태, 실행 중 용어집 갱신, 메인 대화 fork.
- 임의 JS 스크립트 루프. 복잡한 흐름은 코어 `workflow` 도구가 맡는다. PTC 실행기는 코어 내부 구현이라 쓰지 않는다.
- 단계별 모델 선택. 모든 Pixie 단계는 기본 Pixie 모델을 쓴다.
- 이미지 판정, 실시간 조작.
- 외부 프로세스가 결정 엔드포인트를 직접 부르는 장기 토큰 방식. 게임 같은 외부 프로세스는 `act` 어댑터로만 연결한다.
- 코어 `workflow` 스크립트 안의 `judge()`/`pixieLoop()` hook. 코어를 바꿔야 한다.

## 현재 근거

| 근거 | 사실과 영향 |
| --- | --- |
| [judge-tool.ts](../../src/host/judge-tool.ts) | `runJudge`와 `judgeEngineFor`로 요청 하나를 판정하고 결과를 그대로 반환한다. 엔진 선택과 실패 규칙(D5: 오류는 "아니오"가 아님)은 재사용한다 |
| [pixie-runtime.ts](../../src/host/pixie-runtime.ts) | `llm.stream`을 세션 밖에서 직접 호출하고, `untilAborted`, 사용량 집계, 시간 제한을 갖췄다. generate·interpret 호출의 기반이다 |
| [pixie-gate-task-runner.ts](../../src/host/pixie-gate-task-runner.ts) | 게이트는 Pixie 1회 또는 훅 스크립트 + 헬퍼 호출로 끝난다. 3차에서 판정 부분을 엔진으로 바꿀 자리다 |
| [pixie-gate-helper.ts](../../src/host/pixie-gate-helper.ts) | `/ask`·`/judge` 경로, 실행별 토큰, 실행당 20회·256KB 상한, `helperJudgement`의 threshold 규칙. 3차의 `/loop` 경로와 통과 규칙에 재사용한다 |
| [task-tool.ts](../../src/host/task-tool.ts) | `jobs.start`, `handle.append`, 취소, owner 확인 패턴. 현재 빌드에서는 빠져 있다. background 실행의 참고 구현이다 |
| [batch-tool.ts](../../src/host/batch-tool.ts) | `tools.execute`로 세션 정책을 거쳐 다른 도구를 부른다. 항목 파일 읽기·결과 쓰기·`act`에 같은 경로를 쓴다 |
| [build.mjs](../../build.mjs), `packages/shell/package.json` | 도구 플러그인은 `./batch`, `./judge`처럼 별도 export로 배포한다. `./loop`를 같은 방식으로 추가한다 |
| [Pixie Gate 가이드](../../release/docs/appendix/pixie-gate.ko.md), [훅 스킬](../../release/docs/appendix/studio-pixie-hook-guide/SKILL.md), [pixie-hook-skill.ts](../../src/host/pixie-hook-skill.ts), [skill-install.ts](../../src/host/skill-install.ts) | 사용자 가이드는 `release/docs/appendix/`에 ko·en으로 두고, 에이전트 스킬은 `SKILL.md`(규칙)와 영문 가이드(`guide.md`)를 빌드가 패키지에 복사한다. Studio가 시작할 때 `<DSH 홈>/skills/`에 설치하며, 사용자가 고친 파일은 덮어쓰지 않는다. 루프 가이드와 스킬도 같은 방식을 쓴다 |
| [Jev API](https://docs.typesafe.ai/api.md) | 확률만 반환하고 이유는 주지 않는다. choice 최대 255개, score 2–10단계, 요청 64k 토큰 |
| 코어 `workflow` ([tool-workflow](../../../packages/workflow/tool-workflow/README.md)) | `agent()`는 완전한 서브에이전트를 띄워 무겁고, 스크립트 안에서 judge를 부를 수 없다. 역할을 나누는 근거다 |

## 확정한 결정

| ID | 결정 |
| --- | --- |
| D1 | 루프 엔진은 Studio 호스트 모듈 하나로 만들고, 도구·게이트·훅 헬퍼가 공유한다. 레시피, 컨텍스트 정책, 상한, 기록 형식은 경로와 상관없이 같다 |
| D2 | 컨텍스트: 같은 항목의 `generate` 재시도는 그 항목 전용 스레드에 직전 출력과 피드백을 **누적**한다. 그 밖의 Pixie 호출(`compile`, `extract`, `interpret`, 요약)은 매번 새로 만드는 **무상태**다. 항목끼리, 메인 대화와는 항상 분리한다 |
| D3 | 모든 Pixie 단계는 Pixie 설정의 기본 Pixie 모델을 쓴다. 판정은 결정 엔진 설정을 따른다 |
| D4 | 통과 여부는 결정 엔진 결과와 고정된 통과 규칙만으로 정한다. `interpret`가 쓴 글은 재시도 피드백이며 판정을 바꾸지 않는다. 기록에는 "Pixie 추정"으로 표시한다 |
| D5 | `compile`은 자연어 기준을 결정 엔진 질문 세트로 바꾸며, 루프마다 한 번만 실행하고 고정한다. 명세의 통과 예시·실패 예시로 먼저 판정해 보고, 질문이 둘을 가르지 못하면 루프를 시작하지 않고 오류를 반환한다. 검증을 통과하면 메인 에이전트 확인 없이 바로 시작한다 |
| D6 | 질문 세트를 항목마다 바꾸는 것은 명시적으로 켠 경우에만 허용한다(2차). 선택 모드는 질문 문구를 고정하고, 보기는 명세가 정한 출처(게임이 알려준 가능한 행동 등)에서만 채운다. Pixie가 보기를 만들지 않는다 |
| D7 | Pixie 단계에는 도구가 없다. `act`는 명세에 화이트리스트로 정한 도구를 호스트가 `tools.execute`로 실행하며, 세션의 파일 정책·샌드박스·승인 규칙을 그대로 따른다. 승인이 필요한 호출은 background에서 거부된다 |
| D8 | 상한: 항목 수, 항목당 시도 횟수, 동시 실행 수, 전체 토큰, 전체 시간. 상한에 도달하면 남은 항목을 중단하고 지금까지의 요약을 반환한다. 부분 결과를 성공으로 보고하지 않는다 |
| D9 | 메인 에이전트에게 돌아가는 것은 요약 수치, 결과 파일 경로, 실패·예외 항목 목록(항목 id, 시도 횟수, 통과하지 못한 질문과 값, 마지막 피드백)뿐이다. 항목별 시도 이력은 Studio 실행 기록에만 남긴다 |
| D10 | 게이트 연결은 판정 부분만 바꾼다. 실행 시점, 프리셋, 결과 적용 규칙(`gateOutputPlan`)은 그대로 둔다. `repair` 모드는 결과를 바꿀 수 있는 시점(`tool-after`, `agent-message`, `user-message`)에서만 허용한다 |
| D11 | 1차에 내장 코드 검사 세 종을 둔다. `placeholders`(원문의 `{name}`·`%s`·`{{x}}` 같은 자리표시자와 태그가 출력에 그대로 있는지), `regex`(출력이 정규식에 맞는지 또는 맞지 않는지), `json`(출력이 JSON으로 읽히는지, 필요하면 지정한 키가 있는지). 코드 검사는 결정 엔진 판정보다 먼저 실행하고, 하나라도 실패하면 판정을 부르지 않고 실패로 처리한다. 임의 스크립트 검사는 2차 `act`로 미룬다 |
| D12 | `interpret`에는 통과하지 못한 질문의 instructions·값·임계값, choice 실패 유형 이름, 실패한 코드 검사와 그 메시지, 이번 출력, 원래 항목 입력을 넘긴다. 통과한 질문과 이전 시도의 판정 값은 넘기지 않는다 |
| D13 | 기능마다 그 기능을 쓰는 스크립트·명세 작성 가이드를 같은 단계에서 제공한다. 사용자 가이드는 `release/docs/appendix/`에 ko·en으로 쓰고, 에이전트가 같은 규칙으로 명세를 쓰도록 Studio가 설치하는 에이전트 스킬에 넣는다. 가이드의 예시는 실제 엔진(가짜 모델·엔진 가능)으로 실행해 문서에 적은 결과와 같음을 확인한다. 기능이 바뀌면 가이드와 스킬을 같은 커밋에서 고친다 |

## 루프 명세 (1차 계약 초안)

```jsonc
{
  "items": { "inline": [{ "id": "k1", "input": "…" }] } | { "path": "work/pending.jsonl" },
  "shared": "용어집·스타일 가이드 등 모든 항목이 공유하는 고정 컨텍스트",
  "work": { "instruction": "다음 문자열을 한국어로 번역하라…" },
  "criteria": "자연어 기준: 의미 누락 없음, 용어집 준수, 해요체",
  "codeChecks": [{ "type": "placeholders" }, { "type": "regex", "pattern": "[가-힣]", "expect": "match" }],
  "calibration": { "pass": [{ "input": "…", "output": "…" }], "fail": [{ "input": "…", "output": "…" }] },
  "maxAttempts": 3, "concurrency": 4,
  "limits": { "tokens": 2000000, "timeMs": 3600000 },
  "output": "work/done.jsonl",
  "run_in_background": true
}
```

- `compile`의 결과(질문 세트와 통과 규칙)는 실행 기록에 저장한다. 같은 질문 세트를 직접 넘기는 `checks` 필드를 둘지는 O3에서 정한다.
- 결과 파일의 각 줄: `{ id, status: "passed" | "escalated" | "error", output?, attempts, answers }`.
- 반환: `{ runId, passed, escalated: [...], errors: [...], outputPath, usage }`. background면 `{ jobId, runId }`를 반환하고 정산 시 같은 내용을 job 결과로 남긴다.

## 단계

### S1 공개 API 확인

- **결과:** 대상 DSH 두 버전에서 Studio 플러그인이 `llm.stream`, `tools.execute`(read·write·bash), `jobs`(start·wait·kill·output), `credentials`를 쓸 수 있는지, background job 정산이 모델에게 어떻게 알려지는지 확인한다. 자식 에이전트(`subagent_role`, workflow `agent()`)에게 `pixie_loop`이 보이는 조건도 기록한다.
- **변경:** 없음. 결과는 이 문서에 기록한다.
- **수용:** 각 API별 존재 여부와 근거(설치 모듈 경로 또는 태그 소스). 하나라도 없으면 해당 단계를 `blocked`로 표시하고 대안을 적는다.

### S2 루프 계약과 검증

- **선행:** S1
- **결과:** 명세·질문 세트·통과 규칙·항목·결과·실행 기록 타입과 검증 함수. Host·Client 의존이 없는 모듈(`src/pixie-loop-contracts.ts`).
- **수용:** 필수 필드, 상한 범위, 항목 id 중복, calibration 누락, 지원하지 않는 필드에 대한 통과·거부 테스트.

### S3 compile과 검증

- **선행:** S2
- **결과:** Pixie가 `criteria`를 결정 엔진 질문 세트와 통과 규칙으로 바꾼다. 출력은 `validateJudgeRequest`와 통과 규칙 검증을 통과해야 한다. calibration의 통과 예시는 모두 통과하고 실패 예시는 모두 실패해야 시작한다(D5). 형식 오류는 한 번만 다시 compile하고, 그래도 실패하면 오류로 반환한다.
- **수용:** 가짜 Pixie·가짜 엔진으로 성공, 형식 오류 후 재시도 성공, 형식 오류 소진, calibration 불일치로 시작 거부, 취소 테스트.

### S4 루프 엔진

- **선행:** S3
- **결과:** `forEach` 실행기. 항목마다 generate(누적 스레드) → 내장 코드 검사(D11) → check → (실패 시) interpret(무상태, D12 입력) → 피드백 누적 → 재시도. 동시 실행 수 제한, D8 상한, 취소, 사용량 합산(Pixie·엔진 분리), 항목별 시도 이력. 판정 오류는 항목 `error`로 기록하고 실패로 바꾸지 않는다.
- **수용:** 코드 검사 세 종의 통과·실패(자리표시자 누락·추가, 정규식 match/no-match, JSON 파싱·키 누락), 코드 검사 실패 시 판정 미호출, interpret 입력이 D12 범위만 담음, 첫 시도 통과, 재시도 후 통과, 시도 소진 후 escalated, 엔진 오류, 토큰·시간 상한 중단, 동시 실행 수 준수, 취소 시 진행 중 호출 정리, 스레드에 다른 항목 내용이 섞이지 않음, 재시도 스레드가 누적됨 테스트.

### S5 도구 `pixie_loop`

- **선행:** S4
- **결과:** 도구 등록과 별도 export `./loop`. 항목 파일 읽기·결과 쓰기는 `tools.execute`(read·write)로 하여 세션 파일 정책을 따른다. foreground는 결과 요약을 반환하고, background는 job으로 등록하여 진행 상황을 `handle.append`로 내보내며 `job_kill`로 취소한다. 결과 렌더링은 D9 범위만 담고 길이 상한을 둔다.
- **변경:** `src/host/pixie-loop-tool.ts`, [build.mjs](../../build.mjs), `packages/shell/package.json` exports·files, Studio Master 도구 목록 포함 여부(Optimized 제외는 `judge`와 같게).
- **수용:** 실제 DSH `ToolRuntime`에 등록해 스키마·실행·오류·취소 테스트. background 정산과 kill. 모델에게 보이는 설명과 결과 렌더링 스냅샷.

### S6 실행 기록

- **선행:** S4
- **결과:** 세션별 루프 실행 기록 저장(compile 결과, 항목별 시도·답·피드백·사용량). Pixie 탭에서 실행 목록과 항목 상세를 볼 수 있다. 기존 게이트 실행 기록과 같은 저장 방식(직렬화, 임시 파일 rename, 보존 상한)을 따른다.
- **변경:** 기록 저장소, Remote, Client 화면, 로캘 ko·en·zh. 공용 부품 우선([디자인 시스템](../development/design-system.md)).
- **수용:** 저장·재시작·보존 테스트, UI 스냅샷, Web 배포 후 라이트·다크·좁은 폭 확인.

### S7 작성 가이드와 에이전트 스킬

- **선행:** S5
- **결과:** 사용자 가이드 `release/docs/appendix/pixie-loop.ko.md`·`pixie-loop.md`. 다음을 담는다.
  - 언제 쓰는가: `pixie_loop`, `judge`, `subagent_role`, 코어 `workflow`, Pixie Gate 중 무엇을 고를지 판단표
  - 명세 필드 전체 참조, 컨텍스트 정책(D2), 통과 규칙(D4)
  - 기준(`criteria`) 쓰는 법: 질문으로 바꾸기 쉬운 문장, choice 실패 유형 나누기, 정확한 검사는 코드 검사로 돌리기
  - calibration 예시 고르는 법과 compile이 거부됐을 때 고치는 법
  - 코드 검사 세 종의 옵션과 예시
  - 상한 정하는 법, 결과 파일과 escalated 항목 처리, 다시 실행할 때 이어가는 법
  - 예시 명세: 번역 검수, 문서 교정, 파일별 감사(항목 = 파일 내용)
  - 할 수 없는 일(비목표·알려진 한계)
- **에이전트 스킬:** `studio-pixie-loop-guide`(`SKILL.md` 규칙 + 영문 가이드 `guide.md`). 기존 `studio-pixie-hook-guide`와 같은 빌드 복사·설치 경로를 쓴다. 에이전트가 사용자 요청을 루프 명세로 바꾸고, 범위 밖이면 다른 도구를 권하도록 한다.
- **변경:** 위 문서, [build.mjs](../../build.mjs) 스킬 복사, 스킬 묶음 모듈(`pixie-hook-skill.ts`를 일반화하거나 새 모듈), [shell.ts](../../src/host/shell.ts) 설치 목록, [사용자 가이드](../../release/docs/guide.ko.md) 부록 링크, release README 기능 소개.
- **수용:** 가이드의 예시 명세를 문서에서 추출해 실제 루프 엔진(가짜 Pixie·가짜 엔진)으로 실행하고 문서에 적은 결과와 비교하는 테스트. 스킬 설치·사용자 수정 보존 테스트(기존 `installSkill` 테스트와 같은 방식). 격리 프로필에서 에이전트가 스킬을 찾는지 확인.

### S8 번역 스킬 적용과 1차 검증

- **선행:** S6, S7
- **결과:** #30 번역 스킬을 "`pixie_loop`에 명세 하나를 넘기고 escalated 항목만 처리"하는 방식으로 고친 판을 만든다. 같은 네임스페이스를 기존 방식과 비교한다(메인 컨텍스트 토큰, 총 사용량, 통과율, 소요 시간).
- **범위 주의:** 설치된 스킬은 사용자 DSH 홈(`~/.dsh/skills/`)에 있다. 그곳을 고치려면 사용자 승인이 필요하다. 승인 전에는 Studio 안의 사본으로 검증한다.
- **검증:** 에이전트가 S7 스킬만 읽고 번역 루프 명세를 써서 실행하는지 확인한다. Studio 타입 검사·테스트·빌드. Jev 실호출. 수정하지 않은 DSH `0.2.0-rc.2`에 패키징한 Studio를 격리 프로필로 설치해 Loader 로딩과 루프 1건(foreground·background 각 1회) 확인.

### 2차 (상세는 1차 완료 후)

- **S9 `act`:** 화이트리스트 도구 1회 실행과 관찰 결과 전달(D7). 반복하면 안 되는 행동과 공유 상태 병렬 처리를 막는 규칙.
- **S10 `extract`:** 큰 관찰 결과에서 판정 재료만 뽑는 무상태 Pixie 단계.
- **S11 `route`:** choice 결과로 다음 단계나 출력 버킷 선택.
- **S12 `until`:** 재시도형(목표 달성까지)과 에피소드형(상태가 이어지는 연속 행동, 오래된 수는 요약).
- **S13 선택 모드:** 결정 엔진 결과를 판정이 아닌 결과로 쓴다(D6). 확신도 임계값과 대체 처리, 255개 초과 시 2단계 선택.
- **가이드:** 각 단계와 같은 커밋에서 루프 가이드·스킬에 추가한다(D13). `act` 어댑터 스크립트 작성법(입력·출력·종료 코드, 관찰 결과를 텍스트로 내는 법, 반복해도 안전한 행동만 쓰기, 항목마다 상태 분리), playwright DOM 실험 하네스 예시, 외부 프로세스 상태 읽기·행동 넣기 어댑터 예시, 선택 모드의 보기 만드는 법.
- **검증 사례:** playwright 하네스로 하는 DOM 실험. 활용 예시로 외부 게임 프로세스의 상태 읽기·행동 넣기 어댑터를 문서에 적는다(통합은 범위 밖).

### 3차 (상세는 2차 완료 후)

- **S14 저장된 레시피:** Studio UI에 레시피를 저장할 때 compile과 calibration을 실행하고 질문 세트를 레시피에 고정한다. 도구는 `recipe` 이름과 항목만 받는다.
- **S15 게이트 판정 방식:** 게이트 정의 `advanced.engine`에 `{ recipe, mode: "check" | "repair" }`를 추가한다(D10). 루프 결과를 `GateOutput`으로 바꾼다. `check` 실패는 `stop` + 피드백, `repair` 성공은 `replace`. 게이트 `timeoutMs` 안에서만 실행한다.
- **S16 훅 헬퍼 `pixie loop`:** 헬퍼 경로 `/loop`, `pixie loop --recipe <이름> --mode check|repair [--input] [--json]`. 기존 실행별 토큰을 쓰고 사용량은 게이트 실행에 합산한다.
- **가이드:** 레시피 저장·calibration 실패 대응, 게이트 판정 방식 선택(`check`/`repair`, 시점별 허용), 훅 스크립트에서 `pixie loop` 쓰는 예시를 루프 가이드와 [Pixie Gate 가이드](../../release/docs/appendix/pixie-gate.ko.md)에 쓰고, `studio-pixie-hook-guide`·`studio-pixie-loop-guide` 스킬을 갱신한다.

## 알려진 한계

- Jev는 이유를 주지 않는다. 수정 피드백의 품질은 질문 설계와 `interpret`의 추정에 달려 있다.
- 정확해야 하는 검사 중 1차 내장 검사(D11) 밖의 것(글자 수, 스키마 전체, 외부 실행 결과)은 2차 `act` 전까지 할 수 없다.
- LLM 판정 엔진이 Pixie와 같은 모델이면 생성한 쪽이 스스로 채점하게 된다. 시작할 때 경고만 하고 막지 않는다.
- DSH job은 런타임을 재시작하면 복구되지 않는다. 재실행할 때 결과 파일에 이미 있는 id를 건너뛰는 방식으로 이어간다.
- 실행 중에 기준이나 항목을 바꿀 수 없다. 중단하고 다시 시작한다.
- 상태를 텍스트로 받을 수 없거나 실시간 반응이 필요한 작업에는 쓸 수 없다.

## 열린 항목

| ID | 항목 | 추천 |
| --- | --- | --- |
| O4 | 기본 상한 값 | 시도 3회, 동시 4개, 토큰·시간은 필수 입력으로 두고 기본값을 두지 않는다 |
| O6 | 외부 전송 | 항목 내용이 Jev와 Pixie 모델 공급자로 나간다. 도구 설명과 설정 화면에 안내한다. 비밀 값 가리기는 후속 |
