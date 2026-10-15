---
kind: reference
description: "Studio 이슈별 구현 명세의 색인."
---

> **범위 구분:** #15–#23은 이전 workflow 작업의 이력이다. #24는 이후 프리셋 구성 설계 기록이다. 문서 당시 상태와 현재 제품 상태를 구분하며, 현재 안내는 [문서 목차](../README.md)를 따른다.

# Studio 이슈 명세

## 요약

이슈별 결정과 구현 단계는 이 디렉터리에 누적한다. 작성·검증·완료 절차는 [Studio 이슈 작업 절차](../design-workflow.md)를 따른다. 진행 상태는 GitHub 이슈와 각 명세를 확인한다.

## 보조 모델

- [#25 Pixie — 주요 컨텍스트와 분리된 보조 모델](25-pixie.md): `/pixie`·Pixie 탭으로 따로 묻기(MVP), Judge 엔진 분리와 LLM 판정 시험. S1–S5 구현, rc.2 격리 설치에서 UI·커맨드 확인(실제 모델 답변 미확인).

## 프리셋 구성 설계 기록

- [#24 minimal 기반 프리셋 구성과 선택적 덮어쓰기](24-preset-composition.md): 현재 셸 기반 신규 설계. 도구·프롬프트 제공자 선택, persona 편집, scoped override, 통합 미리보기 및 독립 배포. `draft`; 첫 단계 S1은 공개 API·구성 계약 확정.

## 이전 workflow 이력

- [#15 지침 컴포넌트 초안 편집·저장](15-workflow-draft.md): 등록 기반 편집과 프리셋을 변경하지 않는 초안 저장.
- [#16 시스템·연결 검증과 등록 해제 대응](16-workflow-validation.md): 시스템·연결 폼 편집, 위치별 진단과 미해석 초안 보존.
- [#17 모델·추론 및 임의 역할 편집](17-workflow-model-roles.md): DSH 카탈로그 검증, 역할별 독립 설정과 메인 역할 참조.
- [#18 Studio 소유 프리셋 적용과 모델·지침 실행](18-workflow-apply.md): Desktop rc.2 공개 API 기준의 별도 적용본·등록 소유권과 단계별 검증. 메인 모델은 불일치 경고만(D1-a). S1–S5 구현·rc.2 독립 설치 검증 및 사용자 기능 확인 후 종료 승인. 라이브 모델·고정 workspace 전체 앱·HMR 검증 제한은 명세에 기록.
- [#19 실행 구성 고정과 역할 위임](19-workflow-delegation.md): 공용 child-runtime, 루트 단위 구성 고정, 실패 분류. `ready`.
- [#20 도구 노출·실행 제한](20-workflow-tools.md): 허용 목록 restrict와 guard 병행, agent 소유 도구 표시. `ready`.
- [#21 접근 권한·컨텍스트 지원 범위](21-workflow-access-context.md): 지원·조건부·미지원 판정표와 적용 거절. `ready`.
- [#22 독립 정의·복사와 개발 팀 템플릿](22-workflow-library.md): 독립 정의 저장소, 값 복사, 템플릿과 A1–A12 점검. `ready`.
- [#23 독립 플러그인과 사용 여부](23-independent-plugin.md): 코어 의존 제거, 워크플로우 내 비활성 상태 보존과 미수정 런타임 설치 검증.
