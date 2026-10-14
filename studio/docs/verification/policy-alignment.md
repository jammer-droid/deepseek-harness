# 프리셋 정책 일치 작업 검증

## 범위와 결정

Studio의 도구 조합·노출·실행과 Config 병합을 정리한 개발 검증 기록이다. 수명과 의존성 책임은 [프리셋 정책](../reference/preset-lifecycle-policy.md)을 따른다. UI, DSH 코어, 설치된 앱·프로필은 변경하지 않았다. 실행용 독립 사본 발행은 범위에서 제외했다.

## 구현

- 조합은 요청한 프리셋의 선언과 해당 scope에서 보이는 도구를 사용한다. 이름만 일치하는 다른 프리셋의 도구로 대체하지 않는다. 기존 curated prompt 제공자 탐색은 유지한다.
- Config override와 provider 설정 모두 compaction의 배타적인 `retainTokens`/`retainRatio`를 처리한다. 한 패치에서 둘을 명시하면 거절하고, 한쪽을 선택하면 상속된 반대쪽을 제거한다. provider 설정이 나중에 적용된다.
- 선택된 필수 도구가 없으면 policy 설치를 거절한다. 기존 경고 후 제외 동작으로 조용히 다른 도구 집합을 실행하지 않는다.
- 저장소의 등록·복원은 Loader 활성화 검사에 더해 임시 child scope에서 policy를 검증한다. 실패 시 등록을 해제하고 저장된 적용본은 보존한다. 이 검사는 실제 Agent의 생성 이벤트를 실행하는 검사가 아니므로 실행 시 policy 검사도 유지한다.
- 설치 시 Agent 자체 scope 도구는 임시 inherited restriction 검사로 식별하여 거절한다. 같은 이름으로 상속 도구를 가린 경우도 포함한다. 검사 후 제한을 복원하며 sibling scope를 변경하지 않는다.
- PTC와 예약 `run_code`는 명시적인 미지원 오류로 거절한다. 전역 presentation을 바꾸거나 통로만 예외 허용하지 않는다.

## 공개 API 제한

Inspect의 tools 계약에서 `restrict`는 inherited 도구를 제한하지만 own-scope 등록은 숨기지 않는다. scope-local 도구를 선택적으로 숨기는 공개 API는 확인되지 않았다. 따라서 외부 제공자는 안정된 ancestor preset scope 등록을 사용해야 한다.

정책 설치 이후 own-scope 도구를 추가하는 외부 제공자는 지원하지 않는다. 비선택 도구의 실행은 monotonic guard가 거절하지만 schema는 나타날 수 있다. 실행 거절과 모델 비노출을 모두 해결했다고 주장하지 않는다. 늦은 PTC 전환도 실행 guard가 거절한다. 이 경계를 해소하려면 지원 DSH의 공개 노출 제어 계약이 필요하며, 이번 작업에서는 코어 또는 비공개 registry를 수정하지 않았다.

## 실행한 검사

Studio의 `npm run build`로 Host·Client 타입 검사 및 번들 빌드를 수행했다. `node --import tsx --test test/*.test.mjs`에서 90개 테스트가 통과했다. 조합 출처, Config 우선순위, own-scope 거절, PTC 거절, 누락 의존성, sibling 격리, 롤백과 재활성화 복구를 포함한다. 저장소 fixture는 실제 Cordis scope·tools·systemPrompt와 모의 preset registry를 사용하며 실제 Loader 설치 검증은 아니다.

실행 중 Node `DEP0205`와 기존 UI 테스트의 중첩 heading 경고가 출력됐다. 테스트 실패는 없으며 UI 경고 수정은 범위에서 제외했다. 변경 범위와 공백 오류는 `git status --short`, `git diff --check`로 확인한다.

## 미검증

배포 대상은 Studio 패키지의 peer 범위인 DSH `0.2.0-rc.2`와 `0.2.1-alpha.2`다. 이번 검증은 workspace 개발 라이브러리와 라이브 Inspect 계약에 근거하며, 패키징한 Studio를 수정하지 않은 두 런타임에 설치한 독립 배포 검증은 수행하지 않았다. 실제 영속 세션 재개·부모/자식 권한 상속·승인 콜백과 실행 기본값의 상호작용은 별도 통합 검증이 필요하다. 기존에 사용자가 확인한 비활성화/재활성화 결과를 새 빌드 검증으로 대체하지 않는다.
