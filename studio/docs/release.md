# Studio 배포 가이드

이 fork의 `studio/`가 유일한 원본이다. 공개 레포 [matamt-dbg/dsh-studio](https://github.com/matamt-dbg/dsh-studio)와 npm 패키지 [@matamt-dbg/dsh-studio](https://www.npmjs.com/package/@matamt-dbg/dsh-studio)는 배포할 때마다 [release/sync.mjs](../release/sync.mjs)가 만드는 **스냅샷**이다.

기능 브랜치를 병합·리뷰·문서·한국어 교정까지 마무리한 뒤 배포하는 전체 순서는 [Studio 마무리·배포 절차](release-workflow.md)를 따른다. 이 문서는 그중 배포 단계의 명령과 규칙을 소유한다.

## 구조

```text
fork (deepseek-harness/studio)          공개 레포 (matamt-dbg/dsh-studio)        npm
  개발·커밋·테스트          ──sync──▶     release: <version> 커밋 1개씩    ──publish──▶  @matamt-dbg/dsh-studio
  workspace:* DSH 소스                     npm 공개 DSH 0.2.0-rc.2 의존
  내부 문서·이슈 기록                       README·guide·코드만
```

- **한 방향:** 공개 레포에서 직접 고치지 않는다. 다음 sync가 덮어쓴다. 수정은 fork에서 하고 다시 sync한다.
- **패키지 하나:** `packages/shell`이 npm 패키지 전체다. `dsh.bundle`(설치 패치)과 `dsh.client`(화면)를 함께 선언한다. 하위 경로 `/policy`, `/roles`, `/batch`는 프리셋 안에서만 켜지는 진입점이다.
- **이름:** 패키지 이름·버전·플러그인 경로는 [src/package-name.ts](../src/package-name.ts)가 기준이다. 예전 이름(`@local/dsh-studio-shell`, `studio_role`)으로 저장된 프리셋은 시작할 때 자동 변환된다.

## 준비 (최초 1회)

| 항목 | 확인 명령 | 기대값 |
|---|---|---|
| GitHub 배포 계정 | `gh auth status` | `matamt-dbg` 로그인(활성 계정이 아니어도 됨) |
| npm 계정 | `npm whoami` | `mamt` (`matamt-dbg` 조직 owner) |
| npm 2단계 인증 | `npm profile get` | `tfa: auth-and-writes` |
| pnpm | `pnpm --version` | 설치되어 있음 |

배포 계정은 [release/config.json](../release/config.json)의 `author`, `publisher`에 고정되어 있다. sync는 시작할 때 이 계정들을 확인하고, 맞지 않으면 아무것도 하지 않고 멈춘다. 로컬 git 사용자(jammer-droid)나 현재 활성 `gh` 계정은 공개 레포에 쓰이지 않는다.

## 배포 절차

[release/deploy.mjs](../release/deploy.mjs)가 아래 2~5 과정을 두 명령으로 묶는다. 각 단계는 검증에 실패하면 멈추고, 공개 레포와 npm 밖의 상태는 바꾸지 않는다.

```sh
node studio/release/deploy.mjs github   # 2~4단계 push까지: fork studio/ → 공개 레포 main
node studio/release/deploy.mjs npm      # 4~5단계: 공개 레포 main을 새로 clone해 빌드·테스트 후 npm publish (브라우저 인증)
node studio/release/deploy.mjs all      # 두 단계 연속. 인증 가능한 대화형 터미널에서만
```

- `github`는 [sync.mjs](../release/sync.mjs)에 위임한다. export 목록·금지어 검사·공개 의존성 설치·테스트·`release: <version>` 커밋은 sync가 그대로 소유한다. `--dry-run`은 push 없이 export·검증·패키징만 한다.
- `npm`은 공개 레포 브랜치를 임시 폴더에 새로 clone한다. fork 작업 트리 상태와 무관하게 **공개 브랜치에 실제로 올라간 커밋**만 공개 패키지로 빌드·테스트해 `pack.mjs` tarball을 만들고 publish한다. 같은 버전이 이미 레지스트리에 있으면 설치 전에 멈춘다.
- publish 뒤에는 `npm view`로 레지스트리를 재조회해 `dist.shasum`이 방금 만든 tarball과 같은지 확인한다. 전파가 늦으면 경고만 남기고, shasum이 다르면 실패로 처리한다.
- 2차 인증은 기본적으로 브라우저에서 한다. `--otp` 없이 실행하면 npm이 publish 시점에 브라우저 인증 창을 열고 승인을 기다리므로, 설치·테스트 동안 인증이 만료되지 않는다. 대화형 터미널이 필요하다. 비대화형 실행에서만 `--otp=`를 넘기고, OTP·토큰은 채팅·문서·셸 기록에 남기지 않는다.

### 1. 버전 올리기

릴리즈 노트를 먼저 씁니다. [release/CHANGELOG.md](../release/CHANGELOG.md) 맨 위에 `## <버전> — <날짜>` 섹션을 추가하고, 영어 노트 아래에 `### 한국어` 섹션을 붙입니다. 사용자에게 보이는 변경만 적습니다(주요 변경, 변경 사항, 업그레이드 참고). sync는 이 섹션이 없으면 시작하지 않으며, 테스트도 현재 버전 섹션과 한국어 섹션을 검사합니다.


두 곳을 같은 값으로 바꾼다. 다르면 테스트가 실패한다.

- [packages/shell/package.json](../packages/shell/package.json)의 `version`
- [src/package-name.ts](../src/package-name.ts)의 `STUDIO_VERSION`
- [test/preset-policy.test.mjs](../test/preset-policy.test.mjs)의 다운로드 번들 버전 단언

npm은 같은 버전을 다시 올릴 수 없다. 이미 올린 버전 번호는 지워도 재사용할 수 없다.

| 변경 | 올릴 자리 |
|---|---|
| 버그 수정, 문구, 작은 동작 변경 | patch (`0.2.0` → `0.2.1`) |
| 기능 추가, 기본 프리셋 구성 변경 | minor (`0.2.x` → `0.3.0`) |

### 2. fork에서 검증하고 커밋

```sh
npm --prefix studio test
git add studio && git commit
```

sync는 `studio/`에 커밋 안 된 변경이 있으면 시작하지 않는다.

### 3. 드라이런

```sh
node studio/release/sync.mjs
```

1. 공개 레포를 임시 폴더(기본: 새 temp 폴더, `STUDIO_RELEASE_DIR`로 지정 가능)에 받는다.
2. [config.json](../release/config.json)의 `include` 목록만 복사하고, `copy` 항목(공개 README, guide, 이미지, 단독 tsconfig, 공개용 `.gitignore`)을 덮는다.
3. `workspace:*` 의존을 `versions`의 공개 버전으로 바꾼다. `dropScripts`에 적은 개발·배포 스크립트(`web`, `dev`, `dev:desktop`, `deploy`, `release:*`)는 공개 `package.json`에서 뺀다. 남은 스크립트가 스냅샷에 없는 파일을 실행하면 멈춘다.
4. 금지어 검사: `forbidden` 패턴(개인 계정, fork 경로, 브랜치, 로컬 경로·포트, 개발 스크립트·격리 프로필 이름)이 하나라도 있으면 위치를 출력하고 멈춘다. `.gitignore` 같은 점 파일도 검사한다.
5. `pnpm install` → 타입 검사·빌드·테스트 → `pack.mjs`로 tarball을 만든다.
6. `release: <version>` 커밋을 만든다. push는 하지 않는다.

`--push`이면 이어서 공개 레포에 push하고, 같은 커밋에 GitHub Release `v<version>`을 만든다. 이미 있으면 노트를 새 CHANGELOG 섹션으로 갱신한다. 코드 변경 없이 문서·노트만 바뀐 경우에도 push와 Release 갱신은 그대로 수행한다. 공개 레포에는 `CHANGELOG.md`가 함께 내보내진다.

결과 폴더에서 커밋 내용과 `dist/*.tgz`를 확인한다. 현재 스크립트는 `STUDIO_RELEASE_DIR`로 지정한 디렉터리를 삭제하고 다시 만든다. 작업 레포·홈·사용 중인 체크아웃을 지정하지 말고, 별도 지정 없이 자동 임시 폴더를 사용하는 것을 권장한다.

### 4. 공개 레포 push와 npm 공개

```sh
node studio/release/sync.mjs --push
# 출력된 결과 폴더에서 직접 publish하고 브라우저 인증을 완료한다.
# 인증 코드를 sync 시작 전에 넣으면 설치·테스트 도중 만료될 수 있다.
```

위처럼 push와 publish를 나누는 것이 수동 2FA 환경의 권장 절차다. 인증이 가능한 대화형 터미널에서는 `node studio/release/sync.mjs --publish`로 합칠 수도 있다. OTP·토큰은 채팅이나 문서에 공유하지 않는다.

`--publish`는 3번 과정 뒤에 다음을 한다.

1. `matamt-dbg`의 gh 토큰으로 공개 레포 `main`에 push한다.
2. fork에 로컬 태그 `dsh-studio-snapshot/<공개 커밋>`을 단다. 어느 fork 커밋이 어느 공개 스냅샷이 됐는지는 이 태그로만 남긴다(공개 레포에는 남기지 않는다).
3. `npm publish`로 tarball을 올린다.

GitHub만 올리고 npm은 나중에 할 때는 `--push`를 쓴다. 그 뒤 직접 올린다.

```sh
cd <sync 결과 폴더>
npm publish ./dist/matamt-dbg-dsh-studio-<version>.tgz --access public
```

경로는 `./`로 시작해야 한다. `dist/x.tgz`처럼 쓰면 npm이 GitHub 주소로 해석해 실패한다.

### 5. 공개 후 확인

npm 반영에는 시간이 걸릴 수 있다. `404 Not Found`만으로 성공했다고 판단하지 않는다. publish 종료 코드와 성공 메시지를 확인한 뒤 레지스트리를 재조회한다. 이미 원하는 버전이 공개됐다면 같은 버전을 다시 publish하지 않는다.

```sh
npm view @matamt-dbg/dsh-studio version dist.shasum
```

- `dist.shasum`이 sync 결과 폴더의 tarball(`shasum dist/*.tgz`)과 같은지 본다.
- 깨끗한 환경에서 설치를 확인한다. 기존 프로필은 쓰지 않는다.

```sh
mkdir -p /tmp/dsh-check && cd /tmp/dsh-check
npm init -y >/dev/null && npm install @deepseek-ai/dsh@0.2.0-rc.2
export DSH_HOME=/tmp/dsh-check/home
./node_modules/.bin/dsh --profile web --dump-config >/dev/null
./node_modules/.bin/dsh plugin --profile web add @matamt-dbg/dsh-studio
./node_modules/.bin/dsh --profile web --host 127.0.0.1 --port 54313 --no-open
```

출력된 주소를 열어 DSH Studio 화면, 프리셋 목록, Optimized 도구 수(22), 콘솔 오류 여부를 확인한다. 끝나면 서버를 끄고 `/tmp/dsh-check`를 지운다.

### 6. 기록

fork에 버전 태그를 단다.

```sh
git tag dsh-studio-v<version> <공개한 fork 커밋>
```

## 내 DSH 앱에 설치·업데이트

데스크톱 앱은 `desktop` 프로필을 쓴다. 앱을 종료한 뒤 실행한다.

```sh
# 처음 바꿀 때만: 예전 로컬 빌드 제거 (남아 있으면 두 Studio가 충돌해 failed)
dsh plugin --profile desktop remove @local/dsh-studio

# 설치 또는 최신 버전으로 업데이트
dsh plugin --profile desktop add @matamt-dbg/dsh-studio@latest
```

저장한 프리셋은 `~/.dsh/profiles/desktop/studio-data/`에 남는다.

npm에 올리기 전에 로컬 개발 빌드를 앱에서 바로 확인하려면 개발 스크립트를 쓴다.

```sh
# DSH 앱을 종료한 뒤 실행. 테스트·빌드·패키징 후 desktop 프로필에 설치하고, 앱 재시작으로 반영한다.
npm --prefix studio run dev:desktop
```

`node studio/dev.mjs --desktop`은 실제 `desktop` 프로필을 바꾸므로 앱이 실행 중이면 중단한다. 다른 프로필은 `--profile <이름>`, 강제 적용은 `--force`를 쓴다. 되돌리려면 위 `add @matamt-dbg/dsh-studio@latest`를 다시 실행한다. 이 로컬 설치는 독립 배포 검증이 아니다.

## 문서와 스크린샷

- 공개 README: [release/README.md](../release/README.md). fork 루트 README는 내부용이며 공개되지 않는다.
- 사용 가이드: [release/docs/guide.md](../release/docs/guide.md)(영어), [guide.ko.md](../release/docs/guide.ko.md)(한국어). 구성은 두 문서가 같아야 한다.
- 부록: [release/docs/appendix/](../release/docs/appendix/)는 공개 레포의 `docs/appendix/`로 나간다. `preset-check/`는 사용자가 복사해 쓰는 에이전트 스킬(`SKILL.md`, 영어)과 검증 스크립트다. 패키지에는 넣지 않는다. 스크립트는 공개 레포에서 단독 실행되어야 하므로 Studio 소스를 import하지 않고, 역할 Tool Filter 계산·도구-사용 지침 매핑 같은 규칙을 직접 갖는다. 그 규칙(`roleToolFilter`, `tool-prompt-sections.ts`)을 바꾸면 스크립트도 함께 고친다.
- 스크린샷: `release/docs/images/en/`, `release/docs/images/ko/`. 화면이 바뀌면 두 언어 모두 다시 찍는다. 개인 데이터가 없는 격리 환경(위 5번)에서 찍고 1600×1000으로 줄인다.
- npm 페이지는 레포 파일을 읽지 못하므로 `pack.mjs`가 README의 이미지·문서 링크를 GitHub 절대 주소로 바꾼다. 이미지는 npm 패키지에 넣지 않는다.
- 공개 문서에 내부 정보(fork, 개인 계정, 로컬 경로·포트, 내부 이슈)를 쓰지 않는다. 쓰면 sync의 금지어 검사가 멈춘다. 새 금지어는 `config.json`의 `forbidden`에 추가한다.

### 개발 환경 정보를 배포에서 빼는 규칙

공개 스냅샷에는 사용자가 빌드·테스트·패키징하는 데 필요한 것만 넣는다. 개발 루프(`dev.mjs`, `start-web.mjs`, `.dsh-home` 격리 프로필)와 배포 도구(`release/`)는 fork에만 둔다.

| 새로 추가한 것 | 함께 할 일 |
|---|---|
| `package.json` 개발·배포 스크립트 | `config.json`의 `dropScripts`에 이름 추가. 빠뜨리면 sync가 "reference files outside the snapshot"으로 멈춘다. |
| 개발 전용 파일 | `include`에 넣지 않는다. 이름이 공개 파일에 나오면 안 되면 `forbidden`에도 추가한다. |
| 개발용 ignore 항목 | `studio/.gitignore`에만 추가한다. 공개 `.gitignore`는 [release/standalone/gitignore](../release/standalone/gitignore)이며 빌드 산출물만 담는다. |

## 문제 해결

| 증상 | 원인 | 해결 |
|---|---|---|
| `studio/ has uncommitted changes` | fork에 미커밋 변경 | 커밋 후 다시 실행 |
| `npm is logged in as …` | npm 계정 다름 | `npm login`으로 `mamt` 로그인 |
| `Snapshot contains private references` | 공개 파일에 금지어 | 출력된 파일·줄을 fork에서 고쳐 커밋 |
| `pnpm install` 중 `Ignored build scripts` | 새 의존이 설치 스크립트를 가짐 | 필요하면 `config.json`의 `allowBuilds`에 명시 |
| 공개 레포 기준 타입 검사 실패 | 공개 DSH(0.2.0-rc.2)와 fork의 DSH 소스가 다름 | 두 버전 모두에서 통과하도록 코드 수정. 필요한 개발 의존은 `config.json`의 `devDependencies`에 추가 |
| `npm publish` 403 2FA required | npm 2단계 인증 꺼짐 | npmjs.com에서 2FA를 `auth-and-writes`로 켜고 `npm login` |
| `npm publish` EOTP | 2단계 인증 필요 | 출력된 링크로 승인하거나 `--otp` 지정 |
| `npm publish` 403 cannot publish over | 같은 버전이 이미 있음 | 버전을 올려 다시 sync |
| `… is already on npm` (deploy npm) | 공개 브랜치 버전이 이미 레지스트리에 있음 | 버전을 올려 `deploy.mjs github`부터 다시 실행 |
| 설치 후 `@matamt-dbg/dsh-studio: failed` | 같은 프로필에 `@local/dsh-studio` 잔존 | `dsh plugin --profile <프로필> remove @local/dsh-studio` |
| 공개 레포 Contributors에 다른 계정 | GitHub 기여자 목록 캐시 | 커밋 작성자가 맞으면 재계산을 기다림 |
