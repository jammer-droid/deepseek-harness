# 에이전트 E2E 검증 지침

이 디렉터리에는 에이전트가 새 세션에서 받아 실행하는 검증 지침을 둔다. 사용자가 "`<파일>`을 읽고 진행해"라고 지시하면 에이전트는 그 문서만으로 검증을 끝내고 보고한다. 이전 대화는 필요 없다.

## 이름과 위치

- 이슈 검증: `<이슈 번호>-<주제>-e2e.md` (예: `31-pixie-loop-e2e.md`)
- 이슈 없는 배포 검증: `release-<버전>-e2e.md`
- 산출물: `studio/dist/e2e/<이슈 번호 또는 버전>/`(Git 제외). 결론으로 남길 기록은 메인 세션이 `studio/docs/verification/`에 옮긴다.

## 지침서에 들어갈 것

1. **범위:** 쓰는 위치, 바꾸지 않을 파일·프로필, 외부로 전송되는 내용. 검증자는 제품을 고치지 않고 후보와 기록만 남긴다.
2. **시작 확인:** 대상 커밋·런타임 버전, 필요한 도구, 단계별 실행 조건. 조건이 안 되면 그 단계는 `대기`로 남긴다.
3. **단계:** 각 단계의 명령, 기준선(알려진 기대값), 완료 기준, 판정 단계(아래 L0–L2)와 올림 조건. 명세의 판정 질문과 calibration은 실제 데이터로 정한다.
4. **보고 양식:** `통과 / 실패 / 발견 / 대기 / 미실행 / 환경 차단`과 판정 단계. workspace 테스트, 설치 검증, 실제 모델 실행은 서로 대신하지 않는다.

이미 다른 문서에 있는 절차(배포 절차의 문체 교정, 개발 문서의 matrix 검증)는 옮겨 적지 않고 링크한다.

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
- 실모델 세션·Pixie 루프·게이트의 완료는 [wait.mjs](../e2e/wait.mjs)로 기다린다. 한 번 호출하면 완료(exit 0) 또는 시간 초과(exit 1)에 요약 하나를 낸다. 메시지·게이트 원문·루프 출력은 출력하지 않는다.

  ```sh
  node studio/scripts/e2e/wait.mjs session [--session <id>] [--turns 1] [--timeout 10m]
  node studio/scripts/e2e/wait.mjs loop    [--session <id>] [--count 1] [--since <ms>] [--timeout 10m]
  node studio/scripts/e2e/wait.mjs gate    [--session <id>] [--count 1] [--since <ms>] [--timeout 5m]
  ```

  `session`은 세션 로그의 종료된 턴 수·열린 턴·도구 호출 수를, `loop`·`gate`는 프로필 `studio-data/pixie`의 실행 기록 상태·항목 수를 읽는다. `--since`(기본: 호출 시각) 이후 시작한 실행만 센다. 세션 id를 모르면 가장 최근 파일을 읽으므로, 여러 세션이 있으면 `--session`을 준다.
- 긴 출력은 spill 정책에 맡기고, 스크립트는 요약을 먼저 출력한다.

### 보고

결과 표의 항목마다 판정 단계(`L0 / L1 / L2`)를 적는다. L1 판정에는 job id와 통과·escalated·error 수를 함께 적는다. 스크립트 판정과 결정 엔진의 확률 판정은 신뢰도가 다르므로 섞어 집계하지 않는다.

## 격리 서버

설치·기동·종료는 [server.mjs](../e2e/server.mjs)로 한다. 각 호출은 결과가 정해진 뒤에 JSON 요약 하나만 출력하고 끝난다.

```sh
node studio/scripts/e2e/server.mjs up [--profile e2e] [--with-desktop-plugins] [--with-secrets keys,subscriptions] [--plugin <spec>] [--archive <tgz>] [--skip-build] [--port N] [--timeout 90s]
node studio/scripts/e2e/server.mjs status [--profile e2e]
node studio/scripts/e2e/server.mjs down [--profile e2e]
```

- `up`: Studio 빌드·pack(`--archive`가 있으면 생략) → 출하 `web` 템플릿으로 프로필 재생성 → 격리 home에 설치 → 수정하지 않은 `dsh` 기동 → 인증 URL이 응답할 때까지 스크립트 안에서 대기. 출력: `url`, `port`, `pid`, 런타임 `version`, 패키지 이름·`sha256`, 설치 목록, peer 경고, 로그 경로.
- 격리 home은 기본 `studio/dist/e2e/home`(Git 제외, `--home` 또는 `STUDIO_E2E_HOME`으로 변경)이며 회차 사이에 유지한다. 프로필은 매번 새로 만든다(`--reuse-profile`로 유지). `~/.dsh`는 home으로 쓸 수 없다.
- `--with-desktop-plugins`: Desktop 프로필 `package.json`을 **읽기만** 해서 Studio를 뺀 플러그인(구독 플러그인 등)을 같은 버전으로 설치한다. 이 옵션만으로는 토큰·자격 증명을 복사하지 않는다.
- `--with-secrets keys,subscriptions`: `up`마다 `~/.dsh`에서 격리 home으로 복사한다(0600, Git 제외 경로). 출력에는 이름·계정 수·만료까지 남은 분만 나온다.
  - `keys`: `.credentials.yaml`의 `refs`(API 키 참조)만. 기기·브라우저 연결 grant는 복사하지 않는다.
  - `subscriptions`: 구독 플러그인 OAuth 저장소 `plugins/subscriptions/auth.json`.
  - **주의:** 격리 환경에서 토큰이 갱신되면 갱신된 토큰은 격리 home에만 저장된다. 공급자가 갱신 토큰을 한 번만 쓰게 하면 사용자 Desktop의 로그인이 끊길 수 있다. 접근 토큰 만료가 120분 안이면 `secrets.warning`이 나온다. 경고가 있으면 실모델 실행 전에 Desktop에서 먼저 사용해 갱신하거나 진행 여부를 사용자에게 묻는다. 갱신이 일어나는 경우는 아직 시험하지 않았다(2026-10-17: 복사·화면 표시·사용량 조회만 확인, 갱신 미발생, Desktop 파일 불변).
