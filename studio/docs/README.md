# Studio 문서 안내

현재 제품 개요는 [Studio README](../README.md), 다음 화면 개선 작업은 [UI·UX 개선 백로그](plans/ui-ux-backlog.md)에서 시작한다. 과거 워크플로우 구현 기록을 현재 프리셋·역할 기능의 지원 보장으로 해석하지 않는다.

## 목적별 구조

| 위치 | 목적 | 읽을 때 주의할 점 |
| --- | --- | --- |
| `reference/` | 프리셋·역할·도구·탐색 기능 참고 | 본문에 남은 초기 설계·시점별 검사 결과는 최신 구현과 구분 |
| `development/` | UI 규칙과 공개 API·수명 조사 | 소스 조사만으로 설치 런타임 지원을 보장하지 않음 |
| `plans/` | 앞으로 할 개선과 수용 조건 | 미구현 계획이며 현재 기능 설명이 아님 |
| `verification/` | 특정 시점의 구현·검증 기록 | 테스트 수·버전·제약은 해당 기록 당시 기준 |
| `issues/` | 이슈 번호별 결정·구현 단계 | 과거 workflow 이슈와 현재 프리셋 이슈를 색인에서 구분 |
| `archive/workflow/` | 이전 workflow 제품 기획·조사·통합 이력 | 현재 실행 구조의 명세로 사용하지 않음 |
| `archive/prototypes/` | 대체된 초기 화면 목업 | 현재 개선 계획과 분리 |

[마무리·배포 절차](release-workflow.md)는 병합부터 배포까지의 순서를, [배포 가이드](release.md)는 배포 명령을 정한다.

[이슈 작업 절차](design-workflow.md)는 상위 작업 지침의 안정적인 진입 링크이므로 루트 경로를 유지한다.

## 현재 기능 참고

- [프리셋 구성](reference/preset-composition.md): 초기 구성 설계와 편집 흐름. 최신 역할 실행·Master 차이는 후속 문서와 함께 읽는다.
- [Master 프리셋](reference/master-preset.md): 읽기 전용 기준 프리셋과 구성.
- [프리셋 수명·의존성 정책](reference/preset-lifecycle-policy.md): 비활성화·제거와 세션 재개, 저장본 보존 및 Studio의 책임.
- [역할·미리보기](reference/role-preview.md): 역할 설정과 네이티브 위임 연결.
- [Optimized 도구](reference/optimized-tools.md): 기본 정책, bundled 도구와 실행 범위.
- [서비스 탐색](reference/service-navigation.md): Studio 서비스 등록·화면 골격.
- [SettingsX](reference/settingsx.md): Studio 단축키 명령과 정의 파일 기반 사용자 프로바이더.

## 개발 기준과 조사

- [디자인 시스템](development/design-system.md)
- [프리셋 런타임 수명 조사](development/preset-runtime-lifecycle.md)
- [런타임 카탈로그 API 조사](development/runtime-catalog-api.md)
- [DSH 런타임 제어 지점 조사](research/dsh-runtime-control-points.md): 다섯 핵심 개입 지점의 Native 플러그인·커맨드 훅 지원 범위와 서브에이전트·최종 답변 제어의 한계.
- [결정(Decision) 기능 브레인스토밍 자료](research/decision-engine-brainstorm.md): Pixie Gate에서 분리한 판정 기능의 배경, 사용자 시나리오, 남은 Studio 자산, 맞닿는 DSH 공개 표면, 형태 후보와 열린 질문. 결정 전 초안.
- [개발 안내](../development.ko.md)
- [배포 가이드](release.md): fork → 공개 레포 스냅샷 → npm 공개 절차
- [이슈 명세 색인](issues/README.md)

## 개선 계획

- [프리셋 카탈로그 스냅샷과 DSH 기본 실행 흐름](plans/preset-catalog-snapshot-policy.md): Master 재수집, Optimized 고정 기준, 추가·제거 안내와 삭제 규칙, 동적 도구 실행을 DSH에 맡기는 후속 작업 합의. 미구현.

- [UI·UX 개선 백로그](plans/ui-ux-backlog.md): 상태 구분, 오류 복구, 모델 선택, 실효 도구 표시, 편집·접근성 개선. 각 항목에 근거·우선순위·수용 조건을 기록한다.

## 검증 이력

- [카탈로그 런타임 검증](verification/catalog-runtime-verification.md)
- [Config 편집기 진행 기록](verification/config-editor-progress.md)
- [프리셋 정책 일치 검증](verification/policy-alignment.md): 조합·Config·policy 사전 검증과 공개 API 제한.

두 문서의 수치와 제약은 당시 증거다. 이후 구현을 덮어쓰거나 이번 문서 정리를 새로운 GUI 검증으로 해석하지 않는다.

## 과거 기획·조사

- [제품 기획](archive/workflow/workflow-product-plan.md), [기능 명세](archive/workflow/workflow-specification.md)
- [구성 조사](archive/workflow/workflow-composition-research.md), [런타임 조사](archive/workflow/workflow-runtime-research.md)
- [구조 검토](archive/workflow/workflow-architecture-review.md), [DSH 재사용 조사](archive/workflow/dsh-reuse-investigation.md)
- [통합 기록](archive/workflow/workflow-integration.md), [업그레이드 기록](archive/workflow/workflow-upgrade.md), [실험 정책](archive/workflow/experiment-policies.md)
- [초기 최적화 화면 목업](archive/prototypes/optimization-prototype.md)

## 문서 추가 원칙

새 개선은 `plans/`, 현재 기능 계약은 `reference/`, 검증 결과는 `verification/`에 둔다. 이슈 명세는 번호를 유지하여 `issues/`에 둔다. 대체된 자료는 삭제하거나 최신 결과로 덮어쓰지 않고 `archive/`에서 이력으로 보존한다. 문서를 이동할 때 Studio 내부 상대 링크를 함께 갱신한다. 코어 문서와 사용자 데이터는 이 정리의 범위가 아니다.
