---
kind: research
status: draft
---

# 결정(Decision) 기능 브레인스토밍 자료

## 이 문서의 목적

#26 Pixie Gate에서 판정 옵션·판정 화면을 모두 제거하고, **결정(판정) 모델은 게이트와 분리한 별도 기능으로 설계한다**고 정했다(명세 U25–U26, R3 후속 4). 이 문서는 그 별도 기능을 grilling·설계하기 전에 읽는 **출발 자료**다. 결정은 내리지 않는다. 무엇을 봐야 하는지, DSH의 어떤 부분과 맞닿는지, 사용자에게 어떤 동작을 주고 싶었는지를 모으고 열린 질문을 남긴다.

기준: 브랜치 `studio/feat/workflow` @ `49cfd6a996`(이 문서는 `studio/research/decision-engine` 워크트리에서 작성). 대상 DSH `0.2.0-rc.2 || 0.2.1-alpha.2`. DSH 서비스·이벤트 계약은 실행 중인 Host Inspect(`Service.listService`, `Event.listEvents`)로 확인했다. 본체는 읽기 전용 참고 자료이며 수정하지 않는다.

## 1. 왜 게이트에서 빼냈나 — 배경

| 시점 | 무엇이 있었나 | 근거 |
| --- | --- | --- |
| #25 Pixie | Jev 형식(System One) 판정 인터페이스 `JudgeEngine` + `LlmJudgeEngine`, Pixie 탭 수동 판정 시험. 에이전트 훅 연결은 범위 밖 | [25-pixie.md](../issues/25-pixie.md) D9·F1 |
| #26 S8 | 다단계 게이트의 `judge` 단계(질문·통과 규칙 all/any) | [26-pixie-gate.md](../issues/26-pixie-gate.md) S8 절 |
| #26 U15 | 작업 중심 게이트로 재설계하면서 판정을 "결론을 덮어쓰는 고급 옵션"으로 축소 | 같은 명세 U15 |
| #26 U25–U26 | 판정 옵션·설정 판정 페이지·탭 판정 탭·수동 판정 Remote 제거. 판정은 별도 기능으로 | 같은 명세 "R3 후속 2–4" |

빼낸 이유(사용자 대화에서 나온 어긋남):

- **판정이 보는 대상이 직관과 달랐다.** 옵션을 켜면 판정 모델은 Pixie 출력이 아니라 **원래 대상 텍스트**를 평가하고 결론만 덮어썼다. "Pixie가 만든 결과(번역 등)가 괜찮은지 판정"하려는 기대와 맞지 않았다.
- **결론의 주인이 둘이었다.** Pixie 결론과 판정 결과가 다르면 판정이 이기고, Pixie의 막음 이유는 메모로 밀려났다. 사용자가 결과를 예측하기 어려웠다.
- **흐름을 이을 수 없었다.** 판정 → 번역 → 재판정, 판정 기반 탐색처럼 결정이 다음 행동을 고르는 흐름을 담을 자리가 없었다. 훅 스크립트 + `pixie judge`로 우회만 가능했다.
- **게이트는 미들웨어로 남기기로 했다.** 게이트의 역할을 "제어 지점 제공"으로 한정하고, 판단 엔진은 게이트에 꽂히는 처리기 중 하나가 되거나 별도 기능이 되어야 한다는 방향이 정해졌다.

## 2. 사용자가 원했던 동작

대화에서 나온 요구를 그대로 모은다. 우선순위·채택은 정하지 않았다.

