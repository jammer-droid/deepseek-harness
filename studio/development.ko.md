# Studio 빌드와 Web·Desktop 검증

제품은 **수정하지 않은 DSH에 설치하는 Studio 플러그인**이다. 아래의 Desktop 빌드는 DSH 앱 본체 빌드가 아니라 Studio를 빌드해 설치된 앱에서 확인하는 절차다. 코어·루트 의존성·lockfile을 자동 수정하거나 전체 DSH를 빌드하지 않는다.

에이전트는 저장소 루트에서 `/studio-build`를 호출한다. 기본은 빌드·테스트이며, `web`, `matrix`, `desktop` 중 원하는 범위를 함께 요청한다. [저장소 스킬](../.agents/skills/studio-build/SKILL.md)은 이 문서를 실행 절차의 기준으로 사용한다. 스킬이 발견되지 않으면 해당 파일을 직접 읽도록 요청한다. 현재 세션의 자동 갱신은 보장하지 않는다.

## 1. 준비와 검증 수준

저장소 루트에서 `pwd`, `git status --short`, `git branch --show-current`로 작업 위치·기존 변경을 확인한다. 다른 작업과 섞이면 별도 worktree를 사용한다. 현재 CLI의 경로와 `dsh --version`, Node 버전, Studio 버전, 소스 커밋을 기록한다. CLI 버전이 Desktop 앱 버전과 같다고 가정하지 않는다.

새 worktree에는 무시된 node_modules가 없을 수 있다. 기존 checkout의 의존성과 공개 타입 산출물을 읽기 전용으로 재사용할 수 있지만 이는 개발 준비일 뿐 독립 배포 증거가 아니다. Studio 의존성만 연결하면 루트에서 해석되던 `zod` 등이 누락될 수 있다. 누락 의존성을 확인하고 준비 범위를 기록한다. 루트 설치·lockfile 변경·코어 빌드가 필요하면 중단하고 승인을 받는다.

| 수준 | 확인하는 것 | 대신할 수 없는 검사 |
| --- | --- | --- |
| 타입·빌드·단위 테스트 | 개발 소스 회귀 | 순정 런타임 설치 |
| 패키지 설치·Web RPC | 실제 Host 서비스 경로 | 화면 렌더링·자식 실행 |
| 브라우저 조작 | Client 로드·화면·사용자 흐름 | Desktop 앱 동작 |
| Desktop 확인 | 앱에서 플러그인 로드·사용 | 구버전 및 데이터 업그레이드 |
| 버전별·업그레이드 검사 | 특정 조합과 데이터 유지 | 미검증 버전 전체 |

## 2. 기본 빌드·테스트

```sh
npm --prefix studio run typecheck
npm --prefix studio test
# test는 타입 검사·빌드 후 Studio 단위 테스트를 실행한다.
npm --prefix studio run dev -- --build-only
# dev --build-only도 기본적으로 test를 실행하고 설치/서버 시작 전에 종료한다.
```

집중 테스트는 `node --import tsx --test studio/test/<테스트>.test.mjs`로 실행한다. `npm --prefix studio run build`는 타입 검사와 Studio 번들 빌드만 수행한다. `pack:bundle`은 기존 빌드 결과를 포장하므로 단독 실행 전에 빌드해야 한다.

```sh
npm --prefix studio run build
npm --prefix studio run pack:bundle
```

패키지는 `studio/dist`에 생성된다. 패키지 경로·SHA256을 기록한다. 배포는 [배포 가이드](docs/release.md)를 따르며 빌드 요청만으로 커밋·푸시·게시하지 않는다.

## 3. Desktop과 분리된 Web 실행

```sh
npm --prefix studio run dev
# 포트 변경
npm --prefix studio run dev -- --port 19389
# 설치된 다른 순정 CLI 지정
STUDIO_DSH_BIN=/absolute/path/to/dsh npm --prefix studio run dev
```

