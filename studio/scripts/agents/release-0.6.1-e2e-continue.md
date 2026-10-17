# Studio 0.6.1 E2E 이어하기 지침

이 문서는 [0.6.1 E2E 절차](release-0.6.1-e2e.md)의 **E1만 끝난 상태**에서 E2–E5를 이어 하기 위한 인수인계다. 이 문서를 받은 에이전트가 **검증자**다. 기준 절차와 이 문서가 충돌하면 기준 절차가 우선한다. 기준 절차를 먼저 끝까지 읽는다.

- 작성: 2026-10-17 20:10 (Asia/Seoul)
- 작성 시점 소스: 브랜치 `studio/feat/workflow`, HEAD `c6ab77d8e7`
- E1 기록: `studio/dist/e2e/0.6.1/e1.md` (Git 제외 경로)

## 1. 현재 상태

E1은 완료됐고, E2–E5는 아래 이유로 남아 있다.

| 단계 | 상태 | 막는 것 |
| --- | --- | --- |
| E1 | 완료 | — |
| E2 한국어 후보 | 환경 차단 | 세션에 `pixie_loop` 도구 없음 |
| E3 문서 사실 검증 | 환경 차단 | `pixie_loop` 없음 + `## 0.6.1` 절 미커밋 |
| E4 문체 교정 | 환경 차단 | `pixie_loop` 없음 + E3 대상 커밋 없음 |
| E5 설치·RPC | 대기 | `## 0.6.1` 절 미커밋, 작업 트리 dirty |

E1 확정 수치(재확인 없이 인용해도 되지만, 아래 3번의 재검증 조건을 먼저 본다):

- rc.1 `64 ns / 2900 keys / 0 unresolved`, rc.2 `65 / 2910 / 0`.
- 네 소스(0.2.0-rc.2, alpha.2, rc.1, rc.2) 동시 검사: `strayNamespaces` 0, `strayKey` 0.
- rc.2 기준 누락 **63키**, 자리표시자 불일치 **3키**, 사전 없는 네임스페이스 `pluginMarket`(78)·`secretMask`(2)·`deepseek-model-label-1017`(1, 번역 제외).
- 영어가 바뀐 기존 번역 **10키**, 그중 버전 충돌 **3키**.
- 지원 버전 문구 누락 7곳: `CHANGELOG.md:7,49`, `README.md:47`, `docs/guide.md:28`, `docs/guide.ko.md:28`, `docs/highlights.md:5`, `docs/highlights.ko.md:5`.
- 플러그인 라벨 없음: `@deepseek-ai/dsh-web-deepseek-api`, `@deepseek-ai/dsh-client-ui-deepseek-model-label-1017`.
- `npm --prefix studio test`: exit 1, 692 tests / 691 pass / 1 fail(`## 0.6.1` 절 부재).

산출물: `e1.md`, `source-0.2.1-rc.1.json`, `source-0.2.1-rc.2.json`, `ko-rc2-report.json`, `ko-changed-en.json`, `changed-en.mjs`, `ko-items.jsonl`(149줄, E2 입력), `build-items.mjs`.

## 2. 시작 확인

```sh
git status --short
git branch --show-current
git log --oneline -5
dsh --version
ls studio/dist/e2e/0.6.1/
```

1. 도구 목록에 `pixie_loop`이 있는지 확인한다. **없으면 이 세션도 E2–E4는 환경 차단**이다. `judge`·번역 스킬·서브에이전트로 대신하지 않는다.
2. 기준 절차가 바뀌었는지 확인한다: `git log -1 --oneline -- studio/scripts/agents/release-0.6.1-e2e.md`. `c6ab77d8e7` 이후 커밋이 있으면 최신판을 다시 읽고 그 문서를 따른다.
3. E1 산출물이 없으면(다른 worktree·기계) E1을 다시 실행한다: `e1.md`의 E1.1–E1.4 명령. `changed-en.mjs`도 Git 제외 경로라 함께 사라지므로, 그 경우 `e1.md` E1.3의 필드(`ns`, `key`, `alpha2`, `rc1`, `rc2`, `ko`, `placeholders`, `conflict`)대로 다시 만든다(alpha.2→없으면 0.2.0-rc.2 영어와 rc.1·rc.2 영어를 비교, ko는 `dshKo`에서 읽기). 입력이 모두 Git ref·저장소 파일이라 재현된다.
4. `studio/src/dsh-ko/**`가 `c6ab77d8e7` 이후 바뀌었으면 E1.2·E1.3 수치를 다시 계산한다. 바뀌지 않았으면 위 수치를 그대로 쓴다.
5. E2·E3 시작 전에 사용자에게 한 줄로 알린다: 항목(UI 문구·문서 문단·검증 기록)이 Pixie 모델 제공자와 결정 엔진(TypeSafe Jev)으로 전송된다.

