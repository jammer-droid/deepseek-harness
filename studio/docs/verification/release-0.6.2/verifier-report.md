## Studio 0.6.2 배포 E2E 결과

- 대상 커밋: `08cbc6f319`, 브랜치 `studio/feat/workflow`. 초기/최종 git status --short 출력 없음.
- 런타임: 수정하지 않은 설치본 `dsh 0.2.1-rc.2`.
- 후보 패키지: [0.6.2 tgz](../packs/1792309285263/matamt-dbg-dsh-studio-0.6.2.tgz), SHA256 `e514495bd9331dfc79ecf32d5de0b76a35abda928ab816a3b7eb792b9c908afb`. 신규 설치와 업그레이드에 같은 파일 사용.
- workspace 테스트: `npm --prefix studio test` 종료 코드 0, 769/769, 실패 0. 배포 검증과 별도 근거.
- 비밀값 복사: 없음. 사용자 프로필 변경 없음. 실제 모델 호출 없음(각본 모델).

| 단계 | 결과 | 판정 | 근거 |
| --- | --- | --- | --- |
| 0 시작 확인 | 통과 | L0 | package version/STUDIO_VERSION/CHANGELOG 0.6.2; 런타임 일치; zstd, Playwright, Chrome 155.0.8059.84 사용 가능 |
| 기본 smoke | 통과 | L0 | [결과](smoke.json) 12/12, pageerror 0, 플러그인 실패 0 |
| #34 Optimized·Worker | 통과 | L0 | [결과](agent-optimized-worker.json) 16/16 |
| 역할 자식 회귀 | 통과 | L0 | [결과](agent-roles.json) 5/5 |
| #33 세션 역할 시작 방식 | 통과 | L0 | [결과](agent-session-role-spawn.json) 9/9 |
| Web RPC | 통과 | L0 | [로그](web-rpc.log) 네 스크립트 통과; [별도 RPC](fresh-values.json) Optimized 도구 27 |
| 화면 확인 | 미실행(부분 실행) | L0 | [결과](browser.json) 12 통과/12 실패, 검증자 셀렉터 오류. Worker 설명/복구 버튼/목록 스크린샷 3뷰 확보, pageerror/플러그인 실패 0. 편집·저장·복구·Config·Worker 탭·콘솔 오류 검사는 미완료 |
| 업그레이드 0.6.1 → 0.6.2 | 통과 | L0 | [전](upgrade-before.json)/[후](upgrade-after.json), 아래 값 확인; [smoke](upgrade-smoke.json) 12/12, pageerror/플러그인 실패 0; [로그 검색](upgrade-log-check.json) 실패 일치 0 |
| 4 정리 | 통과 | L0 | [신규 서버 종료](down-fresh.json) portFree true; [최종 upgrade 종료](down-upgrade-final.json) portFree true; 최종 기본 down은 이미 종료되어 state 없음 |

### 업그레이드 값

| 항목 | 0.6.1 | 0.6.2 |
| --- | --- | --- |
| Optimized 도구 | 22 | 27 |
| Optimized bash | 600000 | 120000 |
| Optimized 역할 | 0 | Worker 1 |
| Optimized 상태 | applied | applied, customized 없음 |
| __upgrade_copy__ 도구/bash/역할/상태 | 22 / 600000 / 0 / applied | 동일 |

### 발견(결함 후보), 차단 및 미실행

- 제품 결함 확정 없음. 신규 및 이전/후보 업그레이드 설치 모두 peer dependency 경고가 있었으며 설치·기동·검사는 통과했다. 세부 peer 해결/추가 설치는 하지 않았다.
- 검증 스크립트 결함: [browser-check.mjs](browser-check.mjs)의 `role=button[...][exact=true]`는 Playwright 문자열 셀렉터에 지원되지 않는다. Studio 프리셋 목록에서 해당 명령 실행 시 `Unknown attribute "exact"` 재현. Master 읽기 전용 셀렉터는 10초 timeout. 제품 UI 결함으로 판정하지 않았다.
- L1 복구에는 pixie_loop 도구/제공자가 필요하지만 이 검증 세션에 해당 도구가 없고 격리 프로필에는 비밀값을 복사하지 않았다. 복구 환경 차단; 상위 에이전트 지시에 따라 셀렉터를 고치지 않고 화면 나머지를 미실행으로 남겼다. L1 실행/job 없음. 상위 에이전트가 별도 화면 확인 예정.
- 후보 복사 첫 시도는 server 출력 package가 basename인 것을 경로로 사용하여 ENOENT(exit 1). 실제 packs 내 생성 파일을 SHA256 대조하여 식별했고 그대로 업그레이드에 사용했다. 패키지 유실 없음.
- 최종 화면 사람 확인, 실모델, Desktop, 다른 DSH 버전은 이번 검증 범위에서 미실행.

### 산출물

- [신규 설치 요약](up.json), [이전 버전 설치](up-upgrade-before.json), [후보 업그레이드 설치](up-upgrade-after.json): 인증 URL 제거.
- [workspace 로그](workspace-test.log), [브라우저 스크립트](browser-check.mjs), [업그레이드 RPC 스크립트](upgrade-check.mjs).
- 프리셋 목록: [라이트](../shots/0.6.2-browser/presets.light-1440.png), [다크](../shots/0.6.2-browser/presets.dark-1440.png), [480px](../shots/0.6.2-browser/presets.light-480.png).
- [L1 복구 대기 항목](../shots/0.6.2-browser/repair-items.jsonl).
- [최종 git status](git-status-final.txt): 빈 출력. tracked 파일 변경, 커밋, 푸시, 퍼블리시, 이슈 변경 없음.