- 포트는 지정하지 않으면 19410–19499에서 빈 곳을 고른다. 다른 서버를 종료하지 않는다.
- `--mock-llm`: 각본 목 모델([mock-llm.mjs](../e2e/mock-llm.mjs))을 함께 띄우고 DeepSeek 제공자를 그쪽으로 돌린다. 요청은 `<home>/e2e-runs/<profile>/mock-llm.jsonl`에 남는다. 사용법은 [에이전트 제어 시나리오 가이드](../e2e/agent-scenarios.md).
- `down`은 이 스크립트가 띄운 프로세스(상태 파일의 pid, 목 모델 포함)만 종료하고 포트가 비었는지 확인한다.
- 인증 URL은 출력과 상태 파일(0600)에만 있다. 보고서·문서·Git에 옮기지 않는다.
- 설치·기동 성공은 Client 플러그인 활성화나 화면 동작을 뜻하지 않는다. 그 확인은 L0 브라우저 검사의 몫이다.

## 브라우저 검사 (L0)

화면 검사는 [browser.mjs](../e2e/browser.mjs)의 `run()` 위에 시나리오만 쓴다. Playwright 경로 탐색, 인증 URL 접속, 첫 실행 안내 닫기, 테마·폭별 컨텍스트, pageerror·플러그인 활성화 실패 수집, 스크린샷 저장은 하네스가 한다.

```js
import { run } from '../e2e/browser.mjs';
await run({ name: 'pixie-tab', views: ['light', 'dark', 'light@480'] }, async app => {
  await app.check('Pixie 탭 열림', () => app.page.getByRole('button', { name: 'Pixie' }).click());
  await app.shot('pixie');
});
```

- URL은 `server.mjs up`이 남긴 상태 파일에서 읽는다(`profile`·`url` 옵션이나 `STUDIO_E2E_URL`로 지정 가능). 토큰은 출력하지 않는다.
- `views`: `light`, `dark`, `light@480`, `dark@1280x720`. 뷰마다 새 브라우저 컨텍스트에서 처음부터 실행한다.
- `app.check(name, fn)`은 던지지 않고 통과·실패를 기록한다. 실패한 단계의 기본 대기는 10초(`actionTimeout`)다.
- 출력은 JSON 요약 하나다: `ok`, `passed`, `failed`, `failures`(단계·뷰·오류 첫 줄), `pageErrors`, `pluginFailures`, 스크린샷 경로. 실패가 하나라도 있으면 exit 1.
- 스크린샷은 `studio/dist/e2e/shots/<name>/`에 저장하고 경로만 보고한다. 판정은 검사로 하며, 검증자가 이미지를 읽는 것은 실패 원인을 볼 때나 사람 확인용 자료를 고를 때뿐이다.
- 기본 확인은 [smoke.mjs](../e2e/smoke.mjs)다(셸 로드, 플러그인 활성화 실패 없음, Studio 진입·패널 열림, 라이트·다크·480px).
- 셀렉터 단계는 `app.step(name, selector, { action, goal })`으로 쓴다. 실패하면 하네스가 실패 시점 DOM과 접근성 스냅샷을 남기고 요약에 `repair.items`를 낸다. 그 항목은 [L1 셀렉터 복구](../e2e/selector-repair.md) 명세로 `pixie_loop`에 넘기고, `apply-repairs.mjs`로 적용해 L0을 다시 실행한다. 검증자가 스냅샷·스크린샷을 직접 읽어 셀렉터를 고치지 않는다.

## 목록

| 문서 | 대상 |
| --- | --- |
| [release-0.6.1-e2e.md](release-0.6.1-e2e.md) | Studio 0.6.1 (DSH 0.2.1-rc.1·rc.2 호환) 배포 검증 |
| [release-0.6.1-e2e-continue.md](release-0.6.1-e2e-continue.md) | 0.6.1 배포 검증 E1 완료 지점부터 E2–E5 이어하기 |
| [release-0.6.1-e3-e4-rerun.md](release-0.6.1-e3-e4-rerun.md) | 0.6.1 반영 커밋 기준 E3·E4 재실행 |
| [dsh-rc1-compat-check.md](dsh-rc1-compat-check.md) | rc.1 역할 persona·Tool Filter·자식 정책 복원 |
| [jev-decision-engine-check.md](jev-decision-engine-check.md) | #27 Jev 결정 엔진 실사용 |
| [subagent-tool-filter-check.md](subagent-tool-filter-check.md) | 서브에이전트 Tool Filter |
| [dsh-ko-sequential.md](dsh-ko-sequential.md) | #30 한국어 번역 진행(검증이 아닌 작업 지침) |

이 규칙 전에 만든 문서는 이름이 다르다. 새로 고칠 때 이름을 바꾸지 않아도 된다.

새 지침서는 [템플릿](TEMPLATE-e2e.md)을 복사해 쓴다. 공통 절차(서버, L0 하네스, 셀렉터 복구, 기다리기)는 링크로 두고 이슈에서 확인할 것만 적는다.