`dev`는 테스트 → 패키징 → tarball 설치 → Web 실행 순서다. `studio/.dsh-home`의 `lean-agent-web` 프로필을 사용하며 기존 Desktop 프로필은 바꾸지 않는다. 이 프로필은 재실행 때 재사용된다. **신규 설치나 버전별 격리는 아래 matrix 절차를 사용한다.** 로컬 소스 오버레이가 아니며, 패키지 설치만으로 전체 호환성 검증이 끝나는 것은 아니다.

- 터미널의 `http://127.0.0.1:<port>/?token=...` 전체 주소로 접속한다. 인증 토큰을 문서·Git·공유 로그에 넣지 않는다.
- 기본 포트는 19388이다. 다른 서버가 사용 중이면 종료시키지 말고 다른 포트를 선택한다.
- `--skip-test`는 단위 테스트를 생략하지만 타입 검사·빌드는 수행한다. 생략 사실을 결과에 남긴다.
- `npm --prefix studio run web`도 타입 검사·빌드 후 실행하며 단위 테스트는 생략한다.
- 코드 변경 후 서버 종료 → 같은 명령 재실행 → 브라우저 새로고침. `watch`는 번들 빌드 감시이며 설치된 패키지를 자동 교체하지 않는다. HMR을 가정하지 않는다.
- 사람이 실행했다면 Ctrl+C로 종료한다. 에이전트는 관리형 background job ID를 기록하고 결과를 회수한 뒤 자신이 시작한 서버만 종료한다.
- Desktop 인증·세션·모델 설정을 자동 복사하지 않는다. 외부 모델 실행은 비용·자격 증명 범위를 별도로 확인한다.

### Web RPC 스모크

아래 검사는 **프로필을 수정한다**. Master 확장 설정을 임시 변경하고 테스트 프리셋·세션을 생성한다. 프리셋은 정상 종료 시 정리하지만 세션은 남을 수 있으며, 중간 실패 시 일부 데이터가 남을 수 있다. 사용자의 현재 GUI나 Desktop을 대상으로 실행하지 않는다.

격리 서버의 실행 명령·home/profile·포트를 확인한 뒤 실행한다. 환경 변수는 사용자의 확인 표시이지 프로필 격리를 기술적으로 증명하는 장치가 아니다.

```sh
# URL에는 방금 시작한 격리 서버의 인증 URL을 사용한다.
STUDIO_TEST_ISOLATED=1 STUDIO_TEST_PORT=19389 \
  node studio/scripts/check-web-runtime.mjs 'http://127.0.0.1:19389/?token=...'
```

[통합 검사](scripts/check-web-runtime.mjs)는 다음 네 스크립트를 순차 실행하고 첫 실패에서 멈춘다. 개별 실행에도 같은 환경 변수가 필요하다. 기존의 고정 포트 가드 대신 명시한 포트와 URL이 일치해야 한다.

| 스크립트 | 검사 |
| --- | --- |
| [Master](scripts/check-master-runtime.mjs) | 읽기 전용 보호·파생 프리뷰·설정 override·확장 추가/원복 |
| [Optimized](scripts/check-optimized-runtime.mjs) | 순서·삭제 보호·복사 적용·기본 catalog |
| [세션 역할](scripts/check-session-roles-runtime.mjs) | 실제 세션 생성·역할 편집/추가·프리셋 불변·세션 격리 |
| [역할](scripts/check-role-runtime.mjs) | 저장·재적용·해제·복원·모델 catalog |

이 검사는 브라우저, 모델 호출, Fresh/Fork 자식 실행을 검사하지 않는다. runtime별 tool 수 차이와 peer/native dependency 경고도 기록한다. 기동 성공으로 subprocess·PTY 정상 동작을 추정하지 않는다.

### 브라우저 기능 확인

1. Studio 패널과 프리셋 목록이 표시되고 Client 모듈/Slot 오류가 없는지 확인한다.
2. Master가 읽기 전용인지 확인하고 Optimized를 복사한다.
3. 복사본의 도구·프롬프트·설정을 변경하고 프리뷰에 반영되는지 확인한다.
4. 저장·적용 후 새 세션에서 해당 프리셋을 선택한다.
5. 세션 역할을 변경하고 원본 프리셋과 다른 세션이 그대로인지 확인한다.
6. 적용 해제·재적용 및 서버 재시작 후 저장 내용 유지를 확인한다.
7. 라이트·다크, 좁은 창, 키보드 포커스와 Host/브라우저 콘솔 오류를 확인한다.
8. 실제 역할 실행이 범위에 포함되면 Fresh/Fork 각각 persona, 금지 도구 노출·실행 제한, 부모 대화 상속, 재시작 후 재개를 별도로 확인한다. 설정 저장 성공으로 대체하지 않는다.

