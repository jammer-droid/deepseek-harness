---
kind: research
status: draft
---

# Jev 하네스 적용 아이디어

## 1. 목적과 기준

- **조사 기준일: 2026-10-16.** 범용 엔진보다 먼저, 사용자가 체감할 구체적인 판단 지점을 고른다. 아래 **적용 아이디어·평가·권장 정책은 모두 제안**이며 구현 완료나 성능 보장이 아니다.
- **웹 1차 자료:** [공식 색인](https://docs.typesafe.ai/llms.txt), [사용 사례 지도](https://docs.typesafe.ai/concepts/use-case-map.md), [코딩 에이전트 안내](https://docs.typesafe.ai/introduction/coding-agents.md), [공식 skill](https://raw.githubusercontent.com/typesafe-ai/skills/main/skills/typesafe-ai/SKILL.md), 아래에 연결한 API·모델·패턴·쿡북. 웹 내용은 자료로만 읽었다.
- **저장소 근거:** [브레인스토밍 §2·4·7](<../../docs/research/decision-engine-brainstorm.md>), [런타임 개입 지점 조사](<../../docs/research/dsh-runtime-control-points.md>), [Gate 가이드](<../../release/docs/appendix/pixie-gate.ko.md>), [역할 위임 구현](<../../src/host/role-tool.ts>), [Judge 계약](<../../src/pixie-contracts.ts#L120-L175>). 저장소 링크는 이 문서 기준 상대 경로다.
- **확인한 것:** 공개 웹 문서와 위 저장소 자료·구현을 읽어 개념과 접점을 비교했다. DSH 공개 API 가능성은 기존 조사 기록·현재 Studio 코드에 근거한다. **확인하지 않은 것:** 이번 조사에서 live Inspect, Jev 실제 호출, 한국어 정확도, 지연·비용 측정, 훅 실행, 설치·독립 배포 검증. 빌드·테스트·커밋은 하지 않는다.
- **고정 제품 경계:** Pixie는 훅이 준 데이터를 해석하는 사이드 모델로 유지한다. 도구 루프·Pixie 서브에이전트·별도 세션을 만들지 않는다. Jev는 Studio Host의 `JevJudgeEngine` → 기존 `JudgeEngine` 포트 → `fetch` 경로, 키는 DSH credentials의 `TYPESAFE_API_KEY`다. 이미 나온 assistant 출력 교체는 제외한다. [결정 §7](<../../docs/research/decision-engine-brainstorm.md#L113-L173>)

## 2. Jev가 잘하는 것 / 못하는 것

| 항목 | 문서 사실 | 하네스에 주는 의미·제안 |
| --- | --- | --- |
| 역할 | state와 typed questions를 받아 구조화 답을 반환한다. 텍스트·코드 생성, 대화, 도구 실행을 하는 코딩 LLM이 아니다. [코딩 에이전트](https://docs.typesafe.ai/introduction/coding-agents.md) | 번역·요약·교정문은 Pixie/메인 LLM, 선택·검증은 Jev, 실행·반복·종료는 코드가 맡는다. |
| Choice | 정해진 후보 중 최고 확률 하나와 후보별 확률, confidence를 반환한다. [API](https://docs.typesafe.ai/api.md) | 역할·행동 선택. 누락 후보를 생성하지 못하므로 `해당 없음/사람에게 질문` 후보를 둔다. 복수 라벨이 동시에 맞으면 각각 Noul을 쓴다. [공식 skill](https://raw.githubusercontent.com/typesafe-ai/skills/main/skills/typesafe-ai/SKILL.md) |
| Score | 순서 있는 서술형 단계의 **확률 가중 위치**로 소수도 가능하다. 단계별 probabilities·legend와 confidence가 나온다. [API](https://docs.typesafe.ai/api.md) | 품질·관련성·위험의 정도. 서로 비교할 후보에는 같은 척도를 쓴다. Score를 곧바로 성공 확률로 읽지 않는다. |
| Noul | yes일 확률 0–1이고 별도 confidence는 없다. 0.5 부근은 yes/no 불확실성이지 중간 강도가 아니다. [Confidence](https://docs.typesafe.ai/confidence.md) | `오류가 있는가?`와 `얼마나 심각한가?`를 분리한다. W4는 `P(yes)` 임계값을 코드로 적용한다. |
| confidence | Choice는 최고 확률이 균등 분포보다 얼마나 큰지, Score는 최빈 단계 주변 분포 집중도를 요약한다. 전체 워크플로 정확도나 행동 권한은 아니다. [Confidence](https://docs.typesafe.ai/confidence.md), [공식 skill](https://raw.githubusercontent.com/typesafe-ai/skills/main/skills/typesafe-ai/SKILL.md) | 고확신 오판도 가능. 사례별 오탐·미탐 비용으로 임계값을 교정하고 위험 행동의 승인 정책을 대신하지 않는다. |
| 질문 의미 | 질문 ID는 모델에 전달되지 않는다. 현재 API의 `instructions`에 질문, `criteria`에 답 기준을 넣는다. [API](https://docs.typesafe.ai/api.md) | `tests_passed`라는 ID만으로 의미를 전달하지 않는다. 어느 실행·어느 산출물을 검사하는지 문장에 명시한다. |
| 병렬 질문 | 같은 state에 대한 질문을 병렬 처리하며 서로의 답을 볼 수 없다. 불필요한 분기의 답은 코드가 무시한다. [Fan-out](https://docs.typesafe.ai/patterns/fan-out.md), [Primitives](https://docs.typesafe.ai/primitives.md) | 요청 충분성·위험·역할 후보를 함께 질문할 수 있다. 질문 수 증가도 토큰 비용은 든다. |
| 두 번째 요청 | 첫 답을 받아 추가 증거를 읽거나 새 state/후보를 만들어야 할 때 필요하다. [Primitives](https://docs.typesafe.ai/primitives.md) | 스킬 shortlist → 상세 읽기 → 재판정, 번역 생성 → 번역 평가에는 추가 요청이 맞다. 단순 분기만이면 한 번에 묻는다. |
| 기억·증거 | 다음 호출은 보낸 state만 본다. 저장된 추론을 다시 넣으면 오류가 강화될 수 있다. [Memory](https://docs.typesafe.ai/cookbooks/basic_memory.md) | W6는 자동 해결되지 않는다. 원문·최근 요청·작업 증거를 명시적으로 구성하고 관측 사실과 추론을 구분한다. |
| 모델·컨텍스트 | 문서상 `jev-1.14.0`, `jev-1.13.0`: 요청 전체 64k, state+개별 질문 32k 토큰. 질문 수 자체의 별도 한도는 없다. 선택적 long-context 헤더 사용 시 둘 다 262k지만 더 느리고 덜 정확하다고 명시한다. [Models](https://docs.typesafe.ai/models.md) | 전체 로그를 매 도구마다 보내지 않는다. long context는 기본 해법으로 삼지 않는다. |
| 가격·지연 | 입력 1M 토큰당 **$0.042**, 출력 무료. 사용 사례 지도에 **150ms** 홍보 수치가 있지만 읽은 모델 문서에는 게이트별 p95/SLA가 없다. [Models](https://docs.typesafe.ai/models.md), [Use-case map](https://docs.typesafe.ai/concepts/use-case-map.md) | 예: 입력 10k 토큰은 산술상 약 $0.00042/요청(재시도·다른 LLM 제외). 150ms를 DSH 종단 지연으로 약속하지 않는다. |
| 버전·언어·데이터 | 조사 시 `jev-latest`는 1.13.0, `jev-preview`는 1.14.0. 영어가 가장 강하며 CJK는 자체 평가 필요. 고객 요청·응답으로 훈련하지 않는다고 명시하지만 ZDR은 enterprise 관련 법적 문서 확인 대상이다. [Models](https://docs.typesafe.ai/models.md) | 모델 버전을 고정하고 한국어 평가를 별도로 한다. 미학습을 무보관으로 해석하지 않는다. |

### 현재 계약과 연결할 때의 주의

현재 Studio는 Choice `options`, Score `levels`, Noul `question`을 사용하고 Score 확률은 배열이다. Jev HTTP는 모든 질문의 `instructions`, Choice/Score의 `criteria`, Score 답의 번호 키 객체·`legend`를 사용한다. **그대로 POST할 수 있는 동일 스키마가 아니다.** 아래 질문 예시는 설계 설명이지 새 API 필드나 실행 가능한 요청 JSON이 아니다. [현재 계약](<../../src/pixie-contracts.ts#L120-L175>), [현재 API](https://docs.typesafe.ai/api.md)

기존 `pixie judge`는 Noul 확률/exit 0·1을 반환하며 오류는 exit 2다. Choice/Score와 풍부한 state 전달 UX는 후속 결정이다. Gate 훅의 exit 0은 **Pixie 작업을 계속 실행**한다는 뜻이지 판정 결과를 직접 Gate 결론으로 적용한다는 뜻이 아니다. 초기에 훅이 판정 데이터를 주고 Pixie는 고정 규칙대로 해석하도록 하되, 보안 차단은 기존 결정적 권한 정책을 유지한다. [헬퍼·훅 계약](<../../release/docs/appendix/pixie-gate.ko.md#L71-L109>), [미결정 사항](<../../docs/research/decision-engine-brainstorm.md#L169-L173>)

## 3. TypeSafe가 문서에서 제시하는 패턴·쿡북 목록

패턴 4개와 공식 쿡북 색인의 전체 항목을 정리했다. **직독**은 해당 본문도 읽었고, **색인**은 공식 목록의 설명만 확인했다. 쿡북 수치·임계값은 해당 데모 결과이지 DSH 성능 보장이 아니다. [패턴 색인](https://docs.typesafe.ai/patterns.md), [쿡북 색인](https://docs.typesafe.ai/cookbooks.md)

| 패턴 | 한 줄 요약·원문 |
| --- | --- |
| Speculative fan-out | 같은 state의 여러 잠재 질문을 함께 묻고 필요한 답만 사용한다. [직독](https://docs.typesafe.ai/patterns/fan-out.md) |
| Confidence-gated routing | 답과 확신도를 별도 축으로 보고 행동·확인·이관을 나눈다. [직독](https://docs.typesafe.ai/patterns/confidence-routing.md) |
| Intent routing | 의도·복잡도로 결정적 코드, 전문 LLM, 사람을 선택한다. [직독](https://docs.typesafe.ai/patterns/intent-routing.md) |
| Composite scoring | 독립 차원 점수를 코드의 가중치로 조합한다. [직독](https://docs.typesafe.ai/patterns/composite-scoring.md) |

| 쿡북 | 한 줄 요약·원문 |
| --- | --- |
| Function calling | 함수와 닫힌 인자 후보를 선택하며, 자유문·임의 숫자를 생성하는 도구 호출기는 아니다. [직독](https://docs.typesafe.ai/cookbooks/function_calling.md) |
| Skill suggestion | 전체 스킬 후보 순위 → 상위 상세 확인의 두 요청으로 최대 하나를 추천한다. [직독](https://docs.typesafe.ai/cookbooks/skill_suggestion.md) |
| Guardrails for LLMs | 입력·출력의 위험별 Noul과 심각도 Score를 정책으로 분기한다. [직독](https://docs.typesafe.ai/cookbooks/llm_guardrails.md) |
| Double-checking citations | 인용문 존재는 문자열 비교, 주장 지지는 문맥 Choice로 검사한다. [직독](https://docs.typesafe.ai/cookbooks/citation_check.md) |
| Classifying RAG passages | 검색 문단의 관련성·사용 가능성·전제 충돌·인젝션을 구별한다. [직독](https://docs.typesafe.ai/cookbooks/classifying_rag_passages.md) |
| Simple memory system | 오래 쓸 사실이 있는 요청을 골라 저장하고 다음 state에 다시 넣는다. [직독](https://docs.typesafe.ai/cookbooks/basic_memory.md) |
| Hierarchical classification | 계층 후보를 Choice 확률 기반 병렬 beam search로 탐색한다. [색인](https://docs.typesafe.ai/cookbooks/hierarchical_classification.md) |
| Classification using confidence | 불확실한 세부 분류 대신 상위 분류를 보고한다. [색인](https://docs.typesafe.ai/cookbooks/classification_using_confidence.md) |
| Twitch chat filter | 다중 질문과 코드 규칙으로 숨김·흐림·강조를 결정한다. [색인](https://docs.typesafe.ai/cookbooks/twitch_chat_filter.md) |
| SDE cascade | 저렴한 모델 추출 → 필드별 오류 검증 → 필요할 때 강한 추론 모델로 승격한다. [직독](https://docs.typesafe.ai/cookbooks/sde_cascade.md) |
| Date extraction | 날짜 구성요소를 선택하고 상대 날짜 해석·유효성 검사는 코드가 한다. [색인](https://docs.typesafe.ai/cookbooks/date_extraction_cookbook.md) |
| Pre-parsed value extraction | regex가 찾은 후보 중 의도한 값을 선택하고 원문을 복사·정규화한다. [색인](https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook.md) |
| Structure recovery | 줄바꿈 병합 후 새 블록을 분류하여 Markdown 구조를 복구한다. [색인](https://docs.typesafe.ai/cookbooks/autoformat.md) |
| Re-ranking | 검색 shortlist의 query–candidate 관련성을 재평가한다. [색인](https://docs.typesafe.ai/cookbooks/rerank_typesafe.md) |
| Line-by-line search | 줄 후보 Choice와 답 존재 Noul을 함께 사용한다. [색인](https://docs.typesafe.ai/cookbooks/semantic_find.md) |
| Knowledge graph entity alignment | 후보 쌍 동일성 Score와 필드 불일치 Noul을 조합한다. [색인](https://docs.typesafe.ai/cookbooks/entity_alignment.md) |
| Self-consistency: choices | 불확실 후보를 포함한 분류의 일치도와 자동 처리 비율을 비교한다. [색인](https://docs.typesafe.ai/cookbooks/consistency_choice_cookbook.md) |
| Self-consistency: nouls | 원 확률을 유지하면서 불확실 사례를 사람에게 보낸다. [색인](https://docs.typesafe.ai/cookbooks/consistency_noul_cookbook.md) |
| Parallel questions | 독립 질문의 개별 호출과 일괄 호출 비용·시간을 비교한다. [색인](https://docs.typesafe.ai/cookbooks/parallel_questions.md) |
| Autoresearch feature discovery | 질문을 숫자 feature로 만들고 관측 오류를 이용해 다운스트림 예측기를 개선한다. [색인](https://docs.typesafe.ai/cookbooks/autoresearch_feature_discovery.md) |

## 4. 하네스 적용 아이디어 카탈로그

**전부 제안.** `가능`은 공개 접점으로 구성할 수 있다는 뜻이며 이미 구현됐다는 뜻이 아니다. 현재 Gate는 대상 텍스트 하나를 기본 입력으로 받는다. 아래 state의 추가 자료는 호출 도구 또는 허용된 훅이 수집해야 하며 자동 대화 이력을 전제하지 않는다. [W6](<../../docs/research/decision-engine-brainstorm.md#L34-L41>), [Gate 입력](<../../release/docs/appendix/pixie-gate.ko.md#L71-L93>)

### A. 착수·위임·생성물 검증

| ID·이름 / 사용자 시나리오 | 붙는 지점·state | 질문 형태·예시 기준 | 결과로 하는 행동 | 근거 패턴·공개 API 가능성 및 제약 |
| --- | --- | --- | --- | --- |
| **J01 요청 충분성** — “이거 고쳐”만 보내고 엉뚱한 작업이 시작되지 않길 원한다. 저장소 조사로 알 수 있는 것은 되묻지 않는다. | `user-message` Gate + 훅 또는 착수 검사 도구. 요청, 최근 명시적 결정, 작업 범위, 아직 없는 정보 | Noul: “안전한 첫 조사조차 막는 필수 정보가 빠졌는가?” true=목적/대상 간 양립 불가, false=읽기 조사로 확인 가능. Choice: 조사 시작/확인 질문 | 충분하면 진행, 아니면 빠진 항목에 해당하는 질문 템플릿을 제안 | [Confidence routing](https://docs.typesafe.ai/patterns/confidence-routing.md). 입력 거부·덧붙임 가능. 질문 문장 생성은 LLM/템플릿 책임이며 과도한 착수 차단 주의. [Gate](<../../release/docs/appendix/pixie-gate.ko.md#L41-L49>) |
| **J02 역할·모델·추론 라우팅** — 단순 읽기는 저렴한 조사 역할, 복잡한 설계는 깊은 추론 역할에 맡기고 싶다. | 역할 위임 전 Studio agent tool/command. 작업, 역할 목록·전문성, 고정 모델·reasoning, 비용 정책 | Choice: “이 작업을 맡을 등록 역할은?” criteria=각 역할 능력+해당 없음. Score: 단순 조회/다단계 수정/불확실 설계 | 후보와 확신도를 보여 주거나 허용된 역할로 `subagent_role` 위임 | [Intent routing](https://docs.typesafe.ai/patterns/intent-routing.md), [Function calling](https://docs.typesafe.ai/cookbooks/function_calling.md). 기존 역할 선택이 모델·reasoning 설정으로 연결된다. **현재 call 인자에 임의 model/reasoning override는 없다**. 역할 조합으로 시작하며 실행 중 자식 교체를 뜻하지 않는다. [코드](<../../src/host/role-tool.ts#L25-L77>) |
| **J03 출력 언어·번역 루프(W1/W3)** — 영어 답변을 한국어로 보고 싶고, 번역에서 조건·코드가 빠지지 않았으면 한다. | `turn-end` Gate + 훅, `pixie ask` 생성 → `pixie judge` 검증. 원문+번역 초안+목표 언어+코드 보존 기준 | Noul: “설명문이 한국어인가?”; 별도 Noul: “원문의 조건·부정·숫자가 보존됐는가?” true=의미 보존, false=누락/왜곡. 자연스러움은 별도 Score | 비한국어면 번역, 충실도 미달이면 제한 횟수 재번역, 메모로 표시하거나 메인에 재작성 지시 | [Cascade](https://docs.typesafe.ai/cookbooks/sde_cascade.md), [Fan-out](https://docs.typesafe.ai/patterns/fan-out.md). 기존 훅 루프 예시가 있으나 **원문도 평가 state에 포함해야** 충실성 비교가 된다. 이미 나온 답 교체 불가. [가이드](<../../release/docs/appendix/pixie-gate.ko.md#L134-L148>) |
| **J04 실행 전 위험 분류** — 삭제·업로드·외부 배포를 하기 전에 사용자의 요청 범위를 벗어난 호출을 알아차리고 싶다. | `tool-before` Gate + 훅. 도구명, 인자, 명시적 승인 범위, 경로·대상 정보 | 독립 Noul: “요청 밖 데이터 삭제인가?”, “외부 유출 가능성이 있는가?” Score: 읽기/되돌릴 수 있는 변경/비가역 외부 영향 | 위험하면 stop+이유, 애매하면 사람 확인 경로로 유도. 모델의 낮은 위험 답은 권한 승격이 아님 | [Guardrails](https://docs.typesafe.ai/cookbooks/llm_guardrails.md). Gate는 실행 거부 가능하지만 인자 rewrite/승인 우회 불가. native ask와 Gate stop은 다르다. [런타임](<../../docs/research/dsh-runtime-control-points.md#L47-L57>) |
| **J05 긴 도구 결과 선별·요약 여부** — 긴 로그에서 오류 원인은 보존하고 반복 잡음만 줄이고 싶다. | `tool-after` Gate + 훅. 현재 작업 목적, 도구 인자, 결과 구간, 길이·절단 여부 | Score: “이 구간이 현재 질문 해결에 기여하는가?” 무관/단서/직접 증거. Choice: 원문 유지/요약/관련 구간 선택 | 길이는 코드로 먼저 필터링. 필요한 경우만 Pixie 요약, 오류·근거 경로 보존, 불확실하면 원문 유지 | [RAG passages](https://docs.typesafe.ai/cookbooks/classifying_rag_passages.md). 텍스트 결과 교체·덧붙임 가능, **값을 가진 구조화 결과는 Gate 교체 제외**, 이미 실행된 부작용 복구 불가. [Gate](<../../release/docs/appendix/pixie-gate.ko.md#L41-L47>) |
| **J06 완료·테스트 주장 감사** — “테스트 통과”라는 말이 실제 실행 증거와 맞는지 끝에 확인하고 싶다. | `turn-end` Gate + 증거 수집 훅 / 보고 전 검사 도구. 요청 체크리스트, 마지막 답, 실제 실행명령·exit·결과, diff 요약 | 항목별 Choice: “이 완료 주장은 증거로 지지되는가?” 지지/모순/증거 없음. Noul: “실행하지 않은 테스트를 통과했다고 했는가?” | 모순·증거 부재를 구별해 메모 또는 1회 정정 steer. 금지된 테스트는 실행을 강요하지 않고 미검증으로 정정 | [Citation check](https://docs.typesafe.ai/cookbooks/citation_check.md), [Fan-out](https://docs.typesafe.ai/patterns/fan-out.md). 종료에서 추가 step 유도 가능, 출력 회수 불가. 증거 수집 누락을 실패 판정으로 오인하지 않는다. [런타임](<../../docs/research/dsh-runtime-control-points.md#L59-L65>) |
| **J07 목표 달성 판정** — 에이전트가 턴을 끝낸 것과 사용자의 목표를 달성한 것을 구분하고 싶다. | 완료 검토 agent tool/command, `turn-end`는 권고 전달용. 명시적 목표, 승인된 수용 기준, 최신 산출물·관측 결과 | 기준별 Noul: “이 수용 기준을 입증하는 증거가 있는가?” Choice: 달성/추가 작업/사용자 결정 필요/증거 부족 | 달성 권고·미충족 항목 반환. 목표 자동 상태 변경은 별도 공개 계약 검증 후 결정 | [Composite scoring](https://docs.typesafe.ai/patterns/composite-scoring.md), [Confidence routing](https://docs.typesafe.ai/patterns/confidence-routing.md). 필수 기준은 평균으로 덮지 않는다. **goals 서비스의 판정 확장점은 미확인**, 현재 제안은 보조 판정으로 제한. [접점 조사](<../../docs/research/decision-engine-brainstorm.md#L70-L85>) |
| **J08 사용자 질문 답안 추천** — 이미 정한 선호를 반복 질문하면 이전 결정을 바탕으로 답을 추천받고 싶다. | 추천 agent tool/command. 실제 질문·선택지, 사용자의 명시적 선호와 출처·시점 | Choice: “명시적 결정이 지지하는 선택지는?” 실제 선택지+모름. Noul: “현재 질문에 적용 가능한 사용자 결정이 있는가?” | 추천과 근거 위치를 표시하고 사용자가 확정. 권한·비용·삭제 승인을 자동 대답하지 않음 | [Function calling](https://docs.typesafe.ai/cookbooks/function_calling.md), [Confidence routing](https://docs.typesafe.ai/patterns/confidence-routing.md). 추천은 가능; 실제 자동응답은 `user-questions/request` answerer 연결·우선순위 확인 필요. [공개 접점](<../../docs/research/decision-engine-brainstorm.md#L74-L76>) |

### B. 품질·컨텍스트·비용 관리

| ID·이름 / 사용자 시나리오 | 붙는 지점·state | 질문 형태·예시 기준 | 결과로 하는 행동 | 근거 패턴·공개 API 가능성 및 제약 |
| --- | --- | --- | --- | --- |
| **J09 계획 품질 점검** — 코딩 전에 범위·검증·롤백이 빠진 계획을 짧게 점검하고 싶다. | 계획 검사 agent tool 또는 slash command. 요구사항, 제약, 계획 | 차원별 Score: “계획의 검증 단계는 구체적인가?” 없음/막연한 테스트/수용 기준과 연결된 확인. 범위 준수·의존 순서도 별도 질문 | 차원별 점수와 고정 개선 템플릿 표시. 심각한 범위 위반 Noul은 총점과 별도 처리 | [Composite scoring](https://docs.typesafe.ai/patterns/composite-scoring.md). 도구·명령 표면으로 가능, 계획 승인 UI를 가로채는 API는 전제하지 않는다. [접점](<../../docs/research/decision-engine-brainstorm.md#L70-L83>) |
| **J10 커밋 메시지·PR 검사** — 메시지와 PR 설명이 diff·검증 사실을 과장하지 않는지 확인하고 싶다. | 수동 command/agent tool, 제한된 commit 전 hook script. staged diff, 메시지/PR 초안, 실제 검증 내역, 팀 규칙 | Noul: “본문의 변경·검증 주장이 제공 증거와 모순되는가?” Score: 의도·영향 설명 없음/일부/충분 | 수정 권고를 반환하고 메인 LLM이 고친다. 커밋·push·PR 게시 자체는 별도 승인 유지 | [Citation check](https://docs.typesafe.ai/cookbooks/citation_check.md), [Semantic lint 사례](https://docs.typesafe.ai/concepts/use-case-map.md). command/tool은 가능; 일반 bash 문자열만으로 모든 git 경로 통제 불가. [도구 경계](<../../docs/research/dsh-runtime-control-points.md#L55-L57>) |
| **J11 스킬 선택** — 이름이 비슷한 스킬 중 이번 작업에 맞는 것만 추천받고 싶다. | `user-message` 훅 또는 추천 agent tool. 요청+스킬 목록, 이후 shortlist의 상세 내용 | Choice: “실제 요청 행동을 지원하는 스킬은?” 후보+없음. Noul: “절차가 필요한 작업인가?” | 후보 선정 후 상세를 읽어 두 번째 판정, 추천을 컨텍스트에 덧붙이고 로드는 메인 에이전트가 수행 | [Skill suggestion](https://docs.typesafe.ai/cookbooks/skill_suggestion.md). 목록 확보 경로·로드 정책은 별도 확인. 상위 지침의 필수 스킬을 Jev가 배제하지 않는다. 입력 덧붙임 가능. [Gate](<../../release/docs/appendix/pixie-gate.ko.md#L41-L49>) |
| **J12 컨텍스트·검색 결과 선택(W2/W6)** — 관련 파일을 못 찾았는데 답하지 말고 한 번 더 탐색했으면 한다. | 검색 평가 agent tool 또는 `tool-after` 훅. 질문, 검색어, 후보 문단·경로, 현재 필요한 증거 | 후보별 Score: 무관/간접/직접 증거. Noul: “현재 후보에 답할 충분한 근거가 있는가?” | 충분하면 근거 shortlist, 부족하면 메인 에이전트에게 재검색 권고. 모순 자료는 버리지 않고 구별 | [RAG passages](https://docs.typesafe.ai/cookbooks/classifying_rag_passages.md), [Fan-out](https://docs.typesafe.ai/patterns/fan-out.md). 도구로 가능. 반복 탐색은 메인 에이전트/한정된 코드 책임이지 Pixie 도구 루프가 아니다. [W2](<../../docs/research/decision-engine-brainstorm.md#L34-L41>) |
| **J13 저비용 우선·불확실 시 승격** — 쉬운 요약·분류는 작은 역할로 끝내고 실패 가능성 높은 결과만 강한 역할에 재검토시키고 싶다. | Studio 역할 결과를 받는 agent tool/command. 원 과제, 저렴한 역할의 산출물, 기준·근거, 남은 예산 | 항목별 Noul: “이 출력 필드에 원문에 없는 주장이 있는가?” Choice 검증의 낮은 confidence도 승격 조건 | 저렴한 역할 → Jev → 오류 신호/불확실성 시 강한 역할 1회. 반복·예산 상한을 코드로 통제 | [SDE cascade](https://docs.typesafe.ai/cookbooks/sde_cascade.md), [Confidence routing](https://docs.typesafe.ai/patterns/confidence-routing.md). 역할별 모델·reasoning은 가능하나 **자식 결과는 비동기 전달**된다. emit 종료 이벤트 자체로 veto/재실행된다고 가정하지 않는다. [역할](<../../src/host/role-tool.ts#L67-L78>), [런타임](<../../docs/research/dsh-runtime-control-points.md#L67-L71>) |
| **J14 에이전트 인계 품질** — 자식이 “끝났음”만 보내지 않고 변경·증거·남은 일을 전달하도록 하고 싶다. | `agent-message` Gate + 훅. 위임 과제, 들어오는 메시지, 제공된 결과 증거 | 독립 Noul: “검증 근거가 빠졌는가?”, “해결되지 않은 질문이 있는가?” Score: 인계받아 이어갈 수 없는 상태/일부 가능/충분 | 부족한 항목을 덧붙이거나 메시지 거부 피드백. 결과 수락 전 메인에게 검토 안내 | [Fan-out](https://docs.typesafe.ai/patterns/fan-out.md). 메시지 입력 교체·거부 가능, 모든 외부 provider의 내부 실행·메시지를 관찰한다는 보장은 없음. [Gate](<../../release/docs/appendix/pixie-gate.ko.md#L41-L47>), [외부 경계](<../../docs/research/dsh-runtime-control-points.md#L67-L71>) |
| **J15 인용·코드 설명 근거 검사** — “이 함수가 재시도한다”는 설명이 실제 코드·문서와 맞는지 알고 싶다. | 답변 전 agent tool/수동 command. 주장, 인용 구간, 원본 문서/코드, 버전 | Choice: “이 구간이 주장을 지지하는가?” 지지/반박/언급 없음. 파일·인용문 존재는 먼저 코드로 확인 | 근거 부족 항목만 메인에 반환하여 재조회·정정. turn-end 사용 시에는 사후 정정 표시 | [Citation check](https://docs.typesafe.ai/cookbooks/citation_check.md). 공개 tool 표면 가능. 원본 확보와 버전 일치가 필요하고 Jev가 링크를 스스로 읽지 않는다. [도구 표면](<../../docs/research/decision-engine-brainstorm.md#L70-L83>) |
| **J16 외부 결과 인젝션 경고** — 웹·로그에 섞인 “지침 무시/키 업로드”를 작업 근거와 분리하고 싶다. | `tool-after` Gate + 훅. 결과 원문, 출처, 도구 종류, 원래 사용자 목적 | Noul: “자료가 설명 대신 에이전트 행동·권한 변경을 지시하는가?” true=행동 탈취 지시, false=분석 대상 인용·정상 문서 | 의심 구간에 경고를 덧붙이거나 정책에 따라 결과 차단. 오탐이면 원문 확인 경로 제공 | [RAG passages](https://docs.typesafe.ai/cookbooks/classifying_rag_passages.md), [Guardrails](https://docs.typesafe.ai/cookbooks/llm_guardrails.md). post-execute는 가능하나 이미 생긴 부작용을 되돌리지 못하며 안전성 보장이 아님. [런타임](<../../docs/research/dsh-runtime-control-points.md#L47-L57>) |
| **J17 기억할 결정 선별** — 이번에 확정한 프로젝트 제약은 다음 작업에서도 기억하되 모델 추측은 굳히지 않았으면 한다. | 명시적 기억 검토 command/agent tool 또는 `turn-end` 메모. 사용자 결정 원문, 적용 프로젝트, 시점, 기존 후보 사실 | Noul: “사용자가 직접 확정한 지속적 제약인가?” Choice: 추가/기존 사실 대체/일회성/불명 | 저장 후보만 제안하고 사용자 확인 후 저장. 다음 판단에 관련된 승인 사실만 넣음 | [Memory](https://docs.typesafe.ai/cookbooks/basic_memory.md). 추천·메모는 가능; 저장·폐기·충돌 정책은 새 결정 필요. DSH 메모리 서비스를 임의로 전제하지 않는다. [명령 표면](<../../docs/research/decision-engine-brainstorm.md#L70-L83>) |

## 5. 평가

**제안 평가:** 가치는 빈도×사용자 손실 감소, 난이도는 현재 Gate/헬퍼/역할 구조에서의 추가 작업, 위험은 잘못 판단했을 때의 영향이다. 수치는 실측이 아니다. 공통 Jev 어댑터·자격 증명 연결은 어느 후보에도 필요하며, 기존 Noul 헬퍼와 Choice/Score 계약 차이는 난이도에 반영했다. [현 계약](<../../src/pixie-contracts.ts#L120-L175>), [연결 결정](<../../docs/research/decision-engine-brainstorm.md#L145-L173>)

| 순위 | 후보 | 가치 | 난이도 | 위험 | 제안 판단 |
| --- | --- | --- | --- | --- | --- |
| **1 ★** | J03 언어·번역 검증 | 높음 | 낮음–중간 | 낮음(메모) | W1/W3의 명시적 수요, 기존 훅 루프 재사용. 원문+번역 쌍으로 소규모 평가하기 쉽다. |
| **2 ★** | J06 완료·테스트 주장 감사 | 높음 | 중간 | 중간 | 허위 완료를 직접 줄일 수 있다. 먼저 경고 전용으로 시작하고 증거 없는 상태를 별도로 표시한다. |
| **3 ★** | J09 계획 점검 | 중간–높음 | 낮음–중간 | 낮음 | 수동 도구라 핫패스 지연·권한 영향이 적고 루브릭 개선 효과를 보기 쉽다. |
| **4 ★** | J02 역할 라우팅 | 높음 | 중간 | 중간 | 현재 역할별 모델·추론 설정을 활용한다. 자동 위임보다 추천으로 시작하면 오배정 비용이 작다. |
| **5 ★** | J05 결과 요약 여부 | 높음 | 중간 | 중간 | 기존 긴 결과 Gate와 결합해 불필요한 생성 호출을 줄일 가능성. 원문 보존 fallback이 필수다. |
| 6 | J15 인용·코드 설명 검사 | 높음 | 중간 | 낮음–중간 | 좁은 주장과 원본 쌍부터 시작하면 실패 원인을 추적하기 쉽다. |
| 7 | J01 요청 충분성 | 높음 | 중간 | 중간 | 헛작업 감소와 과도한 되묻기의 균형을 먼저 평가한다. |
| 8 | J10 커밋·PR 검사 | 중간 | 낮음–중간 | 낮음 | 수동 검토로 시작 가능, 게시·커밋은 별도다. |
| 9 | J11 스킬 선택 | 중간–높음 | 중간 | 중간 | 공식 agent 쿡북과 직접 대응하지만 목록·상세 확보가 필요하다. |
| 10 | J12 검색·컨텍스트 선택 | 높음 | 중간–높음 | 중간 | 근거를 잘못 제거할 위험과 재검색 비용을 측정한다. |
| 11 | J14 인계 품질 | 중간 | 중간 | 중간 | 여러 역할을 자주 쓸 때 효용이 커진다. |
| 12 | J13 비용 승격 | 높음(잠재) | 높음 | 중간–높음 | 비동기 역할 결과·비용 추적·중복 실행 제어를 먼저 정리한다. |
| 13 | J16 인젝션 경고 | 높음(잠재) | 중간–높음 | 높음 | 보조 신호로만 시작하며 단독 보안 경계로 쓰지 않는다. |
| 14 | J04 실행 위험 | 높음 | 중간–높음 | 높음 | 자동 허용이 아닌 경고/기존 승인 강화만 우선 검토한다. |
| 15 | J08 질문 답안 추천 | 중간 | 중간 | 중간(추천)/높음(자동) | 사용자의 선호와 권한 부여를 혼동하지 않는다. |
| 16 | J07 목표 달성 | 높음(잠재) | 높음 | 높음 | 증거 수집·goals 공개 확장점 확인 전 자동 complete 금지. |
| 17 | J17 기억 선별 | 중간 | 중간–높음 | 중간–높음 | 잘못된 장기 기억의 누적 위험 때문에 저장 전 확인이 필요하다. |

**첫 실험 제안:** J03 하나를 제한된 번역 메모 흐름으로 시작하고, J06을 차단 없는 감사 모드로 나란히 평가한다. 그다음 J09 또는 J02를 수동 호출로 붙인다. 범용 레시피 편집기나 자동 승인부터 만들지 않는다. 이 순서는 기존에 범용 흐름 편집기를 보류한 결정과도 맞는다. [보류 결정](<../../docs/research/decision-engine-brainstorm.md#L117-L126>)

**평가 방법 제안:** 실제 사례를 익명화하여 정상·오류·증거 부족·한국어 혼합·인젝션 사례를 라벨링한다. 기존 Pixie 단독과 Jev 보조를 비교해 오탐/미탐, 수동 수정률, 추가 호출 수, p50/p95 지연, 입력 토큰, 전체 비용을 기록한다. threshold 조정 사례와 평가 사례는 분리하고, 모델 버전·질문·원 state를 재현 가능하게 기록하되 민감정보 보관 정책을 적용한다. 임계값은 자체 데이터로 검증하라는 공식 지침에 근거한 제안이다. [공식 skill](https://raw.githubusercontent.com/typesafe-ai/skills/main/skills/typesafe-ai/SKILL.md), [Confidence](https://docs.typesafe.ai/confidence.md)

## 6. 열린 질문

| 결정·검증할 것 | 질문 / 제안되는 기본 방향 | 근거 |
| --- | --- | --- |
| 첫 사용자 가치 | 번역 메모, 허위 완료 경고, 역할 추천 중 어느 것이 가장 자주 필요한가? | [W1–W6](<../../docs/research/decision-engine-brainstorm.md#L30-L41>) |
| 지점별 지연 예산 | user-message/tool-before는 최대 얼마를 기다릴까? turn-end는 더 긴 예산을 허용할까? 기존 60초 제한을 목표 지연으로 혼동하지 않는다. | [Gate 제한](<../../release/docs/appendix/pixie-gate.ko.md#L51-L60>), [모델](https://docs.typesafe.ai/models.md) |
| 비용·승격 상한 | Jev+Pixie+재위임을 포함한 턴당 예산, 재시도 횟수, 비싼 역할 승격 허용을 누가 정할까? 429/529 backoff도 게이트 전체 제한에 포함해야 한다. | [API 오류](https://docs.typesafe.ai/api.md), [Cascade](https://docs.typesafe.ai/cookbooks/sde_cascade.md) |
| 외부 전송·프라이버시 | 소스 코드·명령·로그·개인정보 중 무엇을 전송할 수 있는가? 키·토큰·비밀은 전송 전 결정적 마스킹, 프로젝트별 opt-in이 필요한가? 보관·처리 지역·ZDR 계약은 따로 확인한다. | [Models: Data handling](https://docs.typesafe.ai/models.md) |
| state 소유권·신선도 | W6의 과제·대화·도구 증거를 누가 공급할까? 결과가 돌아올 때 턴·파일 버전이 바뀌면 폐기할까? 실행 로그 부재와 실제 미실행을 어떻게 구분할까? | [현재 입력 한계](<../../docs/research/decision-engine-brainstorm.md#L34-L41>), [공식 skill](https://raw.githubusercontent.com/typesafe-ai/skills/main/skills/typesafe-ai/SKILL.md) |
| 헬퍼·판정 계약 | Noul부터 시작할까, Choice/Score까지 노출할까? 현재 `question/options/levels`와 HTTP의 `instructions/criteria` 사이 변환을 어디까지 유지할까? | [현재 계약](<../../src/pixie-contracts.ts#L120-L175>), [API](https://docs.typesafe.ai/api.md) |
| 오류와 판단 불확실성 | API 실패는 `ok:false`/오류로 유지한다. 신뢰도 낮음과 장애를 별도로 보여 주고, 각 Gate의 통과/막음 정책을 무엇으로 정할까? | [JudgeResult](<../../src/pixie-contracts.ts#L134-L137>), [Gate 오류 정책](<../../release/docs/appendix/pixie-gate.ko.md#L51-L60>) |
| 최종 결정권·루프 | Jev 결과와 Pixie 해석이 충돌하면 무엇을 적용할까? 보안 정책은 코드, Pixie는 설명/가공만이라는 경계를 어떻게 검증할까? 교정 횟수·헬퍼 20회 한도 안에서 반복을 어디서 끊을까? | [과거 혼란](<../../docs/research/decision-engine-brainstorm.md#L23-L28>), [헬퍼 제한](<../../release/docs/appendix/pixie-gate.ko.md#L95-L109>) |
| 공개 API 재확인 | 목표 상태 전이, 질문 answerer, role 결과 수집은 대상 DSH 버전에서 어떤 공개 계약인가? 기존 조사만으로 구현·배포 완료를 선언하지 않는다. | [검증 한계](<../../docs/research/dsh-runtime-control-points.md#L79-L84>), [역할 버전 차이](<../../src/host/role-tool.ts#L67-L77>) |
| 언어·버전 안정성 | 한국어/영어 혼합·코드·부정 표현에서 임계값을 따로 둘까? 1.13.0 고정과 1.14.0 평가를 어떻게 나눌까? | [Models](https://docs.typesafe.ai/models.md) |

**결론 — 제안:** Jev의 첫 제품 가치는 “에이전트 하나를 더 만든다”가 아니라 **이미 있는 흐름에서 좁은 질문을 검증 가능한 기준으로 묻고, 불필요한 생성·잘못된 종료·잘못된 위임을 줄이는 것**이다. Pixie 구조는 유지하고, 각 아이디어의 실제 효용을 먼저 확인한 뒤 공통 엔진의 외부 표면을 정한다.
