---
kind: reference
description: "DSH 모델 카탈로그·하위 에이전트·권한·압축·복구 기능의 소스 조사와 지원 공백."
---

# Studio 워크플로 런타임 조사

이 문서는 메인·구현자·리뷰어 템플릿과 모델·지침·도구·위임·접근 권한·컨텍스트 컴포넌트를 기존 DSH에 연결할 때의 근거와 제한을 정리한다. 조사 방법은 **소스 확인(source inspection)** 이며 실행 테스트, 실제 제공자 호출, 설치된 GUI 검증은 수행하지 않았다. 아래의 지원 여부는 현재 체크아웃의 소스에 대한 판단이지 설치된 배포 버전의 보증이 아니다.

## 목차

- [결론](#결론)
- [모델과 추론 수준](#모델과-추론-수준)
- [컨텍스트 창과 자동 압축](#컨텍스트-창과-자동-압축)
- [Fork, 새 대화와 자식 옵션](#fork-새-대화와-자식-옵션)
- [도구 제한과 접근 권한](#도구-제한과-접근-권한)
- [재개, 동시성, 현재 Studio 통합](#재개-동시성-현재-studio-통합)
- [첫 구현과 후속 명세의 구분](#첫-구현과-후속-명세의-구분)

## 결론

첫 구현은 DSH의 Agent와 subagent 수명 주기를 재사용한다. 독자 큐, 재시도 정책, 동시성 정책, 별도 Studio 런타임은 추가하지 않는다는 설계 범위를 유지한다. 다만 **역할별 컨텍스트 창과 부모보다 넓은 자식 접근 권한을 현재 child 옵션으로 바로 설정할 수 있다는 근거는 없다**. 이 항목은 기본값으로 조용히 무시하지 말고 적용 불가 또는 후속 통합 대상으로 표시해야 한다. 근거는 [AgentOptions](../../packages/core/agent/src/runtime-types.ts#L25-L35), [자식 구성 및 권한 복사](../../packages/subagent/subagent/src/child-agent.ts#L157-L277), [압축 설정](../../packages/compaction/compaction-basic/src/types.ts#L9-L45)이다.

| 요구 | 소스 판정 | 첫 구현에 대한 의미 |
| --- | --- | --- |
| 사용자 선택 가능 모델과 추론 수준 | DSH 카탈로그 제공 | 기존 Remote 재사용, Studio 자유 입력을 카탈로그 선택으로 바꾸는 연결 작업 필요 |
| Fork와 새 대화 | native provider 모두 제공 | 역할별 허용 모드 선택은 Studio 설정·검증 작업 |
| 자식 persona, 모델, toolFilter, 깊이 제한 | native provider 제공 | 일반화된 역할 컴포넌트와 연결 가능하나 세부 상속을 그대로 설명해야 함 |
| 역할별 컨텍스트 창·자동 압축 임계값 | 모델 용량과 압축 plugin 설정은 존재, child 필드는 없음 | 역할별 적용 수단을 별도 확인하기 전 지원으로 표시하지 않음 |
| 역할별 직접 작업 권한과 위임 권한 | 도구 제한과 부모 정책 복사는 존재 | 독립 권한 할당 및 Host/워크플로 상한은 후속 설계 |
| 기존 자식에게 후속 메시지·cold resume | continuable 자식에 제공 | 저장된 descriptor와 direct-parent 권한 검사를 재사용 |
| 사용자 정의 큐·실패 정책 | 이 설계에서 구현하지 않음 | DSH의 실제 거절·취소·복원 동작을 노출 |

각 행의 상세 근거와 미확인 범위는 아래 절에 있다.

## 모델과 추론 수준

`SessionController.modelCatalog()`는 Session 없이 사용 가능한 카탈로그를 반환한다. `buildModelCatalog()`는 `llm.listProviders()`, `listModels(provider)`, `resolveModelInfo(provider, model)`을 사용하여 제공자별 모델과 `reasoning.efforts`, 선택적인 `defaultEffort`, 제공자별 실패를 반환한다. Studio는 하드코딩된 모델 목록 대신 이 표면을 재사용할 수 있다. 카탈로그 등재는 실제 인증 성공이나 호출 성공의 보증은 아니다. 근거: [modelCatalog](../../packages/api/session-controller/src/index.ts#L313-L320), [buildModelCatalog](../../packages/api/session-controller/src/catalog.ts#L20-L71), [모델 메타데이터](../../packages/llm/llm/src/types.ts#L329-L346).

추론 수준은 제공자·모델별 값이다. `LlmModelReasoningInfo`의 기본 effort가 없으면 제공자 자체 기본값을 보존한다. 모든 모델에 공통인 low/medium/high 목록이나 단일 DSH 추론 기본값을 가정하면 안 된다. 근거: [LlmModelReasoningInfo](../../packages/llm/llm/src/types.ts#L369-L386).

현재 Studio `RoleSettings`는 구현자·리뷰어의 `instructions`, `provider`, `model`, 선택적 `reasoningEffort`만 저장한다. `validate()`는 카탈로그 소속과 `resolveCallConfig()`를 검사하고, `capture()`는 새 자식 생성용 사본을 만든다. 따라서 팀 모델을 한 번 선택하여 역할마다 복사하고 이후 독립 편집하는 UX는 구현 가능한 요구이지만, 현재 역할 설정에 메인 역할이나 여섯 컴포넌트가 구현되어 있다는 뜻은 아니다. 근거: [roleSchema와 rolesSchema](../packages/roles/src/roles.ts#L10-L22), [validate와 capture](../packages/roles/src/roles.ts#L66-L103).

native child의 실제 기본값은 단순히 ‘명시 역할 → 제공자 → DSH’만으로 설명되지 않는다. `parentAgentOptionsForDelegation()`은 부모의 최신 request header를 우선하고, `resolveChildAgentOptions()`는 부모 옵션 위에 요청을 덮어쓴다. 경로가 바뀌고 effort가 생략되면 부모 effort를 제거하여 새 모델 기본값을 사용한다. 같은 경로에서는 부모 effort 상속이 가능하다. 역할의 ‘빈 값은 제공자 기본값’ 의미를 보장하려면 이 차이를 검증해야 한다. 근거: [부모 옵션과 자식 옵션 해석](../../packages/subagent/subagent/src/child-agent.ts#L59-L118).

`tool-subagent`의 모델 선택은 `agentOptions`, 모델이 요청한 provider/model/effort, 선택 정책과 preflight의 결합이다. `modelSelectionSettings`를 사용하는 경우 최상위 새 Session에서 설정을 샘플링하고 자식에 상속한다. 장래 라우터가 인스턴스 모델을 선택하는 요구는 이 경로와 연결할 수 있지만 저장된 역할을 변경하지 않는 정책 자체가 자동 제공되지는 않는다. 근거: [execute의 모델 선택 검증](../../packages/subagent/tool-subagent/src/index.ts#L287-L341), [selectForSession](../../packages/subagent/tool-subagent/src/index.ts#L400-L426).

## 컨텍스트 창과 자동 압축

컨텍스트 용량은 `LlmModelContext.contextWindow`라는 **정확한 제공자·모델 경로의 adapter 소유 메타데이터**다. endpoint discovery의 `contextWindow`는 선택적이며 모델 목록에 용량이 항상 있는 것은 아니다. `AgentOptions`에는 provider/model/reasoningEffort/maxTokens가 있지만 조사한 기본 정의에는 역할별 contextWindow나 자동 압축 임계값이 없다. 근거: [discovery와 context 메타데이터](../../packages/llm/llm/src/types.ts#L311-L346), [AgentOptions](../../packages/core/agent/src/runtime-types.ts#L25-L35).

자동 압축은 `compaction-basic`의 `BasicCompactionConfig`와 정확한 provider/model별 `modelPolicies`가 소유한다. 선언 기본값은 `auto: true`, `thresholdRatio: 0.8`이며 headroom·유지량·요약·재시도도 이 플러그인의 설정이다. 조사한 타입에는 제공자가 자동 압축 비율을 지정하는 필드가 없다. 따라서 ‘역할 명시값 → 제공자 자동 압축 기본값 → DSH 기본값’ 중 가운데 단계는 확인되지 않았으며, 모델 용량의 제공자 기본값과 압축 정책의 DSH 기본값을 구분해야 한다. 근거: [CompactionPolicyConfig와 BasicCompactionConfig](../../packages/compaction/compaction-basic/src/types.ts#L9-L45).

압축의 비율은 절대적인 실행 시점 보장이 아니다. pressure 처리에서는 선택된 모델의 용량을 조회하고 출력 예약량과 함께 `resolveCompactSpec()`에 전달한다. 용량이 없으면 설정 오류를 내고, 계산된 threshold보다 작으면 압축하지 않는다. 따라서 ‘80%’라는 UI 값만으로 실제 토큰 임계값을 설명하면 부족하며 출력 예약과 headroom 영향을 표시해야 한다. 근거: [pressure 처리](../../packages/compaction/compaction-basic/src/index.ts#L304-L340), [ResolvedCompactSpec](../../packages/compaction/compaction-basic/src/types.ts#L74-L79).

**후속 확인 필요:** 사용자가 모델 용량보다 작은 역할별 창을 설정하는 방법, 큰 값을 입력했을 때 충돌 오류를 내는 방법, 같은 모델을 쓰는 서로 다른 역할의 압축 비율을 격리하는 방법은 위 API만으로 확정할 수 없다. 모델 용량 메타데이터를 바꾸는 것과 역할의 실제 컨텍스트 예산을 줄이는 것은 구별해야 한다. 첫 구현에서는 요약 알고리즘을 새로 만들지 않으며, 위 세 항목의 실행 지점을 확인하기 전에는 컨텍스트 컴포넌트를 동작하는 기능으로 약속하지 않는다.

## Fork, 새 대화와 자식 옵션

`ForkInProcessProvider.prepareContinuable()`은 **직접 부모**의 마지막 `turn/end`까지 완료된 로그만 캡처한다. 현재 진행 중인 도구 호출 턴은 포함하지 않으며 완료된 턴이 없으면 빈 seed가 된다. 이 seed는 생성 시 한 번 확정되어 자식 로그에 남는다. `SpawnInProcessProvider.prepareContinuable()`은 빈 구성을 반환하여 부모 대화 없이 시작한다. 두 provider 모두 agentOptions/outputSchema/depthLimit/toolFilter/persona capability를 선언한다. 근거: [Fork provider와 completedTurnPrefix](../../packages/subagent/subagent-fork-in-process/src/index.ts#L38-L79), [Spawn provider](../../packages/subagent/subagent-spawn-in-process/src/index.ts#L32-L55).

fresh는 새 대화라는 뜻이지 독립 실행 환경이나 독립 권한이라는 뜻이 아니다. 두 방식 모두 공통 자식 구성에서 부모 preset에 `composeFrom()`으로 참여하고, 선택적 persona와 tool restriction을 적용한다. persona는 배포 persona를 shadow하는 좁은 기능이다. 임의 지침 섹션을 추가·교체·제외하는 일반 편집 기능까지 child persona로 구현되었다고 볼 수 없다. 추가 과제 지침은 시작 요청의 `prompt`로 전달할 수 있지만 system persona와 user prompt의 역할을 구분해야 한다. 근거: [ChildComposition와 applyChildComposition](../../packages/subagent/subagent/src/child-agent.ts#L157-L216), [시작 요청 구성](../../packages/subagent/tool-subagent/src/index.ts#L323-L341).

깊이는 부모 깊이 + 1로 계산하며 설정된 절대 상한을 넘으면 `SubagentDepthError`로 거절한다. 재개된 부모도 저장된 깊이를 하한으로 사용한다. 따라서 역할마다 ‘몇 단계 더 위임 가능’이라는 상대값을 제공하려면 기존 maxDepth와의 의미 차이를 해결해야 한다. 근거: [resolveChildDepth](../../packages/subagent/subagent/src/child-agent.ts#L30-L56).

조사한 현재 `tool-subagent.execute()`는 `startActivation()` 후 자식 식별자를 반환하는 비동기 시작 방식이다. GUI 또는 이 조사 세션의 도구 schema에 wait/background 옵션이 보이더라도 그것을 이 소스의 동일한 모델-facing 도구 기능으로 단정하면 안 된다. 역할별 동기 대기 허용 정책은 별도 consumer 연결 대상으로 남긴다. 근거: [tool execute](../../packages/subagent/tool-subagent/src/index.ts#L323-L341).

## 도구 제한과 접근 권한

`toolFilter`와 persona는 자식 범위의 구성이다. 자식 restriction은 그 scope chain에서 허용하는 집합과 교집합을 만든다. 따라서 부모의 필터를 임의로 완화하는 설정으로 취급하면 안 된다. 다만 부모 Agent에만 적용되는 guard와 공유 preset 제한은 서로 다른 실행 경로이므로 ‘메인 도구가 적으면 자식도 무조건 같은 집합’이라고 일반화해서도 안 된다. 근거: [applyChildComposition의 scope 설명](../../packages/subagent/subagent/src/child-agent.ts#L176-L216), [현재 Studio 역할별 executor guard](../packages/roles/src/delegation.ts#L67-L73).

현재 Studio의 메인·구현자·리뷰어 도구 집합은 상수이고 `ctx.tools.guard()`가 실제 호출을 거절한다. 이는 모델에게 안 보이게 하는 것만으로 제한을 구현하지 않는 사례다. 그러나 구현자의 목록에 `bash`가 있으므로 도구 이름 목록 자체를 파일 읽기 전용 sandbox로 설명할 수 없다. 역할별 임의 도구 묶음 편집이나 MCP 연결 관리가 구현되어 있다는 근거도 이 코드에는 없다. 근거: [ROOT_TOOLS/CHILD_TOOLS/REVIEW_TOOLS](../packages/roles/src/delegation.ts#L19-L24), [실행 guard](../packages/roles/src/delegation.ts#L67-L73).

native 위임은 `captureDelegatedPolicyOverrides()`에서 부모의 명시 sandbox override와 auto/full permission preset을 복사하고, approval 서비스가 있으면 자식 approval을 `never`로 고정한다. 일회성 승인과 배포 기본값 자체는 이 캡처에 포함하지 않는다. 이어 `appendDelegatedPolicyOverrides()`가 자식 로그에 기록하므로 Fork seed의 오래된 정책보다 새 위임 정책이 우선한다. 근거: [권한 캡처와 기록](../../packages/subagent/subagent/src/child-agent.ts#L236-L277).

**지원으로 확인되지 않은 요구:** 부모 역할의 직접 작업 권한과 별개로 더 넓은 자식 sandbox 권한을 선택하고 Host/워크플로 상한만 적용하는 기능. 조사한 ChildComposition에는 persona/toolFilter만 있고 AgentOptions에도 역할 권한 필드는 없다. 도구 guard로 메인의 직접 작업을 제한하면서 Host 정책을 공유하는 구성과, 실제 sandbox 권한 상승을 허용하는 구성은 구별해야 한다. 첫 구현에서 권한 컴포넌트가 후자를 보장한다고 표시하지 않는다. 근거: [ChildComposition](../../packages/subagent/subagent/src/child-agent.ts#L157-L163), [AgentOptions](../../packages/core/agent/src/runtime-types.ts#L25-L35), [delegation 권한 문구](../../packages/subagent/subagent/src/child-agent.ts#L165-L174).

## 재개, 동시성, 현재 Studio 통합

continuable 자식은 저장된 `subagent/descriptor`로 cold resume한다. `coldResume()`은 Session을 조회하고 direct-parent lineage를 검증한 뒤 descriptor의 provider/model/reasoningEffort/persona/toolFilter로 자식을 복원한다. 지원 descriptor가 없거나 one-shot이면 `NOT_RESUMABLE`로 거절한다. 따라서 아무 Session이나 role 이름으로 다시 연결하는 기능과는 다르다. 근거: [coldResume](../../packages/subagent/subagent/src/manager.ts#L1321-L1375).

descriptor는 모든 AgentOptions를 무조건 저장하지 않는다. `maxTokens`와 `outputSchema`는 activation 단위라 저장하지 않으며, cold resume에서는 이전 maxTokens나 부모의 현재 값을 상속하지 않고 재개 경로의 기본값을 사용한다. Fork는 재개 때 부모의 최신 기록을 다시 캡처하지 않는다. 생성 시 선택한 모델 경로와 persona가 유지되는 근거는 있지만, 임의의 미래 router 변경이나 전체 워크플로 snapshot까지 자동으로 유지된다는 보증은 아니다. 근거: [descriptor 저장 범위](../../packages/subagent/subagent/src/descriptor.ts#L1-L19), [Fork 생성 시 seed](../../packages/subagent/subagent-fork-in-process/src/index.ts#L74-L79).

DSH `ActivationPool.reserve()`는 활성 슬롯이 용량에 도달하면 `ACTIVATION_LIMIT_REACHED`로 거절한다. 이 코드는 자리가 날 때까지 신규 위임을 자동 대기열에 넣는 기능이 아니다. Agent에는 별도로 `nextTurn`/`nextStep` inbox와 취소의 `keepInbox` 옵션이 존재한다. 따라서 신규 자식 admission과 기존 Agent 입력 큐를 혼동하지 말고 DSH 동작을 그대로 노출해야 한다. 근거: [ActivationPool](../../packages/subagent/subagent/src/activation.ts#L15-L35), [CancelOptions와 Inbox](../../packages/core/agent/src/runtime-types.ts#L37-L85).

현재 Studio child adapter는 `startActivation({ delivery: 'caller' })`와 `drainChildren()`를 사용한다. 기존 Studio 구현은 고정 `studio-managed` preset, 고정 역할별 도구 guard, 역할 snapshot 저장을 갖춘 특수 consumer이지 새 합의의 범용 컴포넌트 편집기 자체는 아니다. 역할 설정 Apply는 새 snapshot을 저장하며 `capture()`가 생성용 사본을 반환한다. 재개 때 현재 역할 설정을 다시 적용하는 방식으로 바꾸지 않아야 한다. 근거: [child runtime adapter](../packages/roles/src/child-runtime.ts#L9-L25), [managed preset과 guard](../packages/roles/src/delegation.ts#L19-L27), [snapshot commit/capture](../packages/roles/src/roles.ts#L82-L103), [capture의 생성 전용 의미](../packages/roles/src/roles-remote.ts#L48-L52).

## 첫 구현과 후속 명세의 구분

첫 구현에서 재사용할 대상은 모델 카탈로그, DSH 모델 해석, native fork/spawn, persona와 tool restriction, Session 기반 재개, DSH admission·취소·inbox다. 컴포넌트는 이 기능을 어떤 입력과 도구 결과에 연결하는지 설명해야 하며, 고정 실행 순서나 강제 reviewer 재시도를 새 기본 정책으로 추가하지 않는다. 위 절의 함수가 재사용 근거이며, 각 역할 컴포넌트의 UI·검증·적용 연결은 별도 구현 작업이다.

후속 명세로 분리할 항목은 역할별 컨텍스트 예산 적용, 부모와 독립적인 역할 접근 권한, 임의 지침 섹션 편집, 인스턴스 router override의 변경·재개 규칙, 전체 워크플로 실행 snapshot, 별도 Studio runtime과 혼합 실행 시스템, Jev 결정 컴포넌트, 모델 호출 없는 preview와 상세 관찰, 원본 설정 upstream merge다. 이는 이번 설계에서 보류한 요구 목록이며 저장소 전체에 해당 기능이 절대 없다는 검색 결과가 아니다.

다음 구현 검증에서는 같은 모델의 서로 다른 역할, 부모 effort와 역할 기본값 충돌, Fork의 진행 중 턴 제외, 숨긴 도구 직접 호출 거절, shell을 포함한 실효 권한, 깊이 초과, 활성 슬롯 초과, cold resume의 descriptor 누락·모델 해석 실패·정책 복원, 생성 후 역할 설정 변경을 실행해야 한다. 이번 조사에서는 이 테스트를 수행하지 않았으므로 결과를 지원 증거로 제시하지 않는다.