## 3. E2 — rc.1·rc.2 한국어 후보

E2는 0.6.1 문서 커밋을 기다리지 않는다. `pixie_loop`과 E1 산출물만 있으면 지금 시작할 수 있다.

1. 용어집: `studio/docs/research/ko-locale/README.md`의 "용어집" 표와 아래 문체 문단을 `shared`에 넣는다(기준 절차 E2.1).
2. 항목 파일 `studio/dist/e2e/0.6.1/ko-items.jsonl`을 만든다. **149항목**이다.
   - rc.2 누락 63키(`ko-rc2-report.json`의 `missing`)
   - 사전 없는 `pluginMarket` 78 + `secretMask` 2
   - 영어가 바뀌었고 충돌 없는 7키(`ko-changed-en.json`에서 `conflict: false`)
   - 제외: 버전 충돌 3키(`pluginManager.installDoneRestart`, `reasonIncompatibleVersion`, `restartNotice`), `deepseek-model-label-1017`
   - **150이 아니라 149인 이유**: `settings.webSearch::useSearchApiHint`의 rc.2 영어가 `"... For the new Web Search API's features and pricing, see the "`로 끝에 공백이 있다. 뒤에 링크가 붙는 조각이므로 기준 절차 E2.2에 따라 항목에서 빼고 `e2.md`에 적는다. 63 + 80 + 7 = 150에서 이 1개를 빼면 149다.
   - 입력은 **rc.2 영어 원문만**. 위 조각 외에 영어가 비었거나 앞뒤 공백이 있는 키가 또 나오면 그것도 빼고 보고서에 적는다.

   기준 절차 본문은 "누락 63 + 80 = 143항목"이라고 적고 이어서 "충돌 없는 7키는 새 영어 기준으로 다시 번역한다"고 한다. 두 문장을 합친 150에서 위 조각 1개를 뺀 149가 맞다. 계산이 다르면 멈추고 사용자에게 확인한다.

   생성 로직은 아래와 같다. **이미 `dist/e2e/0.6.1/ko-items.jsonl`(149줄)과 생성기 `dist/e2e/0.6.1/build-items.mjs`를 만들어 두었다.** 기준 문서·E1 산출물이 바뀌지 않았으면 그대로 쓰고, 바뀌었으면 `cd studio && node dist/e2e/0.6.1/build-items.mjs`로 다시 만든 뒤 149줄인지 확인한다.

   ```js
   import { readFileSync, writeFileSync } from 'node:fs';
   const rc2 = JSON.parse(readFileSync('dist/e2e/0.6.1/source-0.2.1-rc.2.json', 'utf8'));
   const report = JSON.parse(readFileSync('dist/e2e/0.6.1/ko-rc2-report.json', 'utf8')).reports[0];
   const changed = JSON.parse(readFileSync('dist/e2e/0.6.1/ko-changed-en.json', 'utf8'));
   const skipNs = new Set(['deepseek-model-label-1017']);
   const skipKey = new Set(['pluginManager::installDoneRestart', 'pluginManager::reasonIncompatibleVersion', 'pluginManager::restartNotice']);
   const ids = new Set();
   for (const ns of report.namespaces) for (const key of ns.missing) ids.add(`${ns.ns}::${key}`);
   for (const ns of report.untranslated) if (!skipNs.has(ns)) for (const key of Object.keys(rc2.namespaces[ns].keys)) ids.add(`${ns}::${key}`);
   for (const row of changed) if (!row.conflict) ids.add(`${row.ns}::${row.key}`);
   const dropped = [];
   const items = [...ids].filter(id => !skipKey.has(id)).map(id => {
     const cut = id.indexOf('::'); const ns = id.slice(0, cut); const key = id.slice(cut + 2);
     const input = rc2.namespaces[ns].keys[key].en;
     if (typeof input !== 'string' || input.trim() === '' || input !== input.trim()) { dropped.push(id); return null; }
     return { id, input };
   }).filter(Boolean);
   writeFileSync('dist/e2e/0.6.1/ko-items.jsonl', items.map(x => JSON.stringify(x)).join('\n') + '\n');
   console.log('items', items.length, 'dropped', dropped);
   ```

