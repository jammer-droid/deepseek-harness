# Pixie Gate R5 실동작 검증

#26 R5 통합 검증 기록이다. 격리 프로필에서 설치한 DSH와 실제 DeepSeek API 키로 Pixie Gate 다섯 경로(입력 거부·입력 덧붙임·도구 결과 덧붙임·스크립트 건너뜀·답변 교정)를 실행했다.

## 환경

- DSH 런타임: `dsh --version` = `0.2.0-rc.2`(설치 앱 `/Applications/DeepSeek Harness.app`). 본체 수정 없음.
- 프로필: 격리 `studio/.dsh-home` / `lean-agent-web`, `node studio/dev.mjs --skip-test --port 19388`로 pack한 Studio tarball 설치. 사용자 GUI(19387)·`~/.dsh/profiles/desktop` 미접근.
- 모델: Pixie 설정 `deepseek-official / deepseek-flash / low`. 세션 모델도 `session/selectModel`로 `deepseek-flash / low`. 세션 프리셋 `studio-master`(workspace-write 샌드박스).
- 작업 공간: `/tmp/pixie-r5/workspace`(`PIXIE_GATE_TEST.md`, `gate-sample.txt` 3줄, `other.txt` 1줄).

## 준비물

| 파일 | 설명 |
| --- | --- |
| [PIXIE_GATE_TEST.md](PIXIE_GATE_TEST.md) | 세션이 따를 점검 지침(작업 공간에 둠) |
| [definitions.json](definitions.json) | 저장된 게이트 3개(`studioPixie.saveGateDefinitions`로 저장·검증) |
| [tag-instruction.sh](tag-instruction.sh) | 입력 게이트 스크립트. `[GATE]` 아니면 exit 10, `pixie ask`로 요약, `pixie judge`로 완료 조건 판정, JSON 출력 |
| [only-gate-file.sh](only-gate-file.sh) | 도구 결과 게이트 스크립트. `read`의 `gate-sample.txt` 결과만 통과, 줄 수 출력 |

스크립트는 `<프로필>/studio-data/pixie-gate/commands/`에 실행 권한으로 둔다.

## 절차

1. 게이트 3개 저장 → `gateDefinitions`에서 invalid 0, `gateScripts`에서 두 스크립트·`supported: true` 확인.
2. 설정 화면 **시험 실행**(실모델): 답변 점검 게이트에 `Done. Everything works.` → stop, `Done.\nGATE-OK` → pass(1.2–1.8초). 스크립트 게이트는 `skipped: script`.
3. 세션 생성(`studio-master`, flash/low) 후 `[GATE] PIXIE_GATE_TEST.md 지침을 읽고 그대로 수행해.` 전송.
4. 같은 세션에 완료 조건을 붙여 다시 전송: `… 완료 조건: 지침의 단계 1~5를 모두 보고하고 마지막 줄이 GATE-OK이면 끝.`
5. `studioPixie.gateRuns`, 세션 이벤트, Pixie 탭 게이트 기록을 확인.

## 결과 (최종 세션 2개에서 동일)

| 게이트 | 결과 | 근거 |
| --- | --- | --- |
| R5 지시 점검 (3단계) | `rejected`, 턴 `blocked` | 헬퍼 `pixie-ask-1`(note), `pixie-judge-2` fail(noul 0.1 < 0.5). 거부 카드 pending |
| R5 지시 점검 (4단계) | `appended` | `pixie-judge-2` pass(noul 1). 세션에 `studio-pixie-gate` 메시지 `Pixie 요약: …` 도착 |
| R5 파일 결과 | `gate-sample.txt`만 `appended`, 나머지 `none`(`skipped by hook`) | 세션이 `[PIXIE CHECKED 8 lines] …`를 `gate-sample.txt` 결과에만 받았다고 보고 |
| R5 답변 점검 | 첫 답변 `steered`(steer 1), 재답변 `none`(`GATE-OK confirmed`) | 세션이 재지시 문구를 인용하고 마지막 줄 `GATE-OK`로 마침 |

게이트 usage는 모델 호출과 헬퍼 호출을 합산해 기록됐다(예: 입력 게이트 입력 653·출력 799). 8 lines는 `read` 도구가 돌려준 서식화된 결과(경로 머리말 포함)의 줄 수다.

화면: [게이트 구성](gate-composition-wide-light.png), [시험 실행 다크 1440](gate-trial-wide-dark.png), [시험 실행 라이트 520](gate-trial-narrow-light.png), [Pixie 탭 실행 기록·헬퍼 호출](gate-run-helper-dark.png). 게이트 구성·편집기·적용 범위를 라이트·다크 × 1440·520으로 headless Chrome 캡처했고 콘솔 오류는 없었다.

## 검증 중 발견해 고친 결함

- **헬퍼 URL**(수정 전 실세션에서 `curl: Could not resolve host: undefined`): rc.2 `webServer`에는 `protocol` getter가 없고, `port`는 listen 이후에만 정해진다. 등록 시점에 URL을 고정하던 것을 실행마다 계산하도록 바꾸고 protocol 기본값 `http:`, 와일드카드 바인드(`0.0.0.0`/`::`)는 루프백으로 치환했다. 회귀 테스트를 먼저 작성해 red(`undefined//0.0.0.0:undefined/…`)를 확인했다.
- **도구 결과 교체 불가 확인**: `read`는 value를 가진 결과라 `replace`가 `value-bearing result`로 메모 처리됐다(설계대로). 점검 게이트를 `append`로 바꿨다.
- **판정 모델 형식 오류 1회**: 헬퍼 `judge`가 한 번 `Judge model output has no answers object`로 실패(exit 2)했고, 초기 스크립트가 이를 미달로 취급해 잘못 거부했다. 스크립트가 exit 2를 재시도·오류로 처리하도록 고쳤다. 이는 flash/low 판정 출력의 간헐적 형식 오류이며 Studio 결함은 아니다.

## 미검증

- 독립 배포 검증 범위: 수정하지 않은 설치 DSH 0.2.0-rc.2에 pack한 Studio를 격리 프로필로 설치했다. 0.2.1-alpha.2, 사용자 desktop 프로필, macOS 이외 OS(Linux bwrap), read-only 샌드박스 세션, Windows는 확인하지 않았다.
- 하위 에이전트(`agent-message`) 지점과 `tool-before` 지점은 이번 실세션에서 실행하지 않았다(단위 테스트만).
- 거부 카드의 **수정해서 보내기** 버튼 클릭은 화면에서 실행하지 않았다.
