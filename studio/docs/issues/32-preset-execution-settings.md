---
kind: implementation-spec
status: ready
---

# #32 프리셋 실행 기본값 — Studio가 덮어쓴 값 표시와 재설정

## 요약

Studio 프리셋 정책은 도구 대기 인자의 기본값(`request.execution.defaults`)과 `read_batch` 상한(`execution.batch`)을 덮어쓴다. 이 값은 저장·적용·복사되지만 편집 화면이 없어 보이지도 지워지지도 않는다. 덮어쓴 값이 있으면 DSH 셸 설정의 명령 타임아웃(`bash-sandbox.timeoutMs`)이나 `tool-jobs.waitTimeoutMs`가 그 프리셋에서 적용되지 않는다. 이 이슈는 **Studio가 덮어쓴 값을 보여 주고, 지우면 DSH 원래 동작으로 돌아가게** 한다.

- GitHub 이슈: [#32](https://github.com/jammer-droid/deepseek-harness/issues/32)
- 기준 브랜치·시작 커밋: `studio/feat/workflow` @ `401054dec2`
- 대상 DSH: `0.2.1-rc.2`. 본체 수정 없음
- 발견 경위: HarnessEngineeringLab 저장소의 TB4 비교 벤치 분석(`docs/dsh/bench/tb4-short14-trace-analysis.md`). DSH bash 호출 164회 중 122회가 600s 대기였다.

## 현재 구조

| 범위 | 위치 | Studio 편집 |
|---|---|---|
| 프리셋 Config | standard 행 + Studio 계층 | 가능 (Config 편집기) |
| 프리셋 정책 | `request.toolOverrides` | 가능 (프롬프트·도구 탭, `변경됨` 표시와 원래대로) |
| 프리셋 정책 | `request.execution.defaults`, `execution.batch` | **화면 없음**. 저장·적용·복사는 됨 |
| 프로필 | `bash-sandbox` 등 dsh-base 행 | DSH 설정 → 셸(`timeoutMs`, `maxOutputBytes`)과 프로필 `cordis.patch.yml` |

### 실행 기본값 화면이 빠진 경위

| 시각 (10-13) | 커밋 | 내용 |
|---|---|---|
| 19:27 | `d0cdc6ea3d` | Master 도입. "기존 실행 설정 카드와 어댑터가 남아 있다." |
| 19:58 | `15eeae2f6a` | 실행 설정 탭을 Config 편집기로 교체. `ExecutionSettings` 연결과 저장 시 `execution` 포함 제거 |
| 22:12 | `a6e2a86dfc` | Optimized 템플릿이 `bash.timeoutMs: 600000`, `job_output.timeout_ms: 120000`을 넣음 |

편집 화면은 `prompt-tools-prototype.tsx`의 `...initialRequest`로 `execution`을 보이지 않게 넘긴다. 그래서 복사본도 값을 그대로 물려받는다.

### 덮어쓴 값이 셸 설정을 가리는 경로

[preset-policy.ts](../../src/host/preset-policy.ts)는 값을 도구 스키마 `default`로 노출하고, 생략된 인자를 채운 뒤 실행기에 넘긴다. 실행기는 모델이 그 값을 명시한 것과 구분하지 못한다.

```
모델 { command } → Studio 정책 { command, timeoutMs: 600000 }
→ bash-sandbox: 요청 값 사용, 셸 설정 timeoutMs 무시, maxTimeoutMs로만 자름
```

## 범위

**포함**
- 실행 설정 탭에 실행 기본값 편집 복구: 선택한 도구의 대기 기본값, `read_batch` 상한. 불러오기·저장·미리보기 왕복
- 덮어쓴 항목마다 `변경됨`과 `원래대로`. 비우거나 원래대로 하면 키를 지워 DSH 원래 동작을 따름
- 프리셋 목록에 실행 기본값 덮어쓰기 개수 표시

**제외**
- dsh-base 프로필 행의 프리셋 범위 편집(S1 판정, D2)
- 프로필 실행 설정 편집 화면. DSH 설정 → 셸이 소유한다
- Optimized 템플릿 값 변경(D3)

## 결정

| ID | 결정 | 상태 |
|---|---|---|
| D1 | 실행 기본값은 기존 `execution.defaults`·`execution.batch` 경로를 유지하고 화면만 복구한다 | 확정 |
| D2 | dsh-base 행은 프리셋 범위에 올리지 않는다. bash 실행기 값은 프로필(DSH 셸 설정·프로필 patch)에서 다룬다 | 확정 (S1 근거) |
| D3 | Optimized 템플릿의 `bash.timeoutMs: 600000`·`job_output.timeout_ms: 120000` 유지 여부 | 미결정. 이번 범위 밖. 복사본은 재설정 가능 |
| D4 | 원래 값 표시: 스키마 `default`가 있으면 그 값, 없으면 "실행기 설정을 따름"으로 안내. DSH `configForms`로 현재 셸 값을 읽어 보여 주는 방식은 후속 | 확정 (1차) |

### S1 판정 근거 (2026-10-18, DSH 0.2.1-rc.2 격리 프로필)

Studio Master에 행을 추가해 활성화 게이트(`saveExtensions`의 임시 프리셋 등록·resolve)를 확인하고, 격리 프로필 patch의 테스트 프리셋에서 mock 모델로 `sleep 4` bash를 호출했다.

| 행 | 프리셋 범위 등록 | 비고 |
|---|---|---|
| `bash-sandbox` 단독 | 실패: `service "shell" has been registered` | Host `shell`과 충돌 |
| `bash-sandbox` + `tool-bash`, `isolate: {shell: true}` 그룹 | 성공 | 1500/2000ms 프리셋은 시간 초과, 8000ms 프리셋·standard는 완료. 서로 영향 없음. `tool-jobs`가 없으면 `run_in_background` 실패 |
| `jobs` | 실패: `service "jobs"` 충돌 | |
| `image-offload` | 실패: projection 중복 등록 | |
| `session-title-llm` | 실패: 제목 provider 중복 | |
| `token-meter` | 실패: `service "tokenMeter"` 충돌 | |
| `repeat-tool-reminder` | 성공 | Host 행이 계속 동작해 완화·끄기 불가 |
| `timeout-policy`, `session-checkpoint-policy`, `llm-retry` | 성공 | 편집할 Config 없음 |

격리 그룹 방식은 Master 구조 변경(`tool-bash` id 이동)과 Host `shell` 사용처 분리를 요구하므로 채택하지 않았다(D2).

## 단계

| ID | 결과 | 선행 | 수용 조건 | 검증 | 상태 |
|---|---|---|---|---|---|
| S1 | dsh-base 행 판정 | — | 위 표 | 격리 rc.2 프로필 실험 | 완료 |
| S2 | 실행 기본값 화면 복구 | — | 실행 설정 탭에서 선택한 도구의 대기 기본값·`read_batch` 상한을 보고 바꿈. 편집 시 저장값을 불러오고 저장·미리보기에 반영. 선택하지 않은 도구 값은 저장하지 않음 | 단위 테스트(저장 정리), DOM 테스트 | 완료 |
| S3 | 덮어쓴 값 표시와 재설정 | S2 | 덮어쓴 항목에 `변경됨`·`원래대로`. 원래대로 하면 키가 사라짐. 프리셋 목록에 덮어쓰기 개수 | DOM 테스트, Optimized 복사본 확인 | 완료 |
| S4 | (폐기) 프로필 계층 행 Master 추가 | — | D2로 폐기 | — | 폐기 |
| S5 | (폐기) 편집 불가 행 안내 | — | D2로 폐기 | — | 폐기 |
| S6 | 독립 설치 검증 | S2–S3 | 수정하지 않은 DSH 0.2.1-rc.2에 패키징한 Studio를 설치해 Optimized 복사본의 bash 기본값 재설정 후 셸 설정값이 적용됨을 확인 | 격리 home/profile 기록 | 완료 |

## 진행

- 2026-10-18: 이슈 생성, 현재 구조 조사.
- 2026-10-18: S1 완료. D1·D2 확정, S4·S5 폐기. 범위를 "덮어쓴 값 표시와 재설정"으로 재정의.
- 2026-10-18: S2·S3 구현. 실행 설정 탭 위쪽에 `실행 기본값` 섹션([execution-settings.tsx](../../src/execution-settings.tsx))을 붙이고, 실행 덮어쓰기를 편집기 상태로 소유해 저장·미리보기에 반영([optimization-prototype.tsx](../../src/optimization-prototype.tsx)). 저장 시 선택한 도구의 값만 남기고 비면 `execution` 키를 지움(`selectedExecution`). 프리셋 카드에 덮어쓰기 개수 표시(`executionOverrideCount`). 예전 컴포넌트의 플러그인 Config 목록·Spill 안내 섹션은 제거.
- 2026-10-18: 검증. `npm --prefix studio test`: 타입 검사·빌드 성공, 738개 통과. S6: 설치된 DSH `0.2.1-rc.2` CLI, 격리 home `studio/dist/e2e/home` 프로필 `p32`, 패키징한 Studio `0.6.1`(tgz SHA256 `73100add…6ace4`), mock 모델. 프로필 patch로 `bash-sandbox.timeoutMs: 1500`을 둔 상태에서 Optimized 요청 그대로의 복사본은 bash 스키마 `default` 600000이 노출되고 `sleep 3`이 완료됨. bash 기본값을 지운 복사본은 `default`가 없고 1500ms 후 백그라운드 작업으로 넘어감. 브라우저(라이트·다크·480px)에서 목록의 `실행 기본값 덮어씀 2`, 복사 편집 화면의 600000 로드와 `변경됨` 확인. pageerror·플러그인 활성화 실패 없음.
- 2026-10-18: UI 통일. 실행 기본값을 Config 덮어쓰기와 같은 `ItemPicker` 목록(켜기·`변경됨`·`설정` 대화상자, 필드별 `기본값으로`)으로 바꿈. 끄면 그 도구의 덮어쓰기를 지움. 격리 rc.2 서버 브라우저 확인(라이트·다크·480px) 통과.
- 2026-10-18: 0.6.2 준비. CHANGELOG(영어·한국어), 사용자 가이드(실행 설정·Optimized 고치기 표), release README, 버전 0.6.2. 한국어 문체 교정은 [마무리 절차](../release-workflow.md) 4단계 명세로 `pixie_loop` 25개 항목 실행: 통과 24, 넘김 1(CHANGELOG 카드 문장, 직접 수정). 바뀐 출력 5개 중 4개 반영, 1개("더 낮게만 바꿀 수 있습니다" → "변경할 수 있습니다")는 용어 통일을 위해 원문 유지. 반영 뒤 Studio 테스트 738개 통과.
- 남은 일: D3(Optimized 템플릿 값), D4 후속(DSH `configForms`로 현재 셸 값 표시). 병합·코드 리뷰·커밋·배포는 하지 않음.

## 배포

- 2026-10-18: Studio 0.6.2(GitHub Release v0.6.2)에 포함되어 GitHub #32을 종료했다. npm 공개는 사용자 2단계 인증 뒤 진행한다.