3. 판정 명세는 기준 절차 E2.3의 JSON을 **그대로** `pixie_loop`에 넘긴다. `items.path`는 `studio/dist/e2e/0.6.1/ko-items.jsonl`, `output`은 `studio/dist/e2e/0.6.1/ko-done.jsonl`, `run_in_background: true`. 시작이 거부되면 오류가 지목한 질문 문구만 고치고 기준값(자연스러움 ≥ 1.5, 의미 ≥ 0.6, 문체 ≥ 0.5)을 낮추지 않는다.
4. 회수: job id를 보고서에 남기고 `job_output`으로 요약을 받는다. `errors`는 일시적 원인이면 그 id만 한 번, `stopped`면 결과 파일에 없는 id만 다시 실행한다. 통과 항목은 다시 돌리지 않는다.
5. 후보: 통과 항목을 `dist/e2e/0.6.1/ko-candidates.json`(`{ns: {key: ko}}`)에 쓴다. `escalated`는 마지막 출력·실패 검사·피드백과 함께 `ko-escalated.md`에 남긴다. 직접 고쳐 통과로 바꾸지 않는다.
6. `settings.webSearch` 후보는 `studio/src/dsh-ko/settings.webSearch.ts`의 기존 용어와 맞춘다. `baseUrl`(Messages API base URL)과 `searchApiBaseUrl`(Search / Fetch API)이 구별되는지 확인한다.
7. `settings.webSearch.searchGuideUrl`처럼 영어가 URL인 키는 `[가-힣]` codeCheck를 통과할 수 없다. 억지로 한국어를 넣지 말고 `escalated`로 남긴다. 같은 이유로 제품명·숫자만 있는 키가 escalated되면 그대로 둔다.
8. 같은 영어가 여러 키에 있으면 후보가 같은지 확인하고 다르면 보고서에 적는다.
9. E2가 끝나면 `e2.md`에 통과/escalated/error 수, job id, 토큰 사용량, 후보 경로, 뺀 키(`useSearchApiHint` 등)를 적는다.

## 4. E3 — 문서 사실 검증

진입 조건: `studio/release/CHANGELOG.md`에 `## 0.6.1` 절이 **커밋**되어 있다. 미커밋 편집본으로 시작하지 않는다.

```sh
git log -1 --format=%H
git show HEAD:studio/release/CHANGELOG.md | grep -c '^## 0.6.1'
git status --short   # 비어 있어야 한다
```

1. 기준 커밋을 `E3_TARGET`로 기록한다. 이후 모든 경로·줄 번호는 이 커밋 기준이다.
2. 기준 절차 E3.1대로 `dsh-studio-v0.6.0` 태그 이후 바뀐 문단을 `facts-items.jsonl`로 뽑는다. id는 `파일:줄`. **E3 시작 시점 작업 트리가 clean이어야 줄 번호가 결과 파일과 맞는다.**
3. `shared`에는 기준 절차 E3.2의 원문을 요약 없이 이어 붙인다. `studio/docs/verification/dsh-0.2.1-rc.2.md`, `dsh-0.2.1-rc.1.md`, `older-dsh-web.md`, `studio/packages/shell/package.json`의 version·peerDependencies, E1 요약, E5 결과가 있으면 `e5.md`까지 넣는다.
4. `pixie_loop` 명세는 기준 절차 E3.3을 그대로 쓴다. `output`은 `facts-done.jsonl`.
5. **인용 재확인은 직접 스크립트로 한다.** 결과의 모든 `quote`가 2번 `shared` 원문에 (공백만 정규화해) 그대로 있는지 확인하고, 없는 인용이 있는 통과 항목은 `인용 불일치`로 강등한다. Pixie 피드백을 사실로 옮겨 적지 않는다.
6. CHANGELOG 영어·한국어 문단을 직접 짝지어 한쪽에만 있는 주장을 적는다.
7. `e3.md`: 항목별 `supported / no_claims / 발견`, 발견마다 `파일:줄 · 주장 · 근거 상태`.
8. rc.2 범위 주의: rc.2는 설치·RPC·Desktop 표시만 검증됐고 역할 자식 실행·재시작은 rc.1에서만 검증됐다. 문서가 rc.1 결과를 rc.2에 적용하면 `overstated`다.

## 5. E4 — 한국어 문체 교정

E3과 같은 커밋이 대상이다. [`studio/docs/release-workflow.md`](../../docs/release-workflow.md)의 "4. 한국어 문체 교정" 명세를 경로만 바꿔 쓴다.

- `items.path` → `studio/dist/e2e/0.6.1/ko-polish.jsonl`
- `output` → `studio/dist/e2e/0.6.1/ko-polish-done.jsonl`
- 반영 단계는 하지 않는다. 입력과 출력이 다른 항목만 `ko-polish-diff.md`에 `파일:줄 / 원문 / 교정안`으로 적고, 거름 규칙(구조 변경·용어 변경)에 걸린 교정안에 표시한다.

## 6. E5 — 패키지 설치와 RPC

진입 조건을 모두 확인한 뒤에만 시작한다.

```sh
git status --short                              # 비어 있어야 한다
node -e "console.log(require('./studio/packages/shell/package.json').version)"   # 0.6.1
dsh --version                                   # 0.2.1-rc.2
```

