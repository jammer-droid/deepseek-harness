# DSH Studio — fork workspace

이 fork에서 Studio를 개발한다. HEL 저장소의 이전 프로젝트는 보존한 원본이며 이후 수정은 이 디렉터리에서 한다. DSH 핵심 패키지는 수정하지 않는다.

## 최초 준비

레포 루트에서 실행한다. Node/pnpm 버전은 루트 개발 가이드를 따른다.

```sh
pnpm install
pnpm --dir studio run prepare:types
pnpm --dir studio test
```

`prepare:types`는 공식 Host 빌드(Typert Remote 생성 포함)와 참조하는 Client 프로젝트의 선언 빌드를 실행한다. upstream 업데이트나 공식 API 변경 후 다시 실행한다. 일반 Studio 수정에는 매번 필요하지 않다.

## 일상 개발

```sh
pnpm --dir studio run typecheck
pnpm --dir studio run build
pnpm --dir studio test
pnpm --dir studio run watch
```

`watch`는 Studio JS만 다시 빌드하며 타입 검사는 별도로 실행한다. 현재 실행 중인 설치형 Desktop을 변경하지 않으며, 그 앱에 자동 반영되지 않는다. 공식 `dev:web`도 Studio 디렉터리를 대신 빌드하지 않는다.

Host와 Client는 별도 TypeScript 프로그램이다. 공식 compiler base와 project references를 사용해 Cordis 등 각 패키지의 검사 경계를 유지한다. `tsc -b studio/tsconfig.json` 대신 위 typecheck 명령을 사용한다. 기본 Context, Slot 서비스, Remote 응답과 PluginInfo/ChangeResult는 공식 타입이며, 로컬 Context 인터페이스를 복제하지 않는다. Studio가 소유하는 feature Slot만 공식 SlotMap에 보강한다.

## 구조

- `src/shell.tsx`: 사이드바 아이콘, main 페이지, profile 스위치.
- `src/demo.tsx`: 독립 해제되는 Client 타이머.
- `src/contracts.ts`: 공식 타입 연결 및 Studio 소유 Slot 계약.
- `src/host/`: 공식 Cordis Context를 받는 Host entry.
- `packages/shell`, `packages/demo`: 각각 독립 Loader row와 Client factory.
- `packages/bundle`: 두 패키지를 묶는 workspace bundle, 데모 기본 OFF.

수정할 소스는 `src/`이며 `packages/*/index.js`, `client.js`는 생성 파일이다. ON/OFF는 native Plugin Manager가 profile에 저장한다. 타이머는 React mount가 아닌 Client 플러그인/Slot 생명주기에 속하며 페이지 간에 공유하지 않는다.

## Web/설치 테스트

먼저 레포 루트에서 `pnpm run build`로 Web 실행에 필요한 공식 전체 산출물을 준비한다. 이 작업과 서버 실행은 Studio 단위 테스트와 별개다. 현재 Desktop profile 대신 별도의 DSH_HOME을 사용한다.

```sh
pnpm --dir studio run build
pnpm --dir studio run pack:bundle
# 다음 명령의 DSH_HOME은 동일한 절대 경로를 계속 사용한다.
DSH_HOME="$PWD/studio/.dsh-home" pnpm dsh plugin --profile web add "$PWD/studio/dist/local-dsh-studio-0.1.1.tgz"
DSH_HOME="$PWD/studio/.dsh-home" pnpm dsh web
```

이 명령들은 별도 개발 Web을 시작하기 위한 사용자 실행 절차다. 서버 기동/브라우저 렌더링은 이번 구축에서 검증하지 않았다. 패키지 설치 후 로딩 실패나 bundle skip은 시작 로그에서 확인한다. snapshot tarball을 설치한 환경에는 소스 저장이나 watch만으로 변경이 반영되지 않으므로 재패키징·재설치하고 필요하면 재시작한다.

pack은 `dist/bundle`에 배포 manifest를 생성하며 workspace manifest를 덮어쓰지 않는다. bundle은 같은 머신의 component tarball 절대 경로를 참조한다. dist를 보존하고 checkout 이동 시 다시 pack한다. 공개 npm 배포용 형식은 아니다.

## 검증 범위

공식 Host 빌드, 참조 Client 선언 빌드, Studio Host/Client strict 타입 검사, JS 빌드, 10개 회귀 테스트, tarball 패키징을 통과했다. 테스트는 Remote envelope, toggle 재조회, 중복 행 거부, 늦은 응답/해제, 타이머 정리, restart 안내 및 ModuleLoader factory 계약을 확인한다. 이 fork 버전의 실제 화면·버튼·재시작 복원은 아직 수동 확인이 필요하다.

Git origin은 개인 fork, upstream은 DeepSeek 공식 저장소다. 개발 브랜치는 `studio/development`다.

## 기존 Desktop 배포 분리

DSH `0.2.0-rc.2` Desktop은 이 fork의 alpha 빌드 대신 기존 설치 payload를 보존한 wrapper `0.1.2`를 사용한다. 배포 위치는 `~/.dsh/artifacts/dsh-studio/desktop-0.2.0-rc.2/installed-0.1.1/release/`다. shell/demo의 JS와 manifest는 기존 설치본과 바이트 단위로 동일하며 profile patch도 유지했다. profile manifest/lock 및 설치된 wrapper의 기존 HEL Studio 경로 의존성은 제거했다.

설치 결과는 `restart-required`다. 앱 재시작 후 로딩·화면은 아직 확인하지 않았다. 같은 artifact 루트의 `original-packages/`, `profile-backup/`, `legacy-hel-project/`에 복구 자료를 보존한다. 기존 HEL 프로젝트는 백업 위치로 이동했으며, 이 머신별 자료는 커밋하지 않는다. 별도 `dsh-session-cycle` 플러그인의 HEL 링크는 이번 Studio 이전 범위가 아니다.
