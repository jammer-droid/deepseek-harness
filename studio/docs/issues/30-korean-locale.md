---
kind: implementation-spec
status: ready
---

# #30 DSH 전체 한국어 번역

## 요약

DSH 화면 문구 전체를 한국어로 제공한다. Studio는 이미 `ctx.locale.addLanguage({ id: 'ko', fallback: 'en' })`로 한국어를 추가해 두었으므로, DSH 각 네임스페이스에 `ctx.locale.register(ns, 'ko', dict)`로 한국어 사전을 등록한다. 번역은 별도 세션에서 에이전트 스킬로 진행한다. 에이전트가 사전 묶음을 번역하고 `judge` 도구로 검수해, 통과한 문구만 반영하고 다음 묶음으로 넘어간다.

- GitHub 이슈: [#30](https://github.com/jammer-droid/deepseek-harness/issues/30)
- 기준 브랜치·시작 커밋: `studio/feat/workflow` @ `b288fc95fa`
- 대상 DSH: `0.2.0-rc.2 || 0.2.1-alpha.2`(Studio 지원 범위). 본체 수정 없음
- 관련: 스킬 `studio-ko-review`(이슈 단위 Studio 한국어 검수, 이전 `studio-ko-locale-review`를 대체), `judge` 도구(#27)

## 조사 결과

- **원문:** 저장소 태그 `dsh-v0.2.0-rc.2`에 rc.2 사전 원본(`packages/client/*/src/**/locales.ts` 등)이 있다. 설치 앱(`app.asar`)의 `dsh-client-locale`이 `0.2.0-rc.2`임을 확인했다. alpha.2는 현재 workspace(`0.2.1-alpha.2`) 소스를 쓴다. 두 버전 사이에 사전 파일 14개가 바뀌었다.
- **분량(S1 확정):** rc.2 58개 네임스페이스 2,615키, alpha.2 62개 2,773키, 합집합 2,779키. 큰 묶음: `conversation` 371, `pluginManager` 209, `trajectory` 192, `chat` 190, `schedule.manager` 188. 상세는 [S1 결과](../research/ko-locale/README.md).
- **등록 동작(rc.2 `LocaleRuntime.register`):** 네임스페이스·언어별로 따로 저장하므로 DSH 사전보다 먼저 등록해도 된다. 같은 네임스페이스에 `ko`가 이미 있으면 예외가 난다. 조회 순서는 활성 언어의 fallback 체인(ko → en), 그다음 `common` 네임스페이스. `{name}` 자리 표시자는 `translate`가 치환한다.
- **번역 불가:** 데스크톱 네이티브 메뉴와 대화상자(`apps/desktop/src/locale.ts`, 앱 소유), Host 쪽 문구(도구 설명·오류 메시지), 사전을 거치지 않고 코드에 쓴 문구.

## 범위

**포함**

- 원문 추출 스크립트: 지정한 git 참조(태그·작업 트리)에서 네임스페이스·키·en·zh를 JSON으로 뽑는다.
- 번역 스킬: 입력은 네임스페이스 하나의 원문, 출력은 Studio 안의 `ko` 사전 파일. 약 20개씩 묶어 `judge`로 판정하고, 기준 미달이면 고쳐서 다시 판정한다. 통과한 문구만 반영한다.
- Studio 안의 사전: 네임스페이스별 `ko` 사전 파일과 등록 코드. 네임스페이스마다 등록 실패를 따로 잡는다(DSH가 나중에 `ko`를 직접 넣는 경우).
- 빠진 키 검사: rc.2와 alpha.2 원문 각각에 대해, 사전에 없는 키와 원문에 없는 키를 보고한다.
- 번역 불가 목록.

**제외**

- DSH 본체 사전 파일 수정, 업스트림 기여
- 문서(README 등) 번역
- Studio 자체 문구(기존 ko·en·zh 사전과 `studio-ko-review`가 맡음)

## 결정

- **D1 원문 수집:** git 태그 `dsh-v0.2.0-rc.2`와 alpha.2 소스에서 읽는다. 앱 패키지 해제는 하지 않는다.
- **D2 검수 기준:** 사용자 결정 — 기존 `studio-ko-locale-review`와 같은 세 질문과 기준(자연스러움 score ≥ 1.5/2, 의미 일치 ≥ 0.6, 합쇼체·짧은 라벨 ≥ 0.5). 도구 오류·빠진 답은 미판정으로 기록하고 실패로 세지 않는다. S2 샘플로 재확인한다.
- **D3 진행 단위:** 네임스페이스 하나가 한 작업 단위. 큰 네임스페이스는 약 20문구 묶음으로 나눠 판정한다.
- **D4 용어집:** 사용자 결정 — S1 추출 결과에서 자주 나오는 용어를 뽑아 Studio가 이미 쓰는 한국어(세션·프리셋·게이트 등)에 맞춘 초안을 만들고, 사용자 검토 후 확정해 스킬에 넣는다.
- **D5 검수 방식:** 사용자 결정 — 에이전트 스킬. Pixie Gate 자동 검수는 쓰지 않는다.

## 단계

| ID | 결과 | 선행 | 수용 조건·검증 |
| --- | --- | --- | --- |
| S1 | 원문 추출 스크립트, 네임스페이스 목록과 키 수(rc.2·alpha.2) | — | 완료: [S1 결과](../research/ko-locale/README.md). 해석 실패 0, 추출 단위 테스트 2/2 |
| S2 | 용어집과 검수 기준 확정 | S1 | 완료: [S2 판정](../research/ko-locale/README.md#s2-샘플-판정-검수-기준-재확인). 20문구 중 첫 통과 9, 재작성 통과 6, 미해결 5, 미판정 0. 기준 유지 |
| S3 | Studio 사전 등록 코드와 빠진 키 검사 | S1 | 완료: [dsh-ko-locale.ts](../../src/dsh-ko-locale.ts), 사전 묶음 [dsh-ko/index.ts](../../src/dsh-ko/index.ts), 검사 `node --import tsx studio/scripts/check-dsh-ko-locale.mjs`. 단위 테스트 5/5 |
| S4 | 번역 스킬 작성·설치 | S2, S3 | 완료: [SKILL.md](../../scripts/agents/studio-dsh-ko-translate/SKILL.md). 다른 세션에서 `sidebarCodePreview`(3키) 번역 완료, 첫 판정 3/3 통과, 검사 3종 통과([판정 기록](../research/ko-locale/judge/sidebarCodePreview.json)) |
| S5 | 네임스페이스별 번역(반복, 별도 세션) | S4 | 완료: 62개 네임스페이스 2,779키. 한국어 2,721(판정 통과 2,449, 승인 161, 판정 없이 둔 토큰·형식 111), 영어 유지 58. 빠진 키 검사 rc.2·alpha.2 통과. 목록 [unresolved.md](../research/ko-locale/judge/unresolved.md) |
| S6 | 독립 설치 검증 | S5 | 수정하지 않은 rc.2 + 패키징 Studio, 한국어 선택 시 화면 확인 |

현재 단계: S6(독립 설치 검증). S2에서 기준은 그대로 두고, 미해결 문구는 사전에서 빼 영어 fallback으로 둔다. 재작성은 키당 3회까지, 이어 붙이는 조각 문구는 문장 전체로 판정한다. 작업 브랜치 `studio/feat/ko-locale`(별도 worktree `deepseek-harness-ko-locale`).

## S3 구현 메모

- `registerDshKo`는 네임스페이스마다 `locale.register(ns, 'ko', dict)`를 따로 부른다. 한 네임스페이스에서 예외가 나면(DSH가 `ko`를 이미 넣은 경우) 경고만 남기고 나머지는 등록한다. 빈 사전은 등록하지 않는다. `shell.tsx`가 `ctx.effect`로 감싸 플러그인 해제 시 모두 지운다.
- 사전 파일은 `studio/src/dsh-ko/<namespace>.ts` 하나에 `{ ko, fallback }`. `fallback`은 판정을 통과하지 못해 영어로 두는 키다. 빠진 키 검사는 `ko`와 `fallback`을 합쳐 원문 키를 모두 덮는지 본다.
- 검사 기준: rc.2와 alpha.2 각각에 대해 빠진 키·자리 표시자 불일치가 없어야 한다. 한 버전에만 있는 키·네임스페이스는 허용하고, 두 버전 모두에 없는 키만 실패로 센다.
- 실제 `LocaleRuntime`은 CSS 모듈 때문에 Node 테스트에서 불러올 수 없다. 테스트는 rc.2 `register`의 중복 예외와 해제 동작을 그대로 흉내 낸 가짜를 쓴다. 실제 동작은 S6 설치 검증에서 확인한다.
- 검증 환경 메모: 이 worktree에서 host 타입 검사(`batch-tool.ts`·`task-tool.ts` 8건)와 `node build.mjs`(`zod` 해석 실패)는 S3 변경 전에도 똑같이 실패한다. client 타입 검사와 client 번들은 통과한다.

## S4 메모

- 스킬 원본은 `studio/scripts/agents/studio-dsh-ko-translate/SKILL.md`다. 번역 개발용 스킬이라 Studio 패키지(`build.mjs`가 배포하는 스킬)에는 넣지 않는다.
- 설치: `cp -R studio/scripts/agents/studio-dsh-ko-translate ~/.dsh/skills/`. 사용자 프로필을 바꾸므로 사용자가 직접 하거나 승인한다.
- 시범 번역 후보: 키가 적은 `settings.locale`(1), `sidebarCodePreview`(3), `claude-code-mods`(4, alpha.2에만 있음).
- 스킬 명령(`node --import tsx …`)은 `studio/`에서 실행해야 한다. 저장소 루트에서는 `tsx`를 찾지 못한다.
- 임시 사전으로 확인함: `check-dsh-ko-locale.mjs`가 빠진 키(`claude-code-mods.pressing`)를 잡고, 한 버전에만 있는 네임스페이스는 허용하며, 사전 파일 형식은 client 타입 검사를 통과한다.

## Studio 한국어 검수 스킬 (#30 밖 부속 작업)

- 사용자 요청으로 `studio/scripts/agents/studio-ko-review/SKILL.md`를 추가했다. 이슈 하나가 바꾼 명세·UI 문구·공개 문서의 한국어를 `judge`로 검수하고, 빠진 ko 문구를 새로 쓴다. 사용자가 승인한 행만 반영한다.
- 이 스킬이 Pixie 파일 2개 전용이던 `studio-ko-locale-review`를 대체한다. 기존 스킬은 저장소에 원본이 없고 `~/.dsh/skills/`에만 있었다.
- 문서용 문체 질문을 Jev로 확인했다. 한다체 질문은 한다체 문장 0.86, 합쇼체 문장 0.06, 반말 0.23으로 구분했다. 합쇼체 질문은 합쇼체 문장 0.58, 한다체 문장 0.07, 반말 0.04였다. 맞는 합쇼체도 0.58로 기준 0.5에 가깝다. 의미 질문은 "기록되지 않고 전달되지 않습니다"를 "전달됩니다"로 바꾼 문장에 0.06을 주었다.

## S4 시범 번역 결과

- 2026-10-17, 별도 세션에서 `studio-dsh-ko-translate`로 `sidebarCodePreview`를 번역했다. 세 키 모두 독립 라벨이고 첫 판정에 통과했다(복사됨·복사·코드).
- 이 시범은 세 키가 모두 첫 판정에 통과해 다시 쓰기, fallback, 조각 문구 판정, 한 버전에만 있는 네임스페이스 처리를 거치지 않았다. S5 초반에 이 경로를 거치는 네임스페이스(예: alpha.2에만 있는 `claude-code-mods`, 조각 문구가 있는 `workspace`)를 번역하면서 확인한다.
- 사전 파일의 키는 따옴표 없이 써도 타입 검사와 빠진 키 검사를 통과한다.

## S5 진행 방법

- 진행 지침: [dsh-ko-sequential.md](../../scripts/agents/dsh-ko-sequential.md). 조율자 세션이 남은 네임스페이스를 묶음(약 250키)으로 나눠 서브에이전트에 번역을 맡긴다. 판정은 [dsh-ko-judge.mjs](../../scripts/dsh-ko-judge.mjs)가 Jev로 일괄 처리하고, 조율자가 등록·검사·커밋한다.
- 판정 스크립트: `judge` 도구와 같은 `JevJudgeEngine`, 같은 세 질문과 기준을 쓴다. 판정을 마친 문구는 다시 보내지 않는다. 첫 번역과 다시 쓰기 3회까지 통과하지 못한 키는 `fallback`으로 옮긴다. 버전 사이에 영어가 다른 키는 두 영어 모두로 판정하고 낮은 점수를 쓴다. Jev 키는 `TYPESAFE_API_KEY` 환경 변수, 없으면 `~/.dsh/.credentials.yaml`을 읽기만 한다.
- 이전 방식(에이전트가 `judge`를 직접 호출)은 판정 요청·응답이 대화에 쌓여 한 세션 400키에서 멈췄다. 2026-10-17에 40개 네임스페이스(583키)를 이 방식으로 마쳤다.
- 시험: `sidebarRight`(34키)를 새 방식으로 처리했다. 판정 4회차, Jev 요청 5번. 결과 통과 24, 재작성 통과 6, fallback 4. 회차마다 바뀐 키만 다시 판정했다.
- 진행률과 다음 대상: `node --import tsx scripts/dsh-ko-next.mjs`(`studio/`에서). 미해결 문구와 용어집 제안은 `docs/research/ko-locale/judge/unresolved.md`에 모으고 S5 완료 전에 사용자가 검토한다.

## S5 결과와 검토

- 2026-10-17, 서브에이전트 번역과 일괄 판정으로 남은 21개 네임스페이스를 마쳤다. 그 뒤 판정 스크립트 버그를 고쳤다. 실패한 키를 번역자가 고치지 않으면 다음 실행에서 다시 판정하지도, 실패로 보고하지도 않아 11키가 미통과 상태로 사전에 남았다. 이 11키는 사용자가 승인했다(단위·제품 이름).
- 사용자 위임으로 미해결 183키를 재검토했다. 채택 125(최선 후보 108, 조각·화면 역할로 다시 판정 12, `saveFailed` 5), 영어 유지 58. 기준과 목록은 [unresolved.md](../research/ko-locale/judge/unresolved.md)에 있다.
- 같은 검토에서 버튼·라벨을 문장으로 바꾼 재작성 27개를 이전 라벨 후보로 되돌렸다. 짧은 라벨은 문체 점수가 낮게 나와, 번역자가 라벨을 "…합니다" 문장으로 바꿔 통과시킨 경우다. 지침에 라벨을 문장으로 바꾸지 말라는 규칙을 넣었다.
- 용어 통일: 새로 고침, 미리 보기, 상위·하위 세션 계보, 팀 작업, 추론 강도. 바꾼 문구는 다시 판정했고, 통과하지 못한 10개는 이전 문구를 유지했다.
- 판정 통과·승인 문구 모두 판정 기록과 사전이 일치한다(검사 스크립트 기준 불일치 0).

## 개발용 스킬 배포 정책

- 사용자 결정(2026-10-17): `studio-dsh-ko-translate`와 `studio-ko-review`는 Studio 개발용 스킬이다. 배포 패키지에 넣지 않고 개발 기기에만 설치한다. 원본은 `studio/scripts/agents/<skill>/SKILL.md`다.
- 배포에 들어가는 스킬은 `build.mjs`가 `packages/shell/skills/`로 복사하는 것뿐이다(현재 `studio-pixie-hook-guide`). 두 스킬은 `build.mjs`·`pack.mjs`·`packages/shell/package.json` 어디에도 없어 패키지에 들어가지 않는다.
- 설치(2026-10-17, 이 기기): 두 스킬의 `SKILL.md`를 `~/.dsh/skills/<skill>/`에 복사했다. 대체된 `~/.dsh/skills/studio-ko-locale-review`는 지웠다. 원본을 고치면 같은 방법으로 다시 복사한다.

  ```sh
  for s in studio-dsh-ko-translate studio-ko-review; do mkdir -p ~/.dsh/skills/$s && cp studio/scripts/agents/$s/SKILL.md ~/.dsh/skills/$s/; done
  ```
