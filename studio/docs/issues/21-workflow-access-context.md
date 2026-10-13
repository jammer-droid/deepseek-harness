---
kind: reference
description: "역할별 접근 권한과 컨텍스트 설정 중 실제 적용 가능한 항목만 적용·표시하는 구현 명세."
status: ready
---

> **이력 자료:** `feat/lean-agent`는 기존 기능 구현을 제거한 셸 전용 브랜치입니다. 이 문서의 workflow 기능·검증 기록은 분기 전 기준이며 현재 배포 기능이 아닙니다.

# #21 접근 권한·컨텍스트 지원 범위 검증과 적용

## 식별과 준비 상태

- 이슈: [#21](https://github.com/jammer-droid/deepseek-harness/issues/21). 선행 [#20](20-workflow-tools.md)(open). 후속 #22.
- 기준 브랜치 `studio/feat/workflow`, 조사 HEAD `2f929c3d154bbb5b181c31c3eab39661822283ed`. 대상 Desktop `0.2.0-rc.2` 공개 API.
- 준비 상태: `ready`. D1·D2는 사용자가 권장안으로 결정했다. S1은 #19 S1 이후 착수한다. 판정표의 '조건부' 항목은 S1 결과에 따라 지원/미지원으로 확정하며, 미지원이 되어도 범위 결정 없이 미지원 표시로 처리한다.

## 목적과 범위

역할별 접근 권한과 컨텍스트 설정에서 실제로 강제·적용 가능한 항목과 미지원 항목을 구분한다. 지원 항목만 적용하고, 미지원 항목은 저장은 하되 적용을 거절하거나 비활성 이유를 표시한다.

**제외:** 부모·Host보다 넓은 권한, 새 압축·요약 알고리즘, 코어 변경, 네트워크 접근의 역할별 제한(공개 지점 없음).

## 현재 근거

| 근거 | 사실과 영향 |
| --- | --- |
| native child 권한 | 부모의 sandbox mode·approval policy·permission preset을 `source: 'delegation'` 이벤트로 child 로그에 복사한다(S). 요청 인자로 권한을 넘길 수 없다. |
| rc.2 `permissionPresets` | `catalog()`, `current(session)`, `resolve(name)`, `set(session, name)`이 공개되어 있다. 기본 preset은 `read-only`·`workspace-write`·`danger-full-access`다. child 세션에 더 좁은 preset을 설정하는 후보 경로다. |
| rc.2 `sandboxPolicy` | 세션의 마지막 `sandbox/mode` 이벤트가 배포 기본값보다 우선한다. 도구 실행마다 `resolve`한다. |
| contextWindow | 모델 메타데이터다. 역할별로 바꾸는 공개 지점이 없다. |
| rc.2 `compaction-basic` | preset 그룹(standard는 `isolate: compaction`) 안에서 `thresholdRatio`, `headroomTokens`, `retainRatio/Tokens`, 정확한 provider/model별 `modelPolicies`를 가진다. child는 부모 preset generation을 공유한다. |

## 지원 범위 판정 (S1에서 확인)

| 항목 | 판정 후보 | 근거·조건 |
| --- | --- | --- |
| 역할 직접 작업 권한: 부모보다 좁은 permission preset | 조건부 지원 | child 생성 직후 `permissionPresets.set`. 부모 변경·승인 정책과의 상호작용 확인 필요 |
| 부모보다 넓은 권한 | 미지원 | 상한 원칙 |
| 네트워크 접근 | 미지원 | 공개 지점 없음 |
| 위임 권한(누구에게 위임 가능) | 지원 | #19 위임 대상 검사로 강제 |
| 컨텍스트 창 크기(모델 한도 변경) | 미지원 | 모델 메타데이터 |
| 자동 압축 시작 시점: Studio preset 전체 | 지원 | preset 구성의 `compaction-basic` 행 |
| 자동 압축 시작 시점: 역할별 | 조건부 | 역할 모델이 서로 다를 때만 `modelPolicies`로 표현 가능. 같은 모델 역할끼리는 구분 불가 |

## 선택한 계약

- 권한·컨텍스트 컴포넌트의 각 필드는 compiler에서 위 판정에 따라 적용하거나 `unsupported-setting`으로 거절한다. 기본값으로 근사하지 않는다.
- 미지정 압축 값은 값별 소유자 기본값(`compaction-basic` 기본 → DSH 기본)으로 둔다. 명시값이 모델 한도와 모순되면 거절한다.
- 지침 문구를 권한 제한 수단으로 표시하지 않는다. 도구 선택(#20)과 자원 접근 제한을 다른 컴포넌트로 둔다.

## 확정한 결정

사용자가 두 결정 모두 권장안을 선택했다.

- **D1 컨텍스트 UI 의미:** '컨텍스트 창 크기'는 첫 구현에서 미지원 이유만 표시한다. '자동 압축 시작 시점'은 컨텍스트 창 대비 비율(`thresholdRatio`)로 노출한다.
- **D2 압축 임계값 범위:** 워크플로우(Studio preset) 단위 한 값만 지원한다. 역할별 값은 미지원으로 표시한다. 판정표의 '역할별 자동 압축'은 첫 구현에서 미지원이다.

## 구현 단계

의존 순서: S1 → S2 → S3 → S4. 새 계획이며 재번호 없음.

| 단계 | 결과·선행 | 변경 책임 | 수용 조건·검증 |
| --- | --- | --- | --- |
| S1 | 지원 범위 적합성 확인. 선행 #19 S1. | Studio 실제 Loader fixture. 코어·프로필 수정 금지. | child `permissionPresets.set`으로 좁힌 권한이 실제 bash·fs 실행에서 거부되는지, 부모 권한 변경 시 child 동작, preset compaction 행 적용을 확인하고 위 판정표를 확정 기록한다. |
| S2 | 권한·컨텍스트 adapter. 선행 S1, #18 S2. | compiler adapter, 정책 설치. | 지원 항목 적용(요청·압축 설정·실행 거부 확인), 미지원 항목 적용 거절, 넓은 권한 거절. |
| S3 | 설명·UI. 선행 S2. | Workflow UI, ko/en/zh. | 지원/조건부/미지원 이유 표시, 권한과 도구 선택 구분 안내. 브라우저 확인. |
| S4 | 독립 배포 검증과 문서. 선행 S3. | 패키징, 격리 profile. | 미수정 rc.2에서 좁힌 권한·압축 설정 확인, 결과 분리 기록. |

## 수용 조건 대응

| #21 요구 | 단계 |
| --- | --- |
| 상한 초과 권한 없음, 도구 선택과 자원 접근 분리 | S1, S2 |
| 컨텍스트 의미 구분, 지원 항목만 적용 | S1, S2 |
| 미지원 항목을 근사·성공 표시하지 않음, 제약 기록 | S1–S3 |
| 양성·음성·Loader·스냅샷·UI | S1–S4 |
| 문서·독립 배포 결과 | S4 |
