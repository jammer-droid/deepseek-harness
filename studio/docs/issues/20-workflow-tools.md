---
kind: reference
description: "역할별 도구 포함·제외를 모델 노출과 실제 실행 거부에 함께 적용하는 구현 명세."
status: ready
---

> **이력 자료:** `feat/lean-agent`는 기존 기능 구현을 제거한 셸 전용 브랜치입니다. 이 문서의 workflow 기능·검증 기록은 분기 전 기준이며 현재 배포 기능이 아닙니다.

# #20 도구 선택을 모델 노출과 실제 실행 제한에 반영

## 식별과 준비 상태

- 이슈: [#20](https://github.com/jammer-droid/deepseek-harness/issues/20). 선행 [#19](19-workflow-delegation.md)(open). 후속 #21.
- 기준 브랜치 `studio/feat/workflow`, 조사 HEAD `2f929c3d154bbb5b181c31c3eab39661822283ed`. 대상 Desktop `0.2.0-rc.2` 공개 API.
- 준비 상태: `ready`. D1·D2는 사용자가 권장안으로 결정했다. 구현 착수는 #18 S2 compiler와 #19 S1 정책 설치 지점을 기다린다. 첫 단계 S1.

## 목적과 범위

역할별로 도구 묶음과 개별 도구를 포함·제외하고, 제외한 도구는 모델 스키마와 executor 실행 양쪽에서 막는다. 메인(Studio preset 루트)과 위임 child 모두에 적용한다.

**제외:** 외부 연결 생성·인증, 파일·셸 자원 접근 제한(#21), 도구 description 재작성, 읽기 전용 보장 표시.

## 현재 근거

| 근거 | 사실과 영향 |
| --- | --- |
| rc.2 `tools.restrict` | agent scope에서 **상속된** 도구(global + preset layer)만 가린다. 알 수 없는 이름, agent 자기 layer 도구, `run_code`는 거절한다. allow 목록은 이후 등록 도구도 숨긴다. |
| rc.2 `tools.guard` | 실행을 거부하지만 스키마는 숨기지 않는다. agent ctx guard는 그 agent에만 적용된다. |
| [managed delegation](../../packages/roles/src/delegation.ts#L67-L116) | `tools.schemas(agent)`로 이름을 구한 뒤 allow restrict + 역할별 허용 집합 guard를 함께 설치한다. 숨김·거부 모두 충족하는 유일한 기존 구현이다. |
| [catalog `studio.tools`](../../packages/sub-agent-catalog/src/resolve.ts#L40-L45) | 줄바꿈 문자열 allow/deny를 `toolFilter`로만 전달한다. 실행 거부가 없고, 틀린 이름은 child 구성 중 예외가 된다. 배포 제외. |
| [ConfigField](../../packages/workflows/src/component-registry.ts#L10) | `'text'`만 지원한다. 도구 ID 목록을 구조 값으로 저장할 수 없다. |
| agent 자기 layer 도구 | DSH의 structured-output 등 child 전용 도구, experiments가 agent ctx에 등록하는 `bash`·`job_output` 래퍼. restrict로 숨길 수 없다. |

## 선택한 계약

- 도구 컴포넌트는 **허용 목록(allow)** 의미로 컴파일한다. UI의 "제외"는 허용 목록에서 빼는 편집이다. 이렇게 하면 나중에 추가된 도구가 자동 노출되지 않는다.
- 설치 지점은 #19 S1의 `agent/created` 정책 설치다. 설치 시 `tools.schemas(agent)`에서 실제 이름을 읽고 `restrict({ allow })`와 같은 집합의 guard를 함께 등록한다. child 경로는 `toolFilter`를 쓰지 않는다(이름 오류가 admission 실패로 번지는 문제 회피).
- 적용 전 검증: 허용 목록의 이름이 현재 대상 preset에서 restrict 가능한지 확인하고, 아니면 `unsupported-tool`로 적용을 거절한다.
- agent 자기 layer 도구는 guard로 실행만 막을 수 있다. 이 경우 UI에 "모델에는 보이지만 실행 거부"로 표시하며 숨김 충족으로 표시하지 않는다.
- Studio 위임 도구, 결과 제출 도구 등 Studio 기능 도구는 역할 기능에 필요한 경우 항상 허용 집합에 포함한다.
- 파일 편집 도구 제외에 읽기 전용 표시를 하지 않는다.

## 확정한 결정

사용자가 두 결정 모두 권장안을 선택했다.

- **D1 도구 카탈로그:** 적용 대상 Studio preset의 도구 이름을 Host가 조회해 제공한다. preset이 mount된 agent가 없으면 preset 구성 행에서 정적 목록을 만든다. 묶음은 Studio가 정의한 고정 묶음(파일 읽기, 파일 쓰기, 셸, 위임, 웹 등)으로 시작하며 개별 도구 선택도 함께 제공한다.
- **D2 구조 필드:** `ConfigField.kind`에 `'string-list'`를 추가한다. 등록 검증·Host 검증·폼을 확장하고, v3 문서 호환과 알 수 없는 값 보존을 유지한다.

## 구현 단계

의존 순서: S1 → S2 → S3 → S4. 새 계획이며 재번호 없음.

| 단계 | 결과·선행 | 변경 책임 | 수용 조건·검증 |
| --- | --- | --- | --- |
| S1 | 도구 카탈로그·구조 필드. 선행 #18 S2. | workflows 등록·검증·Remote, 폼. | 카탈로그 조회·조회 실패 표시, 목록 필드 저장·재열기·알 수 없는 값 보존. |
| S2 | 도구 adapter와 정책 설치. 선행 S1, #19 S1. | compiler adapter, 공용 정책 설치. | 실제 Loader: 메인과 child 각각 제외 도구가 스키마에 없음, 직접 executor 호출 거부, 허용 도구 양성 대조, agent 자기 layer 도구 거부, 다른 preset agent 영향 없음. 모델 입력 스냅샷. |
| S3 | 설명·UI. 선행 S2. | Workflow UI, ko/en/zh. | 숨김/실행 거부 구분 표시, 읽기 전용 아님 안내. 브라우저 확인. |
| S4 | 독립 배포 검증과 문서. 선행 S3. | 패키징, 격리 profile. | 미수정 rc.2에서 제외 도구 미노출·거부 확인, 결과 분리 기록. |

## 수용 조건 대응

| #20 요구 | 단계 |
| --- | --- |
| 모델 노출과 직접 executor 호출 모두 제한 | S2 |
| Agent 소유 도구·우회 음성, 허용 양성 | S2 |
| 다른 실행 영향 없음, 읽기 전용 미표시 | S2, S3 |
| 양성·음성·Loader·스냅샷·UI | S1–S4 |
| 문서·독립 배포 결과 | S4 |
