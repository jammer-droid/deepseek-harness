---
kind: implementation-spec
status: draft
---

# #32 프리셋 단위 실행 설정 편집 — 실행 기본값 복구와 프로필 계층 Config

## 요약

Studio 프리셋에서 지금 보이지도 바뀌지도 않는 실행 설정을 프리셋 단위로 편집할 수 있게 한다. 대상은 두 가지다. 하나는 편집 화면이 빠진 프리셋 정책의 실행 기본값(`request.execution`)이다. 다른 하나는 DSH standard 밖에서 `dsh-base`가 올리는 프로필 계층의 행이다.

- GitHub 이슈: [#32](https://github.com/jammer-droid/deepseek-harness/issues/32)
- 기준 브랜치·시작 커밋: `studio/feat/workflow` @ `401054dec2`
- 대상 DSH: `0.2.1-rc.2`. 본체 수정 없음
- 발견 경위: HarnessEngineeringLab TB4 비교 벤치 분석(`docs/dsh/bench/tb4-short14-trace-analysis.md`). DSH bash 호출 164회 중 122회가 600s 대기였다.

## 현재 구조

Config 편집 대상은 Studio Master의 행뿐이다([shell.ts](../../src/host/shell.ts) `capture()`의 `configEntries(composition)`). Master는 DSH standard + Studio 계층 + 사용자 추가 행이다([master-composition.ts](../../src/host/master-composition.ts)). 덮어쓴 값은 프리셋 플러그인 목록에 병합되어 `agentPresets.register`로 그 프리셋 범위에 등록된다. Master에 없는 id는 `Unknown master Config entry`로 거부된다([config-overrides.ts](../../src/config-overrides.ts)).

| 범위 | 위치 | Studio 편집 |
|---|---|---|
| 프리셋 Config | standard 행 + Studio 계층 | 가능 (Config 편집기) |
| 프리셋 정책 | `request.toolOverrides` | 가능 (프롬프트·도구 탭의 설명 편집) |
| 프리셋 정책 | `request.execution.defaults`, `execution.batch` | **화면 없음**. 저장·적용·복사는 됨 |
| 프로필 계층 | `dsh-base`가 standard 밖에서 올리는 행, 프로필 `cordis.patch.yml` | **불가**. 목록에 없음 |

### 실행 기본값 화면이 빠진 경위

| 시각 (10-13) | 커밋 | 내용 |
|---|---|---|
| 19:27 | `d0cdc6ea3d` | Master 도입. "기존 실행 설정 카드와 어댑터가 남아 있다." |
| 19:58 | `15eeae2f6a` | 실행 설정 탭을 Config 편집기로 교체. `ExecutionSettings` 연결과 저장 시 `execution` 포함 제거. "이전 execution 어댑터는 기존 저장 요청 호환용으로 남긴다." |
| 22:12 | `a6e2a86dfc` | Optimized 템플릿이 `execution.defaults.bash.timeoutMs: 600000`, `job_output.timeout_ms: 120000`을 넣음 |

정책 플러그인은 지금도 이 값을 도구 스키마 `default`로 바꾸고, 생략된 인자를 채운다([preset-policy.ts](../../src/host/preset-policy.ts)). 편집 화면은 `prompt-tools-prototype.tsx`의 `...initialRequest`로 `execution`을 보이지 않게 넘긴다. 그래서 복사본도 값을 그대로 물려받는다. `ExecutionSettings`와 `executionCapabilities`는 남아 있지만 렌더되지 않는다.

### bash 대기값의 실제 출처

| 층 | 값 | 비고 |
|---|---|---|
| `bash-sandbox` 실행기 Config (dsh-base, POSIX) | `timeoutMs: 60000`, `maxTimeoutMs: 600000` | stock 스키마에는 `default`가 없고 "실행기 기본값과 상한을 따른다"는 설명만 있다 |
| Studio 정책 `execution.defaults` | 600000 | 스키마 `default`로 노출되고 생략 인자에 채워진다 |

### 프로필 계층 행 (dsh-base 0.2.1-rc.2, standard 밖)

실행 동작 관련:

| 행 id | Config | 기본값 |
|---|---|---|
| `bash-sandbox` | `timeoutMs`, `maxTimeoutMs`, `maxOutputBytes`, `maxSpillBytes`, `graceMs`, `cwd` | 60000, 600000, 64KB, 64MB, 3000 |
| `jobs` (`dsh-jobs-local`) | `pumpPollMs` 등 | — |
| `repeat-tool-reminder` | `thresholds`, `argumentsPreviewChars` | [3,5,8], 500 |
| `image-offload` | 확인 필요 | — |
| `session-title-llm` | `timeoutMs`, `maxOutputTokens`, `targetWords` 등 | 60000, 4096, 5 |
| `token-meter`, `session-checkpoint-policy`, `timeout-policy` | 없음 또는 내부 | — |

Host 전역 서비스(편집 대상 아님): `llm`, `llm-pi-ai`, `session*`, `storage*`, `sandbox`, `sandbox-policy`, `permission`, `approval`, `credentials`, `authorization`, `otel`, `typert*`, `agent-loop`, `subprocess`, `shell-env`.

standard에 이미 있는 `tool-bash`(`enableRunInBackground`, `promoteOnTimeout`)와 `tool-jobs`(`waitTimeoutMs` 30000, `maxWaitTimeoutMs` 600000)는 Config 편집기에서 다룰 수 있다.

## 범위

**포함**
- `execution.defaults`, `execution.batch` 편집 화면 복구. 불러오기·저장 왕복과 변경 표시
- 상속된 실행 기본값과 도구 설명 덮어쓰기를 프리셋 목록과 편집 화면에 표시
- 프로필 계층 행을 행별로 프리셋 범위에 올릴 수 있는지 판정하고, 가능한 행을 Master(Studio 계층)에 넣어 Config 편집 대상으로 만든다
- 불가능한 행은 이유와 함께 편집 불가로 표시

**제외**
- 프로필 `cordis.patch.yml` 편집 화면. DSH 설정 화면과 소유가 겹친다
- Host 전역 서비스 행의 프리셋별 재정의
- Optimized 템플릿 값 변경 자체. 별도 결정(D3)

## 결정

| ID | 결정 | 상태 |
|---|---|---|
| D1 | 실행 기본값은 `execution.defaults` 경로를 정식 기능으로 유지하고 화면을 복구한다(새 경로를 만들지 않음) | 추천, 미확정 |
| D2 | 프로필 계층 행은 "프리셋 범위에서 활성화 경고 없이 올라가고, 루트 서비스와 충돌하지 않으며, Config가 그 프리셋 세션에만 적용되는" 행만 편집 대상으로 넣는다 | 추천, 미확정 |
| D3 | Optimized의 `bash.timeoutMs: 600000`과 "충분히 기다려라" 설명을 유지할지, 실행기 기본값을 따르게 할지 | 미결정. 벤치 비교 결과 필요 |
| D4 | "원본 기본값" 표시: 스키마 `default`가 없는 도구는 실행기 Config 값(예: `bash-sandbox.timeoutMs`)을 카탈로그에 실어 보여줄지 | 미결정 |

## 단계

| ID | 결과 | 선행 | 수용 조건 | 검증 |
|---|---|---|---|---|
| S1 | 프로필 계층 행 판정표 | — | 위 실행 동작 행마다 프리셋 범위 등록 시 활성화 경고·루트 서비스 충돌·Config 적용 범위를 기록 | no-model 마운트·에이전트 생성 게이트, 두 프리셋에 다른 값을 줘서 서로 영향 없는지 확인 |
| S2 | 실행 기본값 화면 복구 | — | 실행 설정 탭에서 대기 기본값·read_batch 상한을 보고 바꿀 수 있음. 편집 시 저장값을 불러오고 저장 시 유지. 비우면 원본 사용 | 단위 테스트(불러오기·저장 왕복), DOM 테스트 |
| S3 | 상속값 표시 | S2 | 복사·편집한 프리셋에서 실행 기본값과 도구 설명 덮어쓰기가 "변경됨"으로 보이고 되돌릴 수 있음 | DOM 테스트, Optimized 복사본 확인 |
| S4 | 판정 통과 행을 Master에 추가 | S1 | 통과 행이 Config 편집기에 나오고, 덮어쓴 값이 그 프리셋 세션에만 적용됨 | check-master-runtime, 두 프리셋 비교 |
| S5 | 편집 불가 행 안내 | S1 | 불가 행은 이유와 함께 표시. 덮어쓰기 시도는 거부 | DOM 테스트 |
| S6 | 독립 설치 검증 | S2–S5 | 수정하지 않은 DSH 0.2.1-rc.2에 패키징한 Studio를 설치해 S2–S5 흐름 확인 | 격리 home/profile 설치 기록 |

첫 단계: S1과 S2는 서로 독립이다. S2부터 시작할 수 있다. D1 확정이 필요하다.

## 진행

- 2026-10-18: 이슈 생성, 현재 구조 조사 기록. 구현 시작 전.
