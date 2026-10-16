# 이슈 #26 세션 인계 — R2-b1 완료 시점

> **보관 기록.** 이 인계 이후 R2-b2·R3–R5와 사용자 피드백 반영까지 완료했다. 현재 상태는 [주 명세](26-pixie-gate.md)의 "현재 진행 상황"을 따른다.

## 다음 세션에서 먼저 읽기

이 문서는 부모 세션 compact 문제로 대화 연속성이 불확실해져 작성한 인계 기록이다. compact 실행 도구는 자식 세션에 없었으며 부모에 요청만 전달했다. compact 성공 여부는 확인하지 못했다. 제품 코드 문제를 진단한 것은 아니다.

1. 저장소 작업 지침 [AGENTS.md](../../../AGENTS.md), [Studio 지침](../../AGENTS.md)을 읽는다.
2. 아래 Git 상태를 재확인한다. 이 인계 문서 작성 이후 사용자 변경이 있을 수 있으므로 clean이라고 가정하거나 원복하지 않는다.
3. [주 명세](26-pixie-gate.md)의 재설계 U18–U24와 R2-a/R2-b1 기록을 읽는다. 이 문서는 주 명세를 대체하지 않는다.
4. 사용자의 다음 지시를 확인한다. R2-b2 구현·R3 UI 연결·배포를 자동으로 시작하지 않는다.

## Git 상태와 진행률

- 저장소: `/Users/home/playground/vibecoding/deepseek-harness`
- 브랜치: `studio/feat/workflow`
- 이번 구현 시작 HEAD: `c58ffbb1e4b1afa7829977a6ef10a31482102154`, 시작 작업 트리 clean 확인.
- 완료 커밋: `4a2da1e61d67d04341684ed99fc5671b2c9a7398`
- 커밋 제목: `feat(studio): run Pixie Gate hook scripts on bash executors (#26)`
- 인계 작성 직전 위 HEAD 및 clean 작업 트리를 다시 확인했다. **이 인계 문서 자체는 후속 요청으로 작성한 미커밋 파일**이다.
- R1 UI 시안: 기존 명세상 구현, 사용자 확인 대기.
- R2-a: 완료. 구 다단계 파이프라인 삭제까지 완료한 상태에서 이번 작업을 시작했다.
- **R2-b1: 구현·로컬 검증·커밋 완료. 별도 리뷰/실환경 검증 완료를 의미하지 않는다.**
- R2-b2: 다음 구현 후보, 미착수(헬퍼/HTTP/토큰).
- R3 UI 연결, R4 가이드·스킬, R5 통합 검증: 후속.

## 유지해야 할 사용자 제약

- 변경은 `studio/` 내부만. `packages/`, `vendor/`, `apps/` 등 DSH 본체 수정 금지. 공개 API만 사용.
- 하위 위임 없이 직접 작업. 한국어로 보고.
- 사용자 GUI `19387` 및 사용자 프로필 `~/.dsh/profiles/desktop` 접근·배포 금지.
- Client 플랫폼 `cordis_inspect_query` 금지. Host Inspect 허용.
- 원본 저장소에서 npm 검증 허용. 화면 JSX·문구 수정은 R3이므로 이번 범위 밖.
- 새 동작은 회귀 테스트 먼저 작성하고 red 확인. 이번 red 요약은 아래에 영구 보존했다.
- 커밋할 때 바꾼 경로만 하나씩 `git add <정확한 경로>` 후 `git diff --cached --name-only` 확인. `git add -A`/`.` 및 lefthook 우회·푸시 금지.
- 구현 커밋 전 typecheck, `npm --prefix studio test` 2회 연속, `git diff --check` 요구.
- 이번 구현에서는 위 금지 대상 접근·수정·배포·푸시를 하지 않았다.

## 구현된 동작과 코드 위치

