---
kind: reference
description: "독립 에이전트 정의·이름 있는 컴포넌트 설정의 저장·복사와 기본 개발 팀 템플릿의 구현 명세."
status: ready
---

> **이력 자료:** `feat/lean-agent`는 기존 기능 구현을 제거한 셸 전용 브랜치입니다. 이 문서의 workflow 기능·검증 기록은 분기 전 기준이며 현재 배포 기능이 아닙니다.

# #22 독립 정의·설정 복사와 기본 개발 팀 템플릿

## 식별과 준비 상태

- 이슈: [#22](https://github.com/jammer-droid/deepseek-harness/issues/22). 선행 [#21](21-workflow-access-context.md)(open). 마지막 워크플로우 작업이다.
- 기준 브랜치 `studio/feat/workflow`, 조사 HEAD `2f929c3d154bbb5b181c31c3eab39661822283ed`. 대상 Desktop `0.2.0-rc.2` 공개 API.
- 준비 상태: `ready`. D1·D2는 사용자가 권장안으로 결정했다. 첫 단계 S1. 저장·복사(S1–S2)는 #18–#21과 독립이므로 먼저 진행할 수 있다. S3 이후는 #18–#21 완료를 기다린다.

## 목적과 범위

워크플로우와 별도로 에이전트(역할) 정의와 이름 있는 컴포넌트 설정을 저장하고, 워크플로우에 **독립 복사**한다. 메인·구현자·리뷰어 기본 개발 팀 템플릿으로 새 워크플로우를 만들어 편집부터 실행까지 수행한다. 첫 여섯 기능과 A1–A12의 대응을 점검한다.

**제외:** live inheritance·override·원본 업데이트 병합, 고정 역할 종류, 기존 저장 데이터의 자동 이행, 고정 승인 절차.

## 현재 근거

| 근거 | 사실과 영향 |
| --- | --- |
| [DraftStore](../../packages/workflows/src/drafts.ts) | 프로필별 워크플로우 초안만 저장한다. 독립 정의 저장소는 없다. 같은 revision·불명 처리 패턴을 재사용한다. |
| [WorkflowRole](../../packages/workflows/src/workflow-types.ts#L26) | 역할은 워크플로우 안에 인라인으로 저장된다. 역할 ID는 워크플로우 로컬이다. 복사 출처 정보는 없다. |
| [RoleSettings](../../packages/roles/src/roles.ts)·[managed delegation 기록](../../packages/roles/src/delegation-store.ts) | 고정 implementer/reviewer 쌍과 사이클 기록. 변환·삭제하지 않는다. |
| [catalog 기록](../../packages/sub-agent-catalog/src/store.ts) | 배포 제외 패키지의 `studio_role_catalog`. 건드리지 않는다. |
| Mock 화면([mock-library.tsx](../../src/mock-library.tsx)) | 에이전트·컴포넌트·시스템 라이브러리 UI 시안. 실제 데이터와 연결되어 있지 않다. |

## 선택한 계약

- 독립 정의는 별도 storage domain에 저장한다. 워크플로우 초안과 같은 expectedRevision·불명 처리 규칙을 따른다.
- 복사는 값 복사다. 워크플로우 역할에 새 역할 ID·새 인스턴스 ID를 발급하고, 출처(정의 ID·revision)는 표시용 메타데이터로만 남긴다. 원본 수정은 복사본에 전파되지 않는다.
- 템플릿은 코드에 포함된 읽기 전용 정의 묶음이다. 생성 시 #17의 최초 모델 선택을 모든 역할 초기값으로 복사한다. 역할 이름은 편집 가능하며 고정 종류가 아니다.
- 기본 지침은 명세 확인·구현 위임·리뷰 활용을 권장하되 순서를 강제하지 않는다. 재작업은 기존 구현자 child에 후속 메시지로 보내도록 안내한다(#19).
- 기존 RoleSettings·managed delegation·catalog 데이터는 자동 이행하지 않는다(D1).

## 확정한 결정

사용자가 두 결정 모두 권장안을 선택했다.

- **D1 기존 고정 역할 데이터:** 공존만 하고 가져오기를 제공하지 않는다. 사용자는 템플릿으로 새로 만든다. RoleSettings·managed delegation·catalog 데이터는 읽지도 변환하지도 않는다.
- **D2 라이브러리 UI 위치:** 기존 Mock 라이브러리 시안의 구조를 실제 화면으로 옮겨 Workflow 서비스 좌측 메뉴에 "에이전트"·"컴포넌트 설정"을 추가한다. Mock 화면(design-preview)은 그대로 둔다.

## 구현 단계

의존 순서: S1 → S2 → S3 → S4. S1–S2는 #18–#21과 독립. 새 계획이며 재번호 없음.

| 단계 | 결과·선행 | 변경 책임 | 수용 조건·검증 |
| --- | --- | --- | --- |
| S1 | 독립 정의·이름 있는 설정 저장소와 Remote. 선행 없음. | workflows Host domain, Remote. | 저장·재열기·충돌·불명 처리, 기존 저장 데이터 불변 확인. |
| S2 | 워크플로우로 복사·템플릿 생성 UI. 선행 S1. | Workflow UI·폼, ko/en/zh. [디자인 시스템](../design-system.md) 준수. | 복사 후 원본 변경이 복사본에 전파되지 않음(A2), 템플릿 생성·모델 초기값 복사·동일 편집기(A1). 라이트·다크·좁은 폭 확인. |
| S3 | 개발 팀 템플릿 실행 흐름. 선행 S2, #18–#21 완료. | 템플릿 지침, 통합 테스트. | 템플릿 적용 → 새 대화 → 위임·재작업 후속 대화. 강제 순서 없음(A6). 모델 입력 스냅샷. |
| S4 | A1–A12 대응 점검과 독립 배포 검증. 선행 S3. | 문서, 패키징, 격리 profile. | A1–A12별 충족·미지원·후속 표, 미수정 rc.2 설치 흐름. replay와 라이브 결과 분리 기록. |

## 수용 조건 대응

| #22 요구 | 단계 |
| --- | --- |
| 복사본 독립, live inheritance 없음 | S1, S2 |
| 메인·구현자·리뷰어는 초기 템플릿 | S2, S3 |
| 기존 데이터 자동 이행 없음 | S1 |
| 첫 여섯 기능·A1–A12 대응 | S4 |
| 양성·음성·Loader·스냅샷·UI | S1–S4 |
| 문서·독립 배포 결과 | S4 |
