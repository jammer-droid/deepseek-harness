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

## 공개 배포 후보의 추가 검증

공개 레포 `635b7ffe8f`를 새로 받아 공개 npm 의존성으로 타입 검사·빌드·테스트했다. 751개 통과, 1개 skipped이며 내부 전용 검사는 export에서 제외된다. 이 결과로 만든 Studio tarball은 workspace 빌드와 구분한다.

독립 검증자가 같은 공개 후보를 별도 `public-home`의 `rc3-public` 프로필에 Exa·Subscriptions와 설치했다. RPC 4개, Fresh/Fork 역할 5개, Optimized·Worker 16개 검사가 통과했다. tgz와 설치 파일을 전체 대조했다(Studio 16개, Exa 6개, Subscriptions 139개). 주 세션은 이 공개 후보의 Studio 화면과 Client 오류 없음도 확인했다. 결과는 `studio/dist/rc3-compat/public-check/`에 있다.

- Studio 공개 후보 SHA1: `bd7212365cb0ab83b59e0845f33028d6cf3aec93`
- Studio 공개 후보 SHA256: `038b1902db7bf9d5baf874e55204bf66ab7300567ea7f1ba04331b0b1f887d7e`
- Exa 공개 패키지 SHA1: `7cfe33deed051e8cd75aeea4591f2deb4fcffd95`
- Subscriptions 로컬 tgz SHA256: `774a83f47dc1cf8cec1877ca3eb6c4a5ca3865dc6fe8a962cc435ccee6a212e8`

## 배포

공개 레포와 GitHub Release `v0.6.6`를 게시했다. npm은 Exa `0.1.2` 게시·레지스트리 해시 대조를 완료했다. Studio 첫 npm 인증 요청은 만료(404)되어 재게시 전에 버전 부재를 확인했고, 같은 tarball로 새 요청을 보내 접수됐다. Studio `0.6.6`도 npm 레지스트리에서 확인했고 게시한 SHA1과 일치했다. 레지스트리에서 두 tgz를 다시 받아 해시를 대조했다. 새 `rc3-registry` 격리 프로필에 설치·기동하고 RPC 4개가 통과했다.



## Desktop 반영 완료

- 정상 종료한 Desktop에 npm의 Studio `0.6.6`, Exa fetch `0.1.2`와 로컬 Subscriptions `0.9.9-local.rc3.1`을 공식 `dsh plugin --profile desktop add`로 설치했다.
- 설치 후 검사에서 기존 공식 `@deepseek-ai/dsh-web-search-exa@0.2.1-rc.2`의 별도 호환성 차단도 발견했다. 공개 `0.2.1-rc.3`의 peer를 확인하고 격리 설치 후 Desktop도 갱신했다. 해당 provider 소스는 rc.2→rc.3에서 동일하며 로컬 수정이나 재배포를 하지 않았다.
- 설치 파일 전체가 각 tgz와 일치했다. rc.3 검사 함수로 desktop의 직접 의존성 5개 전부 통과를 확인했다.
- Desktop 재시작 후 세 플러그인의 Problem 표시가 없고 활성화 상태다. Studio `0.6.6`과 기존 프리셋 표시, Subscriptions의 기존 Codex·Claude 계정 및 사용량 표시를 확인했다. 실제 새 모델 요청은 보내지 않았다.
- 교체 전 백업: `~/.dsh/local-backups/rc3-20261024/`. 교체·재시작 후 `cordis.patch.yml`과 Studio 데이터 489개 경로의 해시가 모두 같고 활성 bundle 목록도 같다. 기존 계정은 로그인·로그아웃하거나 인증 저장소를 직접 수정하지 않았다.
- 로컬 Subscriptions 배포물은 `~/.dsh/local-packages/dsh-plugin-subscriptions-0.9.9-local.rc3.1.tgz`에 보존했다. npm 공개 대상이 아니다.
- 후보·공개 후보·레지스트리 검증 서버를 종료했고 해당 포트가 비었음을 확인했다. 사용자 Desktop은 실행 상태로 남겼다.
- 설치 도구의 peer dependency 경고는 남지만 최종 DSH 버전 호환성 차단은 없다.

공개 결과: [Studio 0.6.6 Release](https://github.com/matamt-dbg/dsh-studio/releases/tag/v0.6.6), [Studio npm](https://www.npmjs.com/package/@matamt-dbg/dsh-studio/v/0.6.6), [Exa fetch npm](https://www.npmjs.com/package/@matamt-dbg/dsh-web-fetch-exa/v/0.1.2).
