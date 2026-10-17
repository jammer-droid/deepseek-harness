# #31 Pixie Loop 1차 실동작 검증

`pixie_loop` 도구, 루프 엔진, Pixie 탭 › 루프 화면, `studio-pixie-loop-guide` 스킬을 실제 세션과 실제 모델로 확인한 기록이다.

## 환경

- DSH 런타임: `dsh --version` = `0.2.0-rc.2`(설치 앱 `/Applications/DeepSeek Harness.app`). 본체 수정 없음.
- 설치: `node pack.mjs`로 만든 `@matamt-dbg/dsh-studio@0.5.0` tarball을 `dsh plugin --profile loop-e2e add`로 격리 `studio/.dsh-home`의 새 프로필 `loop-e2e`(`--from-default-profile web`)에 설치. `127.0.0.1:19393`에서 실행. 사용자 GUI(19387)와 `~/.dsh`는 건드리지 않았다.
- 모델: 세션은 `DeepSeek-V41-Flash High`, Pixie는 `deepseek-official / deepseek-flash / low`, 결정 엔진은 Jev(`jev-latest`, 격리 프로필 credentials의 키).
- 프리셋: Studio Master. 작업 공간 `/private/tmp/pixie-r5/workspace`.
- 브라우저 조작과 화면: Playwright 1.61.1, 설치된 Chrome headless.

## 실행

웹 GUI에서 Studio Master 세션을 열고 [loop-items.jsonl](loop-items.jsonl)(5개 항목)을 번역하도록 `pixie_loop` 명세를 문장으로 지시했다(criteria, `placeholders`·`regex [가-힣]` 코드 검사, calibration 통과 2·실패 2, `maxAttempts` 3, `concurrency` 3, 토큰 400,000, 600초).

- 에이전트가 `studio-pixie-loop-guide` 스킬을 먼저 읽었다([화면](session-skill-light-1440.png)).
- 첫 호출은 파일이 아직 작업 공간에 없어 `read failed: … not found` 도구 오류로 끝났다(검증자가 다른 작업 공간에 파일을 둔 실수). 에이전트는 번역을 지어내지 않고 질문했다. 파일을 둔 뒤 같은 명세로 다시 호출했다.
- 두 번째 호출 결과(모델에게 간 전체 텍스트):

  ```text
  pixie_loop done
  passed 5, escalated 0, errors 0, skipped 0
  results: loop-done.jsonl
  usage: pixie 1693/1972, judge 4607/839 (input/output tokens)
  {"escalated":[],"errors":[]}
  ```

- 소요 11.1초. 결과 파일: [loop-done.jsonl](loop-done.jsonl).
- 이어서 같은 세션에서 `run_in_background: true`, `output "loop-done-bg.jsonl"`로 다시 지시했다. 도구 결과는 `{"kind":"background","jobId":"pixie-loop-1","runId":…}`였고, 세션 머리글에 `백그라운드 작업 1개 실행 중`이 표시됐다([화면](background-job-light-1440.png)). 에이전트의 `job_output`(wait)이 항목별 진행 줄(`retry: passed after 1 attempt(s)` …)과 같은 요약을 받았고 job은 `completed`로 끝났다. 결과 파일 `loop-done-bg.jsonl`이 생겼다.

## 확인한 동작

| 항목 | 결과 |
| --- | --- |
| compile | Pixie가 criteria를 질문 3개로 바꿨다: choice `q1`(faithful / mistranslation / omission / addition, 통과 `faithful`), noul `q2`(자연스러운 UI 문구, 0.7), noul `q3`(간결한 UI 문체, 0.7) |
| calibration | 통과 2·실패 2 예시를 모두 맞게 갈라 루프가 바로 시작됐다 |
| 재시도 누적 | `open` 1차 출력 `세션을 열어요`가 `q2 0.56`으로 실패 → Pixie 피드백("구어체, 명사형 `세션 열기`를 쓰라") → 2차 `세션 열기`, `q2 0.84`로 통과 |
| 코드 검사 | `{name}`·`{count}` 자리표시자가 출력에 보존됐다(`{name} 저장`, `{count}개 파일을 삭제할까요?`) |
| 결과 파일 | 세션의 `write` 도구로 작성됐다(대화에 `loop-done.jsonl 수정됨` 카드) |
| 메인 컨텍스트 | 세션 로그(`session.v4.jsonl.zstd`)를 풀어 검색: 1차 출력 `세션을 열어요`, 피드백 문장, 질문 id `q2`, 통과한 번역 `4xx를 반환하면`이 하나도 없다. 모델에게 간 것은 위 요약뿐이다 |
| 실행 기록 | `studio-data/pixie/loops/<session>.json`에 상태 `done`, 검사, 항목별 시도·답·피드백·사용량 |
| Pixie 탭 › 루프 | 목록·상세·검사·항목별 시도가 표시됐다. 라이트 1440 [시도 펼침](loops-attempts-light-1440.png), 다크 1440 [검사](loops-checks-dark-1440.png), 라이트 520 [목록](loops-list-light-520.png) |
| 콘솔 | Studio 오류 없음. 페이지가 여는 DSH 본체 요청 `/api/changes.summary?…` 404 하나가 있었다(Studio 경로 아님) |

