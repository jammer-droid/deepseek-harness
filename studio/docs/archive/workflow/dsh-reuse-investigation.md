---
kind: reference
description: "워크플로우 명세를 DSH 공개 API·현재 Studio 구현과 대조하여 재사용 지점, 구조 수정 사항, 이슈별 구현 책임을 정리한 조사."
---

> **이력 자료:** `feat/lean-agent`는 기존 기능 구현을 제거한 셸 전용 브랜치입니다. 이 문서의 workflow 기능·검증 기록은 분기 전 기준이며 현재 배포 기능이 아닙니다.

# 워크플로우 구현의 DSH 재사용 조사

## 요약

[워크플로우 기능 명세](workflow-specification.md)를 **수정하지 않은 DSH에 설치하는 Studio 플러그인**으로 구현할 때, 어떤 DSH 공개 API와 기존 Studio 코드를 재사용하고 어떤 연결부를 새로 만들어야 하는지 정리한다. 구현 완료 보고가 아니다.

결론은 다음과 같다.

1. DSH 실행 엔진은 고치지 않는다. Studio는 **역할 → 공개 subagent 요청**, **지침 → systemPrompt section**, **도구 정책 → restrict + guard**, **적용 → agentPresets.register**를 연결한다.
2. 위임·모델 검증·지침 의미가 현재 Studio 안에서 경로마다 따로 구현되어 있다. 새 기능을 추가하기 전에 **공용 child-runtime seam**, **컴포넌트 apply compiler**, **단일 모델 검증기**로 모아야 한다(§8).
3. 메인 역할의 모델을 프리셋으로 강제하는 공개 지점이 없다. 세션 모델 선택이 요청 route를 소유한다(§5.2). 사용자 결정에 따라 #18은 메인 모델 불일치 경고만 제공한다.
4. 역할별 컨텍스트 창 크기, 역할별 독립 압축 임계값, 부모보다 넓은 권한은 공개 경로가 없다. 미지원으로 표시한다(§7).

## 목차

