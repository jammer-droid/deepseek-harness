# DSH 한국어 번역 진행 (#30 S5)

이 문서를 받은 에이전트(**조율자**)는 남은 DSH 네임스페이스를 서브에이전트(**번역자**)들에게 나눠 맡긴다. 번역자는 번역만 하고, 판정은 스크립트 [dsh-ko-judge.mjs](../dsh-ko-judge.mjs)가 Jev로 한 번에 처리한다. 판정 요청과 응답이 대화에 쌓이지 않으므로 세션이 길어지지 않는다.

진행 상태는 저장소 파일에만 있다. 세션이 끊기면 새 세션에서 이 문서를 다시 받아 이어 간다. 이전 대화는 필요 없다.

## 작업 위치와 범위

- 워크트리 `/Users/home/playground/vibecoding/deepseek-harness-ko-locale`, 브랜치 `studio/feat/ko-locale`. 명령은 `studio/`에서 실행한다.
- 고칠 수 있는 파일: `studio/src/dsh-ko/*.ts`, `studio/docs/research/ko-locale/judge/*`. 다른 파일은 고치지 않는다.
- 커밋은 조율자만 로컬에서 한다. 푸시·병합은 하지 않는다.
- 판정 스크립트는 Jev 키를 `TYPESAFE_API_KEY` 환경 변수에서 찾고, 없으면 `~/.dsh/.credentials.yaml`에서 읽기만 한다. 판정할 문구는 TypeSafe로 전송된다.

## 역할

| | 조율자 (이 세션) | 번역자 (서브에이전트) |
| --- | --- | --- |
| 하는 일 | 대상 나누기, 판정 스크립트 실행, 실패 키 재작성 지시, 등록·검사·커밋 | 맡은 네임스페이스의 사전 파일 작성, 실패 키 다시 쓰기 |
| 쓰는 파일 | `src/dsh-ko/index.ts`, `judge/unresolved.md`, 커밋 | 맡은 `src/dsh-ko/<ns>.ts`만 |
| `judge` 도구 | 쓰지 않는다 | 쓰지 않는다 |

판정 기록 `judge/<ns>.json`은 판정 스크립트만 쓴다. 손으로 고치지 않는다.

## 0. 시작 확인

1. `git status --short`에 `studio/node_modules`와 진행 중 사전 파일(`index.ts`에 없는 `src/dsh-ko/<ns>.ts`) 말고 다른 항목이 없다. 있으면 목록을 보여 주고 진행 여부를 묻는다.
2. `node --import tsx scripts/dsh-ko-next.mjs`로 진행률을 확인한다.
3. 판정할 문구가 TypeSafe로 전송된다는 것을 한 줄로 알린다.

## 1. 나누기

1. `node --import tsx scripts/dsh-ko-next.mjs --json`의 `queue`(작은 순서)와 `inProgress`를 읽는다.
2. 남은 네임스페이스를 **묶음**으로 나눈다. 묶음 하나는 키 합계 약 250개 이하로 하고, 300키가 넘는 네임스페이스(예: `conversation`)는 혼자 한 묶음이다. 진행 중 네임스페이스는 그 이름이 든 묶음에 넣는다.
3. 한 번에 번역자 최대 4명을 띄운다. 묶음이 더 많으면 앞 묶음이 끝난 뒤 다음 묶음을 맡긴다.

## 2. 번역자에게 맡기기

`subagent_role`의 `Worker` 역할에 묶음마다 아래 지시를 보낸다. `<…>`만 채운다.

