# 에이전트 E2E 검증 지침

이 디렉터리에는 에이전트가 새 세션에서 받아 실행하는 지침서를 둔다. 아래 [디렉터리와 파일 규칙](#디렉터리와-파일-규칙)을 따른다. 사용자가 "`<파일>`을 읽고 진행해"라고 지시하면 에이전트는 그 문서만으로 검증을 끝내고 보고한다. 이전 대화는 필요 없다.

## 디렉터리와 파일 규칙

이 디렉터리의 문서는 모두 **에이전트가 새 세션에서 받아 실행하는 지침서**다. 사람용 설명·결과 기록은 두지 않는다(결과는 `studio/docs/verification/`, 설계는 `studio/docs/`).

```text
scripts/agents/
├── README.md            이 지침(공통 규칙·방법의 유일한 기준)
├── TEMPLATE-e2e.md      지침서 템플릿
├── issues/              이슈 완료 검증    <이슈 번호>-<주제>.md
├── releases/            배포 검증         <버전>.md, <버전>-<보조 이름>.md
├── checks/              다시 쓰는 점검    <주제>.md
├── tasks/               검증이 아닌 작업  <주제>.md
├── tools/               지침서가 부르는 읽기 전용 보조 스크립트
└── archive/             실행이 끝나 다시 쓰지 않는 지침서 (issues/, releases/ 같은 구조)
```

| 위치 | 언제 | 이름 | 예 |
| --- | --- | --- | --- |
| `issues/` | 한 이슈의 완료를 확인한다. 이슈가 끝나면 `archive/issues/`로 옮긴다 | `<이슈 번호>-<주제>.md` | `33-session-role-spawn.md` |
| `releases/` | 한 배포 후보를 확인한다([마무리·배포 절차 5단계](../../docs/release-workflow.md#5-배포-e2e)). 배포가 끝나면 `archive/releases/`로 옮긴다 | `<버전>.md`, 이어하기·재실행은 `<버전>-<보조 이름>.md` | `0.6.2.md`, `0.6.1-continue.md` |
| `checks/` | 이슈·배포와 무관하게 여러 번 다시 돌리는 점검(호환성, 비용 비교, 동작 확인) | `<주제>.md` | `subagent-tool-filter.md` |
| `tasks/` | 에이전트가 수행하는 작업 절차(번역 진행 등). 제품을 고칠 수 있으므로 범위·커밋 규칙을 문서 안에 적는다 | `<주제>.md` | `dsh-ko-sequential.md` |
| `tools/` | 지침서에서 실행하는 보조 스크립트. 읽기만 하고 아무것도 쓰지 않는다. 하네스(서버·브라우저·대기)는 [scripts/e2e/](../e2e/)에 둔다 | `<주제>.mjs` | `subagent-report.mjs` |
| `archive/` | 실행이 끝난 지침서. 결론은 이슈 명세나 `docs/verification/`에 있어야 한다. 고치지 않고, 다시 쓸 때는 새 지침서를 만든다 | 원래 이름 그대로 | `archive/releases/0.6.1.md` |

규칙:

- 이름은 소문자·숫자·`-`만 쓰고, 위치가 종류를 말하므로 `-e2e`, `-check`, `release-` 같은 접미사·접두사를 붙이지 않는다.
- 새 지침서는 [템플릿](TEMPLATE-e2e.md)을 복사해 쓰고, 아래 [목록](#목록)에 한 줄을 더한다. `archive/`로 옮기면 목록의 위치를 고친다.
- 지침서가 이슈 명세·다른 지침서를 링크하면 옮길 때 링크를 함께 고친다. 다른 문서가 지침서를 링크할 때는 `scripts/agents/<위치>/<이름>` 경로를 쓴다.
- 한 번만 쓰는 지침서에 사용자 프로필 경로(`~/.dsh/profiles/...`)나 개인 게이트·스크립트를 전제로 넣지 않는다. 격리 서버([격리 서버](#격리-서버))로 재현할 수 있게 쓴다.
- 산출물은 `studio/dist/e2e/<이슈 번호 또는 버전>/`(Git 제외)에 둔다. 결론으로 남길 기록은 메인 세션이 `studio/docs/verification/`이나 이슈 명세에 옮긴다.

## 지침서에 들어갈 것

1. **범위:** 쓰는 위치, 바꾸지 않을 파일·프로필, 외부로 전송되는 내용. 검증자는 제품을 고치지 않고 후보와 기록만 남긴다.
2. **시작 확인:** 대상 커밋·런타임 버전, 필요한 도구, 단계별 실행 조건. 조건이 안 되면 그 단계는 `대기`로 남긴다.
3. **단계:** 각 단계의 명령, 기준선(알려진 기대값), 완료 기준, 판정 단계(아래 L0–L2)와 올림 조건. 명세의 판정 질문과 calibration은 실제 데이터로 정한다.
4. **보고 양식:** `통과 / 실패 / 발견 / 대기 / 미실행 / 환경 차단`과 판정 단계. workspace 테스트, 설치 검증, 실제 모델 실행은 서로 대신하지 않는다.

이미 다른 문서에 있는 절차(배포 절차의 문체 교정 등)는 옮겨 적지 않고 링크한다. 이 문서는 격리 설치 검증(서버, RPC, 브라우저, matrix, 업그레이드, 배포 후 확인)의 유일한 기준이다.

## 기본 흐름

이슈 완료 검증과 배포 검증의 E2E는 이 흐름을 따른다. 각 단계의 세부는 아래 절에 있다.

1. **지침서 작성(메인 세션):** [템플릿](TEMPLATE-e2e.md)을 복사해 이 이슈에서 확인할 것, L0 시나리오, L1 명세, 올림 조건만 채운다. 새 L0 시나리오는 `studio/scripts/e2e/`에 쓴다. 화면은 [browser.mjs](../e2e/browser.mjs)의 `app.step()`, 에이전트 제어(역할 자식·Tool Filter·persona·상속·게이트)는 [에이전트 제어 시나리오 가이드](../e2e/agent-scenarios.md)의 `runAgent()`로 쓴다.
2. **실행(새 세션 검증자):** 사용자가 "`<지침서>`를 읽고 진행해"라고 지시한다. 검증자는 제품을 고치지 않는다.
3. **서버:** `node studio/scripts/e2e/server.mjs up`. 에이전트 제어를 각본으로 확인할 때는 `--mock-llm`(토큰 0)을 붙인다. 구독 모델·Jev·DeepSeek 키가 필요한 검증은 `--with-desktop-plugins --with-secrets keys,subscriptions`를 붙인다(아래 [격리 서버](#격리-서버)의 토큰 갱신 주의).
4. **L0:** `smoke.mjs`부터 실행하고, 이어서 기능 시나리오와 필요한 RPC 검사를 실행한다.
5. **L1:** L0 요약에 `repair.items`가 있으면 [셀렉터 복구](../e2e/selector-repair.md)를 실행하고 L0을 다시 실행한다. 코드로 판정할 수 없는 항목은 `judge`·`pixie_loop`으로 판정한다. 실모델·루프·게이트 완료는 `wait.mjs`로 기다린다.
6. **L2:** L1에서도 판정되지 않은 항목만 검증자가 원문을 보고 판단하고, 결함 후보로 보고한다.
7. **정리와 보고:** `server.mjs down`(`portFree: true` 확인) 후 템플릿 보고 양식으로 낸다. 비밀값을 복사했다면 `--with-secrets` 사용 여부와 경고를 적는다.
8. **사람 확인:** 사용자가 확인을 원하면 서버를 내리지 않고 인증 URL을 사용자에게만 전달한다. 최종 화면 확인은 사람이 실제 Desktop·Web에서 한다.

## 판정 단계

검증자의 모든 행동은 토큰이다. 판정은 가장 싼 단계에서 끝내고, 그 단계에서 판정할 수 없을 때만 다음 단계로 올린다.

| 단계 | 담당 | 대상 | 검증자 컨텍스트에 들어오는 것 |
| --- | --- | --- | --- |
| **L0** | 스크립트(Playwright, Web RPC, 로그·파일 파싱) | 결과가 정해진 검사: 요소 존재, 저장 후 값 유지, 콘솔·pageerror 0건, RPC 기대값, 도구 호출 여부·횟수, 자리표시자 노출 | 통과·실패 요약 |
| **L1** | `judge` / `pixie_loop` | 코드로 판정할 수 없거나 실행해서 찾아야 하는 것: 셀렉터 복구(`act`), 화면 문구 품질, 문서 주장 대조, 실모델 응답이 지시를 따랐는지, 실패 원인 분류(`route`) | 통과 수와 escalated·error 항목 |
| **L2** | 검증자(메인 에이전트) | L1의 escalated, 제품 결함으로 분류된 실패, 단계 규칙으로 정할 수 없는 판단 | 해당 항목 원문 |

### 단계 고르기

1. 결과를 코드로 판정할 수 있으면 L0이다. 확률 판정으로 바꾸지 않는다.
2. 판정 항목이 한두 개면 `judge`를 직접 쓴다. 같은 기준으로 판정할 항목이 여럿이면 `pixie_loop`을 쓴다.
   - `pixie_loop` 명세를 새로 쓰거나 고치기 전에 `studio-pixie-loop-guide` 스킬을 불러온다(`skill` 도구). 원본은 [SKILL.md](../../release/docs/appendix/studio-pixie-loop-guide/SKILL.md)와 상세 계약·예시 [pixie-loop.md](../../release/docs/appendix/pixie-loop.md)다. 적합성 판단, `codeChecks`·calibration 작성, `act`·`episode`·`select`, 실행 뒤 escalated·error 처리 규칙이 들어 있다.
   - 이미 검증된 명세(예: [L1 셀렉터 복구](../e2e/selector-repair.md))를 그대로 쓸 때는 스킬을 다시 읽지 않아도 된다.
3. 실패했을 때 다시 만들어 볼 것이 있으면(셀렉터·문구 후보) retry, 없으면 판정만 한다(`maxAttempts: 1` 또는 `route`).
4. 상태를 바꾸는 행동(저장·삭제·설치)은 L0에서만 실행한다. `act`는 재시도마다 다시 실행되므로 반복해도 안전한 읽기·탐침만 넣는다.

### 올림 규칙

- 지침서에 단계별 올림 조건을 미리 적는다. 예: "L0 셀렉터 없음 → L1 셀렉터 복구 루프", "L1 escalated → L2". 검증자가 즉석에서 단계를 바꾸지 않는다.
- L1 복구 결과(예: 새 셀렉터)는 L0 스크립트로 다시 실행해 확인한다. L1 통과만으로 원래 검사를 통과로 적지 않는다.
- L1의 error(제공자 403, 결정 엔진 오류, 한도 중단)는 `환경 차단`이다. L2가 대신 판정해 통과로 바꾸지 않는다.
- L2가 escalated 항목을 직접 고치거나 통과로 바꾸지 않는다. 결함 후보로 보고한다.
- L1에는 항상 토큰·시간 한도를 둔다. 기준값을 낮춰 통과시키지 않는다.

### 기다리기

외부 프로그램(서버 기동, 스크립트, 실모델 세션)의 결과를 검증자가 반복 확인하지 않는다.

- 완료 조건은 스크립트가 내부에서 확인하고 최대 시간이 지나면 `시간 초과`로 끝낸다. 검증자는 한 번 실행하고 최종 결과만 읽는다.
- 오래 걸리는 실행은 관리형 background job으로 띄우고 완료 알림을 기다린다. 고정 `sleep` 뒤 재확인을 반복하지 않는다.
- 실모델 세션·Pixie 루프·게이트의 완료는 [wait.mjs](../e2e/wait.mjs)로 기다린다. 한 번 호출하면 요약 하나를 낸다. 메시지·게이트 원문·루프 출력은 출력하지 않는다.
  - exit 0은 **끝났다**는 뜻이지 성공이 아니다. 루프의 `error`·`stopped`·`cancelled`, 게이트의 `error`·`skipped`·`cancelled`도 끝난 상태다. 결과는 `runs[].status`·`counts`, 세션의 `lastEnd`·`toolErrors`로 따로 판정한다. exit 1은 시간 초과(마지막 상태 포함), exit 2는 잘못된 입력(알 수 없는 옵션, 값 누락, 양의 정수가 아닌 `--turns`·`--count`, 숫자가 아닌 `--since`, 잘못된 기간) 또는 `zstd` 없음(환경 차단)이다. 모든 경우 JSON 하나를 출력한다.

  ```sh
  node studio/scripts/e2e/wait.mjs session [--session <id>] [--turns 1] [--timeout 10m]
  node studio/scripts/e2e/wait.mjs loop    [--session <id>] [--count 1] [--since <ms>] [--timeout 10m]
  node studio/scripts/e2e/wait.mjs gate    [--session <id>] [--count 1] [--since <ms>] [--timeout 10m]
  # 공통: [--profile e2e] [--home <dir>] [--interval 3s]
  ```

  `session`은 세션 로그의 종료된 턴 수·열린 턴·도구 호출 수를, `loop`·`gate`는 프로필 `studio-data/pixie`의 실행 기록 상태·항목 수를 읽는다. `--since`(기본: 호출 시각) 이후 시작한 실행만 센다. 이미 시작한 루프·게이트를 기다리면 시작 전에 `date +%s000`으로 잰 epoch ms를 `--since`로 준다. `--turns`는 세션의 **누적** 종료 턴 수다. 세션 id를 모르면 가장 최근 파일을 읽으므로, 여러 세션이 있으면 `--session`을 준다.
- 긴 출력은 spill 정책에 맡기고, 스크립트는 요약을 먼저 출력한다.

### 보고

결과 표의 항목마다 판정 단계(`L0 / L1 / L2`)를 적는다. L1 판정에는 job id와 통과·escalated·error 수를 함께 적는다. 스크립트 판정과 결정 엔진의 확률 판정은 신뢰도가 다르므로 섞어 집계하지 않는다.

## 격리 서버

설치·기동·종료는 [server.mjs](../e2e/server.mjs)로 한다. 각 호출은 결과가 정해진 뒤에 JSON 요약 하나만 출력하고 끝난다.

```sh
node studio/scripts/e2e/server.mjs up [--profile e2e] [--home <dir>] [--with-desktop-plugins] [--with-secrets keys,subscriptions] [--mock-llm] [--plugin <spec>] [--archive <tgz>] [--skip-build] [--reuse-profile] [--port N] [--timeout 90s]
node studio/scripts/e2e/server.mjs status [--profile e2e] [--home <dir>]
node studio/scripts/e2e/server.mjs down [--profile e2e] [--home <dir>] [--timeout 20s]
```

exit 0 성공, 1 실패(`step` 포함), 2 잘못된 인자 또는 사용자 home 거부.

- `up`: Studio 빌드·pack(`--archive`가 있으면 생략) → 출하 `web` 템플릿으로 프로필 재생성 → 격리 home에 설치 → 수정하지 않은 `dsh` 기동 → 인증 URL이 응답할 때까지 스크립트 안에서 대기. 출력: `url`, `port`, `pid`, 런타임 `version`, 패키지 이름·`sha256`, 설치 목록, peer 경고, 로그 경로.
- 격리 home은 기본 `studio/dist/e2e/home`(Git 제외)이며 회차 사이에 유지한다. 프로필은 매번 새로 만든다(`--reuse-profile`로 유지). `~/.dsh`와 그 아래(심볼릭 링크 포함)는 home으로 쓸 수 없다.
- **home·프로필 맞추기:** `browser.mjs`·`agent.mjs`는 `server.mjs`가 남긴 `<home>/e2e-runs/<profile>/state.json`을 읽고, `wait.mjs`는 같은 home·프로필의 세션 로그와 `studio-data`를 직접 읽는다. `--home`·`--profile` 인자는 그 명령 한 번에만 적용되므로, 기본값이 아닌 home·프로필을 쓸 때는 **모든 단계 전에 환경 변수로** 맞춘다: `export STUDIO_E2E_HOME=<절대 경로> STUDIO_E2E_PROFILE=<이름>`. `server.mjs`·`browser.mjs`·`agent.mjs`·`wait.mjs` 모두 이 두 변수를 읽는다(인자가 있으면 인자 우선). 기본값이 아닌 home은 승인된 Git 제외 경로만 쓴다.
- `--with-desktop-plugins`: Desktop 프로필 `package.json`을 **읽기만** 해서 Studio를 뺀 플러그인(구독 플러그인 등)을 같은 버전으로 설치한다. 이 옵션만으로는 토큰·자격 증명을 복사하지 않는다.
- `--with-secrets keys,subscriptions`: `up`마다 `~/.dsh`에서 격리 home으로 복사한다(0600). 출력에는 이름·계정 수·만료까지 남은 분만 나온다. `down`은 복사본·세션·로그를 지우지 않는다. 한 번 복사한 비밀값은 다음 `up`에서 옵션을 빼도 그 home에 남는다. 지우려면 `<home>/.credentials.yaml`, `<home>/plugins/subscriptions/auth.json`을 직접 삭제한다.
  - `keys`: `.credentials.yaml`의 `refs`(API 키 참조)만. 기기·브라우저 연결 grant는 복사하지 않는다.
  - `subscriptions`: 구독 플러그인 OAuth 저장소 `plugins/subscriptions/auth.json`.
  - **주의:** 격리 환경에서 토큰이 갱신되면 갱신된 토큰은 격리 home에만 저장된다. 공급자가 갱신 토큰을 한 번만 쓰게 하면 사용자 Desktop의 로그인이 끊길 수 있다. 접근 토큰 만료가 120분 안이면 `secrets.warning`이 나온다. 경고가 있으면 실모델 실행 전에 Desktop에서 먼저 사용해 갱신하거나 진행 여부를 사용자에게 묻는다. 갱신이 일어나는 경우는 아직 시험하지 않았다(2026-10-17: 복사·화면 표시·사용량 조회만 확인, 갱신 미발생, Desktop 파일 불변).
- 포트는 지정하지 않으면 19410–19499에서 빈 곳을 고른다. 다른 서버를 종료하지 않는다.
- `--mock-llm`: 각본 목 모델([mock-llm.mjs](../e2e/mock-llm.mjs))을 함께 띄우고 DeepSeek 제공자를 그쪽으로 돌린다. 요청은 `<home>/e2e-runs/<profile>/mock-llm.jsonl`에 남는다. 사용법은 [에이전트 제어 시나리오 가이드](../e2e/agent-scenarios.md).
- `down`은 상태 파일에 기록된 프로세스가 **같은 pid·같은 시작 시각**일 때만(이 스크립트가 띄운 그 프로세스일 때만) 종료하고 포트가 비었는지 확인한다. 시작 시각이 기록되지 않은 옛 상태 파일도 소유를 증명할 수 없으므로 신호를 보내지 않는다(수동 확인). 서버 pid가 다른 프로그램으로 바뀌었으면 서버에는 신호를 보내지 않고, 목 모델은 자기 기록으로 따로 확인해 종료한 뒤(`mockStopped`) 낡은 상태 파일을 지우고 `ok: false`를 낸다. `status`의 `running`도 같은 기준이다.
- 인증 URL은 `up` 출력, 상태 파일(0600), 서버 로그 `<home>/e2e-runs/<profile>/server.log`(0600)에 있다. 보고서·문서·Git에 옮기지 않고, 로그를 공유할 때는 `token=` 값을 지운다.
- 환경 변수: `STUDIO_DSH_BIN`(기본 `dsh`, 다른 순정 CLI 지정), `STUDIO_E2E_HOME`, `DSH_HOME_USER`(보호할 사용자 home, 기본 `~/.dsh`; `~/.dsh`는 항상 보호).

`up` 실패(`ok: false`)는 `step`으로 대처한다. 제품 소스·코어·사용자 프로필을 고쳐 통과시키지 않는다.

| `step` | 뜻 | 대처 |
| --- | --- | --- |
| (없음) `already has a running server` | 같은 home·프로필에 이 스크립트의 서버가 떠 있음 | `status`로 확인하고, 이 검증에서 띄운 서버면 `down` 후 다시 `up` |
| `runtime` | `dsh --version`이 지원 목록 밖 | `version`·`supported`를 기록. 다른 순정 CLI가 있으면 `STUDIO_DSH_BIN`, 없으면 설치 검증 `대기` |
| `build` / `pack` | 빌드·패키징 실패 | 출력 기록, `환경 차단` 또는 `실패`. 검증자는 소스를 고치지 않는다 |
| `port` | 빈 포트 없음·지정 포트 사용 중 | 다른 `--port`. 다른 서버를 종료하지 않는다 |
| `profile` / `install` / `plugins` | 프로필 생성·플러그인 설치 실패, Desktop 매니페스트 없음 | 출력 기록. `--with-desktop-plugins` 없이 다시 시도할지는 지침서 범위를 따른다 |
| `secrets` | 복사 원본 없음 | 해당 기능을 `환경 차단`으로 적는다. 대신 로그인·키 입력을 하지 않는다 |
| `mock-llm` | 목 모델 기동 실패 | `<home>/e2e-runs/<profile>/mock-llm.log` 기록 |
| `start` | 서버 종료 또는 시간 내 미응답 | 출력(토큰 가림)과 `server.log` 확인, `--timeout`을 늘려 한 번 재시도 |
- 설치·기동 성공은 Client 플러그인 활성화나 화면 동작을 뜻하지 않는다. 그 확인은 L0 브라우저 검사의 몫이다.

## 브라우저 검사 (L0)

화면 검사는 [browser.mjs](../e2e/browser.mjs)의 `run()` 위에 시나리오만 쓴다. Playwright 경로 탐색, 인증 URL 접속, 첫 실행 안내 닫기, 테마·폭별 컨텍스트, pageerror·플러그인 활성화 실패 수집, 스크린샷 저장은 하네스가 한다.

**사전 조건:** Playwright 모듈(저장소 `node_modules/.pnpm/playwright@<버전>` 자동 탐색, 또는 `STUDIO_PLAYWRIGHT=<.../playwright/index.mjs 파일 경로>`), 브라우저(설치된 Chrome 우선, 없으면 Playwright 번들 Chromium), 에이전트 제어·`wait.mjs`에는 PATH의 `zstd`. 없으면 해당 단계는 `환경 차단`이다. 저장소·사용자 환경에 자동 설치하지 않는다.

```js
import { run } from '../e2e/browser.mjs';
await run({ name: 'pixie-tab', views: ['light', 'dark', 'light@480'] }, async app => {
  await app.check('Pixie 탭 열림', () => app.page.getByRole('button', { name: 'Pixie' }).click());
  await app.shot('pixie');
});
```

- URL은 `server.mjs up`이 남긴 상태 파일에서 읽는다(`profile`·`url` 옵션이나 `STUDIO_E2E_URL`로 지정 가능). 토큰은 출력하지 않는다.
- `views`: `light`, `dark`, `light@480`, `dark@1280x720`. 뷰마다 새 브라우저 컨텍스트에서 처음부터 실행한다.
- `app.check(name, fn)`: `fn`이 던지거나 `false`를 반환하면 실패로 기록하고, 그 밖에는 통과다. 자체는 던지지 않고 통과 여부를 반환한다. 반드시 `await`한다. 조건은 `app.assert(조건, 메시지)`로 쓴다.
- `app.step(name, selector, { action, goal })`: 셀렉터 하나에 묶인 검사. `action`은 `'visible'`(기본)·`'click'`·`locator => Promise`. 통과 여부를 반환한다. `goal`은 실패 시 L1 복구 지시문이 되므로 요소를 말로 정확히 적는다.
- `app.locator(selector)`: L1 복구(`repairs.json`)를 반영한 locator. `app.page.getByRole(...)` 등으로 직접 찾은 요소에는 복구가 반영되지 않는다.
- `app.text(locator?)`(보이는 글자), `app.shot(name)`(스크린샷 경로 기록), `app.page`(Playwright Page). 실패한 단계의 기본 대기는 10초(`actionTimeout`), 셸 준비 대기는 30초(`readyTimeout`)다.
- 출력은 JSON 요약 하나다: `ok`, `passed`, `failed`, `failures`(단계·뷰·오류 첫 줄), `pageErrors`, `pluginFailures`, 스크린샷 경로. 실패가 하나라도 있으면 exit 1.
- 스크린샷은 `studio/dist/e2e/shots/<name>/`에 저장하고 경로만 보고한다. `<name>`은 `run({ name })` 값에서 영숫자·`_.-` 밖의 글자를 `-`로 바꾼 것이며, 이름은 ASCII로 짓는다. 판정은 검사로 하며, 검증자가 이미지를 읽는 것은 실패 원인을 볼 때나 사람 확인용 자료를 고를 때뿐이다.
- 기본 확인은 [smoke.mjs](../e2e/smoke.mjs)다(셸 로드, 플러그인 활성화 실패 없음, Studio 진입·패널 열림, 라이트·다크·480px).
- 셀렉터 단계는 `app.step(name, selector, { action, goal })`으로 쓴다. 실패하면 하네스가 실패 시점 DOM과 접근성 스냅샷을 남기고 요약에 `repair.items`를 낸다. 그 항목은 [L1 셀렉터 복구](../e2e/selector-repair.md) 명세로 `pixie_loop`에 넘기고, `apply-repairs.mjs`로 적용해 L0을 다시 실행한다. 검증자가 스냅샷·스크린샷을 직접 읽어 셀렉터를 고치지 않는다.

## Web RPC 검사 (L0)

[통합 검사](../check-web-runtime.mjs)는 다음 네 스크립트를 순차 실행하고 첫 실패에서 멈춘다. **프로필을 수정한다**(Master 확장 임시 변경, 테스트 프리셋·세션 생성). 프리셋은 정상 종료 시 정리하지만 세션은 남을 수 있다. `server.mjs up`으로 띄운 격리 서버에만 실행하고 사용자의 현재 GUI나 Desktop을 대상으로 삼지 않는다. 환경 변수는 확인 표시일 뿐 격리를 증명하지 않는다.

```sh
STUDIO_TEST_ISOLATED=1 STUDIO_TEST_PORT=<port> node studio/scripts/check-web-runtime.mjs '<인증 URL>'
```

| 스크립트 | 검사 |
| --- | --- |
| [Master](../check-master-runtime.mjs) | 읽기 전용 보호·파생 프리뷰·설정 override·확장 추가/원복 |
| [Optimized](../check-optimized-runtime.mjs) | 순서·삭제 보호·복사 적용·기본 catalog |
| [세션 역할](../check-session-roles-runtime.mjs) | 실제 세션 생성·역할 편집/추가·프리셋 불변·세션 격리 |
| [역할](../check-role-runtime.mjs) | 저장·재적용·해제·복원·모델 catalog |

이 검사는 브라우저, 모델 호출, Fresh/Fork 자식 실행을 검사하지 않는다. runtime별 tool 수 차이와 peer/native dependency 경고도 기록한다. 기동 성공으로 subprocess·PTY 정상 동작을 추정하지 않는다.

## 브라우저 기능 확인

배포 검증이나 기능 전반을 확인할 때 다음을 L0 시나리오 또는 사람 확인으로 다룬다. 이슈 검증은 그 이슈에서 바뀐 흐름만 고른다.

1. Studio 패널과 프리셋 목록이 표시되고 Client 모듈/Slot 오류가 없다.
2. Master가 읽기 전용이고, Optimized를 복사할 수 있다.
3. 복사본의 도구·프롬프트·설정을 바꾸면 프리뷰에 반영된다.
4. 저장·적용 후 새 세션에서 해당 프리셋을 고를 수 있다.
5. 세션 역할을 바꿔도 원본 프리셋과 다른 세션이 그대로다.
6. 적용 해제·재적용 및 서버 재시작 후 저장 내용이 유지된다.
7. 라이트·다크, 좁은 창, 키보드 포커스와 Host/브라우저 콘솔 오류.
8. 실제 역할 실행이 범위에 포함되면 Fresh/Fork 각각 persona, 금지 도구 노출·실행 제한, 부모 대화 상속, 재시작 후 재개를 따로 확인한다(`runAgent()`, `--mock-llm`). 설정 저장 성공으로 대신하지 않는다.

## 지원 버전별 검증 (matrix)

지원 범위의 기준은 [배포 manifest](../../packages/shell/package.json)의 peerDependencies이며, 개발 스크립트의 허용 목록과 일치해야 한다. [구버전 Web 기록](../../docs/verification/older-dsh-web.md), [rc.1 기록](../../docs/verification/dsh-0.2.1-rc.1.md)은 과거 증거이며 새 소스의 성공을 대신하지 않는다.

1. Studio를 한 번 패키징하고 SHA256을 기록한다. 런타임별로 다시 빌드하지 않는다.
2. 각 정확한 DSH 버전의 배포 CLI를 확보하고 `--version`을 확인한다. npm으로 받을 때는 `npm install --prefix studio/dist/matrix/<버전>/runtime --no-audit --no-fund @deepseek-ai/dsh@<정확한 버전>`처럼 격리한다. 의존성 install script 승인을 자동 우회하지 않는다.
3. 버전마다 다른 프로필로 같은 tarball을 설치해 띄운다.

   ```sh
   STUDIO_DSH_BIN=<버전별 dsh 절대 경로> node studio/scripts/e2e/server.mjs up --profile m-<버전 이름> --archive <같은 tgz 절대 경로>
   ```

4. 버전마다 smoke·RPC 검사와 범위에 든 기능 시나리오를 실행하고 `down`한 뒤 다음 버전으로 간다.
5. 버전·패키지 해시·설치 경고·통과·실패·미검증을 표로 기록한다. 하나라도 실패하면 지원 범위를 넓히거나 성공으로 발표하지 않는다.

## 업그레이드 검사

신규 설치와 `0.5 → 0.6` 같은 업데이트는 별개다. 격리 프로필에 이전 Studio를 설치(`up --archive <이전 tgz>`; 공개 버전은 `npm pack @matamt-dbg/dsh-studio@<이전 버전> --pack-destination studio/dist/e2e/packs`로 받는다)하고 대표 프리셋·설정·세션을 만든 뒤, 같은 프로필에 후보 tarball을 설치(`up --reuse-profile --archive <후보 tgz>`)해 데이터·적용 상태·재시작·재개를 확인한다. 사용자 데이터를 복사하지 않는다.

## 배포 후 확인

npm에 올린 버전을 새 격리 프로필에 설치해 확인한다. 레지스트리 반영 확인(`npm view`, `dist.shasum`)은 [배포 가이드](../../docs/release.md#5-공개-후-확인)가 맡는다.

```sh
npm pack @matamt-dbg/dsh-studio@<버전> --pack-destination studio/dist/e2e/packs
node studio/scripts/e2e/server.mjs up --profile published --archive studio/dist/e2e/packs/matamt-dbg-dsh-studio-<버전>.tgz
node studio/scripts/e2e/smoke.mjs --profile published
```

`server.mjs`는 로컬 Studio 패키지를 항상 설치하므로 `--plugin`으로 Studio를 넘기지 않는다. 레지스트리의 tarball을 `--archive`로 준다.

smoke 통과와 함께 프리셋 목록과 Optimized 도구 수(0.6.2부터 27, 그 전은 22)를 확인하고 `down`한다.

## 목록

| 위치 | 문서 | 대상 |
| --- | --- | --- |
| checks | [dsh-role-compat.md](checks/dsh-role-compat.md) | DSH 업데이트 뒤 역할 persona·Tool Filter·자식 정책 복원 호환(rc.1 기준으로 작성) |
| checks | [subagent-tool-filter.md](checks/subagent-tool-filter.md) | 서브에이전트 Tool Filter 동작 |
| checks | [web-search-cost.md](checks/web-search-cost.md) | 웹 검색 provider(기존 Messages 검색 / Search·Fetch API) 비용·품질 비교 |
| tasks | [dsh-ko-sequential.md](tasks/dsh-ko-sequential.md) | DSH 한국어 사전 번역 진행(서브에이전트 번역 + 일괄 판정) |
| tools | [subagent-report.mjs](tools/subagent-report.mjs) | 세션과 그 자식이 실제로 받은 프리셋·도구·지침 보고 |
| archive | [releases/0.6.1.md](archive/releases/0.6.1.md), [0.6.1-continue.md](archive/releases/0.6.1-continue.md), [0.6.1-e3-e4-rerun.md](archive/releases/0.6.1-e3-e4-rerun.md) | Studio 0.6.1 배포 검증(새 배포 지침서의 예시로 참고) |
| archive | [releases/0.6.2.md](archive/releases/0.6.2.md) | Studio 0.6.2 배포 검증(#32·#33·#34) |
| archive | [releases/0.6.3.md](archive/releases/0.6.3.md) | Studio 0.6.3 배포 검증(#38) |
| archive | [issues/34-optimized-worker-tuning.md](archive/issues/34-optimized-worker-tuning.md) | #34 Optimized 튜닝·Worker·편집과 복구 |
| archive | [issues/27-jev-decision-engine.md](archive/issues/27-jev-decision-engine.md) | #27 Jev 결정 엔진 실사용(사용자 Desktop 프로필 전제, 재실행 불가) |
