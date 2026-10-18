---
kind: reference
description: "Studio 기능 브랜치를 병합부터 배포까지 마무리하는 순서: 병합, 리뷰어 에이전트 코드 리뷰, 가이드·변경 내역, Pixie Loop 한국어 문체 교정, 배포 E2E, 배포, GitHub 이슈 정리."
---

# Studio 마무리·배포 절차

## 요약

기능 작업이 끝난 브랜치를 기준 브랜치에 넣고 공개 배포까지 하는 순서다. 일곱 단계를 차례로 하고, 단계마다 끝난 조건을 확인한 뒤 다음으로 넘어간다. 이 문서는 단계의 순서와 끝난 조건만 정한다. 버전·배포 명령은 [Studio 배포 가이드](release.md), 격리 설치 검증은 [에이전트 E2E 검증 지침](../scripts/agents/README.md), 이슈 단위 구현·검증은 [이슈 작업 절차](design-workflow.md)가 소유한다. 사용자가 이 절차로 배포까지 맡긴 경우에만 끝까지 진행하고, 그 밖에는 단계마다 승인 범위를 따른다.

| 단계 | 하는 사람 | 결과 |
| --- | --- | --- |
| 1. 병합 | 메인 에이전트 | 기능 브랜치가 기준 브랜치에 들어감 |
| 2. 코드 리뷰 | 리뷰어 에이전트(`subagent_role` Reviewer) | 리뷰 보고와 반영 커밋 |
| 3. 가이드·변경 내역 | 메인 에이전트 | 사용자 가이드, `CHANGELOG.md`, 버전 |
| 4. 한국어 문체 교정 | `pixie_loop` | 바뀐 한국어 문장의 교정본과 넘긴 항목 처리 |
| 5. 배포 E2E | 새 세션 검증자 | 배포 후보 패키지의 격리 설치 검증 보고 |
| 6. 배포 | 메인 에이전트 | 공개 레포·npm·GitHub Release |
| 7. 이슈 정리 | 메인 에이전트 | 배포에 들어간 이슈 종료, 후속 이슈 등록 |

## 목차

