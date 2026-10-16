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

## 7. 다음 단계 제안

1. 이 문서로 grilling을 해서 W1–W6 중 1차 범위와 호출 주체(질문 3)를 정한다.
2. 정한 범위로 새 이슈와 명세(`studio/docs/issues/<번호>-…md`)를 만든다. #26은 닫힌 상태로 둔다.
3. 명세 단계에서 확인할 것: C 후보면 `approval`·`permissionPresets` 계약과 Auto 훅, W1이면 Client 슬롯, A 후보면 프리셋 도구 노출 경로.
