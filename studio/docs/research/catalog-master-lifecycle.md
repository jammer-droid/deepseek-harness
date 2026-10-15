# 기본 tool·Config 카탈로그와 Master 생성·갱신 조사

## 범위와 결론

이 문서는 로컬 checkout의 현행 Studio 소스와 테스트를 추적한 조사 기록이다. **설치 앱의 `app.asar`는 파일이며 `/Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh`는 실제 디렉터리가 아니다.** 따라서 아래 workspace 코드는 로컬 참고본이고, 실행 중인 설치 앱과 동일한 구현·버전임을 확인한 결과가 아니다. 설치 앱, 사용자 프로필, 코어를 수정하지 않았다. own-scope 정책과 대안 설계는 부모 에이전트의 별도 조사 결과를 접점 요약으로만 포함한다.

핵심은 **Master 구성, tool 카탈로그, Config 카탈로그가 서로 다른 집합**이라는 점이다.

| 대상 | 현행 출처 | 생성·갱신 시점 |
| --- | --- | --- |
| Master 선언 | 코드의 명시적 `masterComposition()` + 저장된 사용자 확장 | Studio 서비스 시작 후 capture, 확장 저장 시 재등록 |
| tool 카탈로그 | global tool schemas + Master와 허용된 내장 프리셋의 scope schemas·prompt assembly tools | capture 시 스냅샷 |
| Config 카탈로그 | Master 구성의 leaf 플러그인 모듈이 export한 `Config`를 JSON Schema로 투영 | 같은 capture 시 스냅샷 |
| Client 표시 데이터 | `studioCatalog.read()` 응답 또는 `saveExtensions()` 응답 | 화면 mount / 해당 화면의 확장 저장 성공 |

