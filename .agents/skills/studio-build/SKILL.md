---
name: studio-build
description: Studio를 빌드하고 격리 Web·버전별 호환성 또는 승인된 Desktop 환경에서 검증합니다.
disable-model-invocation: true
---

# Studio 빌드·검증

이 스킬은 Studio 플러그인을 검증한다. DSH 본체 빌드·수정·배포는 하지 않는다.

## 1. 대상과 범위 확정

1. `pwd`, Git 루트·브랜치·상태를 확인한다. 기존 변경을 보존하고 사용자 요청 없이 다른 worktree의 변경을 병합하지 않는다.
2. 해당 checkout의 `AGENTS.md`, `studio/AGENTS.md`, `studio/development.ko.md`를 읽는다. web·matrix 모드는 `studio/scripts/agents/README.md`(에이전트 E2E 검증 지침)도 읽는다. 경로는 이 스킬 파일 위치가 아니라 선택한 저장소 루트를 기준으로 한다.
3. 사용자 인자로 검증 모드를 선택한다. 지정하지 않으면 **build**다. 계획과 미검증으로 남을 범위를 먼저 알린다.

| 모드 | 수행 범위 |
| --- | --- |
| build | Studio 타입 검사·빌드·단위 테스트. 설치·서버 없음 |
| web | build 후 E2E 격리 서버에 설치·smoke·RPC·브라우저 확인 |
| matrix | 한 패키지를 정확한 지원 DSH 버전별 순정 런타임에 설치·검증 |
| desktop | 승인된 실제 Desktop 프로필에 Studio 설치 후 앱 검증 |

`/studio-build desktop`은 Desktop 검증 의도를 나타내지만, 설치 전에 정확한 대상 CLI/앱 버전·home/profile·백업 여부를 사용자와 확인한다. 기본 호출, Web 요청, 일반적인 빌드 요청은 사용자 프로필 변경 승인이 아니다. 앱 종료로 현재 대화가 끊어질 수 있으면 사람이 별도 터미널에서 수행하도록 안내한다.

## 2. 준비와 실행

- 의존성과 공개 타입 준비물이 없으면 정확한 누락 항목을 보고한다. 루트 install·lockfile 변경·코어 전체 빌드로 우회하지 않는다.
- build: `npm --prefix studio test`를 실행한다. 이는 타입 검사·빌드를 포함한다. 실패하면 설치 단계로 넘어가지 않는다.
- web: E2E 지침의 [격리 서버](../../../studio/scripts/agents/README.md#격리-서버)대로 `node studio/scripts/e2e/server.mjs up`을 실행한다(build 직후면 `--skip-build`). 결과 JSON의 home/profile/포트/패키지 해시를 기록한다. 이어서 `smoke.mjs`, [Web RPC 검사](../../../studio/scripts/agents/README.md#web-rpc-검사-l0), 요청 범위의 [브라우저 기능 확인](../../../studio/scripts/agents/README.md#브라우저-기능-확인)을 실행하고 `server.mjs down`으로 끝낸다. RPC 검사는 데이터를 바꾸므로 이 격리 서버에만 실행하고 사용자의 현재 GUI를 대상으로 삼지 않는다. 토큰을 결과 문서에 남기지 않는다. `npm --prefix studio run dev`의 재사용 프로필은 개발 루프용이며 이 검증을 대신하지 않는다.
- matrix: E2E 지침의 [지원 버전별 검증](../../../studio/scripts/agents/README.md#지원-버전별-검증-matrix)을 따른다. manifest의 지원 버전 목록을 읽고 같은 tarball·해시를 버전별 `STUDIO_DSH_BIN`과 별도 프로필로 검사한다. 개발 workspace 타입 검사로 독립 설치를 대신하지 않는다.
- desktop: 개발 문서 5절의 앱 종료·백업·설치 승인 절차를 완료한 뒤 `dev:desktop`을 사용한다. `--force` 자동 사용 금지. 복구는 정확한 이전 호환 버전이며 `@latest`로 대체하지 않는다.

## 3. 관찰과 종료

브라우저 검사는 E2E 지침의 `browser.mjs` 하네스와 기능 확인 목록을 따른다. 도구가 없으면 UI를 미검증으로 남긴다. RPC 통과를 화면 정상, 역할 저장을 실제 persona/Tool Filter 적용, 신규 설치를 기존 데이터 업그레이드 성공으로 표현하지 않는다. 모델 호출·실제 Fresh/Fork 실행은 사용자가 승인한 환경에서 별도 검증한다.

시작한 job ID를 모두 기록하고 필요한 결과를 회수한다. 사용자가 계속 열어두라고 요청하지 않았다면 자신이 시작한 서버를 종료하고 종료 결과를 확인한다. 포트를 비우려고 다른 프로세스를 죽이지 않는다.

## 4. 완료 보고

필요한 상세 증거는 `studio/docs/verification/`에 한국어로 남긴다. 최종 보고에는 다음을 구분한다.

- 선택 모드, 소스 커밋과 변경 상태, 런타임·패키지 해시
- 빌드/단위/설치/RPC/UI/실제 역할 실행/업그레이드의 통과·실패·미검증
- 설치 경고, 준비 실패와 해결, 프로필 변경 여부
- 서버 정리, 변경 파일, 남은 최소 검사

코드 수정이 필요해지면 검증 실패를 먼저 보고하고 사용자 승인 범위를 확인한다. 검증 요청만으로 제품을 고치거나 커밋·병합·배포하지 않는다.
