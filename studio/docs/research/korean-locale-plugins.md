# DSH 한국어 locale 플러그인 조사

조사일: 2026-10. npm 레지스트리 조회와 unpkg·GitHub raw 게시본 확인으로만 조사했다. 패키지는 설치하거나 실행하지 않았다.

## 요약

| 패키지 | 한국어 | 언어 등록 | 사전 등록 | Studio 재사용 |
|---|---|---|---|---|
| `dsh-locale-ko` 0.1.2 | 전용 | 공개 `addLanguage` | 공개 `register` | 구조 참고 적합 |
| `@mimateinn/dsh-i18n` 0.2.6 | 20개 중 하나 | snapshot 직접 대입, `setLocale` 래핑 | 공개 `register` | 내부 구현 의존이라 참고만 |
| `@fang2hou/dsh-locale-ja` 0.5.1 | 없음(일본어) | 공개 `addLanguage` | 공개 `register` | 정석 패턴 예시 |

`@huanlin/dsh-plugin-better-locale`은 별도 조사 대상이라 제외했다.

## 1. `dsh-locale-ko` 0.1.2 (한국어 전용)

이 항목은 주 에이전트가 확인한 내용이다. 나는 코드를 직접 다시 읽지 않았다.

- 소스: https://github.com/juliankang4/dsh-locale-ko (MIT)
- 클라이언트: https://raw.githubusercontent.com/juliankang4/dsh-locale-ko/main/client.js
- README, package.json은 같은 raw 경로(`.../main/`)에 있다.
- README는 작성자가 DSH `0.2.0-rc.2` 데스크톱과 `0.2.1-alpha.2` 웹에서 테스트했다고 밝힌다.

### 등록 코드

- `window.__ModuleLoader__.load`로 id `dsh-locale-ko`, `inject: locale`인 모듈을 등록한다.
- `apply`는 `ctx.effect`로 `addLanguage({ id: 'ko', fallback: 'en' })`를 호출한다.
- `Object.entries(dictionaries)`를 돌며 `ctx.effect`로 `register(ns, 'ko', dict)`를 호출한다.
- 별도의 `pluginDictionaries`는 `bind`로 `common`과 namespace를 탐색한다. `subscribe`와 `queueMicrotask`로 늦게 붙고, namespace가 확인된 뒤 등록을 시도하며, 충돌은 catch한다.

### 범위

- README 범위에 외부 플러그인 17개가 포함된다.
- 추출 스크립트가 있다. `source/en.json`은 두 DSH 태그에서 병합한다.
- placeholder 테스트가 있다.

### 호스트 쪽 구성과 테스트 (주 에이전트 확인)

- 호스트용 `index.js`의 `apply`는 비어 있다.
- `cordis.patch.yml`이 `locale-ko` 항목(name `dsh-locale-ko`)을 삽입한다.
- `test/dictionary.test.js`를 읽어 보니 다음을 검사한다. 모르는 namespace·key, 값이 문자열이고 비어 있지 않은지, placeholder 다중집합 일치, 늦게 붙는 서드파티 사전, 소유자가 이미 한국어를 등록한 경우의 충돌, 정렬된 key.
- 테스트는 읽기만 했고 실행하지 않았다.

### 한계

- 충돌을 catch하는 정책은 플러그인 사전에만 적용된다. 일반적인 공존 정책은 아니다.
- `ko` 언어 등록(`addLanguage`)에는 가드가 없다. Studio의 [shell.tsx](../../src/shell.tsx)가 이미 `addLanguage({ id: 'ko' })`를 호출하므로, 둘을 함께 켜면 중복 id 오류가 날 수 있다. 실행해서 확인하지는 않았다.

## 2. `@mimateinn/dsh-i18n` 0.2.6 (20개 로케일, 한국어 포함)

