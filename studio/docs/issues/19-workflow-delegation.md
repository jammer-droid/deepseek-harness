---
kind: reference
description: "워크플로우 역할 위임, 루트 단위 구성 고정, 후속 대화와 재시작 제한의 구현 명세."
status: ready
---

# #19 실행 구성 고정과 임의 역할의 자율적 위임

## 식별과 준비 상태

- 이슈: [#19](https://github.com/jammer-droid/deepseek-harness/issues/19). 선행 [#18](18-workflow-apply.md)(open, `blocked`). 후속 #20이 이 이슈를 기다린다.
- 기준 브랜치 `studio/feat/workflow`, 조사 HEAD `2f929c3d154bbb5b181c31c3eab39661822283ed`.
- 대상: 수정하지 않은 Desktop DSH `0.2.0-rc.2` 공개 API. Web `0.2.1-alpha.2`는 호환 확인용이다.
- 준비 상태: `ready`. D1–D3은 사용자가 권장안으로 결정했다. 구현 착수는 #18 S2(적용본·compiler) 완료를 기다린다. 첫 단계 S1.

## 목적과 범위

메인(또는 허용된 역할)이 현재 워크플로우의 역할에 fresh·fork로 작업을 위임하고, 기존 자식에게 후속 메시지를 보낸다. 루트 시작 시 적용 구성을 고정하여, 재적용 뒤에도 같은 루트의 늦은 자식은 이전 구성을 쓴다.

**제외:** 고정 구현·리뷰·승인 순서, 새 큐·스케줄러·복구 엔진, 재시작 후 과거 구성 복원 보장, 워크플로우 밖 에이전트 정의로의 위임, managed delegation과 catalog의 데이터 변경·이행, 역할별 도구 정책(#20)·권한(#21).

## 현재 근거

| 근거 | 사실과 영향 |
| --- | --- |
| [managed delegation](../../packages/roles/src/delegation.ts) | 실행 강제 패턴이 있다: `agent/created`에서 역할 판정, restrict + guard, child `agent/request` route 재적용(상속 effort 제거), durable 예약 → 시작 → 결과 기록, `sendMessage` 후속, 종료 시 drain. 고정 implementer/reviewer 쌍과 리뷰 순서가 섞여 있어 그대로 재사용할 수 없다. |
| [child-runtime seam](../../packages/roles/src/child-runtime.ts)과 [rc.2 template](../../compat/desktop-0.2.0/child-runtime.ts.template) | 버전별 `startChild`/`drainChildren`을 빌드 시 교체한다. rc.2는 `startContinuable`이며 `outputSchema`가 없다. |
| [catalog](../../packages/sub-agent-catalog/src/index.ts) | `startActivation` 의존으로 배포 제외. 모든 오류를 `admission-unknown`으로 처리해 전체 위임을 잠근다. 위임 기반으로 쓰지 않는다. |
| [RoleSettings.capture](../../packages/roles/src/roles.ts#L99-L103) | child 생성 시점의 **현재** 적용본을 캡처한다. 루트 단위 고정이 아니다. [구조 검토](../workflow-architecture-review.md)도 기존 테스트가 "같은 루트에서 Apply 후 새 자식이 새 지침"을 기대한다고 기록했다. |
| rc.2 `subagents` | `startContinuable`, `sendMessage(sender, targetId, ...)`, `drainContinuableChildren`. fork는 부모의 완료 turn까지만 상속한다. child는 `composeFrom`으로 부모 preset generation에 합류한다. |
| rc.2 child 옵션 | 같은 route에서 effort 미지정이면 부모 effort를 상속한다. `persona`는 기본 persona를 대체한다. |
| 표준 preset | `subagent`, `subagent_fork`, `send_message`, workflow PTC 도구를 포함한다. Studio preset이 포함하지 않으면 노출되지 않는다. |

## 선택한 계약

### 공용 위임 모듈 (조사 F1)

`child-runtime` seam을 Studio 공용 Host 모듈로 옮긴다. roles와 workflows가 같은 모듈을 쓰며, Desktop 빌드의 template 교체 대상 경로만 바뀐다. managed delegation의 동작과 테스트는 바꾸지 않는다(이동 prefactor만 허용).

"역할 snapshot → child 요청 + child 정책" 변환을 공용 함수로 만든다.

- route: `agentOptions`로 provider/model 전달, child `agent/request`에서 상속 effort를 제거하고 역할 값을 재적용.
- 지침: #18과 같은 의미(Studio 이름 section **추가**). `persona`를 쓰지 않는다. child ctx에 section을 등록하는 시점·소유권은 S1에서 확인한다.
- 정책 설치: `agent/created`에서 Studio 기록과 대조해 child 역할을 판정하고, 판정 불가한 Studio preset child는 거부한다.

### 위임 대상과 재위임

위임 도구는 Studio preset에 포함된 도구 하나다(이름은 S2에서 확정). 호출 시 루트의 고정 구성에서 대상 역할을 해석한다. 워크플로우에 없는 역할, 호출 역할에 허용되지 않은 대상·컨텍스트 방식, 깊이 초과는 실행 시 거부한다. 기본 템플릿은 메인만 위임한다. 자유 `subagent`·`subagent_fork`는 Studio preset에 넣지 않는다.

### 루트 단위 구성 고정 (조사 F8)

루트(부모 세션이 없는 Studio preset agent)가 `agent/created`에서 현재 적용 revision을 **루트 session ID와 함께** 영속 기록한다. 이후 그 루트 아래의 모든 위임은 이 revision의 역할 구성을 쓴다. 적용본 저장소는 기록된 루트가 참조하는 과거 revision을 보존한다. 동시 실행 상태는 루트·child ID로 분리하며 플러그인 공유 필드에 섞지 않는다.

### 실패 분류 (조사 F4)

- 사전 거절: 역할·대상·모델·도구 이름 검증 실패. durable 기록 전에 거절하고 다른 위임을 막지 않는다.
- rollback 보장 거절: `startContinuable`이 던진 오류(rc.2는 실패 시 child 전체 rollback 명시). 예약 기록을 실패로 닫는다.
- 결과 불명: 응답 유실·종료 중단처럼 수락 여부를 알 수 없는 경우만. 해당 child만 불명으로 표시하고 재조회로 해소한다.

## 확정한 결정

사용자가 세 결정 모두 권장안을 선택했다.

- **D1 재시작 후 루트 구성:** 재개한 루트의 위임은 루트가 기록한 revision의 역할 구성을 계속 쓴다(모델·지침은 child 요청에 직접 전달되므로 가능). 루트 자신의 지침·도구는 preset의 현재 정의이므로, 기록 revision ≠ 현재 적용 revision이면 UI와 위임 도구 결과에 "구성 차이"를 표시한다. 기록된 revision의 적용본을 읽을 수 없으면 위임을 거부하고 사유를 표시한다.
- **D2 fork 경계:** DSH 기본(완료 turn까지만 상속)을 그대로 쓴다. 진행 중 turn 내용이 필요하면 호출자가 작업 지시에 넣도록 위임 도구 설명에 명시한다. managed delegation의 증거 첨부 방식은 가져오지 않는다.
- **D3 결과 전달:** continuable child의 기본 알림 전달(부모 inbox)을 쓴다. 구조화 결과는 지원하지 않는다.

## 구현 단계

의존 순서: S1 → S2 → S3 → S4 → S5. 새 계획이며 재번호 없음.

| 단계 | 결과·선행 | 변경 책임 | 수용 조건·검증 |
| --- | --- | --- | --- |
| S1 | 공용 child-runtime 모듈과 변환 함수 추출. 선행 #18 S2. | roles → 공용 모듈 이동, build·build-desktop 교체 경로 갱신. 동작 무변경. | 기존 managed delegation 테스트 전부 통과, Desktop 빌드 타입 검사 통과. child ctx section 등록 시점을 실제 Loader로 확인하고 결과를 기록한다. |
| S2 | 역할 위임 도구(fresh/fork/후속). 선행 S1. | workflows Host 위임 adapter, Studio preset 도구 등록. | 실제 Loader: 허용 역할 fresh·fork 시작, 요청 헤더의 provider/model/effort(미지정 시 상속 없음), 지침 section 존재, 기존 child 후속 대화, 밖 역할·미허용 대상·깊이 초과 거부, 사전 거절 후 다음 위임 정상. 모델 입력 스냅샷. |
| S3 | 루트 단위 구성 고정. 선행 S2. | 루트 기록 domain, 적용본 과거 revision 보존. | 같은 워크플로우 두 루트 격리, 재적용 뒤 오래된 루트의 늦은 child는 이전 구성·새 루트는 새 구성, Studio unload 시 drain. |
| S4 | 재시작 구성 차이 표시. 선행 S3. | Host 재조회 Remote, Workflow UI, ko/en/zh. | 재시작 후 기록 revision ≠ 현재일 때 표시·동작이 D1과 일치, 불명 child 표시. 브라우저 확인. |
| S5 | 독립 배포 검증과 문서. 선행 S4. | 패키징, 격리 profile. | 미수정 rc.2에 설치하여 위임·후속·재적용 흐름 확인. replay와 라이브 결과 분리 기록. |

## 수용 조건 대응

| #19 요구 | 단계 |
| --- | --- |
| 루트 시작 시 구성 고정 | S3 |
| 고정 순서 없이 워크플로우 내 역할 대상 | S2 |
| DSH 실행·취소·drain 재사용, 실행별 상태 분리 | S1, S3 |
| 재시작 시 구성 차이·복원 제한 표시 | S4 |
| 양성·음성·Loader·스냅샷·UI | S2–S5 |
| 문서·독립 배포 결과 | S5 |