| ID | 사용자 시나리오 | 결정이 하는 일 | 대화에서 확인된 제약 |
| --- | --- | --- | --- |
| W1 | 최종 답변이 한국어가 아니면 Pixie가 번역해 보여 주기 | "한국어인가?" 예/아니오 → 아니면 번역 | 이미 출력된 답변을 교체하는 공개 API가 없다. 번역은 메모·별도 화면으로만 보이거나, 에이전트에게 다시 쓰게 해야 한다 |
| W2 | 판정 기반 탐색: 찾기 → 결과가 쓸 만한지 판정 → 다시 찾기 | 결과 품질 점수/선택 → 다음 행동 결정 | 반복·도구 사용이 필요하다. 미들웨어(1회 실행, 도구 없음)로는 맞지 않는다 |
| W3 | 번역 반복: 번역 → 충실한지 판정 → 기준 미달이면 재번역 | 생성물 자체를 평가 | 판정 대상이 "원문"이 아니라 "생성물"이어야 한다 |
| W4 | 엄밀한 통과 기준: "예" 확률이 기준 이상일 때만 통과 | 확률 + 기준값 → 통과/막음 | 결론 결정권을 누가 갖는지 분명해야 한다(U15에서 혼란) |
| W5 | 판정 결과 형식 바꾸기(예/아니오 외 선택지·점수) | choice / score 질문 | 엔진은 이미 choice·score·noul을 지원하지만 게이트·헬퍼에는 noul만 연결돼 있었다 |
| W6 | 맥락을 아는 판단 | 대화 맥락까지 보고 판정 | 현재 게이트·헬퍼 호출은 대상 텍스트 하나만 받는다(세션 기록 없음) |

## 3. Studio 안에서 볼 곳

### 지금 남아 있는 판정 자산

| 파일 | 내용 | 상태 |
| --- | --- | --- |
| [pixie-contracts.ts](../../src/pixie-contracts.ts) | `JudgeQuestion`(choice·score·noul), `JudgeAnswer`, `JudgeRequest{state, questions}`, `JudgeResult`, `validateJudgeRequest`, `DEFAULT_JUDGE_SYSTEM_PROMPT`, 설정의 `judgeModel`·`judgeSystemPrompt` | 계약 유지. 설정 필드는 읽고 그대로 저장만 하며 쓰는 곳 없음 |
| [host/pixie-judge.ts](../../src/host/pixie-judge.ts) | `JudgeEngine` 포트, `LlmJudgeEngine`(JSON 강제·답 검증·실패는 오류로), `parseJudgeOutput` | 사용 중(헬퍼 `pixie judge`) |
| [pixie-gate-contracts.ts](../../src/pixie-gate-contracts.ts) | `JudgePassRule`(all/any 조건), `evaluateJudgePass`, `validateJudgePassRule` | 남아 있으나 실행 경로에서 호출하지 않음(구 S8 자산) |
| [pixie-gate-result.tsx](../../src/pixie-gate-result.tsx), [pixie-gate-judge-locale.ts](../../src/pixie-gate-judge-locale.ts) | answers 요약·실패 조건 문구 표시 | 실행 기록 화면에서 일부 사용 |
| [host/pixie-gate-task-runner.ts](../../src/host/pixie-gate-task-runner.ts) | 헬퍼 `pixie judge` 구현(질문 1개 noul → 확률·기준 → pass/fail, 기록·사용량 합산) | 사용 중 |
| [host/pixie-gate-helper.ts](../../src/host/pixie-gate-helper.ts) | 실행별 토큰 + Studio 웹 경로로 스크립트에서 ask/judge 호출 | 사용 중. 다른 호출자(도구 등)에 재사용 가능한 패턴 |

삭제된 것(기록용): 게이트 `advanced.judge` 옵션, 설정 **판정** 페이지, 세션 Pixie 탭 **판정** 탭, Remote `studioPixie.judge`. 커밋 `9972915298`, `f1c5186703`.

### 관련 문서

