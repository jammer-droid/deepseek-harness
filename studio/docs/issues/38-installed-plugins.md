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

### 문제 1: 공급자가 같은 Host 서비스에 두 번 등록됨 (추정, S1에서 확정)

`dsh-web-search-exa`의 동작은 다음과 같다.

- `inject: ['web']`이며, 활성화될 때마다 Host 공용 `ctx.web`에 id `exa`로 등록한다.
- 키 유무와 상관없이 등록한다.
- `ctx.web`은 같은 id가 이미 있으면 `WEB_DUPLICATE_PROVIDER`로 거부한다.

이 예외는 DSH 프리셋 마운트의 행 검사(`auditRows`)에서 실패로 잡힌다. 서비스 구현을 root에 내놓는 경우를 잡는 `leakedServices` 검사와는 다른 경로다. 초기 상태에 따라 실패 시점이 달라진다.

| 초기 상태 | 추가 | 반영 |
|---|---|---|
| 프로필·Master 어디에도 Exa 없음 | 성공. probe가 첫 등록이고, 해제한 뒤 Master가 다시 등록한다 | **실패**. Master가 등록한 상태에서 스냅샷이 두 번째로 등록한다 |
| Exa가 이미 Master에 있음 | 다른 플러그인을 추가해도 실패할 수 있다. probe가 두 번째 Exa를 만든다 | 실패 |
| 프로필에서 Exa가 이미 실행 중 | 처음 추가부터 실패 | — |

공급자 선택(`web.searchProvider`)도 프로필 행 하나에만 있다. 그래서 프리셋 안에서 실행하더라도 실제로 쓰일지는 프로필이 정한다.

**아직 설명하지 못한 관찰**: 반영 실패 뒤 extensions가 빈 목록이었다. 반영 실패를 롤백해도 extensions는 지우지 않는다. 사용자가 직접 제거했는지, Master capture 실패 복원 경로였는지, `ensureOptimized` 자동 적용과 관련 있는지를 S1에서 따로 확인한다.

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
| D4 | 실행되지 않는 프로필 공용 패키지 등록. `configEditor`는 기존 행의 config override만 만들고, `pluginManager`는 행 켜기·끄기와 번들 선택만 한다. 둘 다 임의 모듈 행을 넣지 못한다. 결정: **복사할 수 있는 스니펫과 안내만** 한다. 직접 쓰기는 공개 API 조건에 맞지 않아 채택하지 않는다 | 확정 |
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
- `credential-ref` 역할이 Config 스키마 투영에 남는지, 그리고 `ctx.credentials`를 Studio Host에서 쓸 수 있는지는 S1에서 확인한다. 쓸 수 없으면 리터럴과 `.env` 안내만 제공한다.

### 분류 근거 (D1a)

행(모듈 진입점) 단위로 판정한다. 위에서부터 처음 맞는 근거를 쓴다.

1. **이미 Master에 있음**: standard나 Studio 계층에 있는 행이다. 지금처럼 프리셋 Config에 나온다.
2. **프로필에서 실행 중**: `configEditor.entries()`에 있거나, `pluginManager.listPlugins()`에서 `patchId`가 있는 행이다. 관찰된 실행 위치로 보고 `프로필 공용`으로 판정한다. Master에도 넣으면 같은 Host 서비스에 두 번 등록되므로 막는다.
3. **Studio 호환성 표**: 검증한 진입점의 범위를 기록한 Studio 내부 표다.
   - S1 결과와 #32 S1 표로 시작한다.
   - `web-search-*`, `web-fetch-*`, `llm-*`, `session-title-*`, `bash-sandbox`, `jobs`, `token-meter`는 `프로필 공용`이다.
   - 도구 등록 플러그인 중 검증된 것은 `에이전트 기능`이다.
4. 그 밖에는 `확인 필요`다.

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
| S1 | 재현과 근거 수집 | — | 격리 rc.2 프로필에서 문제 1 표의 초기 상태 세 가지를 각각 재현하고, 상태 네 시점의 기록을 남긴다(아래). 빈 extensions의 원인을 확정하거나 미확정으로 남긴다. 호환성 표의 첫 판본(진입점 10개 이상)을 만든다 | 격리 home/profile 기록, 실패 재현 테스트 | 대기 |
| S2 | 감지·분류 Host 서비스 | S1 | Remote 하나가 행 단위로 `{ package, entry, scope, evidence, state }`를 반환한다. scope는 `agent`·`profile`·`unknown`, state는 `in-master`·`profile-active`·`profile-inactive`·`profile-failed`·`profile-unaddressable`·`installed`다. 플러그인 export가 없는 패키지는 뺀다 | 단위 테스트(분류 근거 표), 실제 Loader 테스트 | 대기 |
| S3 | 프로필 공용 차단과 이전 | S2 | 프로필 공용 행은 Master에 들어가지 않고 이유가 표시된다. D7 이전 후 다음을 확인한다: 설정이 보존됨, 공용 등록이 정확히 1회, 프로필 등록 뒤 `web_search`가 Exa로 감, 두 프리셋을 동시에 써도 충돌 없음, 재시작 후 복원에서 충돌 없음 | 재현 테스트가 통과로 바뀜, 이전 테스트, 격리 프로필 확인 | 대기 |
| S4 | 에이전트 기능 감지와 설정 후 포함 | S2, S3, D2 | 새 후보가 `새로 설치됨`으로 보인다. 초기 설정 → probe → 포함 흐름이 동작하고, 필수 설정이 있는 플러그인도 포함할 수 있다. 실패하면 이전 Master를 유지한다. `플러그인 추가` 대화상자를 없앤다 | DOM 테스트, Master 수명 테스트 | 대기 |
| S5 | 프로필 공용 설정 | S2, D3, D6 | ACTIVE 프로필 행의 Config를 스키마 폼으로 보고 저장한다. 덮어씀·검증 실패·비활성·주소 지정 불가는 이유를 표시하고 파일을 그대로 둔다. 비밀 필드는 유지·교체·삭제 의미로 저장하고, 응답·오류에 비밀 값이 없다. "모든 세션에 적용"을 표시한다 | DOM 테스트, `configEditor` 실제 Loader 테스트 | 대기 |
| S6 | 실행되지 않는 프로필 공용 안내 | S2, S5 | 번들이 아닌 프로필 공용 패키지에 스니펫(비밀 자리표시자)을 보여 준다. 사용자가 patch에 등록하고 다시 읽으면 S5 목록으로 옮겨지며, 실제로 활성화된다 | DOM 테스트, 격리 프로필 실제 Loader 확인 | 대기 |
| S7 | 독립 설치 검증 | S3–S6 | 수정하지 않은 DSH 0.2.1-rc.2에 패키징한 Studio만 설치한다. 확인 흐름: Exa `dsh plugin add` → 프로필 공용 표시 → 스니펫 등록 → 공용 설정에서 `searchProvider: exa`와 키 저장 → `web_search`가 Exa로 감. 에이전트 기능 플러그인 하나를 설정·포함·반영한다. 라이트·다크·좁은 폭 | 격리 home/profile 기록 | 대기 |

S1의 상태 기록 시점은 네 가지다: `추가 직후`, `키 저장 후`, `반영 후`, `재시작 후`. 시점마다 `master-extensions.json`, `presets.json` 상태, Host Config 목록, 오류 원문을 남긴다.

첫 단계는 S1이다. 남은 결정은 없다. S1 결과로 분류 근거나 D6 경로가 바뀌면 해당 결정을 다시 연다.

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
