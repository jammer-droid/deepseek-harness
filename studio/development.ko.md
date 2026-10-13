# Studio 셸 개발

변경 범위는 `studio/`다. DSH 본체·루트 의존성·lockfile은 수정하지 않는다.

## 명령

```sh
npm --prefix studio run typecheck
npm --prefix studio test
npm --prefix studio run watch
npm --prefix studio run pack:bundle
```

새 워크트리의 무시되는 `studio/node_modules`에는 원본 워크트리의 기존 의존성·공개 타입 산출물을 가리키는 로컬 링크를 준비했다. 원본 설치에 의존하는 개발 편의 환경이며 독립 배포 증거가 아니다. 새 의존성 설치나 lockfile 갱신이 필요하면 루트 변경 범위를 먼저 승인받는다. 타입 준비물이 없다고 DSH 전체 빌드를 자동 실행하지 않는다.

## 새 기능 연결

- `src/shell.tsx`: Studio 패널과 사이드바 등록. 비즈니스 기능이나 Remote 의존성을 두지 않는다.
- `src/service-layout.tsx`: 서비스 등록 목록과 선택·마운트 유지.
- `src/detail-layout.tsx`: 기존 디자인 미리보기와 같은 좌측 메뉴·본문 골격.
- `src/ui.tsx`, `src/ui-host.tsx`, `src/ui-styles.ts`: 기존 디자인 시스템.
- `packages/shell`, `packages/bundle`: 셸 진입점과 번들 구성.

새 기능은 `local.dsh-studio.services`에 등록한다. 슬롯의 `active` 값을 받아 비활성 화면의 부수 효과를 제어한다. 제품 문구는 ko·en를 제공하고 [디자인 시스템](docs/design-system.md)을 따른다.

## 패키징·배포 경계

`pack:bundle`은 `studio/dist`에 셸과 번들 tarball을 만든다. 번들에는 로컬 셸 tarball의 절대 경로가 들어가므로 같은 머신의 설치 확인용이다. 외부 배포용 registry 의존성으로 검증된 산출물이 아니다.

셸과 번들의 지원 선언은 `0.2.0-rc.2 || 0.2.1-alpha.2`다. rc.2의 공개 Slot 등록·구독·목록 조회, locale 등록·구독·조회 계약과 셸 사용법을 대조했다. Host는 비즈니스 서비스가 없는 진입점이고 Client는 slots·locale만 요구한다. 버전 예외는 사용하지 않는다. 신규 기능은 별도 호환성 검증이 필요하다.

## Desktop과 분리된 Web 실행

설치된 `dsh` CLI가 필요하다. 현재 머신의 `dsh --version`은 `0.2.0-rc.2`다. 아래 명령은 Studio만 빌드하고 수정하지 않은 설치 런타임으로 Web을 실행한다. DSH 본체를 빌드하거나 Desktop 프로필을 교체하지 않는다.

```sh
cd /Users/home/playground/vibecoding/deepseek-harness-lean-agent
npm --prefix studio test
npm --prefix studio run web
```

터미널에 출력된 `http://127.0.0.1:19388/?token=...` 주소 전체를 브라우저에서 연다. 토큰 없이 접근하면 인증 오류가 날 수 있다. 토큰은 실행 로그에서 확인하며 문서나 Git에 저장하지 않는다. 서버를 종료하려면 실행 터미널에서 Ctrl+C를 누른다.

- 데이터: `studio/.dsh-home` 내부의 격리 `lean-agent-web` 프로필
- 연결: `studio/dist/web-preview.patch.yml`을 자동 생성하여 로컬 셸 진입점을 개발용으로 로드
- 포트 충돌: `STUDIO_WEB_PORT=19389 npm --prefix studio run web`
- 다른 CLI: `STUDIO_DSH_BIN=/absolute/path/to/dsh npm --prefix studio run web`
- 코드 변경 후: 서버를 종료하고 같은 명령을 다시 실행한 뒤 브라우저 새로고침. 자동 HMR은 보장하지 않는다.

### 브라우저 확인 순서

1. 사이드바에서 DSH Studio를 선택한다.
2. 기존 기능 탭이 없고 빈 서비스 안내가 표시되는지 확인한다.
3. 라이트·다크 모드와 좁은 창에서 읽기·레이아웃·키보드 포커스를 확인한다.
4. 콘솔에 Client 모듈 로드·Slot 렌더링 오류가 없는지 확인한다.

격리 환경에는 Desktop 로그인·세션·모델 설정을 복사하지 않는다. 필요한 경우 Web에서 별도로 로그인한다. 이 개발 오버레이 실행은 tarball 설치 검증이 아니다. 실제 화면 확인과 패키징한 Studio의 독립 설치 검증은 별도이며 서버 기동·HTTP 검사만으로 성공을 선언하지 않는다.
