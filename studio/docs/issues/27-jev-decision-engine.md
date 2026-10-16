---
kind: implementation-spec
status: ready
---

# #27 Jev 결정 엔진 — Pixie Gate 판정 헬퍼와 스크립트 직접 결론

## 요약

Pixie Gate 훅 스크립트가 부르는 판정 엔진에 TypeSafe Jev를 추가하고, 스크립트가 판정 결과만으로 게이트 결론을 낼 수 있게 한다. 게이트는 에이전트 미들웨어로 남는다. 판정을 언제 하고 결과로 무엇을 할지는 훅 스크립트가 정한다. Pixie는 지금처럼 훅이 준 데이터를 해석하는 보조 모델이며, 필요한 경우에만 호출된다. Pixie 출력은 Markdown으로 표시한다.

- GitHub 이슈: [#27](https://github.com/jammer-droid/deepseek-harness/issues/27)
- 선행: [#25 Pixie](25-pixie.md), [#26 Pixie Gate](26-pixie-gate.md)(닫음)
- 조사: [결정 기능 브레인스토밍](../research/decision-engine-brainstorm.md) §7, [Jev 적용 아이디어](../research/jev-use-cases.md)
- 기준 브랜치·시작 커밋: `studio/research/decision-engine` @ `c72e3619b0`(`studio/feat/workflow` @ `5ca5afe97b` 병합 포함)
- 대상 DSH: `0.2.0-rc.2 || 0.2.1-alpha.2`. 본체 수정 없음

## 현재 진행 상황

S1–S7 구현과 검증을 마쳤다. 실제 Jev API 호출, 실세션의 Jev 판정 게이트(exit 11), Pixie Markdown 표시까지 확인했다. 남은 미검증은 아래에 적었다.

| 단계 | 상태 | 커밋 |
| --- | --- | --- |
| S1 판정 계약 정렬 | 완료 | `49086773fd` |
| S2 JevJudgeEngine과 키 | 완료, 실호출 확인 | `49086773fd` |
| S3 엔진 선택과 키 설정 화면 | 완료, 설치 화면 확인 | `49086773fd` |
| S4 `pixie judge` 확장 | 완료 | `a35be44af1` |
| S5 스크립트 직접 결론(exit 11) | 완료 | `a35be44af1` |
| S6 Pixie 출력 Markdown 표시 | 완료, 사용자가 웹 빌드에서 확인 | `e67d5eb5cd` |
| S7 가이드와 검증 | 완료 | `7de926200e` |
| 사용자 피드백: 키 저장·삭제 확인 문구, 설명의 백틱 제거 | 완료 | `c87d6f5c46` |
| 실행 기록: 스크립트 결론이면 `스크립트 출력`, 판정 헬퍼 호출에 형식·라벨·엔진·확신도 | 완료 | `ab55c74126` |
| 결정 엔진 메뉴를 게이트 묶음으로 이동, 문구 정리 | 완료 | `91c21354b3` |
| 자격 증명 파일의 빈 `refs:` 오류 안내 | 완료 | `b283e5d2e0` |
| 스킬 `studio-pixie-hook-guide`를 `<DSH 홈>/skills/`에 설치(사용자 수정은 유지) | 완료, 격리 런타임에서 에이전트가 스킬을 찾음 | `2954767045` |
| 에이전트 도구 `judge`(Jev 요청 형식, Studio Master 포함, Optimized 제외) | 완료, 아래 검증 | 이 커밋 |

### 검증 기록

- **로컬:** `npm run typecheck`, `node build.mjs`, `node --import tsx --test test/*.test.mjs` 479/479 통과, `git diff --check` 통과. 작업 트리에 의존성이 없어 메인 체크아웃의 `node_modules`를 심볼릭 링크로 썼다(커밋하지 않음). DSH 패키지 재빌드는 하지 않았다.
- **가이드 예시 스크립트:** ko·en 가이드의 `translate-check.sh`·`claim-check.sh`를 문서에서 추출해 실제 bash·curl·`jq`와 실제 헬퍼 경로(가짜 판정 엔진)로 실행했다. 문서에 적은 exit·출력과 일치했다(일회성 검사, 저장소에 넣지 않음).
- **독립 설치:** 수정하지 않은 DSH `0.2.0-rc.2`(`/Applications/DeepSeek Harness.app`, `dsh --version`)에 `start-web.mjs`로 pack한 `@matamt-dbg/dsh-studio@0.3.0` tarball을 격리 `studio/.dsh-home` / `lean-agent-web`에 설치했다. 19388은 다른 프로세스가 쓰고 있어 같은 프로필을 19390에서 다시 띄웠다. Loader 로딩 성공, Pixie 설정에 **결정 엔진** 페이지 표시. 키 저장 → `설정됨 · 출처: file`, 입력칸 비워짐, 페이지에 키 문자열 없음, 키 삭제 → `설정 안 됨`(DSH credentials 실제 서비스). 화면: [라이트 1440 LLM](../verification/jev-27/judge-llm-light-1440.png), [라이트 1440 Jev 키 저장 후](../verification/jev-27/judge-jev-saved-light-1440.png), [다크 520 Jev](../verification/jev-27/judge-jev-dark-520.png). 콘솔 오류 없음. 사용자 GUI(19387)·사용자 프로필은 건드리지 않았다.
- **Jev 실호출 (2026-10-16):** 출시 코드의 `JevJudgeEngine`, 모델 `jev-1.13.0`, 격리 프로필 credentials의 키.

  | 입력 | 결과 | 시간 |
  | --- | --- | --- |
  | 영어 요청(로그인 500, 오늘 수정) | noul 급함 0.96 · choice `bug` 1.0 · score 0.93(작은 변경) | 260ms |
  | 같은 요청 한국어 | 0.96 · `bug` 1.0 · 0.92 | 204ms |
  | 번역 충실도(원문 "4xx면 재시도 안 함", 번역 "4xx에서도 재시도") | noul 0.02 | 166ms |

  세 형식 모두 계약 검증을 통과했고 사용량(`input_tokens`·`output_tokens`)이 기록됐다. 이 사례에서 한국어 판단은 영어와 거의 같았다.
- **실세션 게이트:** 격리 프로필 `lean-agent-web`을 19390에서 실행(사용자의 웹 빌드 19388은 건드리지 않음). Studio UI로 `사용자가 지시를 보낼 때` 게이트 `#27 Jev 라우팅`을 **할 일 없이** 만들고 스크립트 `jev-route.sh`(Jev select → `{"append": …}` + exit 11)를 지정해 `Optimized` 프리셋에 붙였다. `Optimized` 세션에 한국어 지시를 보내자:
  - 실행 기록 `applied: appended`, **결론: 훅 스크립트**, Pixie 모델 호출 0회.
  - 헬퍼 호출 `pixie-judge-1`: `select → bug · jev · 확신도 94%`(bug 0.96, other 0.04), 사용량 입력 372·출력 38.
  - 세션 로그에 `studio-pixie-gate` 출처의 `[Jev] bug (confidence 0.94)` 메시지가 에이전트 입력으로 들어갔다. 화면: [Pixie 탭 실행 기록](../verification/jev-27/gate-run-jev-light-1440.png).
- **키 저장 피드백:** 같은 서버에서 키 저장 → `키를 저장했습니다.`, 다시 입력하면 문구가 사라짐, 키 삭제 → `키를 삭제했습니다.`, 페이지에 키 문자열 없음. 설명은 `'pixie judge'`로 표시. 화면: [라이트 1440](../verification/jev-27/key-saved-light-1440.png), [다크 520](../verification/jev-27/key-dark-520.png). 확인용 키로 덮어쓰고 지우면서 저장돼 있던 키도 같이 지워졌으므로, 검사 전에 백업한 `studio/.dsh-home/.credentials.yaml`로 복원했다(`TYPESAFE_API_KEY` 외 항목은 같음을 확인).
- **Markdown:** 사용자가 웹 빌드에서 Pixie 답변의 Markdown 표시를 확인했다.
- **`judge` 도구:** 실제 DSH `ToolRuntime`에 등록해 스키마·실행·오류를 테스트했다. 격리 rc.2 프로필에서 프리셋 편집기 도구 목록에 `judge`가 보였고, Studio Master 세션의 에이전트가 `judge`를 호출해 `noul=1, engine=llm`을 받았다(세션 로그에 도구 호출 기록). 격리 프로필에 TypeSafe 키가 없어 이 확인은 LLM 엔진으로 했고, 확인 뒤 엔진 설정을 원래대로(`jev`) 되돌렸다. 화면: [도구 목록](../verification/jev-27/judge-tool-row-light-1440.png).
- **미검증:** `claim-check.sh`의 실세션 실행(답변 끝 지점), `judge` 도구의 Jev 엔진 실세션 호출, `0.2.1-alpha.2` 설치, Windows.

## 범위

**포함**

- `JevJudgeEngine`(기존 `JudgeEngine` 포트 구현)과 DSH `credentials` 기반 키 관리
- 판정 계약을 현재 Jev API 형식으로 정렬하고, LLM / Jev 엔진 선택을 둔다
- 헬퍼 `pixie judge`의 형식(bool·select·score)과 JSON 출력 확장
- 훅 스크립트 exit 11: stdout을 게이트 출력으로 바로 적용
- Pixie 출력 Markdown 표시
- 가이드 예시: 번역 검증, 완료·테스트 주장 감사

**제외**

Pixie 도구 루프·서브에이전트·별도 세션, 범용 결정 도구·흐름 편집기, 에이전트가 직접 부르는 판정 도구, 게이트 편집기의 판정 칸, DSH 일반 훅(Claude Code·Codex 형식)에서의 판정 호출, Windows 훅 스크립트, Jev long-context 헤더.

## 현재 근거

| 근거 | 사실과 영향 |
| --- | --- |
| [pixie-judge.ts](../../src/host/pixie-judge.ts) | `JudgeEngine` 포트와 `LlmJudgeEngine`. choice·score·noul 답을 엄격히 검증하고, 실패는 오류로 낸다 |
| [pixie-contracts.ts](../../src/pixie-contracts.ts) | 질문 `choice{options}`·`score{levels}`·`noul{question, criteria}`. 현재 Jev와 필드가 다르다(아래 S1) |
| [pixie-gate-task-runner.ts](../../src/host/pixie-gate-task-runner.ts) | 헬퍼 `judge`는 noul 하나만 쓰고 Pixie 모델로 판정한다. 스크립트가 exit 10이면 Pixie 없이 끝나고, 그 밖에는 Pixie를 부른 뒤 `parseGateOutput`→`gateOutputPlan`으로 적용한다 |
| [pixie-gate-script.ts](../../src/host/pixie-gate-script.ts) | exit 0 계속, 10 건너뜀, 그 밖 오류. stdout 256KB 상한 |
| [pixie-gate-helper.ts](../../src/host/pixie-gate-helper.ts) | `/ask`·`/judge` 경로, 실행별 토큰, 실행당 20회·256KB 상한. 응답은 평문 |
| [pixie-gate-task.ts](../../src/pixie-gate-task.ts) | `taskProblem`이 빈 할 일을 저장 거부한다 |
| [Jev API](https://docs.typesafe.ai/api.md), [Models](https://docs.typesafe.ai/models.md) | `{ model, state, questions }` → `{ model, answers, usage }`. 모든 질문 `instructions` 필수. choice `criteria` map(최대 255), score `criteria` 배열(2–10), score 답 `probabilities`·`legend`는 단계 번호 키 객체. 오류 400·401·413·415·422·429·529. 요청 64k·질문 32k 토큰. `jev-latest`=1.13.0 |
| Host `credentials` | `resolve`·`describe`·`set`·`unset`. `0.2.0-rc.2` 태그 소스에도 있다. `describe`는 값을 돌려주지 않는다 |
| DSH `MarkdownText` | `@deepseek-ai/dsh-client-ui-primitives` export. rc.2 태그와 현재 소스에 있다. 필수 라벨 `code.copyLabel`·`code.copiedLabel`·`footnotes` |

## 확정한 결정

| ID | 결정 |
| --- | --- |
| D1 | 결정 엔진은 Pixie Gate 훅 스크립트의 `pixie judge`로만 노출한다. 에이전트 도구·게이트 판정 칸은 이번 범위가 아니다 |
| D2 | Jev는 DSH 모델 프로바이더로 등록하지 않는다. Studio Host가 `fetch`로 직접 호출한다 |
| D3 | 키는 Studio 설정 화면에서 받아 `credentials`에 `TYPESAFE_API_KEY`로 저장한다. Studio 데이터 파일에 저장하지 않고 Client로 값을 돌려주지 않는다. 호출마다 `resolve`하며 캐시하지 않는다 |
| D4 | 판정 계약을 현재 Jev 형식으로 맞춘다. LLM 엔진도 같은 계약을 쓴다 |
| D5 | 판정 오류는 오류다. "아니오"·낮은 점수·기본 라벨로 바꾸지 않는다 |
| D6 | 스크립트 exit 11은 stdout JSON을 Pixie 출력과 같은 계약(`parseGateOutput`)으로 읽어 바로 적용한다. 형식이 틀리면 오류 정책을 따른다 |
| D7 | Markdown은 Pixie가 쓴 글에만 적용한다. 원문·최종 텍스트·전달 내용·거부 원문·제안·Studio가 만든 문구는 일반 텍스트로 둔다 |

## 단계

### S1 판정 계약 정렬

- **결과:** `JudgeQuestion`을 `noul{instructions, criteria?{true,false}}`, `choice{instructions, criteria: Record<string, string>}`, `score{instructions, criteria: string[]}`로 바꾼다. `instructions`·`criteria` 값은 문자열만 받는다(Jev는 객체·배열도 받지만 이번 범위가 아니다). score 답은 `probabilities: number[]`를 유지하고, Jev 응답의 번호 키 객체는 엔진이 배열로 바꾼다.
- **호환:** 저장된 판정 정의는 없다. 기존 실행 기록의 `answers`는 표시만 하므로 이전 형식도 읽어서 표시한다([pixie-gate-result.tsx](../../src/pixie-gate-result.tsx)). 기존 헬퍼 `--question`은 S4에서 noul `instructions`로 옮긴다.
- **변경:** [pixie-contracts.ts](../../src/pixie-contracts.ts) 질문 타입·`validateJudgeRequest`·`DEFAULT_JUDGE_SYSTEM_PROMPT`, `LlmJudgeEngine` 프롬프트, 결과 표시.
- **수용:** 세 형식의 검증 통과·거부 사례(빈 instructions, choice 1개, score 1개·11개, 255개 초과 choice) 테스트. LLM 엔진 회귀 통과.

### S2 JevJudgeEngine과 키

- **선행:** S1
- **결과:** `JevJudgeEngine implements JudgeEngine`. 요청마다 `credentials.resolve('TYPESAFE_API_KEY')`, 없으면 오류 `Jev API key is not configured`. 요청 본문은 `{ model, state, questions }`. 응답 `answers`를 기존 `checkAnswer` 규칙으로 검증하고, `usage.input_tokens/output_tokens`를 `PixieUsage`로 바꾼다.
- **실패:** 429·529는 `retry-after`를 따르거나 지수 대기로 최대 2회 재시도하되 게이트 제한 시간·취소 안에서만 한다. 그 밖의 상태와 네트워크 오류, 형식이 틀린 응답은 바로 오류. 오류 메시지에 키를 넣지 않는다.
- **변경:** `src/host/jev-judge.ts`(새 파일), [pixie-service.ts](../../src/host/pixie-service.ts)에 `credentials`를 선택 의존성(`ctx.get('credentials')`)으로 연결.
- **수용:** 가짜 `fetch`·가짜 credentials로 성공(세 형식), 401·422·429 재시도 후 성공·529 재시도 소진·취소·키 없음·형식 오류 테스트. 요청 헤더와 본문 스냅샷.

### S3 엔진 선택과 키 설정 화면

- **선행:** S2
- **결과:** Pixie 설정에 **결정 엔진** 섹션: 엔진(LLM / Jev), LLM이면 기존 `judgeModel`(없으면 Pixie 모델)·`judgeSystemPrompt`, Jev면 모델 ID(기본 `jev-latest`)와 API 키. 키 칸은 저장·삭제와 `describe` 결과(설정됨·출처·쓰기 가능)만 표시한다. 읽기 전용 출처가 값을 가리면 저장을 막고 출처를 보여 준다.
- **Remote:** `jevKey.describe()`, `jevKey.set(value)`, `jevKey.unset()`. 응답에 값을 넣지 않는다. `credentials`가 없으면 섹션에 사용 불가를 표시한다.
- **변경:** [pixie-contracts.ts](../../src/pixie-contracts.ts) 설정 타입·[pixie-store.ts](../../src/host/pixie-store.ts) 검증, [pixie-settings.tsx](../../src/pixie-settings.tsx), 로캘 ko·en·zh. 공용 부품 우선([디자인 시스템](../development/design-system.md)).
- **수용:** 설정 검증·저장 테스트, Remote가 값을 반환하지 않음, UI 스냅샷. Web 배포 후 라이트·다크·좁은 폭 확인.

### S4 `pixie judge` 확장

- **선행:** S1, S3
- **결과:**
  ```sh
  pixie judge --question "<instructions>" [--threshold 0.5] [--input]                 # 기존. bool과 같음
  pixie judge --type bool   --question "…" [--true "…"] [--false "…"] [--threshold 0.5] [--json] [--input]
  pixie judge --type select --question "…" --option <name>="<설명>" … [--json] [--input]
  pixie judge --type score  --question "…" --level "<설명>" … [--json] [--input]
  ```
  - bool: 기존처럼 stdout에 확률, 기준 이상 exit 0, 미만 exit 1.
  - select: stdout에 고른 선택지 이름, exit 0.
  - score: stdout에 점수, exit 0.
  - `--json`: stdout에 `{"type","label","answer","model"}` 한 줄. `label`은 bool이면 `yes`/`no`, select면 선택지, score면 반올림한 단계 번호. exit 규칙은 같다.
  - 사용법·토큰·상한·엔진 오류는 기존처럼 exit 2.
- **변경:** [pixie-gate-helper.ts](../../src/host/pixie-gate-helper.ts) 스크립트·경로(응답을 JSON으로), [pixie-gate-task-runner.ts](../../src/host/pixie-gate-task-runner.ts) `grant.judge`가 설정된 엔진 사용. 헬퍼 호출 기록에 엔진·형식·라벨 추가.
- **수용:** 헬퍼 스크립트를 실제 bash로 실행하는 테스트(가짜 서버): 세 형식·`--json`·기존 사용법·사용법 오류. 기록·사용량 합산 테스트.

### S5 스크립트 직접 결론(exit 11)

- **선행:** 없음(S4와 독립)
- **결과:** `HOOK_EXIT.direct = 11`. exit 11이면 stdout을 `parseGateOutput`으로 읽어 Pixie 호출 없이 `gateOutputPlan`·기록에 넘긴다. 실행 기록에 결론 출처(`pixie` / `script` / `skipped`)를 저장·표시한다. 할 일이 비어도 스크립트가 지정된 게이트는 저장할 수 있고, 그 상태에서 exit 0이면 오류(`Hook script asked for Pixie but the gate has no instruction`).
- **변경:** [pixie-gate-task.ts](../../src/pixie-gate-task.ts)(`HOOK_EXIT`, `taskProblem`), [pixie-gate-script.ts](../../src/host/pixie-gate-script.ts), [pixie-gate-task-runner.ts](../../src/host/pixie-gate-task-runner.ts), 기록 계약·[pixie-gate-runs.tsx](../../src/pixie-gate-runs.tsx), 편집기 안내 문구. 시험 실행은 스크립트를 실행하지 않음을 그대로 표시한다.
- **수용:** 지점 5개 각각에서 exit 11의 막음·교체·덧붙임·메모 적용 테스트, 잘못된 JSON·알 수 없는 필드 오류, 빈 할 일 + exit 0 오류, 기존 exit 0·10 회귀.

### S6 Pixie 출력 Markdown 표시

- **선행:** 없음
- **결과:** [ui-host.tsx](../../src/ui-host.tsx)에서 `MarkdownText`를 내보내고, 공용 부품 `PixieMarkdown`(로캘 라벨 포함, 탭은 `variant="compact"` 검토)을 만든다. 적용 위치: [pixie-tab.tsx](../../src/pixie-tab.tsx) 탭 답변·`/pixie` 대화 행(생성 중 `streaming`), [pixie-gate-result.tsx](../../src/pixie-gate-result.tsx) Pixie 출력 텍스트·메모. D7의 제외 대상은 바꾸지 않는다.
- **변경:** 위 파일, 디자인 시스템 부품 표, 로캘.
- **수용:** 부품 테스트(코드 블록·표·링크 제한), UI 스냅샷 갱신. Web 배포 후 라이트·다크·좁은 폭, 생성 중 표시 확인.

### S7 가이드와 검증

- **선행:** S1–S6
- **결과:** [Pixie Gate 가이드](../../release/docs/appendix/pixie-gate.ko.md)와 영문판에 결정 엔진 설정, `pixie judge` 형식, exit 11, 예시 스크립트 두 개(번역 검증, 완료·테스트 주장 감사)를 추가한다.
- **검증:** Studio 타입 검사·테스트·빌드. Jev 실제 호출(세 형식, 한국어 state 포함). 실세션에서 exit 11 막음과 Jev 판정 게이트 각 1건. 수정하지 않은 DSH `0.2.0-rc.2`에 패키징한 Studio를 격리 프로필로 설치해 Loader 로딩·키 설정·게이트 1건 확인. 키나 런타임이 없으면 해당 항목을 미검증으로 기록한다.

## 열린 항목

구현을 막지 않는 항목이다. 해당 단계에서 정하고 이 문서에 기록한다.

- 외부 전송: 게이트 state가 Jev로 나간다. 설정 화면에 안내를 둔다. 비밀 값 가리기·프로젝트별 허용은 후속.
- 지점별 지연: 별도 예산 없이 게이트 제한 시간(기본 60초)을 따른다. 실측 후 조정한다.
- 한국어 정확도: Jev 문서는 영어가 가장 정확하다고 한다. S7 실측 결과를 기록한다.
