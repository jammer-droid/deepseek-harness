# Studio 빌드와 Web·Desktop 검증

제품은 **수정하지 않은 DSH에 설치하는 Studio 플러그인**이다. 아래의 Desktop 빌드는 DSH 앱 본체 빌드가 아니라 Studio를 빌드해 설치된 앱에서 확인하는 절차다. 코어·루트 의존성·lockfile을 자동 수정하거나 전체 DSH를 빌드하지 않는다.

에이전트는 저장소 루트에서 `/studio-build`를 호출한다. 기본은 빌드·테스트이며, `web`, `matrix`, `desktop` 중 원하는 범위를 함께 요청한다. [저장소 스킬](../.agents/skills/studio-build/SKILL.md)은 빌드·Desktop은 이 문서를, 격리 설치 검증(`web`, `matrix`)은 [E2E 지침](scripts/agents/README.md)을 실행 절차의 기준으로 사용한다. 스킬이 발견되지 않으면 해당 파일을 직접 읽도록 요청한다. 현재 세션의 자동 갱신은 보장하지 않는다.

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

## 3. 개발용 Web 실행

```sh
npm --prefix studio run dev
# 포트 변경
npm --prefix studio run dev -- --port 19389
# 설치된 다른 순정 CLI 지정
STUDIO_DSH_BIN=/absolute/path/to/dsh npm --prefix studio run dev
```

`dev`는 테스트 → 패키징 → tarball 설치 → Web 실행 순서다. `studio/.dsh-home`의 `lean-agent-web` 프로필을 사용하며 기존 Desktop 프로필은 바꾸지 않는다. 이 프로필은 재실행 때 재사용되는 개발 루프용이다. 로컬 소스 오버레이가 아니며, 이 실행은 독립 설치 검증이 아니다.

- 터미널의 `http://127.0.0.1:<port>/?token=...` 전체 주소로 접속한다. 인증 토큰을 문서·Git·공유 로그에 넣지 않는다.
- 기본 포트는 19388이다. 다른 서버가 사용 중이면 종료시키지 말고 다른 포트를 선택한다.
- `--skip-test`는 단위 테스트를 생략하지만 타입 검사·빌드는 수행한다. 생략 사실을 결과에 남긴다.
- `npm --prefix studio run web`도 타입 검사·빌드 후 실행하며 단위 테스트는 생략한다.
- 코드 변경 후 서버 종료 → 같은 명령 재실행 → 브라우저 새로고침. `watch`는 번들 빌드 감시이며 설치된 패키지를 자동 교체하지 않는다. HMR을 가정하지 않는다.
- 사람이 실행했다면 Ctrl+C로 종료한다. 에이전트는 관리형 background job ID를 기록하고 결과를 회수한 뒤 자신이 시작한 서버만 종료한다.
- Desktop 인증·세션·모델 설정을 자동 복사하지 않는다. 외부 모델 실행은 비용·자격 증명 범위를 별도로 확인한다.

## 4. 격리 설치 검증

수정하지 않은 DSH에 패키징한 Studio를 새 격리 home/profile로 설치해 확인하는 검증(Web RPC 검사, 브라우저 기능 확인, 지원 버전별 matrix, 업그레이드 검사, 배포 후 확인)은 [에이전트 E2E 검증 지침](scripts/agents/README.md)이 소유한다. 격리 서버는 `node studio/scripts/e2e/server.mjs up`으로 띄우며, 위의 `dev` 프로필로 대신하지 않는다.

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
- [브라우저 기능 확인](scripts/agents/README.md#브라우저-기능-확인) 체크리스트를 Desktop에서도 수행한다.
- 실제 Fresh/Fork 실행·정책 적용은 별도 결과로 기록한다.
- 앱 재시작 후 저장 상태와 기존 자식 재개를 확인한다.
- 설치 터미널 출력, 앱에서 제공하는 로그/개발자 도구의 오류를 수집하되 실제 로그 위치는 해당 버전에서 확인한다. 토큰·자격 증명은 공유하지 않는다.

### 실패 시 복구

앱을 종료하고 원인을 기록한다. 이전에 검증한 **정확한 버전 또는 보존한 tarball**로 재설치한다. `@latest`는 복구 버전이 아니다.

```sh
dsh plugin --profile desktop add @matamt-dbg/dsh-studio@<이전에-검증한-정확한-버전>
```

동일한 DSH_HOME과 대상 CLI를 사용한다. 패키지 다운그레이드는 데이터 롤백이 아니다. 새 형식을 이전 버전이 읽지 못하면 사용자 승인 하에 백업으로 복원한다. 자동 삭제·덮어쓰기나 DSH 자체 다운그레이드는 하지 않는다.

## 6. 결과 보고

결과는 `studio/docs/verification/`에 한국어로 기록한다. 격리 설치·E2E 결과의 형식은 [E2E 지침의 보고](scripts/agents/README.md#보고)를 따른다.

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