| 경계 | 구현/확인 내용 | 파일 |
| --- | --- | --- |
| 스크립트 파일 | `<data>/pixie-gate/commands/` 이름 검증, 구분자·절대 경로·`..` 거부, realpath 부모 비교, 실행 가능 일반 파일만 허용 | [pixie-gate-script.ts](../../src/host/pixie-gate-script.ts) |
| 실행 | shell.resolve/execute/result, 세션 cwd와 정책 명시 전달, stdin=대상 텍스트, timeout·취소·256KB 제한, exit 처리 | [pixie-gate-script.ts](../../src/host/pixie-gate-script.ts) |
| 모델 진입 | 스크립트를 일반 모델보다 먼저 실행, text/data instruction 치환, exit 10은 모델·판정 미호출 | [pixie-gate-task-runner.ts](../../src/host/pixie-gate-task-runner.ts) |
| 결과 적용 | 컨텍스트 지연 취득, onError 처리 및 기존 결과 투영 유지 | [pixie-gate-task-executor.ts](../../src/host/pixie-gate-task-executor.ts) |
| 지점별 연결 | user/agent-message, tool-before/after, turn-end에 세션·턴·도구 정보 전달. skip은 원래 흐름·applied none·`skipped by hook` note | [input](../../src/host/pixie-gate-input.ts), [tools](../../src/host/pixie-gate-tools.ts), [turn](../../src/host/pixie-gate-turn.ts) |
| 서비스 | sandboxPolicy.resolve({session}) 연결, gateScripts() Remote(directory/scripts/supported) | [pixie-service.ts](../../src/host/pixie-service.ts) |
| Client | Remote 타입 한 줄만 추가. descriptor/UI 연결은 하지 않음 | [pixie-client.tsx](../../src/pixie-client.tsx) |
| 저장 검증 | 정의된 스크립트 외 instruction 변수 거부, `..` 포함 파일명 거부 | [pixie-gate-task-contracts.ts](../../src/pixie-gate-task-contracts.ts) |
| trial | 세션 정책이 없으므로 기존 `skipped: script` 유지, 수정 없음 | [pixie-gate-trial.ts](../../src/host/pixie-gate-trial.ts) |

stdout text는 앞뒤 개행만 제거하고 공백은 보존한다. JSON 객체면 data에 JSON 문자열을 제공한다. 배열/원시값/일반 텍스트는 data가 빈 문자열이다. 변수 이름은 기존 taskVariables 계약과 동일하게 마지막 확장자를 제거한 이름이다.

환경 변수는 PIXIE_POINT, PIXIE_AGENT(root/child), PIXIE_SESSION_ID, PIXIE_TURN, PIXIE_GATE_NAME 및 도구 지점의 PIXIE_TOOL_NAME/PIXIE_TOOL_ARGS다. **PIXIE_URL/PIXIE_TOKEN은 아직 전달하지 않는다.**

## bash 판별 조사와 한계

Host Inspect에서 shell, sandboxPolicy, 서비스 카탈로그 및 configEditor의 공개 계약을 읽었다. `loader` 조회는 catalogued service가 없다는 오류를 반환했다. 사용자 프로필의 실제 설정 값은 읽지 않았다.

- shell 설명은 **Abstract bash execution service**이며 공개 메서드는 resolve/execute다. 실행기 종류 조회 메서드는 없다.
- configEditor entries/configuration은 설정 행을 제공하지만 현재 ctx.shell 구현의 종류를 보장하는 판별 계약은 확인하지 못했다.
- 사용자가 허용한 대안으로 `process.platform !== 'win32'`를 1차 기준으로, shell 서비스 존재를 추가 확인했다.
- 비지원이면 `hook-script-unsupported: 이 환경에서는 훅 스크립트를 지원하지 않음` 오류 후 onError를 적용한다.
- 비-Windows 사용자 정의 shell이 실제로 bash 계약을 지키는지까지 검증하지 못한다.
- realpath 확인과 실행 사이 파일 교체 경쟁을 원자적으로 막지는 못한다. commands 디렉터리는 신뢰하는 사용자가 관리해야 한다.
- 별도 spawn이나 샌드박스 우회 경로는 만들지 않았다.

## 검증 증거 — 임시 로그가 없어져도 남길 요약

실행한 최종 명령:

```bash
npm --prefix studio run typecheck
npm --prefix studio test
npm --prefix studio test
git diff --check
```

