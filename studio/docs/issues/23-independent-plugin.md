> **이력 자료:** `feat/lean-agent`는 기존 기능 구현을 제거한 셸 전용 브랜치입니다. 이 문서의 workflow 기능·검증 기록은 분기 전 기준이며 현재 배포 기능이 아닙니다.

# #23 독립 플러그인 배포와 워크플로우 사용 여부

이슈: https://github.com/jammer-droid/deepseek-harness/issues/23

## 범위와 확정 규칙

DSH 본체는 수정 없이 배포 대상으로 사용한다. #16에서 추가한 remoteEventContributions와 이벤트 전달·큐 종료 변경 및 그 테스트·생성 문서만 식별해 원복한다. #17 모델·역할 구현은 유지한다. 기능 목록은 화면 진입·재연결·명시적 새로고침에서 조회하며 자동 polling이나 실시간 제공자 이벤트 전달을 요구하지 않는다.

컴포넌트와 시스템 인스턴스에 선택적 enabled boolean을 저장한다. 기존 문서에서 필드가 없으면 활성이다. 사용 안 함은 삭제나 전역 플러그인 해제가 아니다. 설정과 연결을 보존하고 다른 초안에 영향을 주지 않는다. 사용자가 승인한 규칙에 따라 비활성 인스턴스와 그에 닿는 연결은 구성·제공자·의미 검증에서 제외한다. 활성 항목의 필수 시스템과 최소 연결 개수는 활성 항목과 연결만으로 계산한다. 재활성화 시 보존한 값을 다시 검증한다. 비활성 항목을 실제 실행에 포함하지 않는 규칙은 향후 #18 실행 구성에도 적용해야 한다.

v3에 선택적 필드를 추가하며 기존 legacy/v2/v3 문서의 읽기 기본값은 활성이다. 읽을 때 저장하지 않는다. 비활성 상태를 포함한 새 문서를 구버전 Studio로 되돌리는 것은 지원하지 않는다. DSH Session 형식은 바꾸지 않는다.

## 구현 단계

- S1: 새로운 이벤트 서비스 의존성 제거, #16 코어 변경 원복, 명시적 조회 UI와 회귀 테스트.
- S2: 인스턴스 사용 여부 저장·검증·편집, 연결 및 설정 보존 테스트.
- S3: 수정하지 않은 대상 DSH에서 Studio 패키징·설치·Loader 및 브라우저 확인. 대상 버전·실행 경로·실패를 기록한다. workspace 테스트를 설치 증거로 대신하지 않는다.
- S4: 이후 이슈의 완료 조건을 독립 배포 기준으로 정비하고 문서·업그레이드 안내를 Studio 내부로 정리한다.

## 제외와 검증 제한

코어 기능 추가, 전역 플러그인 관리, 실행 엔진, 실제 워크플로우 실행은 제외한다. 사용자 기존 프로필과 설치 앱은 수정하지 않는다. 격리 프로필에 미수정 런타임과 Studio만 설치한다. 코어 재빌드와 저장소 전체 테스트는 실행하지 않는다.

## 진행

S1–S2 구현 완료. Host의 전용 이벤트 서비스 주입과 Client 구독을 제거하고, Studio 서비스 slot owner의 active 속성으로 재진입 재조회를 연결했다. #16의 코어 변경 17개 파일은 도입 전 내용으로 원복했다. 큐 종료 guard도 원복 대상에 포함했으며 별도 upstream 문제로 다뤄야 한다. lockfile은 workflows의 불필요해진 remotes 의존만 제거하고 #17 LLM 항목은 유지했다.

S4 완료: 이후 Studio 이슈의 완료 조건에 미수정 대상 버전과 격리 패키지 설치 증거를 필수로 추가했다. 과거 이슈의 개발용 검사 결과는 설치 증거로 해석하지 않는다.

검증: Host draft/validation/model 테스트 최초 25/25 통과. 추가 enabled 저장·재열기 테스트 포함 drafts 12/12와 remotes 플러그인 자체 없이 실행한 Loader 2/2 통과. UI·서비스 전환·디자인 검사 24/24 통과. Studio 빌드 및 공개 배포판 0.2.0-rc.2 의존만 사용하는 모든 Studio Host/Client 타입 검사·생성·패키징 통과. 최초 Loader 검사는 이전 빌드 산출물을 읽어 실패했고 Studio 재빌드 후 해결했다. 새 저장 테스트의 잘못된 fixture 이름과 서비스 slot의 props/owner 타입 오류도 수정 후 재검증했다.

S3 완료: 수정하지 않은 공개 npm `@deepseek-ai/dsh@0.2.0-rc.2`의 격리 프로필에 최종 Studio 패키지를 설치했다. 기존 앱과 사용자 프로필은 수정하지 않았다.

- 런타임: `/tmp/studio-s3-runtime-rdYxsm/runtime/node_modules/.bin/dsh`, 격리 `DSH_HOME=/tmp/studio-s3-runtime-rdYxsm/final-home`.
- 패키지: `studio/dist/desktop-0.2.0-rc.2/local-dsh-studio-0.1.1.tgz`, SHA-256 `4ef7d4dba3e2467f3e92225367114896431fe365ee2556a77197631a3706736c`. 새 home과 새 pnpm store를 사용했으며 6개 tarball의 설치 파일 70개가 원본과 바이트 단위로 일치했다.
- 설치: 공개 `dsh plugin --profile web add <tarball>`을 사용했다. 누락 peer 경고가 있었으나 설치와 로딩은 성공했다.
- 검증 URL: `http://127.0.0.1:54207` (검증 후 종료). 기존 `19387` GUI를 대체하지 않았다.
- Chrome/Playwright: 설치 목록의 Studio 확인; 지침 사용 안 함→저장→재열기에서 false와 설정 보존; 명시적 가용성 갱신과 Roles→Preset Builder 재진입; 다시 사용→저장→재열기에서 true와 기존 텍스트 보존; 독립 A/B 초안 보존. pageerror 0건.
- 화면 증거와 실행 스크립트: `/tmp/studio-s3-runtime-rdYxsm/final-loader.png`, `/tmp/studio-s3-runtime-rdYxsm/final-workflow-verified.png`, `/tmp/studio-s3-runtime-rdYxsm/verify-final.mjs`. 임시 로컬 증거이므로 영구 배포 자료는 아니다.
- 검증용 서버는 모두 종료하고 결과를 수집했다. 실제 시스템 제공자 비활성 연결 사례는 단위 테스트로 검증했으며 이 설치 브라우저 검증에 포함하지 않았다. 전체 저장소 빌드·테스트, 실제 모델 호출, #18 워크플로우 실행은 실행하지 않았다.
