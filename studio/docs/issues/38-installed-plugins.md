---
kind: implementation-spec
status: ready
---

# #38 설치한 플러그인을 Studio에서 바로 쓰기: 자동 감지, 실행 범위 구분, 그 자리에서 설정

## 요약

프로필에 플러그인을 설치해도 Studio 실행 설정의 Config 목록에는 나타나지 않는다. Master에 넣으려면 실행 설정 탭의 `플러그인 추가`에 패키지 이름을 따로 입력해야 한다. 그렇게 넣은 플러그인 중 Host 공용 서비스에 공급자를 등록하는 것(예: `dsh-web-search-exa`)은 프리셋 반영 단계에서 실패한다.

이 이슈는 다음 네 가지를 바꾼다.

1. 설치된 플러그인을 Studio가 **자동으로 감지**한다.
2. 감지한 플러그인을 **실행 범위**에 따라 나눈다.
   - 에이전트 기능: 프리셋마다 달라지는 도구·프롬프트.
   - 프로필 공용: 모든 세션이 공유하는 서비스와 그 공급자.
3. 각 범위에 맞는 화면에서 **바로 설정**하게 한다.
4. 실행 설정 탭의 별도 등록 대화상자를 없앤다.

검색에 한정하지 않고 플러그인 전반에 같은 UX를 적용한다.

기본 정보:

