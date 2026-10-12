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

## 후속: 카탈로그 배포 제외

사용자 요청으로 카탈로그 소스·단위 테스트는 보존하되 기본 생성·빌드·패키징, 번들 의존성과 프리셋, 실험실 활성화 항목에서 제외했다. 다른 실험 기능은 유지한다. 카탈로그 Client 진입점과 모델 모듈도 배포 Client 타입 검사에서 제외했다.

카탈로그 제외 후 수정하지 않은 공개 DSH `0.2.0-rc.2` 의존성으로 타입 검사·번들 빌드·패키징이 통과했다. 배포 제외 회귀와 실험 설정 테스트 4개 통과. 실제 설치와 GUI 시각 검증은 하지 않았고 기존 프로필도 바꾸지 않았다.

별도로 실행한 experiments runtime 회귀에서는 10개 중 2개가 실패했다: YAML Loader 도구 제한의 scoped context 요구 오류와 optimization context 유지 assertion이다. 당시 원인을 확인하지 않았으나 후속 진단으로 아래 테스트 구성 문제를 확인했다.

### 런타임 실패 원인과 설정 적용 시점

테스트만 `scope/lib/index.js`를 직접 import하고, tools/system-prompt는 패키지 exports를 통해 `scope/src/index.ts`를 사용했다. 각 모듈의 `Symbol('dsh.scope')`가 달라 테스트에서 생성한 scope를 서비스가 인식하지 못했다. 테스트의 createScope import를 공개 패키지 경로로 통일하는 한 줄 수정으로 원래 10개 테스트가 전부 통과했다. Studio 런타임 및 DSH 코어 변경은 필요하지 않았다.

설정은 저장 완료 뒤 current에 게시되고 각 `agent/created`에서 복제된다. 추가 회귀는 실제 설정 저장소·도구·프롬프트 서비스를 연결해 목표/Todo 숨김과 최적화를 both로 저장한 후 연속 생성한 main/sub 에이전트 4개에 적용됨을 확인한다. 도구 schema 제외뿐 아니라 직접 실행 거절도 검사한다. 저장 전 에이전트는 변하지 않으며, off 저장 이후 새 main/sub에는 적용되지 않고 이미 적용된 에이전트는 기존 snapshot을 유지한다. runtime 11개와 settings 3개, 총 14개 통과.

현재 UI의 main/sub/both 선택은 그대로 따른다. 모든 새 main/sub에 적용하려면 both를 선택해야 한다. 적용 시점은 세션 파일 생성이 아니라 agent/created이며, 실제 앱에서 세션 재개·복제 등 경로의 설치 검증은 별도다. 이번 검증은 workspace 테스트이며 설치된 사용자 GUI의 현재 설정이나 동작을 확인한 결과는 아니다.