근거: [Host 서비스:33–45](<../../src/host/shell.ts#L33-L45>), [capture:107–147](<../../src/host/shell.ts#L107-L147>), [tool 수집:31–48](<../../src/preset-catalog.ts#L31-L48>), [Client:86–120](<../../src/shell.tsx#L86-L120>).

## 1. Master는 어디서 만들어지는가

현재 기준은 설치된 모든 플러그인이나 사용자의 `standard` 문서를 복사하는 방식이 아니다. [masterComposition:3–29](<../../src/host/master-composition.ts#L3-L29>)가 매번 새 명시적 구성 배열을 만든다.

- persona, agent-instructions, time-context, OS별 bash/pwsh, spill-policy, Studio batch, fs/search/jobs/skill/goal 등이 포함된다.
- planning·compaction·delegation은 group과 isolate 구성을 유지한다. 범용 subagent와 Studio role 도구 제공자도 선언된다.
- web, present, cordis, plugin-manager 도구 등이 포함되지만, `task_run` 제공자는 주석으로 명시적으로 제외된다.
- 이 목록은 **플러그인 선언 목록**이지 실제 도구 이름 목록이 아니다. 제공자가 활성화되어 등록한 tool schemas가 실제 카탈로그의 출처다.

Host는 확장 행이 있으면 `studio-added` group을 덧붙인다. Loader 대기와 Config 조사 이후 `agentPresets.register({ id: 'studio-master', ... plugins: composition })`를 호출하고 resolve 결과의 `broken`을 검사한다. 서비스 해제 시 Master disposer도 호출한다([shell:107–132](<../../src/host/shell.ts#L107-L132>), [해제:45](<../../src/host/shell.ts#L45>)). `listPresets()`의 읽기 전용 Master 행은 이 snapshot을 기다린 뒤 합성된다([52](<../../src/host/shell.ts#L52>)).

## 2. 기본 tool 카탈로그의 실제 출처

[readPresetCatalog:31–48](<../../src/preset-catalog.ts#L31-L48>)의 절차는 다음과 같다.

1. `tools.schemas()`의 global 결과로 이름별 Map을 시작한다.
2. 전달된 각 프리셋의 `acquireScope(id)` lease를 얻는다.
3. 해당 scope로 `systemPrompt.assemble()`을 호출한다. **prompt contributor를 실행하지 않는 단순 선언 읽기가 아니다.**
4. scope의 `tools.schemas(lease.key)`와 `assembly.tools`를 합친다. 도구 이름이 같으면 뒤 값이 앞 값을 덮는다.
5. 프리셋별 도구·prompt section·선언도 보관하고, 실패 시 그 프리셋의 error를 기록한다. lease는 finally에서 해제한다.
6. 최종 도구는 이름순 정렬하며 알려진 prompt section 매핑을 붙인다.

여기서 “각 프리셋”은 사용자 프리셋 전체가 아니다. 실제 caller는 Master를 먼저 넣고 registry 목록 중 `standard`, `ptc`, `minimal`, `cordis`만 추가한다([shell:133–139](<../../src/host/shell.ts#L133-L139>), [허용 목록:4](<../../src/optimized-preset.ts#L4>)). 따라서 **최상위 `catalog.tools`는 Master 전용 도구 목록보다 넓을 수 있다.** Master 자체의 도구는 `catalog.presets`에서 Master 행의 `tools`로 구별해야 한다. Master 수집 오류는 capture 전체 실패로 승격되지만 다른 프리셋 오류는 행에 남는다.

별도로 `readStartupCatalog()`는 scope를 열거나 assemble하지 않지만, 현행 Host 경로는 이를 호출하지 않는다. 함수 이름이나 [startup 테스트](<../../test/startup-catalog.test.mjs#L4-L11>)만 보고 현행 부팅을 무활성화 조회라고 해석하면 안 된다([두 구현:15–48](<../../src/preset-catalog.ts#L15-L48>), [실제 호출:134](<../../src/host/shell.ts#L134>)).

## 3. Config 카탈로그의 출처와 의미

[capture:110–127](<../../src/host/shell.ts#L110-L127>)는 Master 구성에 대해 다음을 수행한다.

- `configEntries()`가 group을 재귀 순회하여 leaf 행을 만든다. ID는 `delegation/tool-subagent`처럼 부모 ID를 포함한다([configEntries:24–29](<../../src/config-overrides.ts#L24-L29>)).
- `loader.import(row.name)` → `unwrapExports()`로 모듈을 얻고, export된 `Config`가 native schema일 때 `createConfigProjector()`로 JSON Schema를 만든다. loader expression 정의를 `$defs`에 포함하고 JSON 직렬화 가능한 데이터로 만든다.
- native가 아닌 schema/import 실패는 해당 item의 `error`로 남는다. `Config`가 없는 제공자는 schema 없는 행으로 남는다.
- 기본 제공자의 `config` 값은 `row.config ?? {}`의 복제본이다. **validator 기본값까지 적용된 effective runtime config가 아니라 Studio가 선언한 입력값**이다.
- `studio-added/` 아래 사용자 확장은 자격 증명이 있을 수 있으므로 raw `config`를 응답에 넣지 않는다. 단, import는 모듈 코드를 실행할 수 있어 단순 파일 목록 읽기와 다르다.

별도 [readPluginCatalog:14–26](<../../src/plugin-catalog.ts#L14-L26>)는 Loader entries와 owning tree import를 사용하는 유틸리티다. 그 테스트는 유효하지만 현행 Host `capture()`의 Config 목록 생성 경로와는 다르다. 따라서 “Studio Config 목록은 모든 Loader entry를 자동 열거한다”는 결론은 맞지 않는다.

## 4. 언제 만들어지고 언제 바뀌는가

### 최초 생성

생성자에서 `setImmediate` 이후 `capture()`를 실행하는 Promise를 `snapshot`에 저장한다. Loader가 Studio 활성화를 기다리는 상태에서 역으로 Loader를 기다리지 않도록 activation effect 반환값으로 연결하지 않는다는 주석이 있다. capture 안에서는 projector 준비 후 `loader.await()`를 기다린다([shell:41–44](<../../src/host/shell.ts#L41-L44>), [110–113](<../../src/host/shell.ts#L110-L113>)).

`read()`는 capture를 다시 하지 않고 `structuredClone(await snapshot)`을 반환한다. 화면 mount 시의 RPC 재조회나 브라우저 새로고침만으로 서버가 최신 registry를 재수집하지는 않는다([shell:72](<../../src/host/shell.ts#L72>), [Client:90–96](<../../src/shell.tsx#L90-L96>)). 서비스 재생성은 다시 최초 capture를 실행한다.

### 명시적 확장 저장

[saveExtensions:76–105](<../../src/host/shell.ts#L76-L105>)는 아래 순서로 동작한다.

1. JSON과 확장 행을 검증하고 변경 작업을 직렬화한다.
2. 이전 snapshot과 이전 확장을 읽는다.
3. 임시 `studio-probe-*` 프리셋을 등록·resolve하여 활성화를 확인하고 해제한다. 이 단계에서 모듈 코드는 실행될 수 있다.
4. 기존 Master를 해제하고 새 확장으로 capture한다.
5. 성공하면 확장 저장 파일을 갱신한다. 이 전체 update Promise가 새 snapshot이다.
6. capture 또는 저장 실패 시 새 Master를 해제하고 이전 확장으로 capture하여 snapshot 복원을 시도한다. 복원 자체가 실패하지 않는다는 보장은 코드에 없다.

Client의 해당 저장 동작은 반환된 새 catalog로 `setCatalog()`한다([shell.tsx:113–120](<../../src/shell.tsx#L113-L120>)). 다른 창에 broadcast하거나 polling하는 처리는 이 경로에 없다.

### 자동 갱신의 경계

현행 Host 생성자·capture·read·saveExtensions에는 tool 등록 변경, Loader inventory 변경, 파일 변경을 구독하여 snapshot을 무효화하는 코드가 없다([Host 전체 경로](<../../src/host/shell.ts#L24-L150>)). 따라서 패키지를 설치하거나 global 도구가 나중에 등록됐다는 사실만으로 이미 만들어진 snapshot이 갱신되지는 않는다. 다음 capture에서 global/선별 scope에 보이는 새 도구가 수집될 수는 있지만, 설치 자체가 Master 구성에 행을 추가하지는 않는다. 저장 파일을 외부에서 바꾸는 것도 watcher 기반 갱신이 아니다.

## 5. 저장과 Optimized 부수 효과

Master 확장은 profile의 Studio 저장 디렉터리에 둔 `master-extensions.json`에 저장된다. 위치 계산은 `profileContext.dir`을 우선하고 없으면 `DSH_PROFILE_DIR`을 사용한다([preset-store:46–49](<../../src/host/preset-store.ts#L46-L49>), [shell:35–38](<../../src/host/shell.ts#L35-L38>)). 파일이 없으면 빈 확장이고, 형식 오류는 실패한다. 저장은 version 1 JSON, 직렬 큐, 임시 파일 후 rename 방식이다([master-extensions:95–140](<../../src/host/master-extensions.ts#L95-L140>)). 이번 조사에서는 이 사용자 파일을 열거나 수정하지 않았다.

capture 끝에서 Master 행의 tools를 이용해 `ensureOptimized()`도 실행한다([shell:143–146](<../../src/host/shell.ts#L143-L146>)). 이는 순수 조회만 하는 함수가 아니다. Optimized가 없으면 등록·저장하고, 계산한 request가 기존과 같으면 그대로 반환하며, 다르면 적용 상태에 맞추어 갱신한다([preset-store:132–162](<../../src/host/preset-store.ts#L132-L162>)). 따라서 Master를 다시 만들었다고 **모든 파생 프리셋이나 동일 request의 Optimized composition이 무조건 재생성되는 것은 아니다.** 이 조사는 Host 서비스를 실제로 구동하지 않고 정적 추적과 제한된 단위 테스트만 수행했다.

## 6. 테스트 근거와 이번 검증

| 테스트 | 입증하는 것 | 입증하지 않는 것 |
| --- | --- | --- |
| [preset-catalog:5–19](<../../test/preset-catalog.test.mjs#L5-L19>) | global·scope·assembly 합집합, 오류 기록, lease 해제 | Host의 프리셋 whitelist, 실제 설치 런타임 |
| [startup-catalog:4–11](<../../test/startup-catalog.test.mjs#L4-L11>) | 별도 startup helper의 비활성화 조회와 복제 | 현행 Host가 이 helper를 쓴다는 주장 |
| [plugin-catalog 테스트](<../../test/plugin-catalog.test.mjs>) | 별도 helper의 Loader 대기, owning tree import, 개별 오류 | 현행 capture의 명시 구성 기반 Config 수집 |
| [master-extensions 테스트](<../../test/master-extensions.test.mjs>) | 저장·재개방, 직렬 저장, malformed 실패, literal dialect 검증 | Host probe→Master 교체→rollback 전체 통합 |

이번 실행 명령(Studio 디렉터리):

```sh
node --import tsx --test test/preset-catalog.test.mjs test/startup-catalog.test.mjs test/master-extensions.test.mjs test/plugin-catalog.test.mjs
```

결과: **10 tests, 10 pass, 0 fail**. Node `DEP0205` deprecation warning이 있었으나 테스트 실패는 없었다. 테스트 임시 저장소는 OS 임시 디렉터리이며 사용자 프로필이 아니다. 전체 빌드·전체 테스트·GUI 검증·독립 배포 검증은 실행하지 않았다. Host catalog 갱신의 전체 통합 테스트는 위 테스트들로 대체할 수 없다.

## 7. 동적 등록과 정책의 접점(별도 조사 요약)

카탈로그 갱신과 실행 정책 갱신은 별개다. 예를 들어 schedule 도구 제공자는 `schedule` 서비스 의존성이 충족되면 도구를 등록하므로, 서비스 활성화로 기존 제공자가 늦게 깨어날 수 있다([tool-schedule:435–445](<../../../packages/schedule/tool-schedule/src/index.ts#L435-L445>)). 이는 Studio snapshot 자동 갱신을 의미하지 않는다.

정책 설치는 empty allow probe로 해당 정책 scope의 own 등록을 거부한다([preset-policy:82–100](<../../src/host/preset-policy.ts#L82-L100>)). Agent 적용에서는 **Agent own 등록** 문제이지 모든 preset-local 제공자가 금지된다는 뜻이 아니다. 이미 설치된 정책 뒤에 own 도구가 추가되면 schema를 숨기지 못할 수 있으나 선택하지 않은 호출은 guard가 거부한다([132–138](<../../src/host/preset-policy.ts#L132-L138>)). 반면 정책 미설치·재설치 시점의 실패는 모든 호출을 막는 임시 guard와 `tools/change` 재시도 경로로 이어진다. reconcile은 이미 설치된 Agent를 건너뛰므로 서비스 ON을 항상 전체 차단이라고 단정하면 안 된다([190–213](<../../src/host/preset-policy.ts#L190-L213>)).

기존 Master 확장에 제공자를 명시하고 재capture한 뒤 사용할 프리셋에서 명시적으로 허용하는 경로는 검토 가능하지만, 다른 Agent-local 등록과의 충돌까지 해결한다고 보장하지 않는다. 일반적인 inventory 발견과 실제 adoption, Host/global 설정과 preset-local 설정의 소유권을 구분해야 한다. 정책 테스트 `node --import tsx --test test/preset-policy.test.mjs test/policy-reselect.test.mjs`는 16/16 통과했으며, 이는 위 카탈로그 테스트 10개와 구별한다. 실행 중 Host Inspect의 `tools` 계약에서도 `restrict`가 scope-local 등록을 숨기지 않으며 `guard`가 실행을 거부하는 별도 계약임을 확인했다.

### 개선 방향

- **발견과 채택 분리:** 설치/활성 제공자와 도구 후보를 출처·등록 범위·의존성 상태와 함께 보여 주되, 새로 발견됐다고 사용자 프리셋에 실행 권한을 자동 추가하지 않는다. 현재 이름별 Map은 출처 충돌을 구별하지 못하므로 제공자 식별도 보존해야 한다.
- **명시적 갱신부터:** 카탈로그 새로고침을 먼저 제공하고, 이후 공개 변경 이벤트를 검증하여 snapshot 무효화와 Client 갱신을 추가한다. 카탈로그 읽기와 Master 재등록을 분리하여 조회가 실행 구성을 불필요하게 바꾸지 않도록 한다.
- **제공자 채택:** 기존 확장 등록을 이용하여 호환 제공자를 Agent 상위의 프리셋 구성에 명시하고, 의존성·중복 이름·실제 Agent의 own 등록 유무를 검사한다. 임시 프리셋 활성화 성공만으로 Agent별 동적 등록까지 검증됐다고 하지 않는다.
- **Config 소유권:** Host 전역 서비스 설정과 Studio 프리셋 내부 제공자 설정을 구분한다. 외부 Host 설정의 조회 가능성이 수정 권한을 뜻하지 않는다. 전역 설정을 프리셋에 무조건 복제하거나 예약 서비스 자체를 중복 생성하지 않는다.
- **Agent-local 도구의 한계:** 현재 공개 API로 임의 own 도구의 모델 비노출과 실행 차단을 모두 보장한다고 할 수 없다. 엄격한 동일 정책을 유지하려면 등록 방식을 호환시켜야 하며, 범용 지원에는 DSH의 공개 노출 제어 계약 확장이 필요하다. 실행 guard만 유지하고 스키마 노출은 허용하는 방안은 기술적으로 다른 정책 모드이며, 현행 보장 완화이므로 명시적 제품 결정 없이 오류 검사만 제거해서는 안 된다.
- **적용 실패 UX:** 호환되지 않는 구성을 적용 전에 진단하고 기존 정상 적용본을 보존하는 것이 우선이다. 모든 외부 플러그인 활성화를 Studio가 사전에 차단하거나 되돌릴 수 있다는 보장은 없으므로, 실제 실행 시 fail-closed 복구 안내도 유지한다.

이 항목들은 설계 제안이며 구현·설치 환경 검증 결과가 아니다.

## 8. 기존 문서와의 차이

[기존 Master 설명:5–7](<../reference/master-preset.md#L5-L7>)의 `standard` 선언 기반·Master scope만 조회한다는 설명, [28](<../reference/master-preset.md#L28>)의 외부 플러그인 추가 UI가 별도 작업이라는 설명은 현행 소스와 차이가 있다. 현재는 명시 구성, 선별된 내장 프리셋까지 포함한 tool 수집, 확장 저장 RPC와 Client 갱신 경로가 존재한다. 과거 검증 기록을 현재 설치 앱 검증으로 재해석하지 않기 위해 원문을 수정하지 않고 이 조사 문서에 차이를 남긴다.

문서는 기존 [문서 분류 원칙](<../README.md#L58-L60>)과 [선행 runtime 조사](<../development/runtime-catalog-api.md>)를 참고하여 조사 자료 디렉터리에 한 파일만 추가했다. 코드 변경·own-scope 설계 변경·프로필 변경은 포함하지 않는다.
