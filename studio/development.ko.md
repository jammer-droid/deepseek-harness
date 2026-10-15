# Studio 셸 개발

변경 범위는 `studio/`다. DSH 본체·루트 의존성·lockfile은 수정하지 않는다.

## 명령

```sh
npm --prefix studio run typecheck
npm --prefix studio test
npm --prefix studio run dev
npm --prefix studio run dev:desktop
npm --prefix studio run watch
npm --prefix studio run pack:bundle
```

`dev`는 지금 개발한 것을 한 번에 검증하고 Web에서 확인하는 명령이다. 테스트(타입 검사·빌드·테스트)를 통과해야 다음으로 진행하고, 패키징한 셸을 격리 프로필에 설치한 뒤 Web을 띄운다. 검증을 건너뛰려면 `--skip-test`, 빌드까지만 하려면 `--build-only`, 포트를 바꾸려면 `--port`를 준다. 실패를 무시하고 서버만 띄우지 않으며, 코드를 고치면 서버를 끄고 같은 명령을 다시 실행한다.

`dev:desktop`(`node dev.mjs --desktop`)은 같은 검증·패키징 결과를 격리 프로필이 아니라 **실제 `desktop` 프로필**에 설치한다. DSH 앱을 다시 시작해야 반영되고, 저장한 프리셋은 그대로 남는다. 실제 사용자 프로필을 바꾸므로 DSH 앱이 실행 중이면 중단하며, 앱을 종료한 뒤 다시 실행한다. 검증 없이 즉시 적용하지 않는다. 다른 프로필은 `--profile <이름>`, 정말 강제로 적용하려면 `--force`를 쓴다.

새 워크트리의 무시되는 `studio/node_modules`에는 원본 워크트리의 기존 의존성·공개 타입 산출물을 가리키는 로컬 링크를 준비했다. 원본 설치에 의존하는 개발 편의 환경이며 독립 배포 증거가 아니다. 새 의존성 설치나 lockfile 갱신이 필요하면 루트 변경 범위를 먼저 승인받는다. 타입 준비물이 없다고 DSH 전체 빌드를 자동 실행하지 않는다.

## 새 기능 연결

- `src/shell.tsx`: Studio 패널과 사이드바 등록. 비즈니스 기능이나 Remote 의존성을 두지 않는다.
- `src/service-layout.tsx`: 서비스 등록 목록과 선택·마운트 유지.
- `src/detail-layout.tsx`: 기존 디자인 미리보기와 같은 좌측 메뉴·본문 골격.
- `src/ui.tsx`, `src/ui-host.tsx`, `src/ui-styles.ts`: 기존 디자인 시스템.
- `packages/shell`: 공개 패키지. 셸 진입점과 번들 패치(`cordis.patch.yml`)를 함께 담는다.

DSH는 패키지당 Remote contribution을 하나만 받는다(`$mount`를 두 번 하면 "Remote package is already registered"로 Client 활성화가 실패한다). 그래서 기능별 Remote 서술자는 기능 모듈이 내보내고(예: `pixieDescriptors()`), `src/shell.tsx`의 한 번의 `$mount`에 합친다. 셸은 서술자를 합치는 일만 하며 기능 로직은 기능 모듈에 둔다.

새 기능은 `local.dsh-studio.services`에 등록한다. 슬롯의 `active` 값을 받아 비활성 화면의 부수 효과를 제어한다. 제품 문구는 ko·en를 제공하고 [디자인 시스템](docs/development/design-system.md)을 따른다.

## 패키징·배포 경계

`pack:bundle`은 `studio/dist`에 공개용 패키지(`@matamt-dbg/dsh-studio`) tarball 하나를 만든다. 공개 레포·npm 배포는 [배포 가이드](docs/release.md)를 따른다.

셸과 번들의 지원 선언은 `0.2.0-rc.2 || 0.2.1-alpha.2`다. rc.2의 공개 Slot 등록·구독·목록 조회, locale 등록·구독·조회 계약과 셸 사용법을 대조했다. Host는 비즈니스 서비스가 없는 진입점이고 Client는 slots·locale만 요구한다. 버전 예외는 사용하지 않는다. 신규 기능은 별도 호환성 검증이 필요하다.

## Desktop과 분리된 Web 실행

설치된 `dsh` CLI가 필요하다. 현재 머신의 `dsh --version`은 `0.2.0-rc.2`다. 아래 명령은 Studio를 테스트·빌드하고 수정하지 않은 설치 런타임으로 Web을 실행한다. DSH 본체를 빌드하거나 Desktop 프로필을 교체하지 않는다.

```sh
cd /Users/home/playground/vibecoding/deepseek-harness
npm --prefix studio run dev
```

`dev`는 테스트(타입 검사·빌드·테스트)가 통과할 때만 진행하고, 번들을 패키징해 격리 프로필에 설치한 뒤 Web을 띄운다. 테스트를 생략하려면 `npm --prefix studio run dev -- --skip-test`, 빌드까지만 하려면 `--build-only`, 포트를 바꾸려면 `--port 19389`를 준다.

터미널에 출력된 `http://127.0.0.1:19388/?token=...` 주소 전체를 브라우저에서 연다. 토큰 없이 접근하면 인증 오류가 날 수 있다. 토큰은 실행 로그에서 확인하며 문서나 Git에 저장하지 않는다. 서버를 종료하려면 실행 터미널에서 Ctrl+C를 누른다.

- 데이터: `studio/.dsh-home` 내부의 격리 `lean-agent-web` 프로필
- 연결: `studio/dist/web-preview.patch.yml`을 자동 생성하여 로컬 셸 진입점을 개발용으로 로드
- 포트 충돌: `npm --prefix studio run dev -- --port 19389`
- 다른 CLI: `STUDIO_DSH_BIN=/absolute/path/to/dsh npm --prefix studio run dev`
- 테스트 없이 서버만: `npm --prefix studio run web` (빌드 후 Web 실행, 테스트 생략)
- 코드 변경 후: 서버를 종료하고 같은 명령을 다시 실행한 뒤 브라우저 새로고침. 자동 HMR은 보장하지 않는다.

### 브라우저 확인 순서

1. 사이드바에서 DSH Studio를 선택한다.
2. 기존 기능 탭이 없고 빈 서비스 안내가 표시되는지 확인한다.
3. 라이트·다크 모드와 좁은 창에서 읽기·레이아웃·키보드 포커스를 확인한다.
4. 콘솔에 Client 모듈 로드·Slot 렌더링 오류가 없는지 확인한다.

격리 환경에는 Desktop 로그인·세션·모델 설정을 복사하지 않는다. 필요한 경우 Web에서 별도로 로그인한다. 이 개발 오버레이 실행은 tarball 설치 검증이 아니다. 실제 화면 확인과 패키징한 Studio의 독립 설치 검증은 별도이며 서버 기동·HTTP 검사만으로 성공을 선언하지 않는다.
