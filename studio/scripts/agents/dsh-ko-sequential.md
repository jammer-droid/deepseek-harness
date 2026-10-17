# DSH 한국어 번역 순차 진행 (#30 S5)

이 문서를 받은 에이전트는 남은 DSH 네임스페이스를 작은 것부터 하나씩 번역한다. 한 네임스페이스를 끝낼 때마다 커밋하고, 세션이 끊기면 새 세션에서 이 문서를 다시 받아 이어 간다. 진행 상태는 저장소 파일에만 있으므로 이전 세션의 대화는 필요 없다.

네임스페이스 하나를 번역하는 방법은 `studio-dsh-ko-translate` 스킬을 따른다. 이 문서는 순서, 이어 하기, 커밋, 멈출 조건만 정한다. 둘이 충돌하면 이 문서를 따른다.

## 작업 위치와 범위

- 워크트리 `/Users/home/playground/vibecoding/deepseek-harness-ko-locale`, 브랜치 `studio/feat/ko-locale`. 명령은 `studio/`에서 실행한다.
- 고칠 수 있는 파일: `studio/src/dsh-ko/*.ts`, `studio/docs/research/ko-locale/judge/*`. 다른 파일은 고치지 않는다.
- 커밋은 네임스페이스마다 로컬에서만 한다. 푸시·병합은 하지 않는다.

## 0. 시작 확인

1. 도구에 `judge`가 있고, 스킬 목록에 `studio-dsh-ko-translate`가 있다. 없으면 멈추고 알린다.
2. `git status --short`에 `studio/node_modules` 말고 다른 항목이 없다. 있으면 목록을 보여 주고 진행 여부를 묻는다. 단, 아래 *진행 중* 네임스페이스의 파일은 이어 할 대상이므로 그대로 둔다.
3. 판정할 문구가 설정된 판정 엔진(외부일 수 있음)으로 전송된다는 것을 한 줄로 알린다.
4. `node --import tsx scripts/dsh-ko-next.mjs`로 진행률과 다음 네임스페이스를 확인해 보여 준다.

## 1. 반복

`dsh-ko-next.mjs`가 `next: none`을 출력할 때까지 반복한다.

1. **다음 네임스페이스:** `node --import tsx scripts/dsh-ko-next.mjs`가 고른다. 등록되지 않은 사전 파일이 있으면 그 네임스페이스(*진행 중*)를, 없으면 키가 가장 적은 미번역 네임스페이스를 고른다. 남은 키, 한 버전에만 있는 키(`[alpha2 only]`), 버전 사이에 영어가 다른 키(`rc2: …`)가 함께 나온다. 순서를 임의로 바꾸지 않는다.
2. **번역:** `studio-dsh-ko-translate` 절차를 따른다. 번역할 키는 `dsh-ko-next.mjs`가 보여 준 남은 키다(스킬의 "check 스크립트가 보고한 빠진 키" 대신). 키가 60개를 넘으면 약 20개씩 판정할 때마다 바로 반영한다.
   - 통과한 키는 `src/dsh-ko/<ns>.ts`의 `ko`에, 미해결 키는 `fallback`에 넣는다.
   - 판정 기록 `docs/research/ko-locale/judge/<ns>.json`의 `rows`에 이어서 쓴다.
   - `index.ts`에는 네임스페이스를 다 끝낼 때까지 등록하지 않는다. 등록되지 않은 파일은 검사와 테스트가 읽지 않으므로 중간에 끊겨도 안전하고, 다음 세션은 남은 키부터 이어 간다.
3. **등록:** 남은 키가 0이 되면 `src/dsh-ko/index.ts`에 import와 등록 줄을 추가한다. 등록 줄은 네임스페이스 이름 순서로 둔다.
4. **검사:** 스킬의 검사 3종을 실행한다. 실패하면 그 네임스페이스 파일만 고쳐 다시 실행한다. 두 번 고쳐도 실패하면 *멈춤* 조건이다.
5. **미해결 기록:** 미해결 키와 용어집 제안이 있으면 `docs/research/ko-locale/judge/unresolved.md`에 이어 쓴다. 파일이 없으면 다음 표 머리로 만든다.

   ```markdown
   | 네임스페이스 | 키 | 영어 | 최선 후보 | 점수(자연/의미/문체) | 메모 |
   | --- | --- | --- | --- | --- | --- |
   ```

   용어집 제안은 키 칸에 `용어`, 최선 후보 칸에 제안 용어를 쓴다.
6. **커밋:** 그 네임스페이스의 파일만 스테이징하고 커밋한다.

   ```sh
   git add src/dsh-ko/<ns>.ts src/dsh-ko/index.ts docs/research/ko-locale/judge/<ns>.json docs/research/ko-locale/judge/unresolved.md
   git commit -m "feat(studio): add Korean <ns> dictionary (#30 S5)" -m "<keys> keys: pass <a>, fixed <b>, fallback <c>, verbatim/locale <d>, unjudged <e>"
   ```

   (`unresolved.md`가 바뀌지 않았으면 빼고 스테이징한다.) 커밋 훅이 막으면 우회하지 말고 멈춘다.
7. **한 줄 보고:** `<ns>: <keys>키, 통과 a, 재작성 b, fallback c` 형식으로 쓴 뒤 다음 네임스페이스로 넘어간다. 네임스페이스 사이에는 사용자 확인을 기다리지 않는다.

## 멈춤

다음 중 하나면 지금 하던 배치까지 파일에 반영하고 멈춘다. 그런 다음 아래 *보고*를 한다.

- `judge` 도구가 사라지거나 결과의 `engine`이 처음과 달라졌다.
- 판정 호출이 연달아 3번 도구 오류로 끝났다.
- 검사가 두 번 고쳐도 실패하거나, 커밋 훅이 막았다.
- 같은 세션에서 판정한 키가 400개를 넘었다. 이때는 진행 중인 네임스페이스를 끝까지 하지 않아도 된다. 배치 단위로 반영하고 멈춘다.
- 사용자가 멈추라고 했다.

## 보고

1. `node --import tsx scripts/dsh-ko-next.mjs`의 첫 줄(진행률)과 다음 네임스페이스.
2. 이 세션에서 끝낸 네임스페이스별 한 줄 보고, 진행 중으로 남긴 네임스페이스와 남은 키 수.
3. 이번 세션에 `unresolved.md`에 추가한 행 수.
4. 멈춘 이유. `next: none`이면 다음 일을 함께 알린다. 사용자가 `unresolved.md`를 검토하고, 명세 [#30](../../docs/issues/30-korean-locale.md)의 S5를 완료로 바꾼 뒤 S6 설치 검증을 진행해야 한다. 명세는 고치지 않는다.

Jev 점수는 한국어 문구에 대한 신호이며 보증이 아니다.
