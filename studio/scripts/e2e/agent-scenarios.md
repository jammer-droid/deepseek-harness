# 에이전트 제어 시나리오 작성 가이드

역할 서브에이전트·Tool Filter·persona·대화 상속·게이트처럼 **에이전트가 어떻게 제어되는지**를 검증자가 스스로 세션을 만들고 돌려 확인하는 시나리오 작성법이다. 판정 단계(L0/L1/L2)와 기본 흐름은 [에이전트 E2E 검증 지침](../agents/README.md#기본-흐름)을 따른다. 화면 확인은 [browser.mjs](browser.mjs), 세션 제어는 이 문서의 [agent.mjs](agent.mjs)를 쓴다.

## 1. 모델을 고른다

| 모델 | 서버 | 쓰는 곳 | L0으로 판정할 수 있는 것 |
| --- | --- | --- | --- |
| **목 모델(기본)** | `server.mjs up --mock-llm` | 정책 적용, 실행 차단, 상속, persona 전달, 부모 영향 | 전부. 토큰 0, 결과가 항상 같다 |
| 실제 모델 | `server.mjs up --with-desktop-plugins --with-secrets keys,subscriptions` | 지시 준수, 응답 품질, 게이트 번역 | 저장된 정책·모델에 제공된 도구처럼 모델 선택과 무관한 사실만. 행동은 L1 |

정책이 지켜지는지는 목 모델로 확인한다. 실제 모델은 도구를 부를지 말지 스스로 정하므로, "금지 도구를 호출하지 않았다"를 차단 통과로 적지 않는다.

## 2. 목 모델 각본

[mock-llm.mjs](mock-llm.mjs)는 Messages API 형식의 가짜 모델이다. **대화 안의 지시 줄이 각본**이다. 가장 최근 사용자 텍스트(부모의 메시지 또는 자식의 task)에 있는 지시를 요청마다 하나씩 실행한다.

```text
MOCK tool <도구 이름> <JSON 인자>   도구 하나 호출
MOCK say <텍스트>                   이 텍스트로 턴 종료
```

- 지시를 다 쓰면 `MOCK done [도구 결과 요약]`으로 턴을 끝낸다. 지시가 없어도 턴은 끝난다.
- 부모 메시지에 `subagent_role` 호출을 넣고, 그 `task`에 자식용 각본을 넣으면 부모·자식을 한 번에 조종한다.
- 서버는 모든 요청을 `<home>/e2e-runs/<profile>/mock-llm.jsonl`(0600)에 남긴다: 세션 id, **모델에 제공된 도구 이름**, 시스템 프롬프트, 사용자 텍스트(항목당 2,000자), 응답 결정. 인증 헤더는 남기지 않는다. 이것이 **적용 증거**다.
- 세션 모델은 기본 DeepSeek 모델 그대로이며, 서버가 DeepSeek 엔드포인트를 목 모델로 돌린다. 프리셋 모델을 따로 지정할 필요가 없다.

## 3. 시나리오 뼈대

```js
import { mockSay, mockScript, runAgent } from './agent.mjs';

await runAgent({ name: '<이름>' }, async t => {
  // 1) 기대값을 먼저 고정한다 (실행 결과에서 거꾸로 만들지 않는다)
  const preset = await t.preset({ tools: ['read', 'write', 'subagent_role'], deny: ['bash'], roles: [/* … */] });
  const session = await t.session(preset);

  // 2) 각본으로 한 턴 실행하고, 스크립트 안에서 끝날 때까지 기다린다
  const after = await t.prompt(session, mockScript([
    ['subagent_role', { action: 'call', role: 'review', task: mockScript([['write', { file_path: 'x', content: 'x' }], mockSay('done')]) }],
    mockSay('parent-done'),
  ]));
  if (!(await t.settle(session, { after, children: 1 }))) return;

  // 3) 증거를 모아 기대값과 비교한다
  const [child] = await t.children(session, { markers: ['PERSONA_X'] });
  t.expectChild('review child', child, { deny: ['bash', 'write'], persona: 'PERSONA_X', rejected: ['write'] });
});
```

| API | 하는 일 |
| --- | --- |
| `t.preset({ tools, roles, deny, prompt, model })` | 임시 Studio 프리셋 저장·반영. 실행이 끝나면 삭제 |
| `t.session(presetId)` | 세션 생성 |
| `t.prompt(sessionId, text)` | 메시지 전송. 반환값(이전 종료 턴 수)을 `settle`의 `after`로 넘긴다 |
| `t.settle(sessionId, { after, turns, children, timeoutMs })` | 부모 턴과 자식들의 첫 턴이 끝날 때까지 스크립트 안에서 대기. 시간 초과는 실패로 기록 |
| `t.children(sessionId, { markers })` | 자식마다 `policy`(저장 증거: `child-policies/<id>.json`), `evidence`(세션 로그: 도구 호출·거부·턴), `capture`(목 모델: 제공 도구·persona·이력 표식) |
| `t.expectChild(name, child, expect)` | 아래 기대값 비교 |
| `t.check(name, fn)` | 그 밖의 사실. `fn`이 던지거나 `false`면 실패 |
| `t.evidence(id)`, `t.captures()`, `t.rpc(method, args)` | 낮은 수준 접근 |
| `t.reply(id)`, `t.handoff(id, input)` | L1로 넘길 응답 원문과 항목 |

`expectChild`의 기대값:

| 키 | 확인 |
| --- | --- |
| `deny` | 저장된 금지 목록이 같고, 그 도구들이 모델에 제공되지 않았다 |
| `tools` | 모델에 제공된 도구 목록(순서 무관) |
| `persona` | 저장된 persona가 같고 자식 모델에 도달했다(Fresh는 시스템 프롬프트, Fork는 시스템 갱신 메시지) |
| `rejected` | 그 도구 호출이 Studio 정책으로 **실행 단계에서** 거부됐다 |
| `executed` | 그 도구가 정상 실행됐다 |
| `inheritsMarker` / `notInheritsMarker` | 부모의 완료된 이전 턴 표식이 자식 대화에 있다/없다. 목 모델 캡처 필요 |

## 4. 작성 규칙

- **표식:** persona·이력 확인에는 `PERSONA_<짧은 임의값>`처럼 다른 문장에 우연히 나올 수 없는 표식을 쓴다. 이력 표식은 **이전 턴**에 넣고 그 턴이 끝난 뒤 위임한다. 위임하는 턴이나 자식 task에 넣으면 상속 증거가 아니다.
- **실행 차단:** 자식 각본에서 금지 도구를 일부러 호출하고 `rejected`로 확인한다. 허용 도구도 하나 호출해 `executed`로 확인한다(전부 막힌 경우와 구분).
- **상태:** 금지 도구가 실수로 실행돼도 피해가 없는 인자를 쓴다(`bash`는 `true`, `write`는 검증용 이름의 임시 파일). 작업 디렉터리의 파일을 지우거나 덮어쓰는 각본을 쓰지 않는다.
- **여러 턴:** 턴마다 `t.prompt` → `t.settle`. 다음 턴은 이전 턴의 반환값을 `after`로 넘긴다.
- **재시작 복원:** `server.mjs down` → `server.mjs up --reuse-profile --mock-llm --skip-build`로 같은 home·프로필을 다시 띄운 뒤 다른 시나리오 파일에서 기존 자식에 메시지를 보낸다. 새 자식을 만드는 것은 복원 검사가 아니다.
- **증거 구분:** 보고에 저장 증거(정책 파일), 적용 증거(목 모델 캡처·요청 헤더), 자기 보고(자식 응답)를 섞지 않는다. 자기 보고는 L1 자료일 뿐이다.

## 5. 실제 모델과 L1

실제 모델 시나리오는 같은 `runAgent`로 쓰되 각본 대신 일반 지시를 보낸다. L0에는 정책 파일·제공 도구·턴 종료처럼 모델 선택과 무관한 사실만 둔다. 행동은 응답을 L1로 넘긴다.

```js
const after = await t.prompt(session, '리뷰어 역할로 README.md 첫 줄을 요약해 달라고 위임하고, 결과를 한 문장으로 알려 줘.');
await t.settle(session, { after, children: 1, timeoutMs: 600_000 });
const [child] = await t.children(session);
t.expectChild('reviewer policy', child, { deny: ['write'] });   // L0: 모델과 무관
t.handoff('reviewer-summary', `Task: summarize README first line\nReply:\n${t.reply(child.id)}`);  // L1
```

- 요약의 `l1.items`(`studio/dist/e2e/agent/<이름>/l1-items.jsonl`)를 판정 항목이 여럿이면 `pixie_loop`, 한두 개면 `judge`에 넘긴다. 명세는 `studio-pixie-loop-guide` 스킬([SKILL.md](../../release/docs/appendix/studio-pixie-loop-guide/SKILL.md))을 따른다.
- 판정은 응답만으로 한다(판정만 필요하므로 `maxAttempts: 1`). 예: "지시한 형식(한 문장)을 지켰는가", "persona 지시(예: 근거 인용)를 따랐는가".
- 실제 모델 실행 전에 `secrets.warning`을 확인한다([격리 서버](../agents/README.md#격리-서버)).

## 6. 실행과 보고

```sh
node studio/scripts/e2e/server.mjs up --mock-llm
node studio/scripts/e2e/<시나리오>.mjs
node studio/scripts/e2e/server.mjs down
```

출력은 JSON 요약 하나다: `model`(`mock`/`live`), `ok`, `passed`, `failed`, `failures`(자식 id·불일치 사실), `l1`. 보고 표에는 항목마다 판정 단계를 적는다.

기준 예시는 [agent-roles.mjs](agent-roles.mjs)다: Fresh/Fork × 기본값/extend/replace, persona 전달, 금지 도구 실행 거부, Fork만 이력 상속, 부모 도구 유지.

## 실측 (2026-10-18, DSH 0.2.1-rc.2, 목 모델)

| 시나리오 | 결과 |
| --- | --- |
| `agent-roles.mjs` | 5/5 통과, 약 2초, 모델 토큰 0. 자식 3개 생성·정책 파일·제공 도구·persona·실행 거부·이력 상속 확인 |
| 기대값 하나를 일부러 틀린 사본 | 실패 1건: `deny ["write"] ≠ ["write","bash"]; tools … ; denied tool bash offered…; bash was not rejected` |

Fork 자식의 persona는 시스템 프롬프트가 아니라 시스템 갱신 메시지로 모델에 전달된다(부모 시스템 프롬프트를 이어받기 때문). 하네스는 둘 다 "모델에 도달"로 본다.

아직 하지 않은 것: 재시작 복원 시나리오, 실제 모델 시나리오의 L1 실행, Pixie 게이트 시나리오.