````text
DSH 한국어 사전을 번역한다. 판정은 하지 않는다(judge 도구 쓰지 않음).
워크트리: /Users/home/playground/vibecoding/deepseek-harness-ko-locale/studio (명령은 여기서 실행)
맡은 네임스페이스: <ns1, ns2, ...>
쓸 수 있는 파일: src/dsh-ko/<ns>.ts (맡은 네임스페이스만). index.ts, judge/*.json, 다른 파일은 고치지 않는다. 커밋하지 않는다.

1. 용어와 문체: docs/research/ko-locale/README.md의 "용어집", "번역 불가 목록", "S2 샘플 판정" 절을 읽고 따른다. 같은 묶음에서 같은 영어는 같은 한국어로 쓴다.
2. 네임스페이스마다 `node --import tsx scripts/dsh-ko-next.mjs --ns <ns>`로 남은 키와 영어를 본다.
   [alpha2 only]·[rc2 only] 키도 번역한다. `rc2: …`가 붙은 키는 두 영어 모두에 맞게 쓴다.
3. 번역 규칙
   - 문장은 합쇼체(-습니다/-십시오), 버튼·라벨·제목은 짧은 명사구.
   - {name} 자리 표시자는 이름과 개수를 그대로 둔다. 줄바꿈과 Markdown도 영어대로 둔다.
   - 제품·코드 이름(DeepSeek, DSH, MCP, Cron, PTC, UTC, 탭 이름 Trajectory·Chat)은 그대로 둔다.
   - 영어가 Intl 로케일 값(`zh-CN`, `en`)인 키는 `ko-KR`.
   - 앞뒤 공백이 있거나 문장이 중간에 끊긴 키는 다른 키와 이어 붙는 조각이다.
     `git grep -n "<key>" dsh-v0.2.1-alpha.2 -- :/packages`로 이어 붙이는 코드를 찾아, 이어 붙인 한국어 문장이 자연스럽도록 각 조각을 쓴다. 공백도 맞춘다.
   - 뜻이 애매하면 위 git grep으로 쓰이는 화면 코드를 본다.
4. 파일 형식(src/dsh-ko/<ns>.ts). 파일이 이미 있으면 기존 ko·fallback 항목을 그대로 두고 남은 키만 더한다.
   import type { DshKoNamespace } from '../dsh-ko-locale.ts';

   export default {
     ko: {
       'key.name': '번역문',
     },
   } satisfies DshKoNamespace;
   키는 원문 순서, 문자열은 작은따옴표, \n과 \' 이스케이프.
5. 네임스페이스마다 `node --import tsx -e "import('./src/dsh-ko/<ns>.ts').then(m=>console.log(Object.keys(m.default.ko).length))"`로 파일이 읽히는지 확인한다. 출력된 수가 번역한 키 수와 같아야 한다.
6. 보고: 네임스페이스별 번역한 키 수, 조각으로 처리한 키, 용어집에 없어 새로 정한 용어(영어 → 한국어). 그 외 설명은 쓰지 않는다.
````

## 3. 판정 반복 (조율자)

번역자가 보고하면 그 묶음에 대해:

1. `node --import tsx scripts/dsh-ko-judge.mjs <ns ...>`를 실행한다. 아직 판정하지 않은 문구만 20개씩 Jev에 보낸다. 판정을 마친 문구는 다시 보내지 않는다.
2. 출력의 `FAIL` 줄(키, 남은 시도, 자연/의미/문체 점수, 영어, 현재 한국어)을 **같은 번역자에게** `send_message`로 보낸다.

   ```text
   아래 키가 판정을 통과하지 못했다. 통과 기준: 자연스러움 ≥1.5, 의미 ≥0.6, 문체 ≥0.5.
   점수가 낮은 항목을 고려해 src/dsh-ko/<ns>.ts의 해당 값만 다시 써라. 같은 문구를 그대로 두지 마라.
   (문체가 낮은 짧은 라벨은 동사형 "…하기"보다 명사구나 합쇼체 문장이 통과하기 쉽다.)
   <FAIL 줄 붙여 넣기>
   끝나면 "완료"와 바꾼 키 수만 보고한다.
   ```

   번역자가 이미 끝났으면 새 `Worker`에게 위 지시와 2절 지시의 규칙 부분을 함께 보낸다.
3. 다시 1로 간다. 첫 번역 뒤 다시 쓰기 3번까지 통과하지 못한 키는 스크립트가 `fallback`으로 옮긴다. 출력에 `FAIL`이 없으면(exit 0) 판정이 끝난 것이다.
4. 스크립트가 exit 2로 끝나면(키 없음, Jev 오류 3번 연속) 멈춤 조건이다.

## 4. 등록·검사·커밋 (조율자)

판정이 끝난 네임스페이스마다 차례로:

1. `src/dsh-ko/index.ts`에 import와 등록 줄을 이름 순서대로 더한다. import 이름은 네임스페이스를 camelCase로 바꾼 것이다(`settings.models` → `settingsModels`).
2. `node --import tsx scripts/dsh-ko-judge.mjs --ledger <ns>`로 미해결 키를 `judge/unresolved.md`에 더한다. 번역자가 보고한 새 용어는 `| <ns> | 용어 | <영어> | <한국어> | — | 번역자 제안 |` 행으로 직접 더한다.
3. 검사 3종:

   ```sh
   node --import tsx scripts/check-dsh-ko-locale.mjs
   node --import tsx --test test/dsh-ko-locale.test.mjs test/dsh-ko-judge.test.mjs
   npx tsc -p tsconfig.client.json
   ```

   실패하면 원인 네임스페이스의 번역자에게 고치게 한다(자리 표시자 불일치는 그 키를 다시 쓰고 3절 판정을 다시 돈다). 두 번 고쳐도 실패하면 멈춤 조건이다.
4. 커밋:

   ```sh
   git add src/dsh-ko/<ns>.ts src/dsh-ko/index.ts docs/research/ko-locale/judge/<ns>.json docs/research/ko-locale/judge/unresolved.md
   git commit -m "feat(studio): add Korean <ns> dictionary (#30 S5)" -m "<keys> keys: pass <a>, fixed <b>, fallback <c>"
   ```

   숫자는 `judge/<ns>.json`의 `result` 개수다. 커밋 훅이 막으면 우회하지 말고 멈춘다.
5. 한 줄 보고: `<ns>: <keys>키, 통과 a, 재작성 b, fallback c`.

`next: none`이 될 때까지 1–4를 반복한다.

## 멈춤

다음 중 하나면 진행 중인 판정 회차까지 마치고 멈춘다. 번역자는 `interrupt_agent`로 멈추게 한다. 등록하지 않은 사전 파일은 다음 세션이 이어 간다.

- 판정 스크립트가 exit 2로 끝났다(Jev 키 없음, 연속 오류).
- 검사가 두 번 고쳐도 실패하거나, 커밋 훅이 막았다.
- 번역자가 맡지 않은 파일을 고쳤다(`git status`로 확인). 그 변경은 되돌리지 말고 보고한다.
- 사용자가 멈추라고 했다.

## 보고

1. `dsh-ko-next.mjs`의 첫 줄(진행률)과 남은 큐.
2. 이 세션에서 커밋한 네임스페이스별 한 줄 보고, 진행 중으로 남긴 네임스페이스.
3. 이번 세션에 `unresolved.md`에 더한 행 수.
4. 멈춘 이유. `next: none`이면 다음 일을 알린다. 사용자가 `unresolved.md`를 검토하고, 명세 [#30](../../docs/issues/30-korean-locale.md)의 S5를 완료로 바꾼 뒤 S6 설치 검증을 진행한다. 명세는 고치지 않는다.

Jev 점수는 한국어 문구에 대한 신호이며 보증이 아니다.
