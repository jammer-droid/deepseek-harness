# DSH 0.2.1-rc.3 호환성 검증

검증일: 2026-10-24. 기준 소스: `1d6e7a971d`. 대상: Studio `0.6.6`, Exa fetch `0.1.2`, Subscriptions 로컬 포크 `0.9.9-local.rc3.1`.

## 원인과 수정

설치된 Studio 0.6.5·Exa 0.1.1·Subscriptions 0.9.9-local.rc2.1은 DSH 지원 선언이 rc.2에서 끝났다. 공식 `dsh-v0.2.1-rc.3`의 `evaluatePluginCompatibility`를 메모리에서 실행해 각각 DSH peer 8개·2개·5개 불일치로 차단됨을 재현했다.

공식 rc.2→rc.3 소스를 비교했다. 사용하는 Host API·Cordis·web provider·역할 생성/복원 계약에는 변경이 없었다. Client의 panel pin·conversation overflow 메뉴 등 변경은 기존 등록 계약을 유지했다. 세 플러그인 모두 제품 로직 변경 없이 rc.3 지원 선언을 추가했다. Studio 버전과 개발 실행 허용 목록을 갱신했고, Subscriptions는 공개 rc.3 개발 의존성으로 다시 컴파일했다. DSH 코어와 루트 lockfile은 수정·재빌드하지 않았다. 버전 예외 허용을 사용하지 않았다.

## 결과

| 검사 | 결과 |
| --- | --- |
| `npm --prefix studio test` | 타입 검사·빌드 성공, 803개 통과 |
| `node studio/plugins/release.mjs web-fetch-exa pack` | 타입 검사·빌드 성공, 14개 통과 |
| Subscriptions `npm run build`, `npm test`, `npm pack --ignore-scripts` | 빌드 성공, 610개 통과·7개 skipped |
| 미수정 런타임 독립 설치 | 설치된 공식 Desktop CLI `/usr/local/bin/dsh`, `--version` = `0.2.1-rc.3`; 새 home의 `rc3-candidate` 프로필 |
| `check-web-runtime.mjs` | Master·Optimized·세션 역할·역할 저장/재적용 4개 통과 |
| `agent-roles.mjs` | 로컬 각본 모델, 5개 통과. Fresh default/Fork extend/Fresh replace의 persona·금지 도구 노출 및 직접 실행 거부·허용 도구 실행, Fork만 부모 완료 턴 상속, 부모 도구 유지 |
| GUI | CUA로 Studio/Pixie 접근, 다크·480px 렌더링 및 More conversation views → Subagents 접근 확인 |
| Exa GUI 설치 | 후보 tgz 설치·활성화, 별도 등록 없이 실행 확인 |
| Exa 런타임 fetch | 로컬 HTTP Contents fixture에 `web_fetch` 경유 POST 1회 도달, URL·테스트 키·응답 본문 확인; provider 설정 복원 |
| Subscriptions 동시 로딩 | 5개 provider status·proxy RPC 성공, Settings 화면의 5개 미로그인 상태 확인. 사용자 인증 복사 없음 |
| 독립 리뷰 | 차단·수정 권장 없음. 한국어 변경 문구도 별도 수동 검토 |

RPC와 역할 검사는 `STUDIO_E2E_HOME`·`STUDIO_E2E_PROFILE=rc3-candidate`를 명시해 실행했다. 브라우저는 세션의 CUA 도구 지침에 따라 직접 검사했으며 저장소 Playwright 자동 smoke 실행으로 표기하지 않는다. Exa fixture 검사는 `studio/dist/rc3-compat/exa-runtime-probe.mjs`, 결과는 `combined-probe.json`이다. Exa 기존 시나리오의 체크 이름은 Exa라고 표시하지만 이번 호출의 외부 경계는 **로컬 응답 서버**다.

## 실패 이력과 한계

- 첫 역할 검사 명령에서 스크립트가 읽지 않는 `--profile` 인자를 사용해 상태 파일을 찾지 못했다. `STUDIO_E2E_PROFILE`을 지정한 뒤 통과했다.
- Exa fixture의 초기 단언은 effective fetchProvider가 비어 있다고 가정해 실패했다. rc.3 기본값 `http`와 사용자 override를 구분해 `diff.fetchProvider`가 비어 있는지 검사하도록 고쳤다. 제품 변경 없이 통과했다.
- 외부 모델·실제 Exa API·신규 OAuth·기존 자식 cold resume·이전 DSH 버전의 새 후보 설치는 미검증이다. 이전 버전 검증 기록과 이번 결과를 구분한다.
- `pixie_loop`/`judge` 호출 도구가 없어 한국어 자동 교정은 환경 차단이다. 변경 문장의 의미·문체를 독립 리뷰어가 수동 검토했다.
- Subscriptions의 일반 의존성은 바꾸지 않았다. npm audit 집계 low 2/high 4는 이번 호환성 변경과 분리하며 자동 수정하지 않았다.
- 원시 로그와 tgz는 Git 제외 경로 `studio/dist/rc3-compat/`에 있다. 인증 URL·키는 보고서에 기록하지 않는다.

## 배포

공개 패키지·Desktop 반영 결과는 배포 완료 후 추가한다.
