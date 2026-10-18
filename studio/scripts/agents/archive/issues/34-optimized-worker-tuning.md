# #34 Optimized 메인-worker 최적화 E2E 검증

이 문서를 받은 에이전트(**검증자**)는 아래 단계를 실행하고 보고 양식으로 결과를 낸다. 제품을 고치지 않는다. 판정 단계·올림 규칙·기다리기는 [에이전트 E2E 검증 지침](../../README.md#판정-단계)을 따른다.

## 범위

- 대상: [#34 명세](../../../../docs/issues/34-optimized-worker-tuning.md)의 "검증" 절, 대상 커밋은 0단계에서 기록한 `HEAD`, 런타임 `dsh 0.2.1-rc.2`(수정하지 않은 설치본).
- 쓰는 위치: `studio/dist/e2e/34/`와 하네스 기본 경로(`studio/dist/e2e/home`, `studio/dist/e2e/shots/`). tracked 파일·사용자 프로필은 바꾸지 않고 커밋하지 않는다.
- 외부 전송: 없음. 에이전트 제어는 각본 모델(`--mock-llm`, 토큰 0)로 한다. 화면 확인(3단계)의 L1을 쓰면 화면 문구가 Pixie 제공자·결정 엔진으로 전송된다.
- 비밀값: 없음.

## 0. 시작 확인

1. `git status --short`, `git branch --show-current`, `git log --oneline -3`을 기록한다.
2. `dsh --version`이 `0.2.1-rc.2`인지 확인한다. 다르면 1~3단계는 `대기`다.
3. 도구 확인: PATH의 `zstd`(에이전트 제어), Playwright 모듈·Chrome(화면 확인). 없으면 해당 단계는 `환경 차단`이며 자동 설치하지 않는다([사전 조건](../../README.md#브라우저-검사-l0)).
4. 서버를 띄운다.

   ```sh
   node studio/scripts/e2e/server.mjs up --mock-llm
   ```

   `ok: false`면 [step별 대처](../../README.md#격리-서버)를 따른다.

## 1. L0 검사

| 단계 | 명령 | 기준선 | 올림 조건 |
| --- | --- | --- | --- |
| 기본 | `node studio/scripts/e2e/smoke.mjs` | 12/12, pageerror 0, 플러그인 실패 0 | 셀렉터 실패 → L1 셀렉터 복구 |
| Optimized·Worker | `node studio/scripts/e2e/agent-optimized-worker.mjs` | 모든 검사 통과 | 불일치 → L2 결함 후보 |
| Optimized RPC | `STUDIO_TEST_ISOLATED=1 STUDIO_TEST_PORT=<port> node studio/scripts/check-optimized-runtime.mjs '<url>'` | 마지막 줄까지 출력, 오류 없음 | 실패 → L2 결함 후보 |

`agent-optimized-worker.mjs`가 확인하는 것(기대값은 명세에서 고정):

- 새 Optimized의 도구(`edit_batch`가 `edit` 다음, 메인 전용 도구 포함), `studio-batch` Config(`maxLines: null`, `noSpill: true`), Worker 역할 1개(`inherit`, `fresh`, `replace` Tool Filter 11개).
- 미리보기: bash `timeoutMs` 기본 120000과 새 설명, job_output 120000, read `limit`·`offset` 설명, 공통 지침과 새 `tool:read` 문구. 예전 `tool:read` 문장이 없음.
- 실제 세션: 메인은 `subagent_role`·`judge`·`pixie_loop`·`ask_user_question`을 받는다. Worker 자식은 Tool Filter 도구를 받지 않고, `judge` 호출은 거부되며 `read`는 실행된다. Worker 시스템 프롬프트에 공통 지침·`tool:read`·persona가 있고, workflow·goal 지침은 없다. 메인에는 Worker persona가 없다.
- 편집 후 저장하면 `customized`, 기본값 복구 후에는 템플릿 값으로 돌아오고 `applied`. 삭제는 거부된다.

## 2. 이전 버전 Optimized 갱신 (L0)

1. 서버를 내리지 않은 채, 격리 프로필의 `studio-data/presets.json`(경로는 `server.mjs status`의 프로필 디렉터리 아래)을 `studio/dist/e2e/34/presets.before.json`으로 복사한다.
2. 복사본이 아닌 원본에서 `studio-optimized` 행의 `templateHash`를 지우고 `request.prompt`를 `OLD_SHIPPED_PROMPT`로 바꾼다. 이 프로필은 하네스 전용이므로 바꿔도 된다.
3. `node studio/scripts/e2e/server.mjs up --mock-llm --reuse-profile`로 다시 띄운다.
4. `studioCatalog/listPresets`의 Optimized `request.prompt`가 `Read whole files in one call;`로 시작하고 `customized`가 없으면 통과다.

## 3. 화면 확인 (L0, 선택)

브라우저 하네스로 프리셋 목록과 Config 화면을 확인한다. 셀렉터는 [browser.mjs](../../../e2e/browser.mjs)의 `app.step()`을 쓴다.

- Optimized 카드: `편집`이 활성, `삭제`가 비활성, `기본값으로 복구` 버튼이 있다.
- 편집 → 실행 설정 → Config: `여러 파일 한 번에 읽기`(studio-batch)는 켜진 채 잠겨 있고 "Studio가 넣은 값이며, 프리셋을 기본값으로 복구할 때만 바뀝니다"가 보인다. `한 파일 여러 곳 고치기`(studio-edit-batch)는 꺼진 채 "스키마를 읽을 수 없어 편집할 수 없습니다."가 보인다.
- 도구 목록에서 `edit_batch`를 선택하고 설명을 편집할 수 있다.
- 라이트·다크와 480px 폭에서 각각 스크린샷을 `studio/dist/e2e/shots/`에 남긴다. 문구 품질 판정이 필요하면 L1로 올린다.

## 4. 정리

```sh
node studio/scripts/e2e/server.mjs down
```

`portFree: true`를 기록한다.

## 보고 양식

```markdown
## #34 Optimized 메인-worker 최적화 E2E 결과

- 대상 커밋·런타임·패키지 SHA256:
- 비밀값 복사: 없음

| 단계 | 결과 | 판정 | 근거 |
| --- | --- | --- | --- |
| 기본 smoke | 통과/실패/… | L0 | 통과 수, pageerror |
| Optimized·Worker | | L0 | 통과·실패 검사 이름 |
| Optimized RPC | | L0 | 출력 마지막 줄 |
| 이전 버전 갱신 | | L0 | prompt 앞부분, customized |
| 화면 확인 | | L0/L1 | 스크린샷 경로 |

- 발견(결함 후보): 파일·화면·재현 단계
- 대기·미실행·환경 차단과 이유
- 산출물 경로 (`studio/dist/e2e/...`)
```

결과값은 `통과 / 실패 / 발견 / 대기 / 미실행 / 환경 차단` 중 하나다. 스크린샷은 경로만 적는다.