브라우저 도구를 사용할 수 없으면 해당 항목을 미검증으로 남긴다. 기존 사용자의 GUI URL은 테스트 서버가 아니다.

## 4. 지원 버전별 동일 패키지 검증 (matrix)

지원 범위의 기준은 [배포 manifest](packages/shell/package.json)의 peerDependencies다. 개발 스크립트의 허용 목록과 일치하는지 확인한다. [구버전 Web 기록](docs/verification/older-dsh-web.md), [rc.1 기록](docs/verification/dsh-0.2.1-rc.1.md)은 과거 증거이며 새 소스의 성공을 대신하지 않는다.

1. Studio를 한 번 빌드·패키징하고 SHA256을 기록한다. 런타임별로 재빌드하지 않는다.
2. 각 정확한 DSH 버전의 배포 CLI를 확보하고 `--version`을 확인한다. npm 설치를 사용하면 예를 들어 `npm install --prefix studio/dist/matrix/<버전>/runtime --no-audit --no-fund @deepseek-ai/dsh@<정확한 버전>`으로 격리하고 lockfile을 보존한다. 의존성 install script 승인을 자동 우회하지 않는다.
3. 버전마다 별도의 새 DSH_HOME/profile을 만든다. 아래 변수는 실제 절대 경로로 지정한다. 기존 프로필 경로를 재사용하지 않는다.

```sh
RUNTIME='/absolute/path/to/versioned/dsh'
TEST_HOME='/absolute/path/to/worktree/studio/dist/matrix/version/home'
ARCHIVE='/absolute/path/to/the/same/studio-package.tgz'
"$RUNTIME" --version
DSH_HOME="$TEST_HOME" "$RUNTIME" --profile verify --from-default-profile web --dump-config
DSH_HOME="$TEST_HOME" "$RUNTIME" plugin --profile verify add "$ARCHIVE"
DSH_HOME="$TEST_HOME" "$RUNTIME" --profile verify --host 127.0.0.1 --port 19389 --no-open
```

4. 각 서버의 인증 URL로 RPC 검사와 브라우저 확인을 실행한다. 서버 종료 후 다음 버전으로 진행하거나 서로 다른 포트를 사용한다.
5. 버전·패키지 해시·설치 경고·통과 항목·실패·미검증을 표로 기록한다. 하나라도 실패하면 지원 범위를 넓히거나 성공으로 발표하지 않는다.

## 5. Studio를 빌드해 Desktop에서 테스트하기

**실제 사용자 프로필을 바꾸므로 명시적 승인이 필요하다.** 기본 `/studio-build`나 Web 확인 요청에는 이 승인이 포함되지 않는다. DSH 앱 본체를 빌드하거나 교체하지 않는다.

### 설치 전

1. Desktop 앱 버전과 CLI 경로/버전이 같은 배포 대상인지 확인한다.
2. DSH_HOME(미지정 시 기본 `~/.dsh`)과 대상 `desktop` 프로필을 확인한다. 설치 스크립트는 이미 존재하는 프로필만 허용한다.
3. 현재 Studio의 정확한 버전과 이전 설치 패키지를 기록한다. 앱을 완전히 종료한 뒤 프로필 전체를 별도 경로에 백업한다. `studio-data`만이 아니라 설정·의존성 정보·세션 등 복구에 필요한 데이터를 포함한다. 백업에는 자격 증명이 있을 수 있으므로 Git에 넣지 않는다.
4. 현재 대화가 Desktop 앱에 붙어 있으면 앱 종료와 함께 연결이 끊어진다. 에이전트가 임의 종료하지 말고 별도 터미널 실행을 사용자에게 안내한다.

