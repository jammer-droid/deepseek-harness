# <이슈 번호 또는 버전> <주제> E2E 검증

<!-- 복사해 `<이슈 번호>-<주제>-e2e.md` 또는 `release-<버전>-e2e.md`로 저장한다. 꺾쇠 부분만 채우고, 공통 절차는 링크로 둔다. -->

이 문서를 받은 에이전트(**검증자**)는 아래 단계를 실행하고 보고 양식으로 결과를 낸다. 제품을 고치지 않는다. 판정 단계·올림 규칙·기다리기는 [에이전트 E2E 검증 지침](README.md#판정-단계)을 따른다.

## 범위

- 대상: <기능·이슈 문서 링크>, 대상 커밋 `<sha>`, 런타임 `dsh <버전>`(수정하지 않은 설치본).
- 쓰는 위치: `studio/dist/e2e/<이슈 번호 또는 버전>/`와 하네스 기본 경로(`studio/dist/e2e/home`, `studio/dist/e2e/shots/`). tracked 파일·사용자 프로필은 바꾸지 않고 커밋하지 않는다.
- 외부 전송: <L1에 넣는 내용(화면 문구, 접근성 스냅샷 등)>은 Pixie 제공자·결정 엔진으로 전송된다. <실모델 실행이 있으면 모델·비용 범위>.
- 비밀값: <`--with-secrets` 사용 여부와 이유. 쓰지 않으면 "없음">.

## 0. 시작 확인

1. `git status --short`, `git branch --show-current`, `git log --oneline -3`을 기록한다.
2. `dsh --version`이 `<버전>`인지 확인한다. 다르면 설치 검증 단계는 `대기`다.
3. 도구 확인: <`pixie_loop`·`judge` 등>. 없으면 해당 L1 단계는 `환경 차단`이다. 화면 검사는 Playwright 모듈·Chrome, 에이전트 제어·`wait.mjs`는 PATH의 `zstd`가 필요하다([사전 조건](README.md#브라우저-검사-l0)). 없으면 해당 단계는 `환경 차단`이며 자동 설치하지 않는다.
   기본값이 아닌 home·프로필을 쓰면 모든 명령 전에 `export STUDIO_E2E_HOME=<절대 경로> STUDIO_E2E_PROFILE=<이름>`.
4. 서버를 띄운다.

   ```sh
   node studio/scripts/e2e/server.mjs up <--with-desktop-plugins> <--with-secrets ...>
   ```

   `ok: false`면 [step별 대처](README.md#격리-서버)를 따른다. `secrets.warning`이 있으면 <진행 조건>.

## 1. L0 검사

| 단계 | 명령 | 기준선 | 올림 조건 |
| --- | --- | --- | --- |
| 기본 | `node studio/scripts/e2e/smoke.mjs` | 12/12, pageerror 0, 플러그인 실패 0 | 셀렉터 실패 → L1 셀렉터 복구 |
| <에이전트 제어> | `node studio/scripts/e2e/<시나리오>.mjs` (`up --mock-llm`) | <통과 수> | 불일치 → L2 결함 후보 |
| <기능 시나리오> | `node <시나리오>.mjs` | <통과 수·값> | <조건> |

- 화면 시나리오는 [browser.mjs](../e2e/browser.mjs)의 `run()`·`app.step()`, 에이전트 제어 시나리오는 [agent.mjs](../e2e/agent.mjs)의 `runAgent()`([가이드](../e2e/agent-scenarios.md))로 쓴다. 상태를 바꾸는 행동(저장·삭제)은 이 단계에서만 한다.
- RPC 확인이 필요하면 `STUDIO_TEST_ISOLATED=1 STUDIO_TEST_PORT=<port> node studio/scripts/check-web-runtime.mjs '<url>'`.

## 2. L1

- 셀렉터 복구: L0 요약에 `repair.items`가 있으면 [L1 셀렉터 복구](../e2e/selector-repair.md) 명세를 그대로 쓴다. 적용 후 L0을 다시 실행한다.
- <판정 항목(문구 품질, 실모델 응답 등)>: 항목 파일 `<경로>`, 명세 <링크 또는 본문>. 명세는 `studio-pixie-loop-guide` 스킬([SKILL.md](../../release/docs/appendix/studio-pixie-loop-guide/SKILL.md), [상세](../../release/docs/appendix/pixie-loop.md))을 따라 쓴다. calibration은 실제 데이터로 만든다. 기준값을 낮추지 않는다.
- 실모델 세션·게이트·루프 완료는 `node studio/scripts/e2e/wait.mjs <session|loop|gate> ...`로 기다린다.

## 3. 정리

```sh
node studio/scripts/e2e/server.mjs down
```

`portFree: true`를 기록한다.

## 보고 양식

```markdown
## <제목> E2E 결과

- 대상 커밋·런타임·패키지 SHA256:
- 비밀값 복사: <없음 | keys/subscriptions, 경고 여부>

| 단계 | 결과 | 판정 | 근거 |
| --- | --- | --- | --- |
| 기본 smoke | 통과/실패/… | L0 | 통과 수, pageerror |
| <단계> | | L0/L1/L2 | job id, 통과·escalated·error 수 |

- 발견(결함 후보): 파일·화면·재현 단계
- 대기·미실행·환경 차단과 이유
- 산출물 경로 (`studio/dist/e2e/...`)
```

결과값은 `통과 / 실패 / 발견 / 대기 / 미실행 / 환경 차단` 중 하나다. 스크린샷은 경로만 적는다.
