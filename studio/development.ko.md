# DSH Studio — fork workspace

이 fork에서 Studio를 개발한다. HEL 저장소의 이전 프로젝트는 보존한 원본이며 이후 수정은 이 디렉터리에서 한다. DSH 핵심 패키지는 수정하지 않는다.

작업을 시작하기 전에 [제품 목표와 범위](goals.ko.md)를 읽는다. 합의된 목표, 첫 구현 후보, 미확정 사항을 구분하며 개발 기반을 제품 기능의 완성으로 간주하지 않는다.

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

## Web 플러그인 업데이트 자동화

저장소 루트에서 다음 명령으로 실행 계획을 확인한다. `--home`에는 **업데이트할 Web 서버가 사용하는 DSH_HOME의 절대 경로**를 지정한다. 현재 세션의 환경변수를 자동으로 선택하지 않는다.

```sh
npm --prefix studio run deploy:web -- --help
npm --prefix studio run deploy:web -- --home "$PWD/studio/.dsh-home" --dry-run
```

실제 빌드·패키징·설치는 `--dry-run`을 빼고 실행한다. 아래 경로는 별도 개발 Web용 예시이며, 다른 DSH_HOME으로 실행 중인 서버에는 반영되지 않는다.

```sh
npm --prefix studio run deploy:web -- --home "$PWD/studio/.dsh-home"
```

스크립트는 Studio 타입 검사와 빌드 → 고유 배포 디렉터리에 패키징 → 이 checkout의 공식 DSH CLI로 `web` 프로필에 설치 순서로 실행한다. 실패하면 이후 단계는 실행하지 않고 비정상 종료한다. 초기 환경에는 위의 최초 준비와 Web 런타임 빌드가 필요하다. PATH의 설치형 `dsh`는 사용하지 않으며, 대상 Web도 이 checkout과 같은 런타임을 사용해야 한다. 호환성 예외나 설치 스크립트 실행 권한은 자동 승인하지 않는다.

대상 프로필은 `web`으로 고정되며 Desktop 배포는 지원하지 않는다. 설치는 해당 Web 프로필을 사용하는 모든 세션에 영향을 줄 수 있다. 실행 중인 서버를 시작·종료하거나 다른 서버로 교체하지 않는다. CLI 설치 성공은 현재 브라우저의 라이브 적용 확인이 아니므로, 설치 경고를 확인하고 필요하면 기존 Web 서버를 같은 실행 명령으로 재시작한 뒤 해당 페이지를 새로고침한다. 기본 DSH Web 셸은 빌드하지 않는다.

배포 파일은 `studio/dist/web/deploy-*`에 남는다. 같은 버전의 재배포가 이전 tarball 경로를 재사용하지 않도록 매번 별도 디렉터리를 만들며, 설치 번들이 참조하므로 임의로 삭제하지 않는다. 실패한 설치를 자동으로 롤백하지 않으며 CLI 진단을 확인한 뒤 재실행한다.

검증 범위: 인자 검사, 단계 순서, 실패 시 중단, dry-run 무변경을 자동 테스트한다. 실제 프로필 설치와 실행 중인 브라우저 반영은 이 스크립트 추가 과정에서 실행하지 않았으며, 위 실배포 명령은 사용자 실행 절차다.

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

## Desktop 실행

### 작업공간 버전으로 Studio 실행

현재 Studio bundle의 대상은 DSH `0.2.1-alpha.2`다. 레포 루트에서 Studio를 패키징한 뒤 같은 작업공간의 개발용 Desktop을 실행한다. `dev:desktop`은 공식 런타임과 Desktop 산출물도 빌드한다.

```sh
pnpm --dir studio run build
pnpm --dir studio run pack:bundle
DSH_HOME="$PWD/apps/desktop/.desktop-build/development/home" pnpm run dev:desktop
```

개발용 설정·세션·플러그인은 위 `DSH_HOME`에 저장되고, 브라우저 데이터는 기본적으로 `apps/desktop/.desktop-build/development/electron-user-data`에 저장된다. 기존 설치 앱의 기본 저장소와 분리된다. 외부 모델을 사용하려면 개발용 Desktop에도 모델 자격을 설정한다.

다른 터미널을 같은 레포 루트에서 열고, 동일한 `DSH_HOME`의 `desktop` 프로필에 Studio bundle을 설치한다.

```sh
DSH_HOME="$PWD/apps/desktop/.desktop-build/development/home" pnpm dsh plugin --profile desktop add "$PWD/studio/dist/local-dsh-studio-0.1.1.tgz"
```

설치 결과에서 재시작을 요구하면 개발용 Desktop을 종료한다(macOS에서는 창 닫기 대신 `⌘Q`). 이미 빌드된 산출물로 다시 실행할 때는 다음 명령을 사용한다.

```sh
DSH_HOME="$PWD/apps/desktop/.desktop-build/development/home" pnpm run start:desktop
```

Desktop의 **DSH Studio → Role settings**에서 구현자·리뷰어의 지침과 사용 가능한 모델을 입력하고 **Apply**한다. **Settings → Agent presets**에서 **Studio**를 새 작업 기본값으로 선택한 뒤 새 작업을 만든다. 설치된 tarball은 Studio 소스의 `watch` 결과를 자동으로 반영하지 않으므로 수정 후에는 재빌드·재패키징·재설치한다.