```sh
# 앱 종료·백업·설치 승인을 확인한 뒤 실행
npm --prefix studio run dev:desktop
# 다른 명시적 사용자 프로필 (동일하게 승인 필요)
npm --prefix studio run dev -- --profile <이름>
```

테스트·빌드 → 패키징 → 실제 프로필 설치이며 앱은 자동 실행하지 않는다. macOS에서만 실행 중 앱을 자동 감지한다. 모든 OS에서 사용자가 종료 여부를 확인해야 한다. `--force`는 보호를 우회하므로 기본 절차나 에이전트의 자동 재시도에 사용하지 않는다. 데이터 삭제를 하지 않는 설치 방식이지만 데이터 유지 성공은 별도로 확인해야 한다.

### 설치 후

- 앱을 다시 열고 Studio 버전·로딩 오류를 확인한다.
- 기존 프리셋·설정·세션이 유지되는지 확인한다.
- 위 브라우저 기능 체크리스트를 Desktop에서도 수행한다.
- 실제 Fresh/Fork 실행·정책 적용은 별도 결과로 기록한다.
- 앱 재시작 후 저장 상태와 기존 자식 재개를 확인한다.
- 설치 터미널 출력, 앱에서 제공하는 로그/개발자 도구의 오류를 수집하되 실제 로그 위치는 해당 버전에서 확인한다. 토큰·자격 증명은 공유하지 않는다.

### 실패 시 복구

앱을 종료하고 원인을 기록한다. 이전에 검증한 **정확한 버전 또는 보존한 tarball**로 재설치한다. `@latest`는 복구 버전이 아니다.

```sh
dsh plugin --profile desktop add @matamt-dbg/dsh-studio@<이전에-검증한-정확한-버전>
```

동일한 DSH_HOME과 대상 CLI를 사용한다. 패키지 다운그레이드는 데이터 롤백이 아니다. 새 형식을 이전 버전이 읽지 못하면 사용자 승인 하에 백업으로 복원한다. 자동 삭제·덮어쓰기나 DSH 자체 다운그레이드는 하지 않는다.

## 6. 업그레이드 검사와 결과 보고

신규 설치와 `0.5 → 0.6` 같은 업데이트 검사는 별개다. 업데이트를 검증하려면 **격리 프로필**에 이전 Studio를 설치하고 대표 프리셋·설정·세션을 만든 뒤 백업한다. 동일 DSH에서 후보 tarball로 교체해 데이터·적용 상태·재시작·재개를 확인한다. 사용자 데이터를 무단 복사하지 않는다.

결과는 `studio/docs/verification/`에 한국어로 기록한다.

- 소스 커밋/미커밋 변경, OS·Node·런타임 정확한 버전/출처
- 패키지 경로·해시, 격리 home/profile, 포트(토큰 제외)
- 실행 명령과 종료 결과, 빌드·단위·설치·RPC·UI·실제 실행·업그레이드 각각의 상태
- 실패한 준비 단계와 해결 방법, 설치 경고 및 미검증 항목
- 서버 종료·job 회수, 변경 파일, 사용자 프로필 변경 여부

검증 완료가 커밋·병합·게시 승인인 것은 아니다.

## 새 기능 연결

- `src/shell.tsx`: 패널·사이드바 등록과 Remote 서술자 합성. 기능 로직은 기능 모듈에 둔다.
- `src/service-layout.tsx`, `src/detail-layout.tsx`: 서비스 목록·선택·마운트·레이아웃.
- `src/ui.tsx`, `src/ui-host.tsx`, `src/ui-styles.ts`: 공용 UI.
- `packages/shell`: 공개 패키지와 번들 패치.

Remote contribution은 패키지당 하나이므로 기능별 서술자를 셸의 한 번의 `$mount`에 합친다. 서비스는 `local.dsh-studio.services`에 등록하고 슬롯의 active 상태로 비활성 화면의 부수 효과를 제어한다. UI 문구는 ko·en·zh를 제공하고 [디자인 시스템](docs/development/design-system.md)을 따른다.
