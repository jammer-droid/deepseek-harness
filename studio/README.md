# DSH Studio — lean-agent 기반

수정하지 않은 DSH에 설치하는 Studio 플러그인이다. `studio/feat/workflow`의 `89883feb29`에서 셸을 분리한 뒤 프리셋·역할 편집 기능을 구현했다. 현재 기능과 과거 workflow 이력은 [목적별 문서 목차](docs/README.md)에서 구분한다. 다음 개선 작업은 [UI·UX 개선 백로그](docs/plans/ui-ux-backlog.md)를 따른다.

## 현재 구현

- DSH Studio 사이드바 진입점과 `local.dsh-studio.services` 서비스 등록 슬롯
- 기존 상단 탐색 `ServiceLayout`과 좌측 메뉴·본문 골격 `DetailLayout`
- [디자인 시스템](docs/development/design-system.md), 공용 UI 부품, 기존 토큰·스타일
- 읽기 전용 Master, Optimized 및 사용자 프리셋의 편집·저장·적용
- 도구·프롬프트·Config 편집과 프로필별 영속화
- 역할의 모델·reasoning·fresh/fork·persona 설정과 네이티브 서브에이전트 호출
- 적용·호출 전 런타임 모델 검증과 Optimized 도구 정책
- [SettingsX](docs/reference/settingsx.md): DSH에 없는 단축키 명령(세션 이동 등). 정의 파일로 등록하는 사용자 프로바이더는 연구 코드로만 보존하고 배포에서 제외했다(#28 D10)
- Host/Client 패키지, 설치 번들과 Studio 범위 회귀 테스트

기능 기준 커밋은 `4f42345dd8`이다. Desktop DSH `0.2.0-rc.2` 설치 후 사용자가 반영을 확인했다. 이 결과는 모든 화면·접근성·세션 수명 검증을 의미하지 않는다.

## 이력과 현재 기능 구분

분기 당시 제거한 workflow 편집·실험 기능의 기획·조사·이슈 기록은 이력으로 보존한다. 이를 이후 구현한 프리셋·역할 기능과 혼동하지 않는다. 문서 정리는 사용자 프로필·저장 데이터·설치된 Studio를 변경하지 않는다.

## 개발과 검증

```sh
npm --prefix studio run typecheck
npm --prefix studio test
npm --prefix studio run pack:bundle
```

`test`는 Studio 타입 검사·빌드 후 테스트를 실행한다. `watch`는 Studio 번들만 재생성한다. 루트 빌드나 현재 앱 설치는 실행하지 않는다.

개발 환경은 [개발 안내](development.ko.md), 공개 레포 동기화·npm 공개·업데이트 절차는 [배포 가이드](docs/release.md)를 참조한다. 패키징 성공은 수정하지 않은 DSH에서의 독립 설치 검증을 대신하지 않는다.

## 에이전트 E2E 검증

이슈 완료·배포 전 E2E는 에이전트가 격리 환경에서 실행하고, 사람은 결과와 실제 Desktop·Web 화면만 확인한다. 절차와 규칙의 기준은 [에이전트 E2E 검증 지침](scripts/agents/README.md)이다.

1. 메인 세션이 [지침서 템플릿](scripts/agents/TEMPLATE-e2e.md)을 복사해 `scripts/agents/<이슈>-<주제>-e2e.md`를 쓴다.
2. 사용자가 새 세션에 "`<지침서>`를 읽고 진행해"라고 지시한다. 검증자는 제품을 고치지 않고 기록만 남긴다.
3. 판정은 싼 단계부터 한다: **L0** 스크립트 → **L1** `judge`·`pixie_loop` → **L2** 검증자. 결과마다 판정 단계를 적는다.

| 스크립트 (`studio/scripts/e2e/`) | 용도 |
| --- | --- |
| `server.mjs up` / `status` / `down` | 빌드·패키징한 Studio를 격리 home에 설치하고 수정하지 않은 `dsh`를 띄운다. `--with-desktop-plugins`, `--with-secrets keys,subscriptions`, `--mock-llm` |
| `smoke.mjs`, `browser.mjs` | L0 화면 검사(라이트·다크·좁은 폭, pageerror, 플러그인 활성화 실패) |
| `probe.mjs`, `apply-repairs.mjs` | L1 셀렉터 복구([명세](scripts/e2e/selector-repair.md)) |
| `agent.mjs`, `mock-llm.mjs` | 역할 자식·Tool Filter·persona·상속 같은 에이전트 제어 시나리오([작성 가이드](scripts/e2e/agent-scenarios.md)) |
| `wait.mjs` | 실모델 세션·Pixie 루프·게이트 완료를 스크립트 안에서 대기 |

```sh
node studio/scripts/e2e/server.mjs up            # 구독·키가 필요하면 --with-desktop-plugins --with-secrets keys,subscriptions
node studio/scripts/e2e/smoke.mjs
node studio/scripts/e2e/server.mjs down
```

사전 조건은 화면 검사에 Playwright·Chrome, 에이전트 제어와 `wait.mjs`에 `zstd`다(없으면 `환경 차단`). 산출물과 기본 격리 home은 Git에서 제외된 `studio/dist/e2e/`에 남고 `down`해도 지워지지 않는다. 인증 URL(출력·상태 파일·서버 로그)과 복사한 비밀값은 문서·Git에 옮기지 않는다. `--with-secrets`의 구독 토큰은 격리 환경에서 갱신되면 Desktop 로그인이 끊길 수 있으니 [주의 사항](scripts/agents/README.md#격리-서버)을 먼저 읽는다.
