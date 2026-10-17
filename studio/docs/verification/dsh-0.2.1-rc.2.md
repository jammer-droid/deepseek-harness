# DSH 0.2.1-rc.2 호환성 및 Desktop 반영

검증일: 2026-10-17.

## 변경 범위

- Studio `0.6.0`의 DSH peer 8개와 `dev.mjs`, `start-web.mjs` 지원 목록에 `0.2.1-rc.2`를 추가했다. 기존 지원 버전은 유지했다.
- rc.1→rc.2에서 Studio가 사용하는 공개 API의 추가 비호환은 발견하지 못했다. 제품 로직은 변경하지 않았다.
- 다른 작업의 미커밋 UI 변경은 보존했다. 현재 HEAD의 별도 worktree에서 호환성 선언만 변경하여 빌드했다.
- DSH 본체 소스·루트 의존성·lockfile은 변경하거나 재빌드하지 않았다. 버전 예외 허용을 사용하지 않았다.

## 실행한 검사

- `npm --prefix studio test`: 타입 검사·빌드 성공, 테스트 691개 통과, 실패 0.
- `STUDIO_PACK_DIST=dist/rc2-compat/release node studio/pack.mjs`: 정상 배포 패키지 생성. 진단 wrapper 없음.
- `/usr/local/bin/dsh --version`: `0.2.1-rc.2`. 설치된 공식 Desktop 배포본의 CLI 사용.
- 새 `DSH_HOME`의 `rc2-final` Web 프로필에 정상 패키지를 `dsh plugin --profile rc2-final add <tgz>`로 설치하고 기동했다.
- `STUDIO_TEST_ISOLATED=1 STUDIO_TEST_PORT=19392`로 `check-master-runtime.mjs`, `check-optimized-runtime.mjs`, `check-session-roles-runtime.mjs`, `check-role-runtime.mjs` 통과. 프리셋 읽기 전용 보호·복사·적용·역할 저장 및 세션 격리를 확인했다.
- Subscriptions 로컬 포크 `0.9.9-local.rc2.1`을 같은 격리 프로필에 추가하고 재기동했다. Studio 목록과 Subscriptions 상태·proxy 조회 RPC 모두 성공했다. 외부 모델을 호출하지 않았다.

## Desktop

- 사용자 요청으로 desktop 프로필 설정을 백업하고 앱을 정상 종료했다.
- 두 tgz를 공식 `dsh plugin --profile desktop add`로 설치하고 앱을 다시 실행했다.
- Studio 프리셋 목록과 기존 사용자 프리셋 표시 확인.
- 플러그인 목록에서 두 플러그인 활성화 및 호환성 경고 제거 확인.
- Subscriptions 상세 화면에서 `0.9.9-local.rc2.1`, 구성 요소 1개 실행 중 확인.
- 설정 → Subscriptions에서 기존 Codex·Claude 계정과 사용량 표시 확인. 로그인·로그아웃이나 인증 저장소 편집은 하지 않았다.
- 설치된 manifest·Host·Client·Studio 역할/정책 번들의 바이트를 배포 tgz와 비교하여 일치 확인.

배포 파일·검사 로그·해시는 `studio/dist/rc2-desktop-20261017/`에, 교체 전 프로필 설정은 그 아래 `desktop-before/`에 보존했다. Studio tgz SHA256은 `7d2f767bebb3a825f032bc83d38ee506bca4203733b37dc59776b94655781760`이다. Subscriptions tgz SHA256은 `85b1394320fc6fe50de94530ca6f2f47155dfa2a2859210043421a4db35e1c44`이다.

## 한계

rc.2에서 실제 외부 모델 응답·OAuth 신규 로그인·이미지/영상 생성·역할 자식 재시작 시나리오는 실행하지 않았다. rc.1에서의 역할 실행 검증은 이전 기록에 있으며 이번 검사와 구분한다. Subscriptions 테스트는 610개 통과, 7개 건너뜀이다. 설치 도구의 기존 peer dependency 및 node-domexception 폐기 경고는 남지만 DSH 호환성 차단과 앱 로딩 실패는 없었다. 커밋·푸시·npm 공개 배포는 하지 않았다.
