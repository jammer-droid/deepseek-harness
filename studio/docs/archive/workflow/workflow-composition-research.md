---
kind: reference
description: "현재 Studio의 편집·위임 구성과 DSH 프리셋의 재사용 가능 범위 및 제품 요구사항과의 차이."
---

> **이력 자료:** `feat/lean-agent`는 기존 기능 구현을 제거한 셸 전용 브랜치입니다. 이 문서의 workflow 기능·검증 기록은 분기 전 기준이며 현재 배포 기능이 아닙니다.

# Studio 구성·프리셋 조사

## 요약

현재 Studio에는 일반 프리셋 편집기와 고정 구현자·리뷰어 설정/위임이 있지만, 합의한 범용 엔티티·컴포넌트·시스템 편집 모델은 없다. 이 문서는 저장소 소스와 문서의 정적 조사 결과이며 실행 성공이나 설치 검증을 주장하지 않는다. 실행 기능의 세부 근거는 [실행 조사](workflow-runtime-research.md), 목표는 [기획서](workflow-product-plan.md), 요구사항은 [명세서](workflow-specification.md)에 있다.

## 목차

- [현재 Studio](#현재-studio)
- [DSH 프리셋의 의미](#dsh-프리셋의-의미)
- [적용 경로의 공백](#적용-경로의-공백)
- [등록 기반 편집의 공백](#등록-기반-편집의-공백)
- [조사 범위와 한계](#조사-범위와-한계)
- [개발 메모](#개발-메모)

## 현재 Studio

| 확인 내용 | 근거 | 설계 영향 |
| --- | --- | --- |
| 일반 프리셋 편집과 역할 설정은 별도 기능이다. | [Studio README](../../../README.md), [General Client](../../../src/general.tsx) | 일반 프리셋 편집을 새 워크플로우 도메인과 동일시하지 않는다. |
| 현재 카탈로그는 여섯 기본 플러그인 템플릿과 현재/상속 프리셋의 최상위 행을 수집한다. | [PresetSettingsOwner.catalog](../../../packages/general/src/preset-settings.ts) | 설치된 모든 플러그인의 적합성·의존성을 판별하는 범용 등록부가 아니다. |
| 필드 편집은 문자열·숫자·boolean을 추출하며 배열과 실행 표현식은 편집하지 않는다. | [fields 및 plugins](../../../packages/general/src/preset-settings.ts) | 지침 블록·도구 목록·연결 등 구조화된 설정 UI가 추가로 필요하다. |
| 추가 구성은 복사하고 Loader ID를 제거한다. 그룹 조건·격리 등은 유지한다. | [PresetSettingsOwner.change](../../../packages/general/src/preset-settings.ts) | 원시 플러그인 행 복사와 사용자 컴포넌트 템플릿 복사는 다른 데이터 모델이다. |
| 현재 역할 설정은 구현자·리뷰어의 고정 쌍이다. | [Fixed role settings](../../../README.md#fixed-role-settings) | 메인까지 동일하게 편집하는 임의 역할 정의·인스턴스 모델로 확장해야 한다. |
| 현재 위임은 고정 도구 집합과 관리되는 역할/승인 로직을 갖는다. | [StudioDelegation](../../../packages/roles/src/delegation.ts), [Managed delegation](../../../README.md#managed-delegation) | 새 기본 템플릿에 강제 리뷰·제어 정책을 그대로 재사용하면 자율성 요구와 충돌한다. 실행 API 재사용과 기존 제품 정책 재사용을 분리한다. |

## DSH 프리셋의 의미

프리셋은 일반 Cordis 자식 플러그인 목록이다. builtin 전용 허용 목록이 아니며 사용자 플러그인도 의존성과 격리 조건을 만족하면 구성할 수 있다. 선언은 레지스트리 소유 스코프와 Loader 트리를 만들고, Agent는 선택한 리비전을 유지한다. 같은 리비전의 플러그인은 여러 Agent가 공유하므로 mutable 실행 상태를 플러그인 단일 인스턴스 필드에 넣어 실행별 상태라고 가정하면 안 된다. 근거: [agent-preset-registry](../../../../packages/preset/agent-preset-registry/README.md#understand-the-implementation), [mount 구현](../../../../packages/preset/agent-preset-registry/src/mount.ts).

Host는 공통 Agent 루프를 소유한다. 프리셋에 서비스를 제공하려면 소비자와 같은 격리 그룹을 사용해야 할 수 있으며, Agent의 일반 Context 조회가 자동으로 해당 서비스 구현으로 바뀌지는 않는다. 임포트·활성화 실패와 전역 서비스 누출은 mount 감사 대상이다. 따라서 Studio의 시스템별 실행 위치는 단순 UI 라벨이 아니라 실제 배치와 의존성의 검증 대상이다. 근거: [프리셋 격리·활성화](../../../../packages/preset/agent-preset-registry/README.md#understand-the-implementation).

프리셋은 보안 sandbox가 아니다. 플러그인 코드는 Host 권한으로 실행될 수 있다. 또한 Host 프리셋의 자식 목록에 Client 플러그인을 추가하는 것만으로 브라우저 UI를 로드하는 구성이 되지는 않는다. Studio의 [Host/Client 구성](../../../package.json)과 [Client 등록](../../../src/general.tsx)처럼 양쪽 등록을 별도로 다룬다.

현재 Agent가 보유한 리비전 유지와 재시작 이후 복원은 다르다. 레지스트리는 프로세스 재시작 후 과거 구현 리비전을 유지하지 않으며 세션의 프리셋 ID를 현재 정의에 연결한다. 따라서 '실행 당시 구성으로 재시작 후 복원'은 현재 보장으로 적으면 안 된다. 근거: [레지스트리 생명주기 및 제한](../../../../packages/preset/agent-preset-registry/README.md).

## 적용 경로의 공백

현재 General 편집은 기존의 주소 지정 가능한 프로필 행을 수정한다. [ConfigEditor](../../../../packages/boot/config-editor/src/index.ts)는 `configuration()`과 기존 Entry에 대한 `edit()`에서 프로필 쓰기를 직렬화하고 Loader reconcile을 수행한다. 이것만으로 임의의 새 Studio 워크플로우 프리셋을 생성하는 공개 API가 확보되었다고 볼 수 없다.

DSH 문서는 새 프리셋을 bundle patch의 insert로 선언하는 경로를 설명한다. 첫 구현 전에는 Studio가 소유하는 선언의 생성·갱신·삭제를 어떤 지원 경로로 수행할지 결정하고 실제 Loader 테스트로 검증해야 한다. 사용자의 프로필 파일을 직접 덮어쓰는 방식을 임시 해결책으로 선택하지 않는다. 근거: [프리셋 선언](../../../../packages/preset/agent-preset-registry/README.md#use-this-package).

현재 General 편집은 리비전 충돌을 검사하지만 저장과 활성화 성공은 별개이며, 전체 자식 목록을 override한다. 향후 번들 변경을 자동 병합하지 않는다. 새 초안/적용 모델에는 적용 전 검사, 저장 결과, 활성화 결과, 마지막 사용 가능 버전의 표시가 필요하다. 현재 코드가 자동으로 이전 정상 프리셋을 복구한다고 가정하지 않는다. 근거: [프리셋 편집 제한](../../../README.md#preset-overrides), [PresetSettingsOwner](../../../packages/general/src/preset-settings.ts).

## 등록 기반 편집의 공백

기존 카탈로그의 raw row 해시와 표시용 필드 목록은 새 요구사항의 컴포넌트 ID·설정 스키마·입출력·시스템 의존성·변경 설명을 대신하지 않는다. 일반 Config 스키마가 존재하는 것과 Studio에서 조립 가능한 기능을 등록하는 것도 다르다. 새 등록 모델은 기능 제공 플러그인이 소유하고, Studio는 이를 읽어 목록·기본 UI·검증을 제공하도록 설계한다. 이는 신규 요구사항이지 기존 API 발견 결과가 아니다.

스키마만으로 파일 권한, 모델 지원 범위, 동작 범위, lifecycle 안전성을 검증할 수는 없다. 각 시스템은 지원하는 적용 범위와 실행 방식을 선언하고 필요한 검증을 제공해야 한다. 모든 로드 가능한 플러그인을 자동으로 워크플로우 컴포넌트로 표시하지 않는다.

## 조사 범위와 한계

- 조사 대상은 현재 작업 체크아웃이다. 설치된 Desktop 런타임과 체크아웃의 API·버전은 같다고 가정하지 않는다.
- live Config Inspect로 현재 등록 목록을 읽었으나 이를 체크아웃 API와 합쳐 하나의 검증 결과로 취급하지 않았다. 설치·설정 변경은 하지 않았다.
- 사용자가 언급한 '최적화 테스트 플러그인'의 정확한 정체와 코드 연결은 확인하지 못했다. 확인된 별도 세션 이동 실험 플러그인을 그 대상으로 단정하지 않았다. 이 플러그인에 대한 기능 주장은 이번 스펙의 근거에서 제외한다.
- 모델 실행, 실제 권한 거부, 재시작 복구, GUI 조작은 이번 정적 조사로 검증하지 않았다. 소스 근거와 구현 수용 테스트를 구분한다.

## 개발 메모

프리셋 생성 경로, 실행별 리비전 보존, 기존 강제 위임 정책에서의 전환은 구현 전에 결정해야 한다. 범용 레지스트리를 먼저 거대하게 만들기보다 첫 여섯 컴포넌트와 한 개발 팀 템플릿을 통해 인터페이스를 검증한다.
