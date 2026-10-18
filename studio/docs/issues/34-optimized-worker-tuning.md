---
kind: implementation-spec
status: ready
---

# #34 Optimized 메인-worker 최적화 — 벤치로 확정한 도구·읽기·대기·지침 반영

## 요약

Studio 기본 프리셋 `Optimized`는 메인(오케스트레이터)으로 쓰는 프리셋이다. worker 자식은 부모의 정책(공통 지침, 실행 기본값, 도구 설명, Config)을 그대로 물려받고, Tool Filter로 도구만 줄인다. 이 이슈는 TB4 벤치로 측정해 확정한 값을 Optimized 템플릿에 반영한다.

- GitHub 이슈: [#34](https://github.com/jammer-droid/deepseek-harness/issues/34)
- 기준 브랜치: `studio/feat/workflow` @ `ab49b5ec86`
- 대상 DSH: `0.2.1-rc.2`. 본체 수정 없음
- 근거 문서 (HarnessEngineeringLab 저장소)
  - `docs/dsh/optimized-preset-target.md`: 목표값과 측정 기록
  - `docs/dsh/bench/tb4-short14-trace-analysis.md`: 기준선 원인 분석

## 측정 결과

TB4 짧은 과제 12개, 과제별 1회, GPT-6.1 Sol `high`, 500K 문맥, 단일 세션(worker 기준). 비용은 API 단가로 환산했다($2 입력 / $0.10 캐시 / $10 출력, 1M 토큰당).

| | 기준선 (현재 Optimized 계열) | EB | **RD (채택)** |
|---|---:|---:|---:|
| 통과 | 6/12 | 6/12 | 6/12 |
| agent 실행 시간 | 129.9분 | 119.5분 | **94.4분** |
| 모델 요청 | 446 | 408 | **272** |
| 누적 입력 | 18.2M | 17.1M | **12.4M** |
| 비용 | $6.09 | $5.78 | **$4.86** |

- EB: `edit_batch` 추가, bash 기본 대기 120000
- RD: EB에 읽기 최적화와 압축 공통 지침을 더한 것

**RD는 기준선보다 요청과 문맥이 함께 줄었다.** 남은 비용은 큰 로그·데이터를 다루는 4개 과제(누적 문맥의 76%)에 몰려 있다. 읽기 규칙을 위치 기반으로 더 조이면, 설정·명세처럼 전체를 봐야 하는 작업과 짧은 작업에서 왕복이 다시 늘어난다. 그래서 RD 값을 채택하고, 큰 출력 예외 한 줄만 더한다.

## 확정 목록

### C1 도구: `edit_batch` 추가

- 구현: `src/host/edit-batch-tool.ts` (`538538e745`), Master Studio 계층 `studio-edit-batch` 행
- 동작
  - 파일 하나에 대해 수정 1~50개를 순서대로 메모리에서 적용한 뒤, `ctx.fs.writeText`로 한 번 쓴다.
  - 하나라도 대상을 못 찾거나 여러 곳과 일치하면 파일을 바꾸지 않는다.
  - 관찰 정책(`fs/edit-intent`)이 준 버전으로 쓰기를 보호하고, 쓴 뒤 `fs/observed`를 기록한다. CRLF는 유지한다.
- `OPTIMIZED_TOOLS`에 `edit` 다음으로 `edit_batch`를 넣는다. `edit`는 남긴다.
- 근거: EB에서 `edit` 97 → 23회, `edit_batch` 22회(호출당 평균 3.7개 수정). 오류 2회는 모두 "여러 곳 일치"로 파일을 바꾸지 않고 거부한 경우다.

### C2 `read_batch` Config

- 구현: `src/host/batch-tool.ts` Config `maxCalls`, `maxLines`, `noSpill` (`ab49b5ec86`). 기본값은 예전 동작(8개, limit 1–200 필수, spill 적용)이다.
- Optimized 값

  | 항목 | 값 | 의미 |
  |---|---|---|
  | `maxLines` | `null` | `limit` 선택. 각 read가 자체 상한(2000줄·51,200바이트)을 쓴다 |
  | `noSpill` | `true` | 결과를 spill-policy에서 뺀다. DSH가 `read`를 빼는 것과 같은 취급 |

- 근거: EB에서 `read_batch` 결과의 64%가 spill(2500토큰)에 잘려 같은 파일을 다시 읽었다. RD에서는 읽기 호출 98 → 37회, spill 38 → 16회, 마지막 문맥 중앙값 58K → 41K.

### C3 실행 기본값

| 도구 | 항목 | 현재 | 확정 |
|---|---|---|---|
| bash | `timeoutMs` | 600000 | **120000** |
| job_output | `timeout_ms` | 120000 | 120000 (유지) |

근거: EB에서 도구 실행 시간 −53%, 120초 넘는 bash 0회, 백그라운드 실행 1 → 6회.

### C4 도구 설명 덮어쓰기

| 도구·인자 | 확정 문구 |
|---|---|
| `bash.timeoutMs` | Foreground wait in milliseconds; defaults to 120000ms, subject to the runtime cap. A command that runs longer keeps running as a background job; collect it with job_output instead of rerunning it. |
| `bash.run_in_background` | Use for builds, tests, or scripts expected to take longer than a minute; continue other work and collect the result with job_output. |
| `read.limit` | Maximum lines to return. Omit to read the whole file (up to 2000 lines). |
| `read.offset` | 1-based first line. Use only to continue a file longer than the read cap. |
| `job_output.wait`, `job_output.timeout_ms` | 현재 문구 유지 |

### C5 섹션 덮어쓰기

| 섹션 | 확정 문구 |
|---|---|
| `tool:read` | Use read, not cat, for text files. One read returns up to 2000 lines; omit limit unless a file is larger. |

- 기존 DSH 문구의 "Use offset and limit to continue reading large files."가 작은 파일도 나눠 읽게 했다.
- `tool:goal`, `tool:workflow`는 덮어쓰지 않는다. 부모는 그 도구를 가지고, 자식은 Tool Filter로 숨기면 `childPolicy`가 자동으로 비운다(벤치에서는 worker에 도구가 없어 직접 비웠다).

### C6 공통 지침 (`OPTIMIZED_PROMPT`)

```
Read whole files in one call; use offset/limit only past the read cap. Read several files with one read_batch. Do not re-read a file you already have.
For logs, generated files and large data dumps, grep for the relevant lines first and read only those ranges.
Send independent calls in one response; sequence only on a real dependency. Combine related checks into one bash command.
Apply all changes to one file in one edit_batch.
Long commands continue as background jobs; collect them with job_output instead of rerunning. Before finishing, collect or kill every job you started.
Delegate self-contained independent work when useful and collect the result before relying on it.
Stay within the requested scope. Verify the result once with the smallest sufficient check, report failures honestly, then stop.
```

- 벤치에서 측정한 RD 문구 5줄에 두 줄을 더했다.
  - 큰 출력 예외(2번째 줄): RD 측정 뒤 추가. 측정하지 않음
  - 위임 줄(6번째 줄): 부모 전용. 자식은 위임 도구가 없어 영향이 거의 없음
- 시스템 프롬프트(RD worker 기준): 3,001자 → 1,774자
- `read_batch`, `edit_batch`가 선택되지 않은 템플릿에서는 해당 문장이 맞지 않는다. 그런 경우를 처리하는 방법은 D3에서 정한다.

### C7 기본 Worker 역할

Optimized는 지금 `agents: []`이다. 기본 Worker 역할을 하나 넣는다.

| 항목 | 값 |
|---|---|
| 이름 | Worker |
| persona | No user is available to answer questions; do not ask for confirmation. Do the work yourself; do not delegate. Work until the task is complete and verified, then report the result, changed files and checks briefly. |
| 모델·추론 | `inherit` |
| 시작 방식 | `fresh` |
| Tool Filter (`subagentToolFilter.deny`) | `send_message`, `interrupt_agent`, `list_agents`, `workflow`, `ask_user_question`, `exit_plan_mode`, `present`, `judge`, `pixie_loop`, `cordis_inspect_list`, `cordis_inspect_query` |

- `subagent_role`은 Tool Filter에 넣을 수 없고, 자식에서 자동으로 빠진다.
- 벤치는 앞 두 문장을 공통 지침 안에 넣어 측정했다. 보고 형식 문장은 측정하지 않았다.

## 결정 사항

| ID | 결정 | 이유 |
|---|---|---|
| D1 | `read_batch` Config는 `request.configOverrides['studio-batch']`로 지정한다 | `studio-batch`는 Master Studio 계층 행이라 프리셋 범위다. 정책의 `execution.batch`는 항목 수(`maxItems`)만 제한하므로 줄 상한·spill에는 쓸 수 없다 |
| D2 | `edit`는 남기고 `edit_batch`를 추가한다 | 한 곳 수정은 `edit`가 그대로 맞고, UI diff 카드와 샌드박스 권한 확장 인자는 `edit`에만 있다. 두 도구를 함께 둬도 벤치 성능에 문제가 없었다 |
| D3 | 공통 지침의 도구 이름은 선택된 도구로 거른다 | `optimizedTemplate(tools)`는 설치된 도구로 선택을 줄인다. `read_batch`·`edit_batch`가 없으면 그 문장을 빼고 만든다(현재 `read_batch` 누락 경고와 같은 방식) |
| D4 | 기존 사용자 사본(`studio-user-*`)은 바꾸지 않는다 | `ensureOptimized`는 `studio-optimized` 행만 다시 맞춘다 |
| D5 | 기본 Worker 역할은 Optimized 행이 처음 만들어질 때만 넣는다. 다시 맞출 때 사용자가 고친 역할을 덮어쓰지 않는다 | `ensureOptimized`의 갱신 경로는 `existing`을 펼쳐 `agents`를 유지한다. 새로 만들 때만 템플릿의 `agents`를 쓴다 |

## 구현 단계

| 단계 | 내용 | 완료 확인 |
|---|---|---|
| S1 | `optimized-preset.ts`: C1 도구, C3 실행 기본값, C4 설명, C5 섹션, C6 지침(D3), C2 `configOverrides` | `optimized-preset.test.mjs`에 값별 단언 |
| S2 | `edit_batch` 보완: `presentCall`/`presentResult`로 diff 카드, 샌드박스 권한 확장 인자(`tool-fs`의 `FsSandboxController`와 같은 동작) | 단위 테스트. 0.2.1-rc.2 설치본에서 diff 카드 표시 확인 |
| S3 | C7 기본 Worker 역할을 템플릿에 추가(D5) | 새 Optimized에 Worker 1개. 기존 Optimized 다시 맞추기에서 사용자 역할 유지 |
| S4 | 문서: `docs/reference/optimized-tools.md`, `CHANGELOG`, Master 도구 목록 | 문서 리뷰 |
| S5 | 통합 확인: 패키징한 Studio를 수정하지 않은 DSH 0.2.1-rc.2에 격리 설치 | 아래 "검증" |

## 검증

- 단위: `npm test` 전체 통과
- 격리 설치 (0.2.1-rc.2)
  - 새 Optimized의 도구, 지침, Config(`studio-batch`의 `noSpill`, `maxLines`), 실행 기본값이 위 값과 같다.
  - Worker 자식을 실행했을 때:
    - Tool Filter의 도구가 없다.
    - `tool:workflow`와 goal 지침이 비어 있다.
    - 공통 지침과 실행 기본값은 부모와 같다.
  - `edit_batch` 결과가 diff 카드로 보인다.
  - `read_batch` 결과가 2500토큰을 넘어도 잘리지 않는다.
- 회귀 벤치 (HarnessEngineeringLab, 선택): 반영된 Optimized로 같은 TB4 12개를 2~3회 반복한다. 반복 결과 범위가 RD 결과(요청 272, $4.86)와 비슷해야 한다.

## 범위 밖

- bash 기본 대기를 10초 정도로 줄여 바로 백그라운드로 넘기는 변형. 측정하지 않았다.
- 프로필 계층 값(`bash-sandbox`, `repeat-tool-reminder`, `agent-loop.maxParallelToolCalls`, `session-title-llm`): #32 판정에 따른다.
- 실행 기본값과 `read_batch` Config 편집 화면: #32.
- DSH 본체 변경. 예를 들어 spill-policy의 도구 제외 설정이나 클라이언트 diff 카드의 도구 이름 목록.
