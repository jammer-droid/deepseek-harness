# Studio Experiments

Studio의 Experiments 페이지에서 메인·서브 에이전트에 적용할 최적화를 독립적으로 선택한다. 모든 기능은 기본적으로 꺼져 있으며 [정책 안내](../../docs/experiment-policies.md)에 기본 수치와 제한을 정리한다.

## 설정과 수명

설정은 프로필 storageDomain에 저장하며 Remote `studioExperiments.describe/apply`로 조회·변경한다. 저장 요청은 읽었던 리비전이 일치해야 한다. UI 설정 저장은 이미 실행 중인 에이전트에 영향을 주지 않는다. 에이전트 생성 시 최신 설정을 복사하고 플러그인 해제와 에이전트 종료 양쪽에서 등록을 제거한다. 종료 시 실험 소유 작업을 취소하고 완료를 기다린다.

## Model Experience

- **도구:** Goal/Todo 차단은 스키마 노출과 실제 실행을 함께 제한한다. batch 읽기와 성공 의존성이 필요한 `task_run`은 선택한 에이전트에만 제공한다. 일반 Bash는 의존성 관리에 편입하지 않는다.
- **프롬프트:** 최적화 프롬프트 조립 옵션은 독립 도구 호출·대기 선택·완료 판단 규칙을 추가한다. 대기 정책은 Job 안내와 Bash/job_output 설명을 조정한다. Goal 정책은 자동 진행 권한을 해제하되 저장된 목표를 변경하지 않는다.
- **출력·토큰:** 큰 텍스트 결과는 세션 소유 spill에 원문을 저장하고 제한된 미리보기와 조회 경로를 반환한다. 구조화된 canonical 값과 이미지 포함 결과는 보존한다. 저장 실패 시 원래 출력을 반환한다. 토큰 절감량은 결과 내용에 따라 달라지며 고정 절감률을 보장하지 않는다.
- **KV cache:** 실행 중인 에이전트의 정책을 저장 시 변경하지 않는다. 서로 다른 설정으로 시작한 에이전트는 도구·프롬프트가 다를 수 있으므로 에이전트 간 캐시 재사용을 보장하지 않는다.

## Known Limitations and Deferred Work

최적화 지침은 시스템 문자열을 교체하지 않고 로그에 기록되는 런타임 컨텍스트에 추가하므로 전체 시스템 프롬프트 override에서도 유지된다. Desktop 0.2.0-rc.2에서 런타임 컨텍스트 자체를 비활성화하면 이 지침은 주입되지 않는다. 저장 키 `headless`는 기존 설정 호환을 위해 유지하며 마이그레이션하지 않는다. Bash 대기 요청은 기존 런타임 cap의 적용을 받는다. background로 승격된 Bash의 종료 코드를 공개 Job API가 제공하지 않아 해당 작업은 성공 의존성을 충족하지 않는다. 기존 test-plugin과 같은 에이전트에 중복 적용하면 시작을 거부한다. 실사용 프로필 배포는 빌드·패키징과 별도 작업이다.

## 검증

저장소 루트에서 `npm --prefix studio run test:experiments`를 실행한다. Studio launcher는 빌드된 Harness 서비스와 일관된 Cordis scope를 사용한다. 브라우저 테스트는 `DSH_TEST_BROWSER_CHANNEL=chrome npm --prefix studio run test:browser -- experiments.browser.test.ts`로 실행하며 임시 프로필만 사용한다.