- [1. 병합](#1-병합)
- [2. 코드 리뷰](#2-코드-리뷰)
- [3. 가이드와 변경 내역](#3-가이드와-변경-내역)
- [4. 한국어 문체 교정](#4-한국어-문체-교정)
- [5. 배포 E2E](#5-배포-e2e)
- [6. 배포](#6-배포)
- [7. 이슈 정리](#7-이슈-정리)
- [중단 조건](#중단-조건)

## 1. 병합

1. 작업 트리가 깨끗한지 확인한다(`git status --short`). 남의 미커밋 변경이 있으면 멈추고 묻는다.
2. 기준 브랜치(지금은 `studio/feat/workflow`)가 기능 브랜치의 조상이면 fast-forward로 넣는다. 기준이 앞서 있으면 기능 브랜치에 기준을 병합해 충돌을 풀고 테스트한 뒤 넣는다. 사용자 변경을 임의로 stash·삭제·덮어쓰지 않는다. GitHub PR로 통합하면 저장소의 PR·검증 정책을 따른다.
3. 병합 결과에서 `npm --prefix studio test`가 통과해야 한다.

끝난 조건: 기준 브랜치 HEAD에 기능 커밋이 있고 Studio 테스트가 통과한다.

## 2. 코드 리뷰

리뷰는 직접 하지 않고 리뷰어 에이전트에게 맡긴다. 메인 에이전트의 컨텍스트에 diff 전체를 올리지 않기 위해서다.

1. 리뷰 범위를 정한다: 지난 배포 태그 또는 병합 전 기준 커밋부터 병합 후 HEAD까지, `studio/` 아래만.
2. `subagent_role`로 `Reviewer` 역할을 부른다. 과제에 다음을 넣는다.
   - 저장소 경로, 범위(`<기준>..<HEAD>`), 이슈 명세 경로
   - 두 축: 명세 대비(명세의 결정·수용 조건을 지키는가), 기준 대비([Studio 작업 지침](../AGENTS.md), [디자인 시스템](development/design-system.md), 상위 지침의 범위 규칙)
   - 결과 형식: 심각도(차단 / 수정 권장 / 참고)별 목록, 파일·줄, 근거, 제안
   - 쓰기 금지: 리뷰어는 파일을 고치지 않는다(Reviewer 역할은 `write`·`edit`가 막혀 있다)
3. 결과를 받아 **차단**은 모두 고치고, **수정 권장**은 고치거나 고치지 않는 이유를 남긴다. 고친 뒤 테스트를 다시 돌리고 커밋한다.
4. 리뷰 요약과 처리 결과를 이슈 명세의 검증 기록에 적는다.

끝난 조건: 차단 항목이 없고, 반영 커밋 뒤 테스트가 통과한다.

## 3. 가이드와 변경 내역

메인 에이전트가 쓴다. 사용자에게 보이는 변경만 적는다.

1. **가이드:** 바뀐 기능의 사용자 가이드(`release/docs/`)가 현재 동작과 맞는지 확인하고 고친다. 새 기능은 가이드 본문 또는 부록에 넣고 [사용자 가이드](../release/docs/guide.ko.md) 목차에 링크한다. 영문과 한국어를 같은 내용으로 맞춘다.
2. **변경 내역:** [CHANGELOG.md](../release/CHANGELOG.md)의 `Unreleased` 섹션을 `## <버전> — <날짜>`로 바꾸고 이번 변경을 더한다. 영어 노트(Highlights, Changes, Upgrade notes) 아래에 `### 한국어` 섹션을 둔다.
3. **버전:** [배포 가이드 1단계](release.md#1-버전-올리기)의 규칙과 파일 목록대로 올린다.
4. release README의 기능 목록에 새 기능을 한 줄로 더한다.

끝난 조건: 가이드·CHANGELOG·버전이 커밋되고 `release-changelog` 테스트를 포함한 Studio 테스트가 통과한다.

## 4. 한국어 문체 교정

3단계에서 바뀐 한국어 문장을 `pixie_loop`으로 교정한다. 메인 에이전트가 문장마다 직접 판정하지 않는다.

1. **항목 만들기:** 이번 배포에서 바뀐 한국어 문단을 항목으로 뽑는다. 대상은 `CHANGELOG.md`의 `### 한국어` 섹션, 바뀐 `release/docs/**/*.ko.md` 문단, 새 화면 문구(ko 로캘)다. 항목 하나는 문단 하나(목록이면 항목 하나)이고 id는 `파일:줄`로 한다. 코드 블록·표의 코드 칸·링크 주소는 넣지 않는다.
2. **명세:** 아래 명세로 `pixie_loop`을 실행한다. `shared`에는 Studio 용어와 문체 규칙(문서는 합니다체, UI 문구는 해요체 또는 명사형)을 넣는다. 판정 질문과 기준값은 Jev로 직접 잰 값이다(0.6.0 배포 때 측정: 뜻이 바뀐 문장 0.63 대 같은 문장 0.99, 깨진 문장 0.06–0.12 대 자연스러운 문장 0.38–0.63). 자연스러움 질문은 점수가 낮게 나오므로 기준을 0.3으로 둔다. 인라인 코드·링크 보존은 결정 엔진이 약해 `placeholders` 코드 검사가 맡는다. 질문을 바꾸면 calibration이 통과하는지 먼저 확인한다.

   ```json
   {
     "items": {
       "path": "work/ko-polish.jsonl"
     },
     "shared": "Studio Korean style: documents use 합니다체; UI strings use 해요체 or noun phrases. Keep product names, code, paths, option names, numbers, and Markdown links unchanged. Terms: preset → 프리셋, gate → 게이트, session → 세션, tool → 도구, recipe → 레시피.",
     "work": {
       "instruction": "Polish this Korean text: fix awkward translation-style wording, spacing, and particles. Keep the meaning, terms, Markdown, and inline code exactly. If it is already natural, return it unchanged. Reply with the text only."
     },
     "checks": {
       "questions": {
         "meaning": {
           "type": "noul",
           "instructions": "Does `output` keep the full meaning of `input`, adding or dropping nothing important?"
         },
         "fluent": {
           "type": "noul",
           "instructions": "Would a native Korean technical editor leave `output` as it is, without rewriting it for awkward, ungrammatical, or translation-style wording?"
         }
       },
       "pass": {
         "meaning": {
           "min": 0.85
         },
         "fluent": {
           "min": 0.3
         }
       }
     },
     "codeChecks": [
       {
         "type": "placeholders"
       },
       {
         "type": "regex",
         "pattern": "[가-힣]",
         "expect": "match"
       }
     ],
     "calibration": {
       "pass": [
         {
           "input": "레시피를 저장할 때 기준을 질문으로 바꿉니다.",
           "output": "레시피를 저장할 때 기준을 질문으로 바꿉니다."
         },
         {
           "input": "실행 기록은 Pixie 탭 → 루프에 남습니다.",
           "output": "실행 기록은 Pixie 탭 → 루프에 남습니다."
         }
       ],
       "fail": [
         {
           "input": "레시피를 저장할 때 기준을 질문으로 바꿉니다.",
           "output": "레시피를 저장할 때 질문을 기준으로 바꿉니다."
         },
         {
           "input": "그것은 가능하게 됩니다 되어지는 것이 사용함에 의해서.",
           "output": "그것은 가능하게 됩니다 되어지는 것이 사용함에 의해서."
         }
       ]
     },
     "maxAttempts": 3,
     "concurrency": 4,
     "limits": {
       "tokens": 1500000,
       "timeMs": 1800000
     },
     "output": "work/ko-polish-done.jsonl"
   }
   ```

3. **반영:** 결과 파일에서 입력과 출력이 다른 항목만 원문에 반영한다. 반영 전에 구조를 바꾼 출력은 걸러낸다: 목록 기호·제목 기호가 빠진 것(기호를 되살려 반영), 표 행, 제목, 영어가 대부분인 줄, 짧은 명사구 목록을 문장으로 바꿔 뜻이 달라진 것. 반영한 diff를 읽고 용어가 바뀐 곳(예: 정확한 검사 → 정확성 검사)은 되돌린다. `escalated` 항목은 메인 에이전트가 직접 고치거나 원문을 유지하고 이유를 남긴다. `errors`는 원인이 일시적이면 그 id만 다시 실행한다.
4. 반영 뒤 가이드 예시 테스트와 Studio 테스트를 다시 돌리고 커밋한다. 작업용 `work/`는 gitignore 대상이라 커밋되지 않는다. 결론은 이슈 명세에 남기고, 배포가 끝나면 `work/`를 지운다.

끝난 조건: 넘긴 항목이 모두 처리되고, 교정 커밋 뒤 테스트가 통과한다.

## 5. 배포 E2E

배포 후보(4단계 커밋)를 패키징해 수정하지 않은 지원 DSH에 설치하고 확인한다. 방법은 [에이전트 E2E 검증 지침](../scripts/agents/README.md)이 소유한다.

1. [템플릿](../scripts/agents/TEMPLATE-e2e.md)으로 `scripts/agents/releases/<버전>.md` 지침서를 쓴다. 배포가 끝나면 `archive/releases/`로 옮긴다. 이번 배포에 들어간 이슈의 바뀐 흐름, [브라우저 기능 확인](../scripts/agents/README.md#브라우저-기능-확인), 지원 버전이 바뀌었으면 [matrix](../scripts/agents/README.md#지원-버전별-검증-matrix)를 넣는다. 이슈 단계에서 이미 독립 설치 검증을 마친 흐름은 smoke·RPC 수준으로 줄인다.
2. 새 세션의 검증자가 지침서를 실행하고 보고한다. 결론은 `docs/verification/`에 옮긴다.
3. 결함 후보가 나오면 고치고 3단계부터 다시 거친다.

끝난 조건: 보고에 실패가 없고, 대기·환경 차단 항목은 이유와 함께 CHANGELOG 검증 노트에 반영된다.

## 6. 배포

[Studio 배포 가이드](release.md)의 2~6단계를 그대로 따른다.

1. `node studio/release/deploy.mjs github --dry-run`으로 내보내기·금지어 검사·공개 패키지 빌드를 확인한다.
2. `node studio/release/deploy.mjs github`으로 공개 레포에 push하고 GitHub Release를 만든다.
3. `node studio/release/deploy.mjs npm`으로 npm에 올린다. 2단계 인증이 필요하면 사용자가 브라우저 인증을 하거나 대화형 터미널에서 직접 실행한다. OTP·토큰은 채팅에 받지 않는다.
4. [공개 후 확인](release.md#5-공개-후-확인)과 [기록](release.md#6-기록)을 한다.

끝난 조건: npm `@matamt-dbg/dsh-studio`의 새 버전과 GitHub Release가 보이고, 배포 기록이 남는다.

## 7. 이슈 정리

배포에 들어간 이슈를 [이슈 트래커](../../docs/agents/issue-tracker.md)에서 정리한다. 모든 `gh` 명령에 `-R jammer-droid/deepseek-harness`를 붙인다.

1. 열린 이슈를 본다: `gh issue list -R jammer-droid/deepseek-harness --state open`. 이번 배포에 들어간 이슈와 이전 배포에 들어갔지만 열려 있는 이슈를 고른다. 배포 여부는 이슈 명세의 진행 기록, CHANGELOG, 버전 태그(`git tag --contains <커밋>`)로 확인한다.
2. 수용 조건과 독립 설치 검증이 명세에 기록된 이슈를 종료한다. 종료 코멘트에 배포 버전, 명세 경로, 남은 미검증 항목을 적는다: `gh issue close <번호> -R jammer-droid/deepseek-harness -c "<코멘트>"`. 검증이 명세에 없거나 단계가 남은 이슈는 열어 두고 이유를 사용자에게 알린다. 사용자가 검증을 확인해 주면 종료한다.
3. 작업 중 범위 밖으로 미룬 일은 새 이슈로 등록하고(`gh issue create`, 라벨 `enhancement` 또는 `bug`), 원래 이슈에 링크 코멘트를 남긴다. 본문에는 현재 동작, 범위, 확인할 점, 완료 조건을 쓴다.
4. 종료한 이슈의 명세 진행 기록에 배포 버전과 종료를 적는다.

끝난 조건: 이번 배포에 들어간 이슈가 모두 종료되거나 열어 둔 이유가 남고, 후속 이슈가 원래 이슈와 연결된다.

## 중단 조건

다음 중 하나면 그 단계에서 멈추고 사용자에게 알린다.

- 병합 충돌을 의미 판단 없이 풀 수 없을 때
- 리뷰에 **차단** 항목이 남았는데 고칠 방법이 명세 밖의 결정을 필요로 할 때
- 공개 레포·npm 계정 확인이 실패하거나, npm 2단계 인증을 에이전트가 끝낼 수 없을 때
- `studio/` 밖의 파일을 바꿔야 할 때