작성 시점에는 version 0.6.1이 미커밋이고 `## 0.6.1` 절이 없다. 커밋 후 `E3_TARGET`을 E5 대상 커밋으로 삼는다. `E3_TARGET` 이후 tracked 변경이 있으면(예: E2 후보를 `src/dsh-ko`에 반영) 그 커밋을 새 대상으로 잡고 패키지를 다시 만든다.

2026-10-17 20:10 현재 `dsh --version`은 `0.2.1-rc.2`다(같은 날 검사 중 rc.1 → rc.2로 갱신됨). rc.1이 나오면 Desktop 앱 갱신·재기동 후 다시 확인하고, 그래도 rc.1이면 E5는 `대기`로 두고 실제 버전을 기록한다.

1. 패키징·해시:

   ```sh
   STUDIO_PACK_DIST=dist/e2e/0.6.1/release node studio/pack.mjs
   shasum -a 256 studio/dist/e2e/0.6.1/release/*.tgz
   ```

   파일 이름에 `0.6.1`이 없으면 멈춘다.

2. 격리 home·프로필·포트:

   ```sh
   HOME_DIR="$PWD/studio/dist/e2e/0.6.1/home"       # 절대 경로
   DSH_HOME="$HOME_DIR" dsh --profile verify --from-default-profile web --dump-config
   DSH_HOME="$HOME_DIR" dsh plugin --profile verify add "$PWD/studio/dist/e2e/0.6.1/release/<file>.tgz"
   ```

   사용자의 desktop·web 프로필과 현재 GUI는 쓰지 않는다. 포트는 비어 있음을 확인한 값(예: 19390).

3. 서버는 관리형 background job으로 띄운다(`DSH_HOME=... dsh --profile verify --host 127.0.0.1 --port <port> --no-open`). 출력된 인증 URL로:

   ```sh
   STUDIO_TEST_ISOLATED=1 STUDIO_TEST_PORT=<port> node studio/scripts/check-web-runtime.mjs '<인증 URL>'
   ```

   토큰이 든 URL은 보고서·파일에 남기지 않는다.

4. 브라우저 도구가 있으면 같은 격리 서버에서 DSH 언어를 한국어로 바꾸고 본다: 플러그인 관리 화면의 `{peers}`/`{reason}` 노출, 설정 → 웹 검색의 영어 잔존과 `baseUrl`·`maxUsesHint` 뜻 불일치, Master 목록의 `dsh-web-deepseek-api` 라벨 누락, 그 밖의 미반영 영어. 없으면 `미실행`.
5. rc.2 역할 자식(Fresh/Fork) persona·Tool Filter·재시작 복원은 미검증이다. 지시가 있을 때만 `dsh-rc1-compat-check.md` 4절(격리 B 모드)을 rc.2로 실행한다.
6. 구버전(0.2.0-rc.2·alpha.2·rc.1) 재검증은 지시가 있을 때만 한다.
7. 서버를 종료하고 포트에 listener가 없는지 확인한다.
8. `e5.md`: 패키지 SHA256, 런타임 버전·경로, 설치 경고, RPC 4개 결과, 브라우저 확인 여부, 역할 자식 실행 여부, 서버 종료.

## 7. 범위와 금지

- 쓰는 위치는 `studio/dist/e2e/0.6.1/` 하나다. tracked 파일, `src/`, 릴리즈 문서, 사용자 프로필, 현재 GUI를 바꾸지 않는다.
- 커밋·푸시·배포·이슈 변경을 하지 않는다. 제품 결함을 발견해도 고치지 않고 보고만 한다.
- 수정하지 않은 DSH 런타임에 패키징한 Studio만 설치한다. workspace 테스트 통과를 독립 설치 성공으로 적지 않는다.
- `pixie_loop` 없음·시작 거부·Calibration 실패를 다른 도구나 낮은 기준으로 우회하지 않는다.

## 8. 완료 보고

기준 절차의 "보고 양식"을 그대로 쓴다. 단계별 판정은 `통과 / 실패 / 발견 / 대기 / 미실행 / 환경 차단` 중 하나다.

### 결정 필요 (E2·E3 전에 사용자에게 확인)

- 버전 충돌 3키: `pluginManager.installDoneRestart`(rc.1+ `{reason}`), `reasonIncompatibleVersion`(`{peers}` ↔ `{requirements}`), `restartNotice`(rc.1+ `{reason}`). 하나의 ko 문구로 구버전과 rc.1·rc.2를 모두 맞출 수 없다. 현재 ko는 구버전 기준이다. 선택지: (a) rc.2 기준으로 바꾸고 구버전 화면의 중괄호 노출을 감수, (b) 구버전 기준 유지, (c) 런타임별 사전 분기(제품 변경, 별도 승인 필요).
- 지원 버전 문구 7곳과 플러그인 라벨 2개는 0.6.1 문서/코드 커밋에서 처리할지, E2 후보와 함께 반영할지.