- typecheck 성공.
- 전체 테스트 1회차: **404 tests / 404 pass / 0 fail / 0 cancelled / 0 skipped / 0 todo**, 2349.545375ms.
- 전체 테스트 2회차: **404 tests / 404 pass / 0 fail / 0 cancelled / 0 skipped / 0 todo**, 2290.321792ms.
- 기존 370개 + 새 스크립트 테스트 32개 + 실제 PixieService/Cordis 정책/cwd 조합 복원 2개 = 404개.
- [스크립트 테스트](../../test/pixie-gate-script.test.mjs): 경로 탈출, unsupported/onError, 정책 누락, text/JSON, exit 0/10/그 외, timeout, 출력 초과, env/stdin, 취소, 목록, 다섯 지점 원래 흐름/applied none.
- [서비스 테스트](../../test/pixie-service.test.mjs): 실제 Cordis에 PixieService를 구성하고 셸/정책 서비스 fake로 read-only·workspace-write 두 경우의 session 전달과 cwd를 검증. 실제 OS sandbox 실행 테스트는 아니다.
- [기존 계약 테스트](../../test/pixie-gate-task-contracts.test.mjs)의 미지원 오류 기대값을 새 오류 코드로 갱신했다.
- git diff --check 성공. 정확한 13개 변경 경로를 개별 stage하고 cached 목록 확인. 정상 lefthook의 Studio staged scope(13 paths) 및 whitespace 검사 통과 후 커밋.
- 임시 원본 로그: [1회차](</tmp/pixie-r2b1/test-1.txt>), [2회차](</tmp/pixie-r2b1/test-2.txt>). 임시 파일은 다음 세션에서 없어질 수 있다.

### Red 관찰 기록

[임시 red 요약](</tmp/pixie-r2b1/red.txt>)의 내용을 여기에도 보존한다.

1. 실행기 tracer: 구현 전 스크립트 exit 0 테스트가 `expected done / actual error`로 실패. 당시 기존 스크립트 미지원 guard 때문에 실패했다(1개 실패).
2. 저장 검증: `{{hooks.other.text}}`를 지정했을 때 expected exception이 없어 실패(1개 실패, 기존 tracer 1개 통과). 이후 미정의 변수 검증 추가.
3. 실제 서비스 조합: read-only·workspace-write 두 테스트 모두 shell 요청 수 `expected 1 / actual 0`으로 실패. 이후 서비스/미들웨어 연결.
4. 추가 경로·exit·오류·env·취소·목록·다섯 지점 skip 테스트는 핵심 구현 후 경계 커버리지로 추가했고 최초부터 통과했다. **모든 추가 테스트가 독립적인 red를 거쳤다고 주장하지 않는다.**
5. 기존 executor 테스트의 `스크립트 미지원` 문자열 기대값 실패는 새 오류 코드로 바뀐 계약에 따른 기대값 갱신이지 별도 제품 회귀 red가 아니다.

## 남은 일과 다음 세션의 시작점

1. 필요하면 완료 커밋을 주 명세 U18–U24와 대조해 검토한다. 특히 bash fallback 한계, 정책 전달 경계, timeout/cancellation, 경로 검증을 확인한다.
2. 실제 bash 샌드박스 실행, macOS seatbelt, Linux bwrap, 사용자 정의 비bash shell 식별, 실모델, 독립 설치/배포, GUI는 **미검증**이다. 기존 사용자 금지 범위를 넘어서 검증하지 않는다.
3. R2-b2는 별도 사용자 지시를 받아 진행한다: `pixie ask/judge`, Studio 로컬 HTTP 공개 API 경로, 실행별 토큰 발급/폐기, 요청 크기/호출 수 제한, 권한 제한, 호출 사용량·기록 통합. PIXIE_URL/TOKEN 연결도 여기서 한다.
4. R3에서 gateScripts Client descriptor/화면 연결과 실행 카드 등을 연결한다. 현재 Remote 타입 선언만 존재한다.
5. 부모 세션 compact 실패는 이 작업에서 원인 조사하거나 해결하지 않았다. 이 문서를 읽으면 제품 개발 이력은 복구할 수 있다.

## 재개 요청 예시

> 저장소 `/Users/home/playground/vibecoding/deepseek-harness`의 `studio/docs/issues/26-pixie-gate-handoff.md`와 주 명세를 먼저 읽고 현재 Git 상태를 확인해 줘. R2-b1 커밋은 `4a2da1e61d67d04341684ed99fc5671b2c9a7398`이다. 기존 금지 범위는 유지하고, 우선 완료 내용과 남은 작업을 확인한 뒤 내가 지정하는 다음 단위를 진행해 줘.
