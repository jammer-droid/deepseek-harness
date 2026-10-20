# Studio 0.6.3 배포 E2E 결과

지침서: [archive/releases/0.6.3.md](../../../scripts/agents/archive/releases/0.6.3.md). 새 세션의 검증자가 2026-10-20에 실행했고, 메인 세션이 산출물(`studio/dist/e2e/0.6.3/`)을 읽어 정리했다.

- 대상 커밋: `f9bcb8e704`. 패키지 `matamt-dbg-dsh-studio-0.6.3.tgz`의 SHA256은 `8a8f8c93e2af573e09060b247e53e36abce1d7dbb90d391b8e3cad9178115379`이고, client 번들이 HEAD 빌드와 같다.
- 런타임: 설치된 수정하지 않은 DSH `0.2.1-rc.2` CLI. 비밀값은 복사하지 않았다. 각본 모델과 로컬 가짜 Exa 엔드포인트를 썼다.
- workspace 테스트: `npm --prefix studio test` 800개 통과(배포 증거가 아니라 회귀 확인).

| 단계 | 결과 | 판정 | 근거 |
| --- | --- | --- | --- |
| 기본 smoke | 통과 | L0 | 12/12, pageerror 0, 플러그인 실패 0 (라이트·다크·480px) |
| Web RPC 회귀 | 통과 | L0 | master·optimized·session-roles·role 네 스크립트 통과 |
| Optimized·Worker 회귀 | 통과 | L0 | 16/16 |
| R1 분류 | 통과 | L0 | Exa `profile`/`installed`/`compatibility` |
| R2 차단 | 통과 | L0 | Master 추가 거부, extensions `[]`, Optimized `applied`·경고 없음 |
| R3 등록 | 통과(검증 스크립트 기준 수정) | L0 | 아래 참고 |
| R4 설정 | 통과 | L0 | 응답에 키 없음, `apiKey set: true`, `web.searchProvider: exa` |
| R5 검색 | 통과 | L0 | 가짜 엔드포인트 `/search`에 저장한 키(Bearer)로 도달, 세션에 표식 |
| R6 기본값 | 통과 | L0 | patch에서 `web` 덮어쓰기 행 제거, Exa insert 유지 |
| R7 재시작 | 통과 | L0 | Master·Optimized `applied`, 7개 카테고리 17행 |
| 업그레이드(0.6.2 → 0.6.3) | 통과 | L0 | 0.6.2에서 Exa를 Master에 추가하자 Optimized가 실패 경고를 남겨 원래 결함을 재현했다. 0.6.3으로 올린 뒤 이전 계획 1건이 나왔고 키는 가려져 있었다. 이전 성공, 백업 600, 원본 키 보존. Optimized 재반영 `applied` |
| 플러그인 탭 화면 | 통과 | L0 | 33/33, pageerror 0 |
| 실행 설정 화면 | 통과 | L0 | 18/18, `플러그인 추가` 입력 없음 |
| 가짜 엔드포인트 정리 | 통과 | L0 | `portFree: true` |

## R3 판정

검증 스크립트는 `ok: false`를 기록했다. 기준에 "patch 줄 수 +3"을 고정했는데, 새 프로필의 patch는 빈 목록 `[]` 한 줄로 끝나고 Studio는 이 줄을 insert 블록으로 바꾼다. 그래서 순증가는 +2다. 이 동작은 명세와 단위 테스트(`[]` 처리)가 정한 대로다. 나머지 기준은 모두 맞았다: `id: web-search-exa`, 재등록 거부, 추가된 텍스트가 insert 한 항목, 이후 `profile-active`. 같은 패키지로 새 격리 프로필 `r063r3`에서 다시 확인해 같은 결과를 얻었다. 그래서 제품 결함이 아니라 검증 기준의 오류로 판정한다(L2, 메인 세션).

## 남은 것

- 미실행: 실제 제3자 에이전트 기능 패키지의 포함 흐름, 실제 활성화 실패 등록. [후속 후보](../../plans/plugins-followups.md) V1·V2 참고.
- 다른 DSH 버전에서는 시험하지 않았다.
- 설치 도구의 peer dependency 경고는 이전 배포와 같다.
