---
kind: implementation-spec
status: ready
---

# #39 Exa `/contents` 가져오기 공급자 플러그인 (`exa-contents`)

## 요약

Exa API `POST /contents`로 `web_fetch`를 처리하는 가져오기 공급자를 Studio와 별도인 플러그인 패키지로 추가한다. 프로필에 등록하면 Studio → 플러그인 → 프로필 설정의 웹 카드에서 `fetchProvider: exa-contents`를 고를 수 있다.

- GitHub 이슈: [#39](https://github.com/jammer-droid/deepseek-harness/issues/39)
- 출처: [플러그인 탭 후속 후보 F1](../plans/plugins-followups.md)
- 기준 브랜치·시작 커밋: `studio/feat/workflow` @ `16329d72ed`, 작업 브랜치 `studio/feat/39-exa-contents`
- 대상 DSH: `0.2.0-rc.2`, `0.2.1-rc.2`. 두 태그 모두 `ctx.web.registerFetchProvider()`와 `WebFetchProvider` 계약이 같다. 본체는 수정하지 않는다.

## 결정

| ID | 결정 | 이유 |
| --- | --- | --- |
| D1 | 패키지는 shell과 분리한다. 2026-10-21 배포 뒤 `studio/packages/web-fetch-exa`에서 `studio/plugins/web-fetch-exa`로 옮겼다(별도 버전·배포, [플러그인 배포 가이드](../plugin-release.md)) | 따로 설치하고 켜고 끌 수 있다. Studio 본체가 `web`에 의존하지 않는다. 0.6.3 프로필 등록·설정 흐름을 그대로 쓴다 |
| D2 | 공급자 id는 `exa-contents`이고 `EXA_CONTENTS_PROVIDER_ID`로 export한다 | 검색 공급자 `exa`와 화면에서 구분한다. export 규칙으로 Studio가 자동 감지한다 |
| D3 | npm 이름은 `@matamt-dbg/dsh-web-fetch-exa`이고 Studio와 같은 게시자를 쓴다 | 이름에 `fetch`가 있어야 Studio가 가져오기 공급자로 분류한다 |
| D4 | 의존성은 `dsh-web`·`dsh-launch-environment`·`cordis`를 peer로, `schemastery`를 dependency로 둔다. 이는 `dsh-web-search-exa`와 같은 구조다. 루트 `pnpm-lock.yaml` 갱신은 사용자가 승인했다(2026-10-21) | Config가 schemastery여야 프로필 설정 화면에서 `apiKey`·한도를 편집할 수 있다 |
| D5 | 요청은 `{ urls: [url], text: { maxCharacters }, maxAgeHours?, livecrawlTimeout? }`이고 응답 `results[0].text`를 `body.kind: 'text'`로 매핑한다 | Exa가 본문을 추출해 주므로 HTML 변환이 필요 없다 |
| D6 | 크롤링 실패(`statuses[].status = 'error'`)는 `error.httpStatusCode`가 있으면 빈 본문의 결과로 돌려준다. 없으면 `WebError('WEB_PROVIDER_ERROR')`로 처리한다 | seam 계약에서 대상 페이지의 non-2xx는 오류가 아니라 결과다. 상태 코드가 없는 실패(타임아웃·지원하지 않는 URL)는 가져오기 자체의 실패다 |
| D7 | 키를 담은 요청은 `redirect: 'error'`로 보낸다. 대상 URL은 `http(s)`만 받고 그 밖은 `WEB_INVALID_URL`이다 | DSH web 패키지 규칙(리다이렉트 거부)과 같다. 대상 페이지는 Exa가 가져오므로 로컬 사설 IP 검사는 해당하지 않는다 |
| D8 | 키는 Config `apiKey`가 먼저이고 없으면 `EXA_API_KEY`(launch environment)를 쓴다. 키가 없으면 `available() = false`다 | 기존 Exa 검색과 같은 키를 그대로 쓴다 |
| D9 | 한도 기본값: `maxCharacters` 100,000. Exa에는 1자 더 요청하고 결과를 상한에서 자르며, 넘으면 `truncated`다(Exa는 상한에서 잘라도 알려 주지 않는다), `timeoutMs` 30,000(`WEB_FETCH_TIMEOUT`). `maxAgeHours`·`livecrawlTimeoutMs`는 없으면 보내지 않는다 | `web-fetch-http`의 `maxBodyChars`·`timeoutMs` 기본값과 맞춘다 |
| D10 | Studio 쪽 `COMPATIBILITY`와 `KNOWN_PROVIDERS`에 새 패키지를 추가한다 | 프로필 등록 전 "설치됨" 상태에서도 프로필용으로 판정되게 한다 |

제외: DSH 코어, `dsh-tool-web` 렌더링, Exa summary·highlights·subpages, `statuses`의 `source`(cached/live) 노출.

비용 참고: Exa Contents는 페이지 1,000개당 약 $1다(내용 종류별, [요금](https://exa.ai/pricing)). `deepseek-fetch-api`는 성공 1,000건당 $0.75다.

## 단계

| ID | 결과 | 선행 | 수용 조건 | 검증 |
| --- | --- | --- | --- | --- |
| S1 | 공급자와 플러그인 패키지 | — | D2·D5–D9 동작. `name`·`inject`·`Config`·`apply`를 export하고 default export는 없다. 등록 해제 시 공급자가 제거된다 | 단위 테스트: 요청 형태, 매핑, 잘림, 크롤 실패 2종, HTTP 오류, 리다이렉트 대상 미접촉, 취소·타임아웃, 키 없음, 등록·해제 |
| S2 | 빌드·패키징 | S1 | `build.mjs`가 `packages/web-fetch-exa/index.js`를 만들고, 별도 pack 스크립트가 tarball을 만든다 | Studio 타입 검사·빌드, tarball 내용 확인 |
| S3 | Studio 연동 | S1 | D10. 등록 전 범위가 `profile`이고, 웹 그룹 소속·`exa-contents` 감지·`apiKey` 마스킹이 된다 | 기존 `installed-plugins`·`service-groups` 테스트에 사례 추가 |
| S4 | 문서 | S1–S3 | 패키지 README, 사용 가이드 항목, F1 링크 갱신 | 문서 링크 확인 |
| S5 | 독립 설치 검증 | S2–S4 | 수정하지 않은 DSH(격리 home/profile)에 Studio와 이 패키지만 설치한다. 프로필 등록 → `exa-contents` 선택 → 실제 `web_fetch` 성공 | 런타임 버전·명령·결과 기록. 실제 Exa 키가 필요하다 |

현재 단계: 없음. S1–S5 완료. 0.2.0-rc.2 설치와 npm 게시는 남았다.

## 진행 기록

### S1–S4 완료 (2026-10-21)

- 소스: [web-fetch-exa-provider.ts](../../src/host/web-fetch-exa-provider.ts)(공급자), [web-fetch-exa.ts](../../src/host/web-fetch-exa.ts)(플러그인 진입점), 패키지 [packages/web-fetch-exa](../../packages/web-fetch-exa/README.md)
- 빌드: `build.mjs`가 `packages/web-fetch-exa/index.js`를 만든다. `node pack.mjs web-fetch-exa`가 tarball을 만들며 내용은 `index.js`, `README.md`, `LICENSE`, `package.json`이다. 외부 import는 `dsh-web`·`dsh-launch-environment`·`schemastery`뿐이다.
- Studio 연동: `COMPATIBILITY`, 웹 그룹 `members`, `KNOWN_PROVIDERS`에 추가했다.
- 의존성: `studio/package.json` devDependencies에 `dsh-web`·`dsh-launch-environment`·`schemastery`를 추가했다. 루트 `pnpm-lock.yaml`이 갱신됐다(사용자 승인). `pnpm install`이 lockfile에서 이미 존재하지 않는 `studio/packages/bundle` importer를 지우고, shell peer 범위(`0.2.1-rc.2` 추가)와 일부 외부 항목도 함께 정리했다.
- 검사:
  - `node --import tsx --test test/web-fetch-exa.test.mjs`: 12개 통과. 요청 형태, 잘림(정확히 상한인 경우 포함), 크롤 실패 2종, HTTP 오류(JSON·비JSON, 키 미노출), 잘못된 URL, 실제 로컬 서버로 리다이렉트 대상 미접촉, 취소·타임아웃, 가용성, export 형태, 실제 `WebRuntime` 등록·해제와 `EXA_API_KEY` 대체, 키 없음, Studio 범위·그룹·감지, 실제 projector 스키마의 `apiKey` secret 역할을 확인했다.
  - Studio 전체 단위 테스트 812개 통과. `npm run build`(타입 검사 포함) 통과. 기존 `node pack.mjs`(Studio 0.6.3 tarball) 내용 변화 없음.

### S5 완료 (2026-10-21)

- 런타임: 수정하지 않은 `dsh 0.2.1-rc.2`(`/usr/local/bin/dsh`). 격리 home은 `studio/dist/e2e/home`, 프로필은 `e39`이다.
- 설치: `server.mjs up --profile e39 --skip-build --plugin <dsh-web-fetch-exa-0.1.0.tgz>`. Studio 0.6.3 tarball의 sha256은 `ba49df34…`이다. peer는 런타임 패키지로 해석됐다(설치된 `dsh-web-search-exa`와 같은 방식).
- 브라우저 L0 [plugins-exa-contents.mjs](../../scripts/e2e/plugins-exa-contents.mjs): 10단계 통과, 페이지 오류·플러그인 실패 0건. 확인한 흐름은 다음과 같다.
  1. 설치한 플러그인 목록에 `프로필 공용`으로 나온다.
  2. **프로필에 등록하기 › 등록**을 누르면 `프로필에서 실행 중`이 된다.
  3. 프로필 설정에 `공급자 ID: exa-contents · apiKey: 설정 안 됨`이 나온다.
  4. 가져오기 공급자에서 `exa-contents`를 고를 수 있고 저장된다. patch에는 `insert web-fetch-exa`와 `web.config.fetchProvider: exa-contents`가 기록됐다.
- 실제 `web_fetch`: 사용자 지시에 따라 `desktop` 프로필 `web-search-exa` 행의 Exa 키를 격리 프로필의 `web-fetch-exa.config.apiKey`에 값 출력 없이 복사했다. 서버를 `--mock-llm --reuse-profile`로 다시 띄운 뒤 [agent-exa-contents.mjs](../../scripts/e2e/agent-exa-contents.mjs)를 실행했다. 모델은 mock이고 도구 호출만 스크립트이며, 가져오기는 실제 Exa API로 갔다. 2/2 통과: `Fetched https://example.com/ (HTTP 200)`과 본문 `Example Domain …`. 검증 후 격리 프로필에서 키를 지웠고 `dist/e2e`에 키 문자열이 남지 않은 것을 확인했다. 데스크톱 프로필은 읽기만 했다.
- 실제 응답 확인(공급자 직접 호출)과 그에 따른 수정:
  - 없는 페이지는 `statuses` 오류 404로 오고, 결과도 404와 빈 본문이다(D6 확인).
  - `maxCharacters: 300`이면 Exa는 정확히 300자로 자르면서 잘렸다는 표시를 주지 않았다. 그래서 요청을 `maxCharacters + 1`로 바꿨다(D9). 수정 후 긴 페이지는 `truncated: true`(300자), 짧은 페이지는 `false`였다. 수정한 tarball(sha256 `315e2c40…`)로 등록 흐름 10/10과 실제 가져오기 2/2를 다시 통과했다.
- 미검증: 0.2.0-rc.2 런타임 설치. npm 게시는 하지 않았다.

### 배포 전 리뷰 (2026-10-21, 0.6.4)

- 범위 `16329d72ed..c341740027`를 리뷰어 에이전트가 검토했다.
- 차단 1건, 고침: Exa 오류 본문(`error`·`message`·`tag`)과 전송 오류 문자열에 키가 되돌아오면 `WebError` 메시지로 노출될 수 있었다. 이제 설정된 키를 `[redacted]`로 바꾸고 300자로 자른다. 전송 오류는 `cause`를 붙이지 않는다. 크롤 태그는 `[A-Z0-9_]` 형식만 쓴다. 회귀 테스트를 추가했다.
- 수정 권장 1건, 고침: 200 응답이 `null` 등 예상 밖 형태이면 `TypeError`가 그대로 나갔다. 이제 응답 형태를 검사해 `WEB_PROVIDER_ERROR`로 처리한다. 테스트 6개 사례를 추가했다.
- 수정 권장 1건, 고침: E2E 판정을 강화했다. 등록 흐름은 patch 파일의 `fetchProvider`와 새로고침 뒤 선택값까지 확인한다(14/14). 실제 가져오기는 호출 전에 `fetchProvider: exa-contents`와 공급자 행 활성을 확인한다(3/3). 수정한 tarball(sha256 `e8f07e00…`)로 다시 실행했고, 이후 격리 프로필의 키를 지웠다.

### 한국어 문체 교정 (2026-10-21, 0.6.4)

- `pixie_loop`(배포 절차 4단계 명세 그대로)으로 바뀐 한국어 5문단을 교정했다: CHANGELOG `### 한국어` 4개, 가이드 1개. 5개 모두 통과했고 넘긴 항목과 오류는 없었다. 결과가 달라진 3개를 반영했다. CHANGELOG 검증 문단은 빠진 목록 기호를 되살려 반영했고, 가이드의 `제공받고`는 원문 `받고`로 되돌렸다.

### 배포 (2026-10-21, Studio 0.6.4)

- 배포 E2E는 사용자 결정에 따라 생략했다. 이슈 단계의 독립 설치 검증(등록 14/14, 실제 가져오기 3/3)으로 대신한다.
- GitHub: fork `d5bf0097d8`를 공개 레포 `main` `055dfd9734`(`release: 0.6.4`)로 push했고 Release `v0.6.4`를 만들었다. 공개 스냅샷은 공개 DSH 0.2.0-rc.2 패키지로 테스트 762개 통과(1개 건너뜀)했다.
- npm: 사용자가 직접 게시한다(이 세션 npm 미로그인). Studio는 `node studio/release/deploy.mjs npm`. 플러그인은 공개 커밋으로 빌드한 tarball을 쓴다: `dsh-web-fetch-exa-0.1.0.tgz`, sha1 `32a4df99…`. 게시 후 `npm view`로 확인하는 작업이 남았다.

### 플러그인 구조 분리 (2026-10-21)

- 사용자 결정: 플러그인은 Studio와 따로 버전을 관리하고 따로 배포한다(`0.1.0`). 관리 경로는 `studio/plugins/`다.
- 옮긴 것: 소스는 `plugins/web-fetch-exa/src/{index,provider}.ts`, 테스트는 `plugins/web-fetch-exa/test/`다. Studio 연동 검사는 `test/web-fetch-exa-integration.test.mjs`로 나눴다. 플러그인 전용 `tsconfig.json`과 `CHANGELOG.md`를 추가했다.
- Studio 빌드 체계 원복: `build.mjs`의 플러그인 빌드 줄과 `pack.mjs`의 인자 처리를 0.6.3 상태로 되돌렸다. 배포는 [plugins/release.mjs](../../plugins/release.mjs)가 맡는다.
- 공개 레포: `plugins/README.md`와 `plugins/web-fetch-exa/`를 내보낸다. sync는 플러그인 tsconfig의 base 경로를 바꾼다. `release.mjs`는 fork에만 둔다.
- 0.6.4 노트 정정: 0.6.4 CHANGELOG의 "Exa로 웹 페이지를 가져올 수 있습니다"는 별도 플러그인 설치가 필요하다는 점이 약했다. 다음 Studio 배포 노트에서 바로잡는다.

### 0.1.0 설치 문제와 0.1.1 (2026-10-21)

- 사용자 보고 1: npm 페이지의 설치 안내(`npm i @matamt-dbg/dsh-web-fetch-exa`)를 저장소 루트에서 실행하자 npm이 `Cannot read properties of null (reading 'name')`로 실패했다(pnpm workspace의 링크 구조를 npm arborist가 읽지 못함). 어느 위치에서든 `npm i`는 DSH 프로필에 설치하는 방법이 아니다.
- 사용자 보고 2: DSH **플러그인 → 플러그인 추가**가 0.1.0을 "declares no dsh.bundle"로 거부했다. GUI는 bundle만 받는다. CLI `dsh plugin add`는 경고 후 일반 의존성으로 설치하므로, CLI로만 한 S5 검증이 이 차이를 놓쳤다.
- 0.1.1 변경:
  - `cordis.patch.yml`(`web-fetch-exa` 행 insert만)과 `dsh.bundle.patch`를 추가했다. 설치는 공급자 선택을 바꾸지 않는다.
  - README 설치 절 맨 위에 "`npm i`를 쓰지 말 것"을 적고, GUI·CLI 설치, 키, 공급자 선택, 제거 순서를 적었다.
  - CHANGELOG에 업그레이드 안내를 넣었다. `release.mjs`는 `files` 누락과 `dsh.bundle.patch` 누락을 막는다.
  - 테스트: bundle 선언·패치 내용·README 문구 검사를 추가해 14개가 통과했다. Studio 801개도 통과했다.
- 검증(수정하지 않은 dsh 0.2.1-rc.2, 격리 프로필):
  - [plugins-exa-contents-gui-install.mjs](../../scripts/e2e/plugins-exa-contents-gui-install.mjs): 플러그인 페이지에서 tarball 설치 → 지금 활성화 → bundles 목록에 추가되고 `fetchProvider`는 바뀌지 않았다 → Studio에서 "프로필에서 실행 중", 등록 버튼 없음 → 공급자 목록에 `exa-contents`. 14/14 통과.
  - 키와 `fetchProvider: exa-contents`를 넣고 실제 Exa로 `web_fetch` 3/3 통과. 이후 키를 지웠다.
  - 업그레이드: 0.1.0(npm)을 설치하고 Studio로 등록한 뒤 제거하고 0.1.1을 설치했다. 사용자 행과 bundle 행이 같은 id라 활성 행 하나로 합쳐졌고, 중복 등록 오류는 없었다.
- Studio 가이드(ko·en) 해당 줄을 GUI 설치·`npm i` 경고·0.1.1 동작으로 고쳤다. ko 문장은 `pixie_loop`로 교정해 1/1 통과했다.
- [별도 플러그인 배포 가이드](../plugin-release.md)에 "설치 가능한 형태와 설치 안내" 절을 추가했다.

### 사용자 문서 갱신 (2026-10-21)

- 하이라이트(en·ko)를 0.6.4 기준으로 바꿨다. 빠져 있던 0.6.2(Optimized·Worker·실행 기본값)와 0.6.3(플러그인 탭)을 넣었고, 이번 작업인 Exa 웹 검색·가져오기와 Studio와 함께 배포하는 별도 플러그인(`plugins/`)도 추가했다. 0.6.1 내용은 "이전: 0.6.1"로 내렸다.
- 가이드(en·ko)에 하위 절 "Exa로 웹 검색·가져오기"를 추가하고 목차에 넣었다. 내용은 플러그인 표, 설치(GUI·CLI, `npm i` 불가, 검색 플러그인은 번들이 아님), 행마다 따로 넣는 키, 공급자 선택, 오류 표, 제거 순서다. README 기능 줄도 바꿨다.
- desktop 실사용에서 확인한 사실을 반영했다. 검색 행의 키는 가져오기 행과 공유되지 않으며, 키가 없으면 "registered but unavailable"이 난다.
- 한국어는 `pixie_loop`로 교정했다. 36개 중 34개 통과, 2개는 넘김(목차 링크 줄의 들여쓰기, 긴 설치 문장)이며 둘 다 원문을 유지했다. 바뀐 17개를 반영했고, 들여쓰기가 빠진 1개는 들여쓰기를 되살렸다.