- [1. 기준과 표기](#1-기준과-표기)
- [2. 현재 Studio 구현 지도](#2-현재-studio-구현-지도)
- [3. 등록·초안·검증](#3-등록초안검증)
- [4. 프리셋 적용](#4-프리셋-적용)
- [5. 모델](#5-모델)
- [6. 지침과 도구](#6-지침과-도구)
- [7. 위임·권한·컨텍스트](#7-위임권한컨텍스트)
- [8. 구조 수정 사항](#8-구조-수정-사항)
- [9. 이슈별 책임과 수용 기준](#9-이슈별-책임과-수용-기준)
- [10. 후속 항목](#10-후속-항목)
- [11. 조사 범위와 한계](#11-조사-범위와-한계)

## 1. 기준과 표기

조사 기준 commit은 `2f929c3d154bbb5b181c31c3eab39661822283ed`(브랜치 `studio/feat/workflow`)다. 대상 런타임은 두 가지다.

- **Desktop `0.2.0-rc.2`**: [#18 명세](../../issues/18-workflow-apply.md)의 개발 기준이다. 근거는 [build-desktop.mjs](../../../build-desktop.mjs)가 설치한 공개 npm 패키지의 선언(`lib/types/*.d.ts`)과 배포 JS다.
- **checkout `0.2.1-alpha.2`**: Web 호환 확인용이다. 근거는 저장소 소스다.

| 표기 | 의미 |
| --- | --- |
| **rc2** | rc.2 공개 선언·배포 JS에서 확인함. 호출 성공은 검증하지 않음 |
| **ws** | checkout 소스에서만 확인함. rc.2에서 동일하다고 보장하지 않음 |
| **S** | 내부 구현의 동작 근거. Studio가 그 파일을 import해도 된다는 뜻이 아님 |
| **U** | 요구를 충족하는 공개 지점이 확인되지 않음 |

이름에 `public`이 있거나 TypeScript에서 import할 수 있다는 이유로 배포 API라고 판정하지 않는다. 기존 독립 배포 증거는 [#23 설치 기록](../../issues/23-independent-plugin.md)의 rc.2 UI·초안 저장 검증뿐이다. 모델 호출과 워크플로우 실행은 포함하지 않는다.

### 1.1 두 런타임의 차이

| 계약 | rc.2 | ws | 영향 |
| --- | --- | --- | --- |
| `subagents.startActivation` | **없음** | 있음 | 위임은 [child-runtime seam](../../../packages/roles/src/child-runtime.ts)을 통해서만 호출한다. rc.2는 [교체 template](../../../compat/desktop-0.2.0/child-runtime.ts.template)의 `startContinuable`을 쓴다. |
| `startContinuable` 요청의 `outputSchema` | 제외됨 | — | rc.2에서 구조화 결과는 Session 이벤트 관찰로 얻는다(`observeInitial = true`). |
| `tools.restrict/guard`, scope 상속 view | 동일 | 동일 | preset 등록 도구는 agent의 조상 layer라 agent scope에서 restrict할 수 있다. agent 자기 layer 등록은 restrict 대상이 아니다. |
| `systemPrompt.section({ complete })`, `system-prompt/assemble` | 동일 | 동일 | complete section은 waterfall 뒤에 강제된다. |
| `agentPresets.register/composeFrom/composedPreset/serviceFor` | 동일 | 동일 | 재등록 시 이전 generation은 사용자가 0이 될 때까지 유지된다. |
| child effort 상속(`routeChanged`), `persona` → `deployment:persona-prefix` | 동일 | 동일 | §5.3, §6.1 |
| 세션 모델 선택(`installModelSelection`) 설치 순서 | preset mount보다 먼저 | 동일 | §5.2 |

## 2. 현재 Studio 구현 지도

| 패키지 | 배포 | 역할 | 이번 조사의 판정 |
| --- | --- | --- | --- |
| [workflows](../../../packages/workflows/src/index.ts) | 포함 | 초안 저장, 컴포넌트·시스템 등록, 구성 검증, 모델 카탈로그 | 재사용. 적용·실행 adapter가 없음 |
| [roles](../../../packages/roles/src/roles-plugin.ts) | 포함 | 고정 implementer/reviewer 설정, managed delegation, `studio-managed` preset | 실행 강제 패턴(restrict + guard, `agent/request` route 재적용)을 추출해 재사용 |
| [sub-agent-catalog](../../../packages/sub-agent-catalog/src/index.ts) | **제외** | 초안 메인 역할을 child로 실행 | rc.2 비호환으로 배포 제외([통합 기록](workflow-integration.md#L21-L29)). 위임 기반으로 쓰지 않음 |
| [general](../../../packages/general/src/preset-settings.ts) | 포함 | `configEditor`로 기존 preset entry 편집 | Studio 소유 preset과 공존만 함 |
| [experiments](../../../packages/experiments/src/runtime.ts) | 포함 | 모든 새 agent에 도구·프롬프트 정책 적용 | Studio preset과의 적용 범위 결정 필요(§8 F7) |
| Client `design-preview` | 포함 | Mock 화면 | 실제 편집기와 분리되어 있음 |

## 3. 등록·초안·검증

**재사용(S):** [WorkflowRemote](../../../packages/workflows/src/index.ts)는 초안·카탈로그·모델·검증 Remote와 등록 메서드를 제공한다. [ComponentRegistry](../../../packages/workflows/src/component-registry.ts)는 effect 소유 disposer를 반환한다. [DraftStore](../../../packages/workflows/src/drafts.ts)는 expectedRevision 충돌, 저장 불명 후 쓰기 중단, 실행 부작용 없는 저장을 제공한다. [validateWorkflow](../../../packages/workflows/src/validation.ts)는 비활성 인스턴스와 그에 닿는 연결을 제외한다.

**공백:**

- 등록 정의는 필드·포트만 선언한다. "이 컴포넌트를 실행 구성으로 바꾸는 adapter"가 없다. `validate()` 성공은 실행 가능 판정이 아니다(F2).
- `ConfigField.kind`는 `'text'` 하나다. 도구 목록 같은 구조 값은 줄바꿈 문자열로 저장된다.
- 검증 도중 카탈로그 revision이 바뀌면 `model-lookup-failed`를 붙인다([index.ts:69](../../../packages/workflows/src/index.ts#L69)). 이는 조회 실패가 아니라 오래된 판정이다(F5).

등록 수명, 카탈로그 갱신 시점, 미해석 초안 보존은 [#16](../../issues/16-workflow-validation.md)과 [#23](../../issues/23-independent-plugin.md)에서 확정했고 그대로 유지한다.

## 4. 프리셋 적용

**rc2:** `agentPresets.register(definition)`은 정의를 등록하고 즉시 mount한다. 반환된 disposer가 해제를 소유한다. 정의는 `id`, `name`, `description`, `order`, `plugins`(Cordis entry 목록)만 가진다. **모델 필드는 없다.** 같은 ID는 중복으로 거절하므로 갱신은 "이전 disposer 호출 → 새 정의 등록"이다. 이전 generation은 `retired`로 표시되고, 그 preset에 묶인 agent가 모두 끝나야 수거된다. 따라서 살아 있는 실행은 재적용 후에도 이전 구성을 유지한다. 활성화 실패는 예외가 아니라 `list()` 진단(`broken`)으로 나타난다.

**한계:**

- 갱신 사이에 그 ID가 잠시 없다. 이 구간의 새 대화 생성은 `agent-preset/not-found`로 실패한다.
- 세션 resume은 Session에 기록된 preset ID로 **현재** 정의에 mount한다. 재적용 후 재시작·재개한 오래된 세션은 새 구성을 받는다. 과거 구성 복원은 보장되지 않는다(#19).
- `configEditor.edit()`는 기존 entry 편집이다. 새 preset 선언 생성 경로가 아니며 런타임 등록과 같은 영속화 프로토콜이 아니다. Studio 적용본의 영속화는 Studio storage domain이 소유하고, 시작 시 재등록한다.

**현재 Studio의 preset 소유 방식은 세 가지다.**

1. 번들 patch의 정적 `studio-managed`([cordis.patch.yml](../../../packages/bundle/cordis.patch.yml)): managed delegation 전용.
2. General의 기존 entry 편집([preset-settings.ts:91–96](../../../packages/general/src/preset-settings.ts#L91-L96)).
3. #18이 추가할 런타임 등록.

워크플로우 적용은 3만 사용한다. General은 `configEditor.configuration()`의 entry만 나열하므로 3을 편집 대상으로 노출하지 않는다. 다만 preset roster `list()`에는 나타난다.

## 5. 모델

### 5.1 카탈로그와 검증

[WorkflowModels](../../../packages/workflows/src/models.ts)가 `listProviders/listModels/resolveModelInfo/resolveCallConfig`(rc2)로 카탈로그와 선택 검증을 담당한다. 같은 판정이 [RoleSettings.validate](../../../packages/roles/src/roles.ts#L66-L73)와 managed delegation 재시작 검증에도 따로 있다. RoleSettings는 모든 실패를 `capability-unavailable` 하나로 축약한다. 적용·위임 경로는 `WorkflowModels` 하나를 쓴다(F5).

### 5.2 메인 역할 모델 — 공개 강제 지점 없음 (U)

DSH 세션 생성은 agent setup에서 `installModelSelection`을 **preset mount보다 먼저** 설치한다(rc2, ws [agent.ts:381–396](../../../../packages/api/session-controller/src/agent.ts#L381-L396)). 이 waterfall listener는 `agent/request`의 provider/model/effort를 세션 선택값으로 덮어쓴다. Cordis waterfall은 먼저 등록된 listener가 바깥쪽이라 preset 안의 listener보다 나중에 결과를 정한다. 세션 선택값은 사용자가 고르지 않았으면 전역 `agentDefaultModel`이다.

그러므로 Studio preset이 메인 역할 모델을 적용하는 방법마다 문제가 있다.

| 방법 | 결과 |
| --- | --- |
| preset 안에서 `agent/request` 재작성(일반 등록) | 세션 선택 listener가 바깥에서 덮어써 효과가 없음 |
| `prepend: true`로 최외곽 등록 | 실제 요청은 역할 모델이 됨. 그러나 모델 선택 UI와 프롬프트 `{{model}}`은 세션 선택값을 표시함. `agent/pre-step`의 모델 변경 알림이 "선택값 ≠ 직전 요청"으로 판정해 **매 step 알림 메시지를 추가함** |
| `sessionController.selectModel` 호출 | 그 세션의 다음 요청에 반영됨. 그러나 **전역 기본 모델도 저장**함(`agentDefaultModel.saveSelection`) |
| `model/selection` Session 이벤트 직접 기록 | 세션 컨트롤러 내부 projection 계약에 의존함. 공개 API로 판정하지 않음 |

이 문제는 child에는 해당하지 않는다. 세션 모델 선택은 api-session root에만 설치되므로, managed delegation의 child `agent/request` 재적용([delegation.ts:121–127](../../../packages/roles/src/delegation.ts#L121-L127))은 유효하다.

### 5.3 추론 미지정의 의미

native child는 요청한 route가 부모와 같고 effort를 지정하지 않으면 **부모 effort를 상속한다**(rc2 `routeChanged`). [wire 타입](../../../packages/workflows/src/workflow-types.ts#L23-L24)과 명세는 "미지정 = 해당 모델의 기본값"이다. managed delegation은 child `agent/request`에서 상속 effort를 제거하여 명세와 일치한다. catalog 경로는 `agentOptions`만 전달하여 불일치한다. 위임 공용 모듈은 managed delegation 방식을 따른다.

## 6. 지침과 도구

### 6.1 지침

**rc2:** `systemPrompt.section({ name, order, text, interpolate, complete })`. 같은 layer에서 이름이 겹치면 오류다. scoped 같은 이름 section은 global을 shadow한다. 유효한 complete section이 둘 이상이면 assembly가 실패한다. complete는 sections만 대체하며 tools·contexts·variables·대화 기록·실행 제한은 바꾸지 않는다.

`persona` 요청 필드는 child의 `deployment:persona-prefix`를 **대체**한다(order 0). 명세와 #18 계약은 "활성 블록을 문서 순서대로 **추가**하고 DSH 필수 지침을 대체하지 않음"이다. 현재 managed delegation과 catalog는 지침을 persona로 전달하므로 의미가 다르다(F3).

| 모드 | 공개 연결 | 제한 |
| --- | --- | --- |
| 블록 추가 | Studio 이름 section 등록, 명시 order | 뒤 블록이 앞 지침을 확실히 override한다고 설명하지 않음 |
| persona 교체 | preset의 `dsh-persona` 구성 또는 child `persona` | 기본 persona 하나만 대체 |
| 특정 section 교체·제외 | 검증된 scoped shadow만 | 임의 이름 삭제 API 없음. 지원 section 목록을 고정해 노출 |
| 전체 대체 | `complete: true` section 하나 | 첫 구현 필수 아님. experiments의 section 편집이 무효가 됨 |

### 6.2 도구

**rc2:** `tools.restrict({ allow | deny })`는 agent scope에서 **상속된** 도구(global + preset 등 조상 layer)를 가린다. agent 자기 layer에 등록된 도구, 알 수 없는 이름, `run_code`는 거절한다. 여러 restrict는 교집합이다. `tools.guard()`는 실행을 거부하지만 스키마를 숨기지 않는다. child의 `toolFilter`는 child scope의 `restrict`와 같다.

숨김과 실행 거부를 모두 충족하는 기존 구현은 managed delegation뿐이다([guard](../../../packages/roles/src/delegation.ts#L67-L73), [restrict](../../../packages/roles/src/delegation.ts#L116)). catalog는 `toolFilter`만 써서 숨김만 하고, 이름이 틀리면 `restrict()`가 child 구성 중에 던진다.

- allow 목록 restrict는 나중에 등록되는 도구(MCP 연결 등)도 자동으로 숨긴다. deny 목록은 그렇지 않다. 실행 거부 guard도 같은 허용 집합으로 판정한다.
- 자유 위임 경로가 남아 있다. 표준 preset은 `subagent`, `subagent_fork`, `send_message`, workflow PTC 도구를 포함한다. 역할 기반 위임만 허용하려면 이 도구들도 정책 대상이다.
- 도구 description은 시스템 section이 아니므로 complete로 바뀌지 않는다.
- 파일 편집 도구를 제외해도 셸·외부 도구로 쓰기가 가능하다. 읽기 전용 보장으로 표시하지 않는다.
- PTC 내부 호출(`rootCallId`가 다른 중첩 실행)에도 guard가 적용되는지는 실제 Loader로 확인한다.

## 7. 위임·권한·컨텍스트

### 7.1 위임

**rc2:** `subagents`는 named provider(`spawn`, `fork`), `startContinuable`, `sendMessage`, `drainContinuableChildren`, 조회·중단을 제공한다. 요청은 `prompt`, `parent`, `agentOptions`, `persona`, `toolFilter`, `maxDepth`를 받는다. provider capability가 없는 옵션은 지원으로 표시하지 않는다.

- fresh(spawn)는 부모 대화 없이, fork는 직접 부모의 **완료된 turn**까지를 상속한다. 진행 중 turn은 복사하지 않는다. managed delegation은 fork 시 진행 중 turn의 텍스트를 증거로 덧붙인다([delegation.ts:491–502](../../../packages/roles/src/delegation.ts#L491-L502)).
- child는 `composeFrom`으로 부모 preset의 같은 generation에 합류한다. Studio preset의 위임 도구도 child에 보인다. 재위임 허용 여부는 child 역할 기록으로 실행 시점에 판정한다.
- 후속 대화는 기존 child ID로 `sendMessage`를 쓴다. 새 fork가 아니다.

### 7.2 접근 권한

**S:** native child는 부모의 sandbox mode·approval policy·permission preset을 `source: 'delegation'` 이벤트로 child 로그에 복사한다. 요청 인자로 역할별 권한을 넘길 수는 없다.

**rc2:** `permissionPresets.set(session, name)`, `current(session)`, `catalog()`가 공개되어 있다. child 세션에 부모보다 좁은 preset(예: `read-only`)을 설정하는 경로의 **후보**다. 부모의 승인 정책과의 상호작용, 이후 부모 변경 시 동작은 실제 Loader로 확인한다. 네트워크 접근의 역할별 제한은 공개 지점이 없다(U).

### 7.3 컨텍스트

**rc2:** contextWindow는 모델 메타데이터다. 역할별로 바꾸는 공개 지점이 없다(U). 자동 압축은 `compaction-basic`이 preset 그룹(standard는 `isolate: compaction`) 안에서 `thresholdRatio`, `headroomTokens`, `retainRatio`, 정확한 provider/model별 `modelPolicies`를 가진다.

- Studio preset 구성에 compaction 행을 넣으면 **preset 단위** 압축 정책을 정할 수 있다.
- child는 부모 preset generation을 공유하므로 **역할별 독립 임계값은 역할 모델이 서로 다를 때만** `modelPolicies`로 근사할 수 있다. 같은 모델을 쓰는 두 역할은 구분할 수 없다.
- 명세의 '컨텍스트 창 크기'를 `maxTokens`(출력 한도)나 압축 비율로 대체해 표시하지 않는다.

## 8. 구조 수정 사항

| ID | 문제 | 수정 방향 | 담당 이슈 |
| --- | --- | --- | --- |
| F1 | child 생성 경로가 셋(managed delegation, 배포 제외 catalog, 예정된 workflow 위임)이고 각자 검증·effort·도구·불명 처리를 구현함 | `child-runtime` seam을 roles 내부에서 Studio 공용 Host 모듈로 옮김. "역할 snapshot → child 요청 + child 정책 설치" 변환을 managed delegation의 `agent/created` 핸들러에서 분리함 | #19 S1 |
| F2 | 컴포넌트 등록에 실행 adapter가 없어 실행 가능 판정이 소비자 하드코딩([resolve.ts:37–46](../../../packages/sub-agent-catalog/src/resolve.ts#L37-L46))이 됨 | workflows에 Host 전용 apply compiler를 둠. 컴포넌트 ID·버전별 adapter가 역할 실행 구성 조각을 만들고, adapter 없는 활성 항목은 `unsupported-adapter`로 거절함. #18 preset publisher와 #19 위임이 같은 compiler를 공유함 | #18 S2 |
| F3 | 지침이 위임 경로는 persona 대체, #18은 section 추가 | 지침 컴포넌트는 메인·child 모두 Studio 이름 section **추가**로 통일. persona 교체는 별도 지원 항목으로 분리 | #18 S3, #19 |
| F4 | catalog가 durable 기록 뒤 모든 오류를 `admission-unknown`으로 처리해 전체 위임을 잠금 | admission 전 도구 이름·모델 검증. rollback이 보장된 실패(rc.2 `startContinuable`은 실패 시 child 전체 rollback을 명시)는 거절로, 응답 유실만 불명으로 분류 | #19 S2 |
| F5 | 모델 검증 3중 구현, 카탈로그 변경을 조회 실패로 표시 | `WorkflowModels` 단일화, `catalog-changed` 진단 분리 | #18 S2 |
| F6 | preset 소유 방식 세 가지 | 워크플로우 적용은 런타임 등록만 사용. `studio-workflow:` ID 접두사, roster 표시 이름 규칙 | #18 S1 |
| F7 | experiments가 모든 새 agent에 정책 설치 | 결정: Studio preset에도 그대로 적용하고 적용본 설명(A12)에 표시 | #18 S3·S4 |
| F8 | 구성 고정이 child 단위뿐. 오래된 root의 늦은 child가 현재 설정을 읽음 | root 시작 시 적용 revision을 root session ID와 함께 기록하고, 늦은 child는 그 revision으로 역할을 해석. 적용본 저장소는 참조 중인 과거 revision을 보존 | #19 S3 |

## 9. 이슈별 책임과 수용 기준

| 이슈 | Studio가 구현할 부분 | 재사용 대상 | 공개 지점 공백 |
| --- | --- | --- | --- |
| [#18](../../issues/18-workflow-apply.md) 적용 | 적용본 저장, compiler, preset publisher, 메인 지침, 메인 모델 불일치 경고 | `agentPresets.register`, `systemPrompt.section`, DraftStore 패턴 | 메인 모델 강제(§5.2, 미지원으로 결정) |
| [#19](../../issues/19-workflow-delegation.md) 위임 | 공용 child-runtime, 역할 위임 도구, root 고정, 재시작 차이 표시 | `subagents` 공개 서비스, managed delegation 패턴 | 재시작 후 과거 구성 복원 |
| [#20](../../issues/20-workflow-tools.md) 도구 | 도구 카탈로그·묶음, allow restrict + guard 설치 | `tools.schemas/restrict/guard` | agent 자기 layer 도구 숨김 |
| [#21](../../issues/21-workflow-access-context.md) 권한·컨텍스트 | 지원 항목 판정·표시, preset 압축 구성 | `permissionPresets`, `compaction-basic` 구성 | 역할별 창 크기·네트워크·같은 모델 역할별 임계값 |
| [#22](../../issues/22-workflow-library.md) 라이브러리 | 독립 정의·설정 저장, 복사, 템플릿, A1–A12 대응 | DraftStore 패턴 | 없음 |

| 기준 | 최소 검증 |
| --- | --- |
| A1·A2 | 메인 포함 동일 편집기, 모델 초기값 복사, 원본 변경 후 복사본 불변 |
| A3 | 카탈로그 fixture + Host 재검증, effort 미지정 시 부모 상속이 없는지 요청 헤더로 확인 |
| A4 | 실제 Loader에서 preset·agent 자기 layer 도구 각각의 스키마 제외와 executor 거부 |
| A5 | fresh/fork 완료 turn 경계, 지침 section 추가, 기존 child 후속 대화 |
| A6 | workflow 밖 역할·미허용 재위임 거부, 자유 subagent 도구 정책 |
| A7 | 미지원 권한·컨텍스트 값 적용 거절, 좁힌 permission preset의 실제 거부 |
| A8 | 초안 저장과 적용 분리, Studio 소유 preset만 변경 |
| A9 | Loader unload에서 등록·preset disposer와 UI 반영 |
| A10 | 같은 workflow 두 root 격리, 재적용 뒤 오래된 root의 늦은 child |
| A11 | 저장·활성화·응답 유실 실패 주입과 재조회 |
| A12 | ko/en/zh 설명에 기본 대비 차이, 한계, 미지원 사유 |

검증 순서는 Studio 단위 테스트 → 실제 Loader 구성 테스트 → **버전을 명시한 미수정 DSH에 패키징한 Studio 설치**다. 각 결과를 따로 기록한다.

## 10. 후속 항목

- **Jev:** 명세의 Choice/Score/Noul, state/questions/answers 계약을 보존한다. 첫 버전은 호출 코드·자격 증명·UI를 추가하지 않는다. 실패를 정상 점수로 바꾸지 않는다.
- **무모델 미리보기:** `systemPrompt` assembly 재사용 여지는 있으나 provider callback의 부수효과가 없다고 보장할 수 없다. preview-safe 경계를 따로 정의한다.
- **관찰:** 기존 Session 로그와 요청·도구 결과를 참조한다. 숨은 사고 수집, 외부 플러그인 자동 분석은 약속하지 않는다. 민감정보 마스킹을 설계한다.
- **그 밖:** upstream merge/live inheritance, 그래프 편집 필수화, Studio 외부 runtime 혼합, 권한 확장, 품질·비용 A/B 평가는 첫 구현에 넣지 않는다.

## 11. 조사 범위와 한계

소스, rc.2 공개 패키지의 선언과 배포 JS, GitHub 이슈만 읽었다. 테스트, 빌드, 설치, 모델 호출, 프로필 변경은 하지 않았다. 위 rc2 판정은 선언·구현 수준 근거이며, 각 이슈 명세의 첫 단계에서 실제 Loader로 확인해야 한다. [구성 조사](workflow-composition-research.md)와 [런타임 조사](workflow-runtime-research.md)의 과거 현황 서술이 현재 소스와 다르면 이 문서와 현재 소스를 우선한다.