## 2차·3차 실동작 확인

같은 환경에서 다시 패키징한 Studio(2차·3차 포함)를 설치해 확인했다.

| 항목 | 결과 |
| --- | --- |
| `act` (DOM 실험) | 작업 공간에 `page.html`(버튼 4개)과 Playwright `probe.mjs`(매칭 수와 텍스트 출력)를 두고 Studio Master 세션에 셀렉터 찾기를 지시했다. 에이전트가 `act: { command: "node probe.mjs page.html {{output}}", isolated: true }` 명세로 `pixie_loop`을 불렀고, 세션 `bash`로 실행한 결과 `matches: 1 / text: Save`를 Jev가 판정해 1회에 통과했다(출력 `[type="submit"]`). 기준은 질문 3개(noul 2, choice 1)로 바뀌었다 |
| 레시피 저장 | **Studio → Pixie → Loop 레시피**에서 `ko-review`(해요체 한국어로 다시 쓰기)를 JSON으로 저장했다. 저장 때 기준이 질문 3개로 바뀌고 calibration을 통과했다([화면](recipe-saved-light-1440.png)) |
| 게이트 판정 방식 | 게이트 편집기 고급 옵션에서 레시피 `ko-review`, **고치기**를 골라 `사용자가 지시를 보낼 때` 게이트를 만들고 `Optimized Copy` 프리셋에 붙여 DSH에 반영했다([화면](gate-editor-loop-light-1440.png)) |
| 고치기 실행 | `Optimized Copy` 세션에 영어 지시 `Read probe.mjs and explain in two sentences what it does.`를 보냈다. 에이전트가 받은 메시지는 `probe.mjs를 읽고, 이 파일이 무엇을 하는지 두 문장으로 설명해 주세요.`였다. 게이트 기록은 적용 `교체`, 결론 `Pixie Loop 레시피`, 원문과 최종 텍스트를 보여 준다([화면](gate-repair-light-1440.png)). 같은 세션의 루프 탭에 `레시피 ko-review · 게이트` 실행이 남았다 |
| 훅 스크립트 `pixie loop` | 가이드의 예시 스크립트를 문서에서 꺼내 실제 bash·curl·jq와 실제 헬퍼 경로로 실행했다(레시피 실행은 가짜). `write` 한국어 → exit 10, `write` 영어 → exit 11과 `{"verdict":"stop","reason":…}`, `read` → exit 10. 문서에 적은 동작과 같다 |

## 검증 중 고친 것

- 루프 게이트 실행 기록이 세션이 아닌 `unknown.json`에 저장됐다. 게이트 실행기가 훅 스크립트가 있을 때만 세션 정보를 넘겼기 때문이다. 루프 게이트에도 넘기도록 고치고 회귀 테스트를 추가했으며, 다시 설치해 세션 파일에 기록되는 것을 확인했다.

- 항목 카드의 시도 수가 `2번째 시도`로 표시되어 시도 제목과 겹쳤다. 카드는 `시도 2회`, 실패한 시도 배지는 `넘김` 대신 `통과 못 함`으로 바꿨다(항목 상태 `넘김`과 구분).

## 미검증

- background 실행 중 `job_kill`로 멈추는 경우는 실제 DSH jobs에서 확인하지 않았다(단위 테스트는 가짜 jobs로 취소 확인).
- 토큰·시간 상한 도달, calibration 거부, 엔진 오류는 실모델로 재현하지 않았다(단위 테스트로 확인).
- 0.2.1-alpha.2, 사용자 desktop 프로필, macOS 이외 OS.
- 번역 스킬(#30)과의 비교(S8의 메인 컨텍스트 토큰·통과율 비교)는 하지 않았다. 사용자 DSH 홈의 스킬을 고치는 일은 승인이 필요하다.
- 다크 520은 캡처하지 않았다(라이트 520과 같은 레이아웃).
- 2차: 연속 실행(`episode`)과 선택 모드(`select`), `route`, `extract`는 실모델로 실행하지 않았다(가짜 모델·가짜 bash 단위 테스트로 확인).
- 3차: 게이트 **판정** 모드와 `tool-after`·`agent-message` 시점, 실제 게이트 안의 `pixie loop`(실제 레시피 실행)는 실세션으로 확인하지 않았다.
