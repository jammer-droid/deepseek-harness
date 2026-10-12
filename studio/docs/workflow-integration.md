# Workflow와 experiments 통합 기록

## 통합 범위

`studio/feat/workflow`에 `studio/issue-23-independent-plugin`의 `a1dbe7483f`까지 fast-forward하고, `studio/experiments`의 `b7a9f9e535`까지 병합했다. #17 모델·다중 역할, #23 독립 플러그인 정리·인스턴스 사용 여부, experiments의 opt-in 서브에이전트 카탈로그를 보존한다.

기존 미커밋 #17 문서 두 개는 저장소 밖 `/Users/home/playground/studio-pre-merge-docs-2_5s28h4`에 백업했다. 통합된 문서는 기존 계획에 완료 결과를 더한 상위 버전이다. experiments의 `.studio-web-home`도 같은 백업의 `experiments-web-home`에 보존했다. 기본 작업 트리의 로컬 프로필은 유지한다.

## 충돌과 호환성 수정

- lockfile은 양쪽 Studio 의존성을 모두 보존했다.
- Workflow 편집기는 v3 역할 배열·모델 UI를 유지하면서 experiments의 필드·추가 버튼 번역과 도구 도움말을 이식했다.
- 카탈로그는 `mainRoleId`로 메인 역할을 찾고 역할별 모델을 사용한다. 비활성 컴포넌트를 실행 설정에서 제외하며 모델 지원을 공개 검증 API로 확인한다.
- 성공 상태 색상은 기존 Studio 토큰 어댑터 경계로 옮기고 스냅샷을 재생성했다.
- 배포 빌드의 패키지 목록에 서브에이전트 카탈로그를 포함하여 누락된 타입 검사·생성을 수행하게 했다.

## 검증과 제한

Studio workspace 생성·빌드, Client 및 카탈로그 Host 타입 검사, Workflow Loader/카탈로그 빌드 산출물 4개 검사 통과. 카탈로그 Host·해석·식별 회귀 15개 통과. Workflow 저장·모델·검증·서비스 전환·카탈로그 토글 29개, Workflow UI 17개, 카탈로그 UI 5개, 디자인 시스템·역할 UI 5개 통과. 최초 빌드는 새 workspace 링크 부재와 구형 mainRole 참조 때문에 실패했으며 의존성 링크와 v3 통합 후 해결했다. 최초 Loader 실패는 이전 generated protocol 산출물을 재생성하여 해결했다. 오프라인 의존성 설치는 pnpm 메타데이터 부재로 실패했고 frozen-lockfile 온라인 설치로 해결했다.

**독립 배포 차단:** 수정하지 않은 공개 DSH `0.2.0-rc.2`의 타입으로 통합본을 생성할 때 카탈로그의 `SubagentRuntime.startActivation` API가 없어 실패했다. #23 단독의 이전 설치 성공은 experiments 통합본의 설치 성공으로 해석하지 않는다. 코어 수정·새 호환 adapter 구현은 이번 브랜치 통합 범위에 넣지 않았다. 통합본의 rc.2 설치·GUI·라이브 모델 실행은 미검증이며, 해당 API를 지원하는 대상 버전 확정 또는 별도 Studio 호환 구현 후 재검증해야 한다.

전체 저장소 빌드·테스트, 기존 사용자 GUI 배포, 원격 푸시와 이슈 닫기는 수행하지 않았다.