- [#25 명세](../issues/25-pixie.md) — Jev 계약 선택 이유, Converse/Judge 엔진 분리(D9), Jev HTTP 엔진은 후속(자격 증명은 `credentials` 서비스로)
- [#26 명세](../issues/26-pixie-gate.md) — U13·U14 출력 계약과 지점별 적용 표, U15(판정 옵션의 의미), U23 헬퍼 계약, U25–U26 결정
- [Pixie Gate 가이드](../../release/docs/appendix/pixie-gate.ko.md) — `pixie judge` 사용법과 "번역 반복" 예시(W3을 스크립트로 우회하는 현재 방법)
- [DSH 런타임 개입 지점 조사](dsh-runtime-control-points.md) — 지점별 dispatch mode와 한계
- [R5 실검증](../verification/pixie-gate-r5/README.md) — flash/low 판정 모델이 `answers` 형식을 간헐적으로 틀린 사례(헬퍼 exit 2)

## 4. DSH와 맞닿는 부분

Host Inspect로 확인한 공개 계약 기준이다. "가능성"은 설계 후보일 뿐 검증하지 않았다.

| DSH 공개 표면 | 계약 요지 | 결정 기능과의 연결 가능성 |
| --- | --- | --- |
| `tools.register` (서비스 `tools`) | 도구 등록·실행 파이프라인. Studio는 이미 `read_batch`, 역할·task 도구를 등록한다([batch-tool.ts](../../src/host/batch-tool.ts), [role-tool.ts](../../src/host/role-tool.ts), [task-tool.ts](../../src/host/task-tool.ts)) | **에이전트가 부르는 결정 도구**(예: `pixie_decide`, 판정 기반 탐색 `pixie_search`). W2·W5에 자연스럽다. 프리셋 도구 선택과 함께 노출 범위를 정할 수 있다 |
| `tools/pre-execute`, `tools/post-execute` (waterfall) | 실행 전 allow/deny/cancel/ask, 실행 후 accept/replace/enrich/block | 지금 게이트가 쓰는 지점. 결정 엔진을 게이트의 **처리기**로 꽂는 경우의 접점 |
| `approval/request` (waterfall) + 서비스 `approval` | 정책 적용 후 answerer 체인이 `allowed-once / rejected / cancelled / unavailable`을 고른다. 모든 ask/outcome 쌍을 세션에 기록 | **승인 응답자로서의 결정**: 사람 대신(또는 사람 전에) 모델이 승인 여부를 판단. 감사 기록이 이미 있다. 단 무엇을 자동 승인해도 되는지는 보안 결정이다 |
| `permissionPresets` | 배포 권한 프리셋과 고정 "Auto integration hook" | Auto 모드와의 관계 확인 필요. 결정 기반 자동 승인을 만든다면 충돌·중복 여부를 먼저 봐야 한다 |
| `user-questions/request` (waterfall) + `userQuestions` | 에이전트의 구조화 질문(`ask_user_question`)에 answerer가 답한다 | **질문 자동 응답자**: 에이전트가 사용자에게 묻는 선택지 질문을 결정 모델이 먼저 답하거나 추천. choice 질문과 형태가 비슷하다 |
| `agent/pre-step` (waterfall), `agent/turn-stopping` (serial) | 입력 거부/교체, 턴 종료 직전 관찰·steer | 게이트가 쓰는 지점. 답변 끝 결정은 steer(다시 하라)만 가능하고 출력 교체는 불가 |
| `agent/request` (waterfall), `llm/stream` (waterfall) | 모델 호출 구성 교체, 스트림 가로채기 | 라우팅 결정(어떤 모델·추론 강도로 보낼지)의 접점 후보. 범위가 커서 신중해야 한다 |
| `subagents`, `subagent/start·end` | 이름 있는 provider, 일회 실행·계속 가능한 자식 | **위임 결정**: 어떤 역할에 맡길지, 결과를 받아들일지 판정. Studio 역할 위임(#7–#14)과 연결 |
| `workflow/*` 이벤트 | workflow 실행·phase·agent 시작/끝 관찰(emit) | 관찰만 가능. 결정 결과를 기록·표시하는 용도 |
| `goals` | 세션 로그 기반 목표와 자동 계속 | "목표 달성 여부 판정"으로 계속/종료를 정하는 후보. 목표 서비스의 공개 확장점 여부는 확인 필요 |
| `commands` | 사람이 쓰는 명령 등록(`/pixie`가 사용 중) | `/decide` 같은 수동 실행 명령 후보(예전 수동 판정 시험의 대체) |
| `llm` | 모델 라우팅·스트림. 자격 증명은 DSH가 관리 | LLM 판정 엔진은 그대로 사용. Jev 같은 외부 HTTP 엔진은 `credentials` 서비스로(#25 후속 메모) |

공개 API로 **안 되는 것**(대화에서 확인): 이미 출력된 assistant 답변을 바꾸는 것. 결정 결과로 답변을 "교체"하는 기능은 범위에서 빼거나, 표시 계층(Client)에서 별도로 보여 주는 방식으로만 가능하다. Client에 끼울 슬롯이 있는지는 별도 확인이 필요하다.

## 5. 기능 형태 후보 (브레인스토밍 재료)

아래는 서로 배타적이지 않다. 각 후보에 맞는 W 시나리오와 주요 쟁점만 적는다.

| 후보 | 개요 | 맞는 시나리오 | 쟁점 |
| --- | --- | --- | --- |
| A. 결정 도구 | 에이전트가 부르는 도구. 입력(대상·질문·형식) → choice/score/noul 답 | W2, W5, W6(에이전트가 맥락을 넣어 호출) | 에이전트가 언제 부를지 모델에 맡김. 프리셋별 노출, 비용 |
| B. 게이트 처리기 | 게이트에 "결정" 처리기를 꽂아 지점마다 실행 | W1, W4 | 결론 결정권·대상(원문 vs 생성물)을 다시 정해야 함. U25의 "미들웨어로 한정"과 경계 |
| C. 승인/질문 응답자 | `approval/request`·`user-questions/request` answerer로 동작 | 자동 승인, 선택지 추천 | 안전성(무엇을 자동 허용하나), Auto 모드와의 관계, 감사 표시 |
| D. 결정 파이프라인(작은 workflow) | 생성 → 판정 → 분기/반복을 선언형으로 조립 | W1, W3 | 스크립트·workflow와 중복, 반복 상한·비용 |
| E. 수동 결정 명령 | `/decide` 또는 Pixie 탭에서 직접 질문 | 실험·검증 | 예전 수동 판정 시험을 되살릴지 |
| F. 외부 결정 엔진 | Jev 등 HTTP 엔진을 `JudgeEngine` 포트로 연결 | W4, W5 | 자격 증명, 지연, 실패 처리 |

## 6. 열린 질문

1. **대상:** 결정은 무엇을 보는가 — 원문, 생성물, 둘 다, 대화 맥락까지? W3·W6은 각각 다른 답을 요구한다.
2. **결정권:** 결정 결과가 무엇을 바꾸는가 — 통과/막음, 다음 행동 선택, 점수만 기록? 다른 판단(Pixie 결론, 사람 승인)과 충돌하면 누가 이기나?
3. **호출 주체:** 에이전트(도구), 런타임(미들웨어·answerer), 사용자(명령) 중 무엇부터?
4. **형식:** noul만 먼저 할지, choice·score까지 처음부터 열지. 통과 규칙(`JudgePassRule` all/any)을 되살릴지.
5. **모델 설정:** 남아 있는 `judgeModel`·`judgeSystemPrompt`를 다시 쓸지, 결정 기능 전용 설정으로 옮길지, 지울지.
6. **번역(W1):** 에이전트가 처음부터 한국어로 답하게(프리셋 지침·steer) vs 원문은 두고 번역을 따로 보여 주기(Client 표시) — 어느 쪽을 원하나.
7. **형식 오류:** LLM 판정의 `answers` 형식 오류(R5에서 관측)를 재시도·강제 출력·구조화 출력 중 무엇으로 줄일지.
8. **비용·기록:** 결정 호출 사용량을 어디에 합산하고 어디에 보여 줄지(게이트 기록, Pixie 탭, 세션 로그 밖 저장소).
9. **헬퍼와의 관계:** 스크립트 `pixie judge`를 새 결정 기능의 얇은 클라이언트로 바꿀지, 그대로 둘지.
10. **배포:** 공개 API만으로 되는지 — 특히 Client 표시(W1)와 Auto 모드(C)는 먼저 확인이 필요하다.

## 7. 브레인스토밍 결과 (2026-10-16)

후보 A–F와 Pixie 확장 방식을 대화로 검토한 결과다. 기준은 `studio/feat/workflow` @ `ce9a731d9f`를 merge한 이 브랜치이며, 대상 DSH `0.2.0-rc.2 || 0.2.1-alpha.2`다. 아래 공개 API 근거는 Host·Client Inspect, 저장소 소스와 `dsh-v0.2.0-rc.2` 태그로 확인했다. 실제 호출·설치 검증은 하지 않았다.

### 하지 않기로 한 것

| 검토안 | 하지 않는 이유 |
| --- | --- |
| Pixie를 서브에이전트로 실행 | 메인의 `list_agents`·`send_message`에 노출될 수 있다. 사이드바 대화 탭 주소(`dsh-resource://subagentchat/...`)는 ui-subagent 내부 형식이라 공개 계약이 아니다. 결과 전달 API도 rc.2와 alpha.2에서 다르다 |
| Pixie를 독립 세션(fork처럼)으로 실행 | `agents.create`로 세션은 만들 수 있지만, Host에서 그 세션에 지시를 넣는 공개 경로를 찾지 못했다. 세션 목록 표시, 승인 알림 문제도 있다 |
| Pixie 전용 도구 루프(bash 등) | `llm.stream`의 `tools` 옵션과 `tools.execute`로 가능은 하다. 하지만 메인 루프가 이미 처리하는 도구 메시지 형식, 승인, 취소를 다시 구현해야 한다 |
| 범용 결정 도구·레시피·흐름 편집기 | 구조가 커지는 데 비해 실제 사용 이득이 불분명하다 |

Pixie는 지금 구조를 유지한다. 훅으로 필요한 데이터를 받아 해석하는 역할이다. 사용해 보니 이 방식으로도 UI/UX가 충분했다.

### 결정 1: Pixie 출력을 Markdown으로 표시한다

모델 출력은 대부분 Markdown이지만 지금 Pixie는 `<p>`에 일반 텍스트로 보여 준다.

- **부품:** DSH 공용 `MarkdownText`(`@deepseek-ai/dsh-client-ui-primitives`)를 쓴다. 메인 대화창과 같은 렌더러다. GFM 표, 코드 블록·복사, TeX 수식, `streaming` 증분 렌더링을 지원한다. 원시 HTML은 버리고 링크는 http·https·mailto만 허용한다. `0.2.0-rc.2` 태그와 현재 소스에서 모두 export되는 것을 확인했다.
- **필수 라벨:** `labels.code.copyLabel`, `labels.code.copiedLabel`, `labels.footnotes`. ko·en·zh 사전에 둔다. 좁은 Pixie 탭에는 `variant="compact"`를 검토한다.

| 위치 | 변경 |
| --- | --- |
| [ui-host.tsx](../../src/ui-host.tsx) | primitives export 목록에 `MarkdownText` 추가. 기능 모듈은 이 파일을 통해서만 가져온다 |
| 공용 부품 `PixieMarkdown`(새로 만듦) | `MarkdownText` + 로캘 라벨. 디자인 시스템 문서의 부품 표 갱신 |
| [pixie-tab.tsx](../../src/pixie-tab.tsx) :50, :284 | Pixie 탭 답변, `/pixie` 대화 행. 답변 생성 중에는 `streaming` |
| [pixie-gate-result.tsx](../../src/pixie-gate-result.tsx) :35, 메모(:64, :77) | 게이트 결과 중 Pixie가 쓴 출력 텍스트와 메모 |

- **바꾸지 않음:** 게이트 기록의 원문, 최종 텍스트, 함께 전달한 내용, 거부 원문·제안은 사용자나 도구의 원본 데이터라 일반 텍스트로 둔다. 판정 답 요약, 이유 한 줄 같은 Studio가 만든 문구도 그대로 둔다.
- **확인:** `MarkdownText`의 CSS가 Pixie 탭 좁은 폭, 라이트·다크 모드에서 코드 블록과 표를 어떻게 보여 주는지 Web에 배포해 본다. UI 스냅샷을 갱신한다.

### 결정 2: Jev는 Studio 내부 판정 엔진으로 붙이고, 키는 DSH credentials에 둔다

- **DSH 모델 프로바이더로 등록하지 않는다.** `llm.registerAdapter`는 공개지만 대화 모델용이다. 텍스트를 스트림으로 돌려주는 `stream()`을 구현해야 하고, 등록하면 일반 모델 선택 목록에 뜬다. Jev는 `POST https://api.typesafe.ai/v1/systemone`에 `{ model, state, questions }`를 보내 `{ answers, usage }`를 받는 판정 API다([API reference](https://docs.typesafe.ai/api.md)).
- **엔진:** 기존 `JudgeEngine` 포트([host/pixie-judge.ts](../../src/host/pixie-judge.ts))에 `JevJudgeEngine`을 추가한다. Studio Host에서 `fetch`로 호출한다. 429·529는 짧게 다시 시도한다. 401·422·네트워크 오류는 오류로 낸다. 오류를 "아니오"나 낮은 점수로 바꾸지 않는 기존 규칙을 유지한다.
- **계약 정렬:** Studio 계약은 이전 Jev 형식에 맞춰져 있어 현재 API와 다르다. 엔진 안에서 변환하되, 판정 품질과 직결되는 차이이므로 계약 자체를 현재 형식으로 맞추는 쪽을 권장한다.

| 항목 | Studio 현재 | Jev 현재 |
| --- | --- | --- |
| 질문 문장 | noul만 `question` | 세 형식 모두 `instructions`(필수, 문자열·객체·배열) |
| choice 선택지 | `options` | `criteria`(map, 최대 255) |
| score 단계 | `levels` | `criteria`(배열, 2–10) |
| score 답 | `probabilities` 배열 | `probabilities`·`legend`(단계 번호 키 객체) |
| 모델 | 없음 | `model` 필수(예: `jev-latest`) |
| 사용량 | Studio 형식 | `usage.input_tokens`·`output_tokens` |

- **키 설정:** Studio 설정의 결정 엔진 화면에서 입력받는다.
  - 저장: Client → Studio Remote → `ctx.credentials.set('TYPESAFE_API_KEY', value)`. 삭제는 `unset`.
  - 상태: `ctx.credentials.describe(ref)`의 `{ configured, source, writable }`만 표시한다. 키 값은 Client로 돌려주지 않는다.
  - 사용: 호출마다 `ctx.credentials.resolve(ref)`로 읽고 캐시하지 않는다. DSH `llm-deepseek-api-key`와 같은 방식이다.
  - 환경 변수·`.env`로 설정한 키도 `resolve`가 그대로 찾는다. 읽기 전용 출처가 값을 가리면 `set`이 거부되므로, 화면에 출처와 "여기서 바꿀 수 없음"을 표시한다.
  - 키 이름은 `TYPESAFE_API_KEY`로 고정한다.
- **쓰지 않는 길:** Studio 플러그인 Config에 `role('credential-ref')` 필드를 두는 방식은 쓰지 않는다. 키 입력·저장 UI는 DSH 모델 설정 화면만 제공하고, 일반 플러그인 설정 화면에서는 같은 처리를 찾지 못했다. Config에 두면 키 값이 아니라 이름 문자열만 편집하게 된다.
- **미검증:** 실제 Jev 응답(세 형식), Studio 설정 화면의 키 저장·출처 표시. API 키가 있어야 확인할 수 있다.

### 결정 3: 결정 엔진은 게이트 훅 스크립트에서 부르고, 스크립트가 결론을 낼 수 있다

- 게이트는 에이전트 미들웨어다. 판정 시점·입력·결과 처리는 훅 스크립트가 `pixie judge`로 정한다. Pixie는 도구가 없어 판정을 직접 부르지 않는다.
- 스크립트 exit 11을 추가해 stdout JSON을 게이트 출력으로 바로 쓴다. 통과는 exit 10, 애매하면 exit 0으로 Pixie에게 넘긴다(confidence routing).
- 적용 아이디어 조사와 우선 후보는 [Jev 적용 아이디어](jev-use-cases.md)에 있다.

## 8. 다음 단계

1차 범위(Jev 엔진·키, 계약 정렬, `pixie judge` 확장, exit 11, Markdown 표시)는 [#27 명세](../issues/27-jev-decision-engine.md)에서 진행한다. 에이전트 도구, 게이트 판정 칸, DSH 일반 훅 연결은 #27 이후 사용 결과를 보고 정한다.