이 Desktop 기동·설치 경로는 수동 검증 절차다. 실행하는 개발자가 시작 로그의 bundle 로딩, 역할 설정 Apply, Studio preset으로 만든 새 작업을 확인한다. 자동화된 격리 Web 검증을 Desktop 설치 검증으로 간주하지 않는다. 런처와 저장소 위치의 상세는 [Desktop 개발 문서](../apps/desktop/README.md#develop)를 따른다.

### 설치형 Desktop에 자동 배포(macOS)

대상은 `/Applications/DeepSeek Harness.app`, 기본 `~/.dsh`의 `desktop` 프로필, 설치형 `dsh` 버전 `0.2.0-rc.2`다. 사용자 지정 DSH_HOME을 쓰는 앱에는 이 명령을 사용하지 않는다.

```sh
# 대상 및 실행 계획 확인 (설치하지 않음)
npm --prefix studio run deploy:desktop -- --dry-run

# 작업을 저장하고 Desktop을 Cmd+Q로 완전히 종료한 뒤 외부 터미널에서 실행
npm --prefix studio run deploy:desktop
```

호환 버전으로 빌드·패키징한 뒤 공식 CLI로 설치하고 앱을 연다. 설치형 런타임 버전이 다르거나 앱이 실행 중이면 중단한다. 강제 종료, 버전 예외 승인, 설치 실패 롤백은 하지 않는다. 빌드 중 앱을 다시 열지 않는다. 출력된 고유 배포 디렉터리는 설치 번들이 참조하므로 보존한다. 설치 성공과 앱 열기 요청은 화면 정상 로딩을 보장하지 않으므로 DSH Studio 화면을 확인한다. 도움말과 dry-run만 검증했으며 실제 앱 종료·설치는 사용자 실행 단계다.

### 기존 설치 앱 실행(macOS)

```sh
open "/Applications/DeepSeek Harness.app"
```

이 명령은 설치된 앱을 열며 작업공간 소스를 빌드하거나 설치하지 않는다. 이 머신의 설치본 `0.2.0-rc.2`에는 다음 전용 빌드를 사용한다.

```sh
npm --prefix studio run build:desktop
```

산출물은 `studio/dist/desktop-0.2.0-rc.2/local-dsh-studio-0.1.1.tgz`다. 빌드는 임시 작업공간에서 해당 버전의 공식 패키지와 타입을 설치하고 Host·Client를 검사한다. 현재 레포의 의존성 링크나 Desktop 프로필은 변경하지 않는다. 구버전의 첫 리뷰는 `studio_review_submit`으로 판정을 제출하며, 자식 완료 시 구버전의 기본 알림이 부모를 깨울 수 있다.

설치된 `dsh --version`이 `0.2.0-rc.2`인지 확인한다. 기존 Desktop에 적용할 때는 앱을 종료한 뒤 아래 명령으로 설치하고 다시 연다. 사용자 지정 `DSH_HOME`으로 앱을 운영한다면 설치 명령에도 같은 값을 지정한다.

```sh
dsh plugin --profile desktop add "$PWD/studio/dist/desktop-0.2.0-rc.2/local-dsh-studio-0.1.1.tgz"
open "/Applications/DeepSeek Harness.app"
```

bundle이 참조하는 component tarball도 같은 `dist/desktop-0.2.0-rc.2`에 있으므로 디렉터리 전체를 보존한다. 설치된 Desktop 런타임의 격리 Web 프로필에서 위임·리뷰·재작업·완료·종료와 Studio 설정 화면을 확인했다. 기존 사용자 Desktop 프로필에 설치한 뒤 네이티브 창에서도 Studio 역할 설정 화면의 로딩을 확인했다. 실제 모델 API 호출은 이 검증에 포함하지 않는다. 재현 명령은 [테스트 문서](test/README.md)에 있다. 보존된 이전 Studio 배포는 아래 [기존 Desktop 배포 분리](#기존-desktop-배포-분리)를 참조한다.

## 검증 범위

공식 Host 빌드, 참조 Client 선언 빌드, Studio Host/Client strict 타입 검사, JS 빌드, 10개 회귀 테스트, tarball 패키징을 통과했다. 테스트는 Remote envelope, toggle 재조회, 중복 행 거부, 늦은 응답/해제, 타이머 정리, restart 안내 및 ModuleLoader factory 계약을 확인한다. 이 fork 버전의 실제 화면·버튼·재시작 복원은 아직 수동 확인이 필요하다.

Git origin은 개인 fork, upstream은 DeepSeek 공식 저장소다. 현재 통합 브랜치는 `studio/role-delegation-integration`이다.

## 기존 Desktop 배포 분리

기존 shell/demo 전용 wrapper와 복구 자료는 `~/.dsh/artifacts/dsh-studio/desktop-0.2.0-rc.2/installed-0.1.1/`에 보존한다. `release/`, `original-packages/`, `profile-backup/`, `legacy-hel-project/`는 머신별 복구 자료이며 커밋하지 않는다. 현재 역할 위임 기능을 설치할 때는 위의 Desktop 전용 bundle을 사용한다. 별도 `dsh-session-cycle` 플러그인의 HEL 링크는 Studio 설치 범위가 아니다.