- npm: https://www.npmjs.com/package/@mimateinn/dsh-i18n
- 소스: https://github.com/mimateinn/dsh-i18n (MIT, 별 2개, 2026-10-01 push)
- 게시본: https://unpkg.com/@mimateinn/dsh-i18n@0.2.6/lib/client.js
- 한국어 README: https://unpkg.com/@mimateinn/dsh-i18n@0.2.6/README.ko.md
- 로케일 레지스트리: https://raw.githubusercontent.com/mimateinn/dsh-i18n/957142430c47a424c433ffa5fa5fa3a0cae11a3c/scripts/locales.mjs (`ko`, `한국어`)
- peer: `@deepseek-ai/dsh-client-locale` `>=0.1.0-rc.6 <0.1.1 || >=0.1.1-rc.1 <0.2.0-0`, `@deepseek-ai/dsh-llm`. Node `^22.19.0 || >=24`.

### 등록 코드 (게시본 grep 확인)

- 사전은 `ctx.effect(() => locale.register(ns, langId, dict), ...)`로 등록한다. 공개 API이고 해제도 연결된다.
- 게시본에 `addLanguage` 문자열이 0건이다. 대신 `locale.getLocale()` snapshot의 `locales`에 항목을 넣은 새 객체를 `locale.snapshot`에 직접 대입하고 `locale.publish`를 호출한다.
- `locale.setLocale`을 래핑하고, 선택값을 브라우저 `localStorage`에 저장한다. DSH 서버 설정(`locale.preference`)에는 저장되지 않는다.
- 사전에 없는 키는 영어로 대체한다. `MutationObserver`로 DOM을 보정하고, 긴 영어 문구는 설정된 LLM으로 자동 번역한다.
- 한국어 사전은 번들 안에 `"ko":{"common":{"ok":"확인",...` 형태로 있다. README 기준 로케일당 715개 문자열이다.

### 평가

`snapshot` 대입과 `setLocale` 래핑은 비공개 내부 구현에 의존한다. [AGENTS.md](../../../AGENTS.md)의 변경 범위 규칙상 Studio가 따라 하면 안 되고, 참고만 한다.

## 3. 참고: `@fang2hou/dsh-locale-ja` 0.5.1 (일본어)

- npm: https://www.npmjs.com/package/@fang2hou/dsh-locale-ja
- 소스: https://github.com/fang2hou/dsh-locale-ja (MIT)
- 게시본: https://unpkg.com/@fang2hou/dsh-locale-ja@0.5.1/lib/client.js
- peer: `@deepseek-ai/dsh-client-locale` `^0.1.5-rc.2`, `inject: ["locale"]`

게시본의 등록부는 `locale.addLanguage({ id, label, fallback: "en" })`를 `ctx.effect`로 감싼다. namespace마다 `locale.register(ns, id, dict)`를 호출하고 disposer를 모아 해제한다. 42개 namespace, 1,257개 문자열이며, 선택값은 DSH 설정에 저장된다고 README에 적혀 있다. 공개 API만 쓰는 구조 예시다.

## Studio 시사점

- 구조는 `addLanguage` → namespace별 `register` → `ctx.effect` 해제 연결이 표준 패턴이다. `dsh-locale-ko`와 `dsh-locale-ja`가 같은 방식이다.
- `ko` 등록이 Studio와 외부 팩에서 겹친다. 동시 활성화 정책이 필요하다. 예를 들면 `ko`가 이미 있으면 `addLanguage`를 건너뛰는 가드다. 이 가드는 공개 `getLocale().locales`로 만들 수 있지만, 이번 조사에서 검증하지는 않았다.
- 문구를 복사하면 MIT 고지를 유지해야 한다. 직접 번역이면 이 의무가 없다.

## 한계

- `web_search`를 쓸 수 없어 npm 검색만 사용했다. 이름이 `dsh`, `locale`, `i18n`, `korean`과 무관한 패키지는 놓쳤을 수 있다. GitHub 전체 검색은 하지 않았다.
- 번들은 grep으로만 확인했고 전체를 정독하지 않았다. `addLanguage` 부재는 문자열 검색 0건에 근거한다.
- 번역 품질과 키 커버리지(대상 DSH 버전 대비 누락)는 검증하지 않았다.
- 대상 DSH 버전과의 런타임 호환성은 설치·실행하지 않아 미검증이다.
