# Studio 0.6.2 배포 E2E

검증일: 2026-10-18. 지침서: [releases/0.6.2.md](../../../scripts/agents/releases/0.6.2.md). 검증자 원본 보고: [verifier-report.md](verifier-report.md).

## 대상

- fork 커밋 `08cbc6f319`(`studio/feat/workflow`), 수정하지 않은 DSH `0.2.1-rc.2`(`/usr/local/bin/dsh`).
- 후보 패키지 `matamt-dbg-dsh-studio-0.6.2.tgz`, SHA256 `e514495bd9331dfc79ecf32d5de0b76a35abda928ab816a3b7eb792b9c908afb`.
- 격리 home·프로필(`server.mjs`), 각본 모델(`--mock-llm`). 비밀값 복사·실제 모델 호출 없음.

## 결과

| 단계 | 결과 | 근거 |
|---|---|---|
| workspace 테스트 | 통과 | 769/769. 배포 증거가 아니라 회귀 확인 |
| smoke | 통과 | 12/12, pageerror 0, 플러그인 실패 0 |
| #34 Optimized·Worker | 통과 | `agent-optimized-worker.mjs` 16/16 |
| 역할 자식 회귀 | 통과 | `agent-roles.mjs` 5/5 |
| #33 세션 역할 시작 방식 | 통과 | `agent-session-role-spawn.mjs` 9/9 |
| Web RPC | 통과 | `check-web-runtime.mjs` 네 스크립트, Optimized 도구 27 |
| 화면 | 부분 | 검증자 스크립트의 셀렉터 오류로 일부만 실행. 메인 세션이 별도로 확인(아래) |
| 업그레이드 0.6.1 → 0.6.2 | 통과 | 아래 표, 업그레이드 뒤 smoke 12/12 |
| 정리 | 통과 | 두 프로필 `portFree: true`, 최종 `git status` 빈 출력 |

업그레이드 전후([전](upgrade-before.json), [후](upgrade-after.json)):

| 항목 | 0.6.1 | 0.6.2 |
|---|---|---|
| Optimized 도구 | 22 | 27 |
| bash 실행 기본값 | 600000 | 120000 |
| 서브에이전트 역할 | 0 | Worker 1 |
| 상태 | applied | applied, 편집됨 표시 없음 |
| 0.6.1에서 만든 Optimized 복사본 | 22 / 600000 / 0 / applied | 그대로 |

## 화면 확인 (메인 세션)

같은 후보 패키지를 새 격리 프로필(`guide`)에 설치해 확인했다. 사람 확인을 대신하지 않는다.

- 프리셋 목록: Optimized 카드에 `편집`·`복사` 활성, `삭제` 비활성, `기본값으로 복구` 있음. 라이트·다크·480px([다크](presets.dark-1440.png), [480px](presets.light-480.png))에서 겹침 없음.
- 편집 → 서브에이전트: Worker 역할 1개(라이트·다크).
- 편집 → 실행 설정 → Config: `여러 파일 한 번에 읽기`는 켜진 채 비활성, `한 파일 여러 곳 고치기`는 꺼진 채 비활성, "프리셋을 기본값으로 복구할 때만 바뀝니다" 안내 표시(라이트·다크). pageerror 0.
- 가이드 `preset-list.png`(ko·en)를 이 프로필에서 다시 찍었다.

## 미검증

- 실제 모델로 Worker에 일을 맡기는 흐름, Desktop 앱, DSH `0.2.1-rc.2` 외 버전.
- 화면에서 편집 저장 → `직접 편집함` → 복구 확인 창 흐름은 jsdom 테스트와 RPC 시나리오로만 확인했다.
- 설치 시 peer dependency 경고는 이전 배포와 같이 남아 있다.