- GitHub 이슈: [#38](https://github.com/jammer-droid/deepseek-harness/issues/38)
- 기준 브랜치·시작 커밋: `studio/feat/workflow` @ `c4b14778d3`
- 대상 DSH: `0.2.1-rc.2`. 본체 수정 없음. 공개 API만 사용한다.
- 발견 경위
  - 2026-10-20 Desktop `desktop` 프로필에서 다음 순서로 실패했다.
    1. `@deepseek-ai/dsh-web-search-exa@0.2.1-rc.2`를 `pnpm add`로 설치했다.
    2. 실행 설정에서 Master에 추가했다.
    3. apiKey를 저장했다.
    4. `Studio에 반영`을 눌렀다. 이 단계에서 실패했다.
  - 실패 후 상태: `master-extensions.json`은 빈 목록이었고, `studio-optimized`는 Exa가 없는 스냅샷으로 적용돼 있었다.
  - Desktop은 오류를 파일 로그로 남기지 않는다. 그래서 아래 원인은 코드 경로로 추정한 것이며 S1에서 확정한다.

## 현재 구조와 문제

### 구성 경로

| 단계 | 위치 | 동작 |
|---|---|---|
| Master 구성 | [master-composition.ts](../../src/host/master-composition.ts) | 구성: DSH standard + Studio 계층 + 사용자 추가 행(`studio-added` 그룹, `isolate` 없음) |
| Master 등록 | [master-catalog.ts](../../src/host/master-catalog.ts) `capture` | `studio-master` 프리셋으로 등록·활성화한다. Config 목록은 Master 행만 담는다. 끝에서 `ensureOptimized`가 Optimized를 자동으로 적용할 수 있다 |
| 추가 | [shell.ts](../../src/host/shell.ts) `addMasterPlugin` → `replaceExtensions` | 빈 config 행으로 임시 probe 프리셋을 등록·resolve해 본다. probe를 해제하고 기존 Master를 내린 뒤 새 Master를 활성화한다 |
| 반영 | [preset-store.ts](../../src/host/preset-store.ts) `applyRow` → `mount` | Master를 **유지한 채** 스냅샷을 별도 프리셋으로 마운트한다. 실패하면 이전 스냅샷만 복원하고 extensions는 바꾸지 않는다 |

### 문제 1: 공급자가 같은 Host 서비스에 두 번 등록됨 (S1에서 확정)

`dsh-web-search-exa`의 동작은 다음과 같다.

- `inject: ['web']`이며, 활성화될 때마다 Host 공용 `ctx.web`에 id `exa`로 등록한다.
- 키 유무와 상관없이 등록한다.
- `ctx.web`은 같은 id가 이미 있으면 `WEB_DUPLICATE_PROVIDER`로 거부한다.

이 예외는 DSH 프리셋 마운트의 행 검사(`auditRows`)에서 실패로 잡힌다. 서비스 구현을 root에 내놓는 경우를 잡는 `leakedServices` 검사와는 다른 경로다. 초기 상태에 따라 실패 시점이 달라진다.

| 초기 상태 | 추가 | 반영 |
|---|---|---|
| 프로필·Master 어디에도 Exa 없음 | 성공. probe가 첫 등록이고, 해제한 뒤 Master가 다시 등록한다. **단, 같은 capture의 `ensureOptimized`가 Optimized를 다시 적용하다 실패해 Optimized가 `modified`와 `Apply failed` 경고로 남는다** | **실패**. Master가 등록한 상태에서 스냅샷이 두 번째로 등록한다 |
| Exa가 이미 Master에 있음 | 다른 플러그인 추가도 **실패**한다. probe가 두 번째 Exa를 만든다 | 실패 |
| 프로필에서 Exa가 이미 실행 중 | 처음 추가부터 **실패** | — (Exa 없는 프리셋 반영은 성공) |

모든 실패의 오류 원문은 같다. `<id> (@deepseek-ai/dsh-web-search-exa): a web provider with id "exa" is already registered`. 표의 굵은 값은 S1에서 관찰한 결과다.

공급자 선택(`web.searchProvider`)도 프로필 행 하나에만 있다. 그래서 프리셋 안에서 실행하더라도 실제로 쓰일지는 프로필이 정한다.

**빈 extensions 관찰 (S1 판정)**: 반영이나 추가가 실패해도 extensions는 그대로였다. Desktop에서는 extensions가 11:55:46에 빈 목록으로 저장됐고, 5초 뒤 Optimized가 경고 없이 적용됐다. 이 순서는 사용자가 Exa를 제거(`removeMasterPlugin`)하자 capture의 `ensureOptimized`가 Optimized를 다시 적용한 흐름과 일치한다. Studio가 스스로 목록을 비운 경로는 발견하지 못했다. 사용자 확인은 하지 않았다.

**추가 발견**: 추가가 성공해 보여도 같은 작업에서 Optimized 자동 적용이 실패한다. 사용자는 프리셋 목록의 경고로만 알 수 있다.

### 문제 2: probe 성공이 범위 안전을 보장하지 않음

#32 S1에서 이미 확인한 내용이다.

- Host singleton(`bash-sandbox`, `jobs`, `token-meter`, `session-title-llm` 등)은 프리셋 범위에서 충돌한다.
- `repeat-tool-reminder`는 probe를 통과한다. 그러나 Host 행이 계속 동작하므로 프리셋에서 끄거나 완화할 수 없다.

활성화가 성공한 것은 프리셋 범위에서 의미가 있다는 증거가 아니다.

### 문제 3: 설치한 플러그인이 보이지 않음

- Studio는 설치를 감지하지 않는다.
- `dsh.bundle` 선언이 없는 패키지는 설치해도 프로필 어디에서도 실행되지 않는다(예: Exa). Host Config 조회 결과에서 `dsh-web-search-exa` 항목은 0건이었다.
- Plugins 페이지(`pluginManager.installBundle`)는 번들이 아닌 패키지를 거부하고 설치를 되돌린다. 그래서 이런 패키지는 `dsh plugin add`(pnpm)로만 설치된다.
- 등록 대화상자는 Config 목록과 떨어진 곳에 있다.
- 기존 추가 흐름은 빈 config로 probe한다. 그래서 필수 설정이 있는 플러그인은 설정 화면에 도달하기 전에 실패할 수 있다.

## 범위

**포함**

- 프로필에 선언된 플러그인 패키지 감지. 행(진입점) 단위 상태 표시.
- 에이전트 기능 후보
  - 처리 순서: 스키마 조회 → 초기 설정 작성 → probe → Master 포함.
  - 포함된 뒤에는 Config·도구 목록에 바로 나타나고, 거기서 값을 바꿔 프리셋에 반영한다.
- 프로필 공용 플러그인
  - 실행 중인 행의 설정을 Studio에서 보고 바꾼다(`configEditor`). 모든 세션에 즉시 적용된다.
  - 실행되지 않는 패키지는 등록 방법을 안내한다.
- 프로필 공용 플러그인이 Master나 프리셋에 들어가지 않게 막는다.
- 이미 저장된 `studio-added` 행을 설정을 보존하며 이전한다(D7).
- 실행 설정 탭의 `플러그인 추가` 대화상자를 없앤다.

**제외**

- 프리셋별로 다른 공급자. 사용자 결정에 따라 필요 없다.
- 패키지 설치·제거. 번들은 DSH Plugins 페이지, 그 밖의 패키지는 `dsh plugin add`가 맡는다. Studio는 안내만 한다.
- 프로필 patch 파일을 Studio가 직접 쓰는 것. 공개 API 범위를 벗어난다(D4).
- DSH 본체 변경(행 삽입 API, 비밀 저장소 연동 등).
- 적용된 프리셋 스냅샷을 자동으로 바꾸는 것. 현재 규칙을 유지하고, 이전 시에는 경고와 재적용 안내를 한다.

## 사용자 흐름

1. 사용자가 패키지를 설치한다. 번들은 Plugins 페이지, 그 밖의 패키지는 `dsh plugin add`를 쓴다.
2. Studio `플러그인` 화면(D3)에 그 패키지의 행이 `새로 설치됨`으로 나타난다. 범위(`에이전트 기능`·`프로필 공용`·`확인 필요`)와 근거가 함께 표시된다.
3. 범위에 따라 흐름이 나뉜다.
   - **에이전트 기능**
     1. `설정하고 포함`을 누른다.
     2. 스키마 폼에서 초기 설정을 입력한다. 비워 둘 수 있다.
     3. probe가 성공하면 Master에 포함된다. 프리셋 편집의 Config·도구 목록에 바로 보인다.
     4. 실패하면 이전 Master를 유지하고 오류 원문을 보여 준다.
   - **프로필 공용, 실행 중**: `프로필 공용 설정`에 나온다. 값을 저장하면 모든 세션에 적용된다. 공급자 선택값(예: `web.searchProvider`)도 같은 곳에서 바꾼다.
   - **프로필 공용, 실행되지 않음**: `cordis.patch.yml`에 넣을 스니펫과 안내를 보여 준다. 사용자가 등록하고 다시 읽으면 위 목록으로 옮겨진다.
   - **확인 필요**: 근거가 없으므로 자동으로 포함하지 않는다. 사용자가 범위를 골라야 하고, 에이전트 기능을 고르면 "프리셋에서 의미가 없을 수 있음" 경고를 보여 준다.
4. 프로필 행이 비활성·실패·주소 지정 불가(중복 id, 중첩 Include) 상태이면 편집할 수 없는 이유와 파일 기반 복구 방법을 보여 준다.

## 결정

| ID | 결정 | 상태 |
|---|---|---|
| D1 | 실행 범위를 `에이전트 기능`과 `프로필 공용`으로 나눈다 | 확정(사용자 방향) |
| D1a | 분류는 휴리스틱이 아니라 **근거**로 한다. 근거가 없으면 `확인 필요`로 둔다. probe 성공은 활성화 확인일 뿐 범위 판정 근거가 아니다. 자세한 기준은 아래 분류 근거 | 확정(리뷰 반영) |
| D2 | 새로 설치된 에이전트 기능 후보는 **감지는 자동, 포함은 사용자가 한 번 확인**한다. 포함하면 코드가 실행되고, 초기 설정이 필요할 수 있기 때문이다 | 확정(사용자, 2026-10-20) |
| D3 | Studio에 `플러그인` 탭을 새로 만들고, 감지 목록과 프로필 공용 설정을 이 탭에 둔다. 프리셋 실행 설정에는 Config 목록만 남기고, 기존 `플러그인 추가` 버튼과 대화상자는 제거한다. "모든 세션에 적용" 링크로 플러그인 탭을 가리킨다 | 확정(사용자, 2026-10-20) |
| D4 | 실행되지 않는 프로필 공용 패키지 등록. **개정(2026-10-20, 사용자 요청)**: Studio가 직접 등록한다. 프로필 patch 끝에 insert를 텍스트로 덧붙여 기존 주석과 `!!js`를 보존하고, 원자적으로 교체한다(0600). 이 작업을 공개 `hmr.runExclusive()` 안에서 하고, 공개 `hmr.reconcileProfile([id])`로 적용한다. 새 행이 활성화되지 않으면 이전 파일로 되돌리고 다시 적용한다. HMR이 없는 런타임에서는 거부하고 스니펫 안내로 대신한다. 스니펫은 `직접 등록하기`로 계속 제공한다 | 확정(개정) |
| D5 | 프로필 공용 설정은 `configEditor.edit()`로 저장한다. 이 API는 ACTIVE 상태이고 profile root Include에 속하며 id가 고유한 행만 편집한다. home patch나 명령줄 overlay가 덮어쓴 값은 거부한다. 이런 제한에 걸리면 오류 원문을 보여 주고 파일은 그대로 둔다 | 확정 |
| D6 | 비밀 값 처리. 아래 규칙을 따른다 | 확정(사용자, 2026-10-20) |
| D7 | 기존 `studio-added` 행 중 프로필 공용으로 판정된 것의 이전 방식. 아래 이전 계약 | 확정(리뷰 반영, 세부는 S3에서 검증) |

D6 규칙:

DSH에서 비밀 값을 저장하는 경로는 세 가지다. 셋 다 평문이지만, 어떤 경로를 쓸 수 있는지는 플러그인 Config가 정한다.

| 경로 | 위치 | 보호 | 쓸 수 있는 플러그인 |
|---|---|---|---|
| 자격 증명 저장소(`ctx.credentials`) | `$DSH_HOME/.credentials.yaml` | 평문 파일. 0600이 아니면 로드를 거부한다. Config에는 키 이름만 남는다 | Config에 `role('credential-ref')` 필드가 있는 플러그인(예: `web-search-deepseek`의 `apiKeyEnv`, `llm-pi-ai`) |
| 실행 환경 `.env` | 실행 디렉터리 또는 `$DSH_HOME`의 `.env`, 셸 환경 변수 | 평문 | 실행 환경에서 값을 읽는 플러그인(예: Exa의 `EXA_API_KEY` 대체) |
| Config 리터럴 | 프로필 `cordis.patch.yml` | 평문. `configEditor`가 0600으로 쓴다. 다만 설정 화면과 조회 결과에 그대로 노출된다 | 모든 문자열 필드(예: Exa `apiKey`) |

- 우선순위: 플러그인이 `credential-ref` 필드를 제공하면 자격 증명 저장소를 쓴다. `ctx.credentials.set`으로 저장하고 Config에는 키 이름만 남긴다. 화면에는 `describe`로 설정 여부만 표시한다. 그런 필드가 없으면 실행 환경에서 읽을 수 있는 변수를 안내한다. Desktop에서는 셸 환경 변수가 전달되지 않을 수 있으므로 `$DSH_HOME/.env`를 권한다. 리터럴 저장은 마지막 수단이다.
- 리터럴로 저장되는 필드는 필드 이름 규칙(`apiKey`, `token`, `secret`, `password`)과 알려진 표로 비밀 여부를 판정한다. 판정된 필드는 화면에서 가린다.
- 저장 의미는 `유지`·`교체`·`삭제` 세 가지로 한다. 가린 값을 다시 보내지 않는다.
- 오류 문구와 스니펫에는 값 대신 자리표시자를 쓴다.
- S1 확인 결과
  - 투영된 Config 스키마에 필드 역할이 `x-cordis.role`로 남는다. `secret`(예: `web-search-deepseek.apiKey`)과 `credential-ref`(예: `apiKeyEnv`) 두 가지다. 그래서 비밀 판정은 **스키마 역할을 먼저 보고**, 역할이 없는 필드(Exa `apiKey`)에만 이름 규칙을 적용한다.
  - 자격 증명은 공개 `ctx.credentials`와 `credentials` Remote(`describe`·`set`·`unset`)로 쓸 수 있다. 격리 서버에서 `describe(['EXA_API_KEY','DEEPSEEK_API_KEY'])`는 값 없이 `configured`·`source`·`writable`을 돌려줬다.
  - DSH `settings` 서비스는 비밀 역할을 가리고 폼 편집을 제공하지만, **volatile 필드만** 다룬다. Exa처럼 volatile 필드가 없는 플러그인은 네임스페이스가 없다. 그래서 프로필 공용 설정은 `configEditor`(D5)를 유지한다. 비밀 가림은 Studio가 `settings`와 같은 규칙(값 대신 있음 표시, 받지 않은 필드 보존)으로 구현한다.

### 분류 근거 (D1a)

행(모듈 진입점) 단위로 판정한다. 위에서부터 처음 맞는 근거를 쓴다.

1. **이미 Master에 있음**: standard나 Studio 계층에 있는 행이다. 지금처럼 프리셋 Config에 나온다.
2. **프로필에서 실행 중**: `configEditor.entries()`에 있거나, `pluginManager.listPlugins()`에서 `patchId`가 있는 행이다. 관찰된 실행 위치로 보고 `프로필 공용`으로 판정한다. Master에도 넣으면 같은 Host 서비스에 두 번 등록되므로 막는다.
3. **Studio 호환성 표**: 검증한 진입점의 범위를 기록한 Studio 내부 표다. 첫 판본은 아래 S1 표와 #32 S1 표다.
4. 그 밖에는 `확인 필요`다.

**S1 호환성 표** (격리 rc.2 프로필, 빈 config로 Master에 추가한 뒤 Optimized 요청으로 프리셋을 저장·반영):

| 진입점 | 추가 | 반영 | 판정 | 근거 |
|---|---|---|---|---|
| `dsh-web-search-exa` | 성공 | 실패: `web provider "exa" already registered` | 프로필 공용 | 공용 `ctx.web` 공급자 |
| `dsh-web-fetch-http` | 실패: `web provider "http" already registered` | — | 프로필 공용 | 프로필에서 실행 중 |
| `dsh-session-title-first-prompt-llm` | 실패: `targetWords` 필수 설정 없음 | — | 프로필 공용 | 프로필에서 실행 중(#32). 빈 config probe가 필수 설정에서 먼저 막힘 |
| `dsh-token-meter` | 실패: `service "tokenMeter" has been registered` | — | 프로필 공용 | Host singleton |
| `dsh-jobs-local` | 실패: `service "jobs" has been registered` | — | 프로필 공용 | Host singleton |
| `dsh-compaction-image-offload` | 실패: projection `image/offload` 중복 | — | 프로필 공용 | Host 등록 중복 |
| `dsh-repeat-tool-reminder` | 성공 | 성공 | 프로필 공용 | 프로필에서 실행 중. probe는 통과하지만 프리셋에서 끄지 못함(#32) |
| `dsh-llm-retry` | 성공 | 성공 | 프로필 공용 | 프로필에서 실행 중. probe 통과는 근거가 아님 |
| `dsh-tool-subagent`(`toolName: studio_extra_agent`) | 성공 | 성공 | 에이전트 기능 | 도구 등록, 프리셋 범위 |
| `dsh-tool-todo`(두 번째 행) | 실패: `tool "todo_write" is already registered in this scope` | — | 에이전트 기능(이미 Master) | Master에 있는 패키지 중복 |

이 표에서 확인한 사실은 두 가지다. 프로필에서 실행 중인 행은 근거 2로 모두 맞게 판정된다. 또 probe가 통과한 `repeat-tool-reminder`·`llm-retry`도 실제로는 프로필 공용이다. 그래서 "probe 성공은 범위 근거가 아니다"(D1a)는 유지한다. 호환성 표에는 프로필 공용 `web-search-*`·`web-fetch-*`·`session-title-*`·`token-meter`·`jobs-*`·`compaction-image-offload`·`bash-sandbox`, 에이전트 기능 `tool-subagent`를 넣는다.

기각한 규칙: "Host 서비스를 inject하고 자기 서비스는 제공하지 않으면 프로필 공용". 이 규칙은 `tool-web`(`tools`·`web`·`systemPrompt`를 inject하고 도구만 등록함)과 `plugin-manager/tools`도 공용으로 분류한다. 이 둘은 에이전트 기능이다. `inject`는 의존성을 나타낼 뿐, 등록이 범위를 지원하는지나 전역 부작용이 있는지는 나타내지 않는다.

### 이전 계약 (D7)

1. 시작할 때 프로필 공용으로 판정된 `studio-added` 행을 찾는다. 이 단계에서는 바꾸지 않고 `이전 필요` 알림만 띄운다.
2. 사용자가 확인하면 그 행의 config와 프리셋별 Config override를 `studio-data/migrated-extensions.json`에 보존한다. 파일 권한은 0600으로 둔다.
3. 프리셋마다 값이 다르면 프리셋별로 보여 주고, 사용자가 프로필에 쓸 값을 하나 고르게 한다. 자동으로 합치지 않는다.
4. 그 행을 쓰는 적용 스냅샷이 있으면 프리셋 이름을 보여 주고 `재적용` 또는 `적용 해제`를 요구한다. 이것이 끝나기 전에는 프로필 등록을 권하지 않는다. 등록하면 재시작 복원 때 다시 충돌하기 때문이다.
5. 마지막으로 extensions에서 행을 제거한다. 사라진 override id는 기존 `catalogChange` 알림으로 정리한다.

## 공개 API 사용 (DSH 0.2.1-rc.2)

| 용도 | API | 한정 |
|---|---|---|
| 설치 목록 | 프로필 `package.json` 읽기(`profileContext.dir`) | `listBundles`는 번들이 아닌 일반 의존성을 대부분 빼고, 선택된 non-bundle만 `not-bundle` 오류로 낸다. 그래서 매니페스트를 직접 읽는다 |
| 프로필 실행 행 | `configEditor.entries()`, `configuration()`, `pluginManager.listPlugins()` | 목록에 있다고 ACTIVE는 아니다. `patchId`와 `readOnlyReason`을 확인한다. nested Include 행은 편집 대상이 아니다 |
| 프로필 설정 저장 | `configEditor.edit(entry, change)` | D5 |
| Config 스키마 | `loader.import` + `createConfigProjector` | Master 카탈로그가 이미 쓰는 경로다. import는 모듈 최상위 코드를 실행한다 |
| 변경 감지 | `plugin-manager/changed`(`{ reason: 'plugin' \| 'bundle' \| 'install' \| 'remove' }`) | manager 작업이 실패한 뒤에도 발행된다. CLI 설치나 수동 patch 수정은 알리지 않으므로 화면에 들어올 때와 `새로고침` 때 다시 읽는다 |
| Master 포함 | 기존 `replaceExtensions`(probe 후 교체) | 초기 config를 받을 수 있게 입력을 넓힌다(Studio 내부 변경) |

## 단계

| ID | 결과 | 선행 | 수용 조건 | 검증 | 상태 |
|---|---|---|---|---|---|
| S1 | 재현과 근거 수집 | — | 격리 rc.2 프로필에서 문제 1 표의 초기 상태 세 가지를 각각 재현하고, 상태 네 시점의 기록을 남긴다(아래). 빈 extensions의 원인을 확정하거나 미확정으로 남긴다. 호환성 표의 첫 판본(진입점 10개 이상)을 만든다 | 격리 home/profile 기록, 실패 재현 스크립트 [s38-repro.mjs](../../scripts/e2e/s38-repro.mjs) | 완료 |
| S2 | 감지·분류 Host 서비스 | S1 | Remote 하나가 행 단위로 `{ package, entry, scope, evidence, state }`를 반환한다. scope는 `agent`·`profile`·`unknown`, state는 `in-master`·`profile-active`·`profile-inactive`·`profile-failed`·`profile-unaddressable`·`installed`다. 플러그인 export가 없는 패키지는 뺀다 | 단위 테스트(분류 근거 표), 실제 Loader 테스트 | 완료 |
| S3 | 프로필 공용 차단과 이전 | S2 | 프로필 공용 행은 Master에 들어가지 않고 이유가 표시된다. D7 이전 후 다음을 확인한다: 설정이 보존됨, 공용 등록이 정확히 1회, 프로필 등록 뒤 `web_search`가 Exa로 감, 두 프리셋을 동시에 써도 충돌 없음, 재시작 후 복원에서 충돌 없음 | 재현 테스트가 통과로 바뀜, 이전 테스트, 격리 프로필 확인 | 완료 |
| S4 | 에이전트 기능 감지와 설정 후 포함 | S2, S3, D2 | 새 후보가 `새로 설치됨`으로 보인다. 초기 설정 → probe → 포함 흐름이 동작하고, 필수 설정이 있는 플러그인도 포함할 수 있다. 실패하면 이전 Master를 유지한다. `플러그인 추가` 대화상자를 없앤다 | DOM 테스트, Master 수명 테스트 | 완료 |
| S5 | 프로필 공용 설정 | S2, D3, D6 | ACTIVE 프로필 행의 Config를 스키마 폼으로 보고 저장한다. 덮어씀·검증 실패·비활성·주소 지정 불가는 이유를 표시하고 파일을 그대로 둔다. 비밀 필드는 유지·교체·삭제 의미로 저장하고, 응답·오류에 비밀 값이 없다. "모든 세션에 적용"을 표시한다 | DOM 테스트, `configEditor` 실제 Loader 테스트 | 완료 |
| S6 | 실행되지 않는 프로필 공용 안내 | S2, S5 | 번들이 아닌 프로필 공용 패키지에 스니펫(비밀 자리표시자)을 보여 준다. 사용자가 patch에 등록하고 다시 읽으면 S5 목록으로 옮겨지며, 실제로 활성화된다 | DOM 테스트, 격리 프로필 실제 Loader 확인 | 완료 |
| S7 | 독립 설치 검증 | S3–S6 | 수정하지 않은 DSH 0.2.1-rc.2에 패키징한 Studio만 설치한다. 확인 흐름: Exa `dsh plugin add` → 프로필 공용 표시 → 스니펫 등록 → 공용 설정에서 `searchProvider: exa`와 키 저장 → `web_search`가 Exa로 감. 에이전트 기능 플러그인 하나를 설정·포함·반영한다. 라이트·다크·좁은 폭 | 격리 home/profile 기록 | 부분 완료(격리 설치·브라우저 확인, 에이전트 기능 실제 포함 흐름 미확인) |
| S8 | 서비스 그룹과 공급자 선택 | S5 | 프로필 설정이 서비스(예: 웹 검색·가져오기)별 카드로 묶인다. 서비스 소유 행(`dsh-web`)과 내장 공급자를 포함한 모든 공급자 행을 함께 보여 준다. 공급자 행에는 종류(검색/가져오기), 공급자 ID, 사용 중 여부를 표시한다. 소유 행에서 실행 중인 공급자 중 하나를 골라 저장한다. 자격 증명 참조(`apiKeyEnv`)는 저장소의 설정 여부로 표시한다 | DOM 테스트, 격리 rc.2 RPC·브라우저 | 완료 |
| S9 | 목록 검색 | S4, S5 | 설치한 플러그인·프로필 설정 두 페이지에서 이름·패키지·범위·서비스·공급자 ID로 좁혀 본다 | DOM 테스트, 브라우저 | 완료 |
| S10 | 워크플로우 카테고리 묶기 | S8 | 프로필 설정이 카테고리 카드로 묶인다: 웹, 위임 공급자, 루프 가드, 목표 자동 진행, 컨텍스트(Host 부분), MCP 서버, 모델 재시도·측정. 프리셋에서 실행되는 행(도구, 압축)과 단일 구현 기반 서비스(`ptc-runtime-node`, `jobs-local`, `skill`, `schedule`)와 모델 어댑터는 나오지 않는다. 행마다 바로 설정할 수 있다 | 단위 테스트(카테고리 표), DOM 테스트, 격리 rc.2 | 완료 |
| S11 | 공급자 이름 자동 인식 | S10 | 공급자 ID·이름을 다음 순서로 찾는다: ① Config 실제 값 또는 스키마 기본값의 `providerName`/`serverName` ② 모듈의 `*_PROVIDER_ID` 문자열 상수(이름에 `SEARCH`/`FETCH`가 있으면 종류도 정함) ③ Studio 표. 셋 다 없으면 표시하지 않는다 | 단위 테스트, 격리 rc.2 | 완료 |
| S12 | 공급자 직접 입력 | S8 | 선택 드롭다운에 `직접 입력`을 둔다. 값을 입력하면 그 ID로 저장하고, 빈칸으로 저장하면 그 필드의 덮어쓰기를 지워 기본값(자동 선택)을 따르게 한다. 안내 문구: DSH 제공 플러그인 명명 규칙을 따르는 공급자만 목록에 자동으로 나온다 | DOM 테스트, 격리 rc.2 | 완료 |
| S13 | 사용 가이드 | S10 | Studio 사용 가이드(ko·en)에 `프리셋 › 실행 설정 Config = 프리셋 구성에서 실행되는 플러그인`, `플러그인 › 프로필 설정 = 프로필(Host) 단위로 공유되는 플러그인`을 정리한다. 화면 안에 항목별 안내 문구는 넣지 않는다 | 문서 검토 | 완료 |

S1의 상태 기록 시점은 네 가지다: `추가 직후`, `키 저장 후`, `반영 후`, `재시작 후`. 시점마다 `master-extensions.json`, `presets.json` 상태, Host Config 목록, 오류 원문을 남긴다.

남은 일: S7의 에이전트 기능 플러그인 실제 설치·포함·반영 확인(설치본에 해당 후보가 없어 미확인). 사용자 Desktop 반영은 별도 승인.

## 위험과 제한

- 호환성 표는 검증한 진입점만 다룬다. 새 플러그인은 대부분 `확인 필요`로 시작한다. 사용자가 범위를 고르는 단계가 생기는 것은 이 정확성을 얻는 대가다.
- 감지 단계의 import는 모듈 최상위 코드를 실행한다. 플러그인 `apply`는 실행하지 않는다. 대상은 프로필 매니페스트에 선언된 의존성으로 제한한다.
- 프로필 공용 설정은 실행 중인 모든 세션에 즉시 영향을 준다.
- 프리셋별 공급자는 지원하지 않는다. 지원하려면 프리셋 안에서 `web`을 격리하고 `tool-web`을 다시 구성해야 하며, 이 이슈 범위 밖이다.

## 진행

- 2026-10-20: 원인 조사. Desktop 프로필 파일 시각, Studio Master·반영 경로, `ctx.web` 중복 거부, `configEditor`·`pluginManager` 공개 계약을 확인했다. 사용자 방향을 확정했다: 프리셋별 공급자는 필요 없음, 검색에 한정하지 않는 일반 UX. 초안을 작성했다.
- 2026-10-20: 독립 리뷰(Reviewer, 읽기 전용 소스 대조)를 반영했다.
  - inject 기반 분류 규칙을 기각하고 근거 기반 분류(D1a)로 바꿨다. 반례는 `tool-web`, `plugin-manager/tools`였다.
  - 초기 상태별 실패 시점을 정리하고 빈 extensions를 미확정 항목으로 분리했다.
  - D7 이전 계약(보존·선택·적용본 처리)을 넣었다.
  - 설정 후 probe 흐름과 비활성 프로필 행 처리를 넣었다.
  - API 한정 조건을 넣었다: Plugins 페이지의 non-bundle 거부, `listPlugins`의 `patchId`, 이벤트가 알리지 않는 경우.
  - D4를 안내 방식으로 확정했다.
  - S4 선행에 S3를 추가하고, S3·S5·S6의 수용 조건을 구체화했다.
- 2026-10-20: 사용자 결정 반영. D2·D3 추천안 확정(실행 설정의 플러그인 추가 제거 포함), D6 확정. D6에 DSH 비밀 값 저장 경로(자격 증명 저장소·`.env`·Config 리터럴)를 정리하고, 자격 증명 저장소를 우선한다. `ready`로 바꾼다.
- 2026-10-20: GitHub #38 발급.
- 2026-10-20: S1 완료. 설치된 DSH `0.2.1-rc.2` CLI, 격리 home `studio/dist/e2e/home` 프로필 `p38`, 패키징한 Studio `0.6.2`(tgz SHA256 `ee76735b…270c`), `--mock-llm`, `--plugin @deepseek-ai/dsh-web-search-exa@0.2.1-rc.2`.
  - 초기 상태 A(Exa 없음): 추가 성공, 같은 capture에서 Optimized 자동 적용 실패, 키 override 저장 성공, 반영 실패. extensions는 유지.
  - 초기 상태 B(Exa가 Master에 있음): 다른 플러그인 추가 실패, Optimized 반영 실패.
  - 재시작(Exa가 Master에 있는 채로): Master는 복원됐고(도구 39개), Optimized는 실패 경고를 단 `modified`로 남음.
  - 초기 상태 C(프로필 patch에 Exa insert와 `web.searchProvider: exa`): Exa 행 ACTIVE, Optimized 반영 성공, Master 추가는 즉시 실패. 가짜 Exa 엔드포인트(`baseURL`)와 목 모델로 `web_search`를 호출하자 요청이 Exa `/search`에 도달했고 결과 표식이 세션에 남음. 프로필 공용 경로가 동작함을 확인했다.
  - 호환성 표 10개 진입점(위 표). `x-cordis.role`(secret·credential-ref) 투영, `credentials` Remote, `settings`의 volatile 한정을 확인했다.
  - 격리 patch는 원본으로 되돌리고 서버·가짜 Exa를 종료했다(`portFree: true`). 사용자 Desktop과 `~/.dsh`는 바꾸지 않았다.
- 2026-10-20: S2 완료, S3 차단 부분 구현.
  - 분류는 순수 함수 [installed-plugins.ts](../../src/installed-plugins.ts)가 맡는다(`classifyInstalled`, 호환성 표 `COMPATIBILITY`, `masterRefusal`). Host 수집은 [host/installed-plugins.ts](../../src/host/installed-plugins.ts)가 맡는다. 프로필 `package.json` 의존성을 읽고, 각 패키지의 `exports` 진입점을 Loader로 import하며(`apply`는 실행하지 않음), `pluginManager.listPlugins()` 행을 함께 쓴다.
  - Remote `studioCatalog/listInstalledPlugins`를 추가했다. `addMasterPlugin`은 프로필 공용 진입점을 probe 전에 거부한다.
  - 검증: 단위 테스트 8개. `npm --prefix studio test` 778개 통과(타입 검사·빌드 포함). 격리 rc.2 `p38`(Studio tgz SHA256 `6c4c57a7…aa7`)에서 두 경우를 확인했다.
    - Exa가 설치만 된 경우: `profile compatibility installed`로 분류되고, 추가는 안내 문구와 함께 거부된다. S1과 달리 Optimized는 `applied`로 유지됐다.
    - patch에 등록한 경우: `profile profile-row profile-active web-search-exa`로 분류되고, 추가는 "already runs in the profile"로 거부된다.
- 2026-10-20: S3 Host 부분 완료.
  - 비밀 필드: [secret-fields.ts](../../src/secret-fields.ts). 스키마 `x-cordis.role`을 먼저 보고, 역할이 없으면 이름의 마지막 단어(`token`·`secret`·`password`·`apiKey`)로 판정한다. 판정된 값은 `{ secret, set }` 표식으로 가리고, 문자열에 나타나면 자리표시자로 바꾼다.
  - 이전: [extension-migration.ts](../../src/extension-migration.ts) `migrationPlan`. Remote는 `extensionMigration`(가린 설정, 프리셋별 override, 그 진입점을 아직 마운트하는 적용 프리셋)과 `migrateExtension`이다. `migrateExtension`은 원본 값을 `studio-data/migrated-extensions.json`(0600)에 더해 보존한 뒤 Master에서 행을 뺀다. 사라진 override id는 기존 카탈로그 변경 알림이 정리한다.
  - D7 4단계 조정: Master에서 빼는 것은 막지 않는다. 빼지 않으면 모든 반영이 계속 실패하기 때문이다. 대신 `appliedIn` 프리셋을 돌려주고, 화면은 프로필에 등록하기 전에 그 프리셋을 재적용하라고 안내한다.
  - 분류 보강: 사용자가 추가한 행도 근거로 분류한다. 표에 있는 항목(Exa)은 `profile`이고, 그 밖의 추가 행은 `agent`/`in-master`다.
  - `saveExtensions`는 새로 들어오는 프로필 공용 행을 거부한다. 이미 저장된 행은 이전할 때까지 유지한다.
  - 검증: 단위 테스트 3개 추가. `npm --prefix studio test` 781개 통과. 격리 rc.2 `p38`에서 다음을 확인했다.
    - 예전 빌드가 저장한 Exa 행(원본 apiKey 포함)을 재현했다. plan은 apiKey를 가린 채 돌려줬다.
    - 이전 후 백업 파일은 권한 600이고 원본 값을 보존했다. extensions는 `[]`가 됐다.
    - 실패 경고가 남아 있던 Optimized 반영이 성공했다.
    - `saveExtensions`로 Exa를 넣으려 하면 거부된다.
    - 기존 [check-master-runtime.mjs](../../scripts/check-master-runtime.mjs)(tool-subagent 확장 추가·원복 포함)가 통과했다.
  - S3 수용 조건 중 "두 프리셋 동시 사용·재시작 복원"은 프로필 등록 경로(S6)와 S7에서 함께 확인한다. S1에서는 프로필 등록 상태의 Optimized 반영과 `web_search`까지 확인했다.

- 2026-10-20: S4–S6 구현, S7 일부 확인.
  - 플러그인 서비스 [plugins-page.tsx](../../src/plugins-page.tsx)(문구 [plugins-locale.ts](../../src/plugins-locale.ts))를 상단 서비스 탭 `플러그인`(order 5)으로 등록했다. `설치한 플러그인` 페이지는 범위 배지와 범위별 동작(설정하고 포함·에이전트 기능으로 포함·프로필에 등록하기·프로필 설정 열기)과 이전 카드를 보여 준다. `프로필 설정` 페이지는 서비스 행(예: `dsh-web`)을 함께 보여 주고, 비밀 값은 유지·교체·삭제로 다룬다.
  - Host 쪽: [host/profile-config.ts](../../src/host/profile-config.ts)가 `configEditor.configuration()`·`edit()`로 프로필 행을 읽고 쓴다. 대상은 프로필 공용으로 판정되고 실행 중인 행, 그리고 그 행이 inject하는 서비스의 소유 행(`SERVICE_OWNERS`)뿐이다. 순수 로직 [profile-config.ts](../../src/profile-config.ts)는 diff, 비밀 처리, 스니펫을 맡는다. Remote는 `listProfileConfigs`, `saveProfileConfig`, `installedPluginSchema`다. `addMasterPlugin`은 `{ name, config }`를 받아 초기 설정과 함께 probe한다.
  - 비밀 판정을 보강했다. 스키마 역할이 없는 이름 규칙 필드(Exa `apiKey`)도 스키마 속성에서 찾아, 값이 없어도 `설정 안 됨`으로 표시한다.
  - D3: 실행 설정의 `플러그인 추가` 입력을 없앴다. 이미 추가한 플러그인이 있을 때만 그 목록과 `제거`를 남겼다.
  - 검증: `npm --prefix studio test` 789개 통과(타입 검사·빌드·디자인 규칙 포함). 격리 rc.2 `p38`(Studio tgz SHA256 `4656f48a…2415`)에서 다음을 확인했다.
    1. 스니펫 그대로 patch에 등록하자 Exa가 `profile-active`가 됐다.
    2. 프로필 설정에서 apiKey 교체와 baseURL을 저장하고, `dsh-web.searchProvider: exa`도 저장했다. patch에는 configEditor 형식으로 기록됐고, 응답에 키는 0회 나왔다.
    3. 목 모델 `web_search`가 가짜 Exa에 `Bearer <저장한 키>`로 도달했다.
    4. 유지 저장 후에도 키가 남았다.
    5. `numResults: -1`은 검증 오류로 거부됐고 파일은 그대로였다.
    6. 목록에 없는 `bash-sandbox`는 거부됐다.
    7. 삭제 후 patch에서 키가 사라졌다.
    8. 재시작 뒤 Master와 Optimized가 `applied`였고, Optimized 재반영과 `web_search`가 성공했다.
  - 브라우저 [plugins-tab.mjs](../../scripts/e2e/plugins-tab.mjs): 라이트·다크·480px 27개 검사 통과, pageerror·플러그인 활성화 실패 0.
  - 격리 patch는 원본으로 되돌리고 서버와 가짜 Exa를 종료했다. 사용자 Desktop과 `~/.dsh`는 바꾸지 않았다.
  - 미확인: 실제 `확인 필요`·`에이전트 기능` 후보 패키지를 설치해 설정하고 포함·반영하는 흐름. DOM 테스트와 기존 `check-master-runtime`(extensions 경로)만 확인했다. "두 프리셋 동시 사용"은 Optimized와 Master만으로 확인했다.- 2026-10-20: Desktop 반영(사용자 요청).
  - 교체 전 desktop 프로필의 `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `cordis.patch.yml`, `studio-data/`, 설치된 Studio 디렉터리를 `studio/dist/desktop-38-20261020/desktop-before/`(Git 제외)에 백업했다.
  - 격리 검증에 쓴 tgz(SHA256 `4656f48a…2415`)를 `dsh plugin --profile desktop add`로 설치했다. 설치된 패키지 전체를 tgz 내용과 `diff -rq`로 대조해 일치함을 확인했고, bundle 선택은 그대로다.
  - 앱 재시작과 화면 확인은 하지 않았다. 작업 세션이 그 Desktop 앱 안에서 실행 중이기 때문이다. 상태는 "설치 완료, 실행 반영 미확인"이다.

- 2026-10-20: D4 개정, 프로필 직접 등록(사용자 요청).
  - 구현: [host/profile-register.ts](../../src/host/profile-register.ts)(`registerProfilePlugin`, `appendInsert`, `uniqueRowId`). Remote는 `registerProfilePlugin`이다. 등록 대화상자는 주 동작 `등록`과 접힌 `직접 등록하기` 스니펫을 함께 둔다. 프로필 설정 페이지는 보일 때마다 다시 읽는다.
  - 검증: `npm --prefix studio test` 791개 통과. 단위 테스트는 주석·식을 보존하며 덧붙이는지, `[]` 처리, id 충돌 회피, HMR 트랜잭션 순서, 실패 시 파일 복원, 0600을 확인한다.
  - 격리 rc.2 `p38`(tgz SHA256 `00ae8c3b…f529`)에서 확인한 내용:
    1. Studio에서 Exa를 등록하자 재시작 없이 `profile-active`가 됐다. patch에는 insert 한 줄만 추가됐다.
    2. 같은 항목은 다시 등록할 수 없다.
    3. 키와 `searchProvider: exa`를 저장한 뒤 `web_search`가 가짜 Exa에 Bearer 키로 도달했다. Master와 Optimized는 `applied`였다.
  - 브라우저: [plugins-register.mjs](../../scripts/e2e/plugins-register.mjs) 8개 통과, [plugins-tab.mjs](../../scripts/e2e/plugins-tab.mjs) 라이트·다크·480px 27개 통과.
  - 미확인: 실제 런타임에서 등록이 활성화 실패로 이어지는 경우. 후보로 `dsh-web-fetch-http`를 설치했지만 이미 프로필에서 실행 중이라 등록 대상이 아니었다. 롤백은 단위 테스트로만 확인했다.
- 2026-10-20: 직접 등록 버전을 Desktop에 다시 설치했다. 백업 위치는 `studio/dist/desktop-38b-20261020/desktop-before/`이고, tgz는 SHA256 `00ae8c3b…f529`이다. 설치본을 tgz와 `diff -rq`로 비교해 일치함을 확인했다. 앱 재시작과 화면 확인은 하지 않았다.

- 2026-10-20: S8·S9 추가와 구현(사용자 요청: 연관 관계를 볼 수 있게 묶기, 목록 검색).
  - [service-groups.ts](../../src/service-groups.ts): 서비스 그룹 정의(`web` → 소유 `dsh-web`, 선택 필드 `searchProvider`·`fetchProvider`)와 공급자 ID 표(`exa`, `deepseek-official`, `perplexity`, `deepseek-search-api`, `deepseek-fetch-api`, `http`)다. 공개 API에 등록된 공급자 목록 조회가 없어서 0.2.1-rc.2 패키지 소스에서 읽은 값을 표로 둔다. 표에 없는 플러그인은 `inject`한 서비스로 그룹에 들어간다.
  - Host [profile-config.ts](../../src/host/profile-config.ts)에서 바꾼 것:
    - 그룹 서비스의 소유 행과 공급자 행을 설치 여부와 상관없이 나열한다.
    - `pluginManager.listPlugins()`로 실행 여부를 붙이고, 꺼진 행의 저장을 거부한다.
    - `credential-ref` 필드는 `ctx.credentials.describe`로 설정 여부만 붙인다.
  - UI: 그룹 카드, 소유 행의 공급자 선택(실행 중인 공급자만, 현재 값이 목록에 없으면 `실행 중 아님`으로 유지), 두 페이지의 검색 칸.
  - 검증: `npm --prefix studio test` 795개 통과. 격리 rc.2 `p38`(tgz SHA256 `6da4b76b…84a2`)에서 확인했다.
    - 내장 `web-deepseek-api`, `web-fetch-http`, `web-search-deepseek`가 `web` 그룹에 나왔다. `DEEPSEEK_API_KEY`는 `configured: true`였다.
    - 선택값 저장은 patch에 `searchProvider: exa`, `fetchProvider: deepseek-fetch-api`로 기록됐다.
    - 브라우저 [plugins-tab.mjs](../../scripts/e2e/plugins-tab.mjs)는 라이트·다크·480px 33개 통과, pageerror 0이었다.
- 2026-10-20: S8·S9 버전을 Desktop에 설치했다. 백업 위치는 `studio/dist/desktop-38c-20261020/desktop-before/`이고, tgz는 SHA256 `6da4b76b…84a2`다. 설치본을 tgz와 `diff -rq`로 비교해 일치함을 확인했다. 앱 재시작과 화면 확인은 하지 않았다.
- 2026-10-20: S10–S13 추가(사용자 결정). 워크플로우 카테고리를 조사해서 다음을 확인했다.
  - `standard` 프리셋에 이미 있는 행(도구, 압축, 계획, 스킬 로더 등)은 프리셋 Config에 나오므로 대상에서 뺀다. 플러그인 탭은 Host에서만 실행되는 행을 맡는다.
  - 공급자 선택 드롭다운이 필요한 곳은 웹뿐이다. 위임 공급자는 프리셋의 `tool-subagent`가 고르므로 이름만 보여 준다.
  - 자동 인식은 Config 이름 필드의 기본값이 공개 스키마에 있어 가장 확실하다. `*_PROVIDER_ID` 상수는 관례일 뿐이고 DSH 문서의 계약이 아니다.

- 2026-10-20: S10–S13 구현.
  - [service-groups.ts](../../src/service-groups.ts)가 7개 카테고리(웹, 위임 공급자, 루프 가드, 목표 자동 진행, 컨텍스트(공용), MCP 서버, 모델 재시도·측정)의 멤버 패턴과 웹 선택 필드를 정의한다. 공급자 인식은 `detectProviders`가 맡는다: Config의 `providerName`/`serverName` 값이나 스키마 기본값, 그다음 `*_PROVIDER_ID` 문자열 export(이름의 SEARCH/FETCH로 종류를 정함), 마지막으로 표.
  - Host는 카테고리 멤버인 프로필 행만 나열한다. 프리셋에서 실행되는 행은 `configEditor.entries()`에 나오지 않으므로 섞이지 않는다. 스키마가 없는 행은 `설정 항목 없음`으로 표시한다. 카드 순서는 카테고리 정의 순서다.
  - S12: 선택 드롭다운에 `기본값 사용(현재 기본값)`, 실행 중인 공급자, `직접 입력`이 있다. 직접 입력을 비워 저장하거나 기본값을 고르면 그 필드의 덮어쓰기를 지운다. 명명 규칙 안내는 직접 입력을 열 때만 보여 준다.
  - S13: 사용 가이드 ko/en에 `플러그인 (프로필 공용 설정)` 절을 추가했다. 실행 설정 Config와 프로필 설정의 구분 표, 직접 입력 규칙, 비밀 값 처리를 담았다. 실행 설정 절의 `플러그인 추가` 설명과 그림 링크는 바꿨다. 스크린샷은 `images/{ko,en}/plugins-profile.png`다.
  - 검증: `npm --prefix studio test` 796개 통과. 한 차례 전체 실행에서 무관한 `pixie-gate-script` 시간 의존 테스트가 실패했지만, 단독으로 3회 다시 돌리면 모두 통과해 부하에 따른 불안정으로 기록한다.
  - 격리 rc.2 `p38`(tgz SHA256 `79052dad…05b6`)에서 확인한 것:
    1. 7개 카테고리 17개 행이 나왔다. 위임 공급자 ID `spawn`·`fork`는 Config 기본값으로 인식됐다.
    2. 직접 입력 `my-search`를 저장하자 patch에 기록됐다. 빈값으로 저장하자 `web` 덮어쓰기 행 자체가 지워졌다.
    3. 브라우저 33개 검사가 통과했다.
- 2026-10-20: S10–S13 버전을 Desktop에 설치했다. 백업 위치는 `studio/dist/desktop-38d-20261020/desktop-before/`이고, tgz는 SHA256 `79052dad…05b6`다. 설치본을 tgz와 `diff -rq`로 비교해 일치함을 확인했다. 앱 재시작과 화면 확인은 하지 않았다.
- 2026-10-20: 배포 전 코드 리뷰(Reviewer, `c4b14778d3..41e437a810`, `studio/`만, 읽기 전용). 차단 3건과 수정 권장 3건을 모두 반영했다.
  - 차단 1, 중첩·짧은 비밀 노출: [secret-fields.ts](../../src/secret-fields.ts)를 재귀 처리로 바꿨다. 스키마 역할을 `properties`·`anyOf`·`items`·`$defs` 전체에서 찾고, 값 가림도 모든 깊이와 배열에 적용한다. `configDiff`는 중첩 비밀을 표식으로 바꾸고, 저장할 때 `restoreMasked`가 현재 값으로 되돌려 표식이 설정 파일에 쓰이지 않는다. `redactSecrets`는 모든 깊이의 비밀을 `<secret>`으로 바꾸고, 4자 미만 비밀이 들어 있는 문장은 통째로 숨긴다.
  - 차단 2, 등록 경로의 오류·경고: patch 파싱 오류는 원문 없이 안내만 한다. 활성화 오류와 복원 오류는 기존 patch와 요청 config의 비밀을 가려서 돌려준다. 경고는 내용 대신 개수만 돌려준다.
  - 차단 3, 이전 작업의 동시성: Master 확장 변경(`saveExtensions`, `addMasterPlugin`, `removeMasterPlugin`, `migrateExtension`)을 하나의 직렬 큐로 묶었다. 이전 작업은 최신 상태 읽기 → 백업 → 교체를 한 단위로 처리한다. 백업 임시 파일은 고유 이름, `flag: 'wx'`, 0600으로 만든다.
  - 권장 4: `saveExtensions`는 이미 저장된 행과 완전히 같은 행만 유지를 허용한다. 프로필 공용 패키지의 새 ID·복제·변경은 행마다 거부한다.
  - 권장 5: 설치 목록이 프로필 공용 항목마다 그 항목을 아직 마운트하는 반영 프리셋(`pendingPresets`)을 서버 상태에서 계산한다. 그런 프리셋이 있으면 등록 버튼 대신 `먼저 프리셋을 다시 반영`과 프리셋 이름을 보여 주고, 서버도 등록을 거부한다.
  - 권장 6: 등록 실패 뒤 복원 재적용까지 실패하면 이를 따로 알리고 재시작을 안내한다.
  - 참고: `MasterPluginActions.add`와 쓰지 않는 locale 키를 지웠다.
  - 검증:
    - `npm --prefix studio test` 799개 통과(회귀 테스트 3개 추가).
    - 격리 rc.2 `p38`(tgz SHA256 `76380192…e74c`):
      - 예전 빌드가 저장한 Exa 행을 넣은 상태에서 복제 ID를 섞어 `saveExtensions`를 호출하자 거부됐다.
      - 같은 이전을 동시에 두 번 호출하자 하나는 성공하고 하나는 거부됐다. 백업은 1건이었고 권한은 600이었다. 미리 만들어 둔 644 `.tmp` 파일은 재사용되지 않았다.
      - 이전한 뒤 `pendingPresets`가 비어 있어 등록할 수 있었다.
- 2026-10-20: 0.6.3 마무리 3·4단계(처음에는 0.7.0으로 올렸다가 사용자 결정으로 0.6.3으로 바꿨다).
  - 3단계 가이드·변경 내역: CHANGELOG `0.6.3`(영·한), 가이드(이전 대상과 반영 대기 프리셋 안내 추가), release README 기능 목록(Plugins 줄 추가, Execution settings에서 패키지 추가 문구 삭제)을 고치고 버전을 `0.6.3`으로 올렸다.
  - 4단계 한국어 문체 교정: [release-workflow](../release-workflow.md) 4단계의 명세에 용어(플러그인·공급자·프로필·등록·반영)를 더해 `pixie_loop`을 127개 항목에 실행했다. 결과는 통과 123, escalated 2, error 2였고, error 2는 다시 실행해 바뀐 것 없이 통과했다.
    - 반영: 바뀐 출력 27개 중 23개를 반영했다.
    - 원문 유지 6개: 체를 바꾼 출력(해요체·하십시오체: `manualHint`, `empty`, `registerHint`), 주어를 바꿔 뜻이 달라진 `registerDirectHint`, 프로필 설정에서 쓰는 `적용`을 `반영`으로 바꾼 `pageProfileDescription`·`registeredRestart`.
    - 반영하며 고친 것: 반영한 출력 안의 `반영`/`해제`는 `적용`/`지웁니다`로 되돌렸고, 목록 기호가 빠진 2개는 기호를 되살렸다.
    - escalated `CHANGELOG.md:60`은 직접 고쳤고, `ko.include`(`설정하고 포함`)는 원문을 유지했다.
  - 테스트 799개가 통과했다.
- 2026-10-20: 후속 후보 F1–F3(Exa `/contents` 가져오기 공급자, 서비스 그룹 확장, 가져오기 키 분리)와 검증 후보 V1–V2는 사용자 결정에 따라 GitHub 이슈로 등록하지 않는다. 내부 문서 [plugins-followups.md](../plans/plugins-followups.md)에만 남긴다. 지금 기능만으로도 워크플로우 설정을 할 수 있기 때문이다. #38을 종료할 때는 이 문서를 링크한다.
- 2026-10-20: Desktop 확인 피드백을 반영했다. 바꿀 설정이 없는 행(스키마 속성이 없거나 비밀 필드만 있고 비밀 컨트롤이 없는 행)은 `설정` 버튼 대신 `설정 항목 없음`으로 표시한다(`hasEditableFields`). 격리 rc.2에서 `llm-retry`, `token-meter`, `timeout-policy`, `session-checkpoint-policy`, `goal-round-driver`, `image-offload`, `mcp-resources`가 해당했다. 배포 버전은 사용자 결정에 따라 `0.7.0`에서 `0.6.3`으로 바꿨다(배포 지침서 `releases/0.6.3.md`). 테스트 800개가 통과했다.
- 2026-10-20: 0.6.3 후보를 Desktop에 설치했다. tgz SHA256은 `5616f333…01ba2`다. 같은 패키지로 격리 rc.2에서 smoke 12/12와 플러그인 탭 33/33을 통과했고 pageerror는 0이었다. 백업 위치는 `studio/dist/desktop-063-20261020/desktop-before/`다. 설치본을 tgz와 `diff -rq`로 비교해 일치함을 확인했고, 설치된 버전은 `0.6.3`이다. 앱 재시작과 화면 확인은 하지 않았다.
