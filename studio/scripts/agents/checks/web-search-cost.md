# 웹 검색 provider 비용 비교 E2E

이 문서를 받은 에이전트(**검증자**)는 아래 단계를 실행하고 보고 양식으로 결과를 낸다. 제품을 고치지 않는다. 판정 단계·올림 규칙·기다리기는 [에이전트 E2E 검증 지침](../README.md#판정-단계)을 따른다.

비교 대상은 DSH 웹 검색 provider 둘이다.

| 이름 | provider | 동작 |
| --- | --- | --- |
| 기존 (`legacy`) | `deepseek-official`(`dsh-web-search-deepseek`) + 로컬 HTTP fetch | 검색마다 보조 Messages 요청(`deepseek-v4-flash`, 서버 측 `web_search` 최대 5회, thinking 끔) |
| 신규 (`api`) | `deepseek-search-api`·`deepseek-fetch-api`(`dsh-web-deepseek-api`) | Search API·Fetch API 직접 요청, 성공 1,000건당 $0.75 |

요금 기준은 [DeepSeek 요금표](https://api-docs.deepseek.com/quick_start/pricing)와 [Search & Fetch 과금 규칙](https://api-docs.deepseek.com/guides/search#billing)이다. 서버 측 검색은 2026-11-01 00:00(베이징)부터 건당 과금된다. 값이 바뀌면 [web-cost-lib.mjs](../../e2e/web-cost-lib.mjs)의 `PRICES`를 바꾸지 말고 보고에 차이를 적는다.

## 범위

- 대상: 현재 브랜치 커밋, 런타임 `dsh 0.2.1-rc.2`(수정하지 않은 설치본).
- 쓰는 위치: `studio/dist/e2e/web-cost/<run>/`, 격리 home `studio/dist/e2e/home`의 프로필 `web-legacy`·`web-api`. tracked 파일·`~/.dsh`는 바꾸지 않고 커밋하지 않는다.
- 외부 전송: 검색어 20개와 URL 5개가 DeepSeek API로, 세션 과제 5개가 세션 모델로, 결과 목록(제목·URL·스니펫)이 결정 엔진으로 전송된다.
- 비용: DeepSeek 계정에서 실제로 청구된다. 예상 상한은 직접 측정 $0.05, 실세션 두 환경 합계 $0.10 수준(Flash 기준)이다. 세션 모델이 Flash가 아니면 0단계에서 멈추고 사용자에게 묻는다.
- 비밀값: `--with-secrets keys`로 `DEEPSEEK_API_KEY` 참조를 격리 home에 복사한다. 키 값은 출력·보고하지 않는다.

## 0. 시작 확인

1. `git status --short studio`, `git log --oneline -1`을 기록한다.
2. `dsh --version`이 `0.2.1-rc.2`인지 확인한다. 다르면 2·3단계는 `대기`다.
3. PATH의 `zstd`, 도구 `pixie_loop`을 확인한다. 없으면 해당 단계는 `환경 차단`이다.
4. 회차 이름을 정하고 모든 명령 전에 맞춘다.

   ```sh
   export WEB_COST_RUN=$(date +%Y-%m-%d) STUDIO_E2E_HOME="$PWD/studio/dist/e2e/home"
   ```

## 1. provider 직접 측정 (L0)

두 provider가 보내는 요청과 같은 본문으로 검색어 20개([`QUERIES`](../../e2e/web-cost-lib.mjs))와 URL 5개를 호출한다. 서버 한 대만 있으면 된다(키 복사용).

```sh
STUDIO_E2E_PROFILE=web-legacy node studio/scripts/e2e/server.mjs up --with-secrets keys
node studio/scripts/e2e/web-cost-probe.mjs
```

- 기준선: 검색 각 20회, fetch 각 5회. 실패 0이 기대값이지만 기존 검색이 `no web_search_tool_result block`으로 실패하는 것은 provider의 실제 동작이므로 `발견`으로 적고 계속한다.
- HTTP 401·402는 `환경 차단`이다. 429는 한 번만 다시 실행한다.
- 출력 `aggregate`의 호출·성공·과금 대상 수를 보고에 옮긴다.

## 2. 실세션 측정 (L0)

같은 과제 5개([`SESSION_TASKS`](../../e2e/web-cost-lib.mjs))를 각 환경에서 실모델 세션으로 실행한다. 임시 Studio 프리셋은 `web_search`·`web_fetch`만 가진다.

```sh
# 기존: 1단계 서버(web-legacy)를 그대로 쓴다
STUDIO_E2E_PROFILE=web-legacy WEB_COST_PROVIDER=legacy node studio/scripts/e2e/web-cost-session.mjs
ARCHIVE=$(node -p "require('$STUDIO_E2E_HOME/e2e-runs/web-legacy/state.json').archive")   # down 전에 읽는다
STUDIO_E2E_PROFILE=web-legacy node studio/scripts/e2e/server.mjs down

# 신규: 같은 패키지로 프로필을 만들고 provider를 바꾼 뒤 다시 띄운다
STUDIO_E2E_PROFILE=web-api node studio/scripts/e2e/server.mjs up --with-secrets keys --archive "$ARCHIVE"
STUDIO_E2E_PROFILE=web-api node studio/scripts/e2e/server.mjs down
STUDIO_E2E_PROFILE=web-api node studio/scripts/e2e/web-cost-select.mjs api
STUDIO_E2E_PROFILE=web-api node studio/scripts/e2e/server.mjs up --with-secrets keys --reuse-profile --archive "$ARCHIVE"
STUDIO_E2E_PROFILE=web-api WEB_COST_PROVIDER=api node studio/scripts/e2e/web-cost-session.mjs
STUDIO_E2E_PROFILE=web-api node studio/scripts/e2e/server.mjs down
```

- `ARCHIVE`는 `web-legacy`의 `down` 전에 읽어 둔다(`down`은 상태 파일을 지운다). 두 환경이 같은 패키지 SHA256인지 보고에 적는다.
- 각 실행은 세션 5개를 차례로 돌리고 스크립트 안에서 기다린다(세션당 최대 10분). 관리형 background job으로 띄우고 완료 알림을 기다린다.
- L0 검사: 턴 정상 종료, `web_search` 호출, **provider 확인**(기존만 세션 로그에 `web/deepseek-search-llm-request`가 남는다). provider 확인이 실패하면 그 환경의 수치는 비교에 쓰지 않고 `실패`로 적는다.
- 모델이 검색을 부르지 않은 과제는 `발견`이다. 모델 행동이라 결함 후보로 올리지 않는다.

## 3. 결과 품질 비교 (L1)

1단계가 만든 `studio/dist/e2e/web-cost/<run>/l1-items.jsonl`을 결정 엔진에 넘겨 검색어마다 A/B 중 더 나은 결과 목록을 고른다. 항목에는 provider 이름이 없고 A/B 순서는 검색어마다 섞여 있다(대응표 `l1-map.json`).

```json
{
  "items": { "path": "studio/dist/e2e/web-cost/<run>/l1-items.jsonl" },
  "work": { "instruction": "Pick the better search result list for the query." },
  "select": { "instructions": "A developer searched `query`. Compare result list `A` and result list `B` by how relevant, authoritative (official docs first), and current the sources are for that query. Pick the better list, or tie when they are about equally useful.", "optionsFrom": "input", "minConfidence": 0.4 },
  "output": "studio/dist/e2e/web-cost/<run>/l1-results.jsonl",
  "limits": { "tokens": 300000, "timeMs": 900000 },
  "run_in_background": true
}
```

- 항목 한 줄은 2,000자(read 도구 줄 한도) 안이어야 한다. `web-cost-probe.mjs`가 스니펫·제목을 줄여 맞춘다. 판정 기준을 바꿔 다시 만들 때는 API를 다시 부르지 않고 `node studio/scripts/e2e/web-cost-probe.mjs --l1-only`를 쓴다.
- 판정만 하므로 criteria·calibration 없이 `select`만 쓴다. 확신도가 0.4 미만이면 escalated로 남고 판정되지 않은 항목으로 집계한다. L2가 대신 고르지 않는다.
- error는 `환경 차단`이다.

## 4. 보고서

```sh
node studio/scripts/e2e/web-cost-report.mjs --job <3단계 job id>
```

`studio/dist/e2e/web-cost/<run>/report.md`가 생긴다. 이 표를 아래 양식에 붙이고 해석을 덧붙인다.

## 5. 정리

`server.mjs status`로 두 프로필 모두 `running: false`인지 확인한다. 복사된 키는 `studio/dist/e2e/home/.credentials.yaml`에 남는다. 남기지 않으려면 사용자에게 알리고 지운다.

## 보고 양식

```markdown
## 웹 검색 provider 비용 비교 결과 (<날짜>)

- 커밋·런타임·패키지 SHA256:
- 비밀값 복사: keys (DEEPSEEK_API_KEY 참조)
- 세션 모델:

| 단계 | 결과 | 판정 | 근거 |
| --- | --- | --- | --- |
| 1 직접 측정 | 통과/실패/발견/… | L0 | 호출·성공·과금 수 |
| 2 실세션 기존 | | L0 | 검사 통과 수, provider 확인 |
| 2 실세션 신규 | | L0 | |
| 3 품질 | | L1 | job id, 판정·escalated·error 수 |

<report.md의 1–3절 표>

### 해석
- 검색 1회 비용: 현재 / 서버 측 검색 과금 후
- 세션 1회 기준 차이와 그 원인(보조 모델 토큰, 결과 텍스트 길이)
- 품질 차이

- 발견·대기·환경 차단과 이유
- 산출물: studio/dist/e2e/web-cost/<run>/
```
