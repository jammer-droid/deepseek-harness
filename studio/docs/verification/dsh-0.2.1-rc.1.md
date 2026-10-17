# DSH 0.2.1-rc.1 호환성 검증

## 결과

2026-10-17: **S1 역할 위임 호환 구현·독립 설치 검증 완료, S2 DEP0205 수정 완료**.

현재 Studio `0.6.0`의 지원 선언에 `0.2.1-rc.1`을 추가했다. 기존 `0.2.0-rc.2`·`0.2.1-alpha.2` 경로는 유지한다. Fresh/Fork의 역할 persona와 Tool Filter, 부모 대화 상속, 재시작 후 복원을 미수정 rc.1에서 확인했다. 전체 기능·외부 모델 호환성을 무제한으로 보증하는 결과는 아니다. 검증하지 않은 범위는 아래에 구분한다.

## 환경과 변경 범위

- 브랜치: `studio/feat/workflow`, 작업 시작 커밋 `880caad795`.
- 런타임: `/usr/local/bin/dsh` → `/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh`, `dsh --version` = `0.2.1-rc.1`.
- 공개 API 대조: `dsh-v0.2.1-rc.1` 태그(`1600d8a1e140dcde43a1a0941940a0480712c011`).
- 개발 Node: `v26.10.0`, `tsx 4.23.13`.
- 격리 home: `studio/dist/rc1-compat-fixed/home`. 역할 진단 프로필은 `rc1-compat-fixed`, 최종 패키지 설치 프로필은 `rc1-final`. Web 포트는 `127.0.0.1:19388`.
- DSH 본체 수정·재빌드, 사용자 앱·desktop 프로필 변경, 외부 모델 호출, 커밋·푸시·배포는 하지 않았다. 검증 서버는 종료했다.
- 제품·테스트·문서 변경은 `studio/`다. 예외는 **사용자가 별도로 승인한** 루트 `pnpm-lock.yaml`의 Studio tsx 항목 2줄과 shell peer specifier 7줄뿐이다. shell의 실제 잠긴 alpha.2 의존성 버전은 유지했다.

## 처음 발견한 비호환

지원 선언만 임시로 넓힌 패키지에서는 Fresh/Fork 모두 자식 생성은 성공했지만, 금지한 `read`가 노출되고 역할 persona가 빠졌다. `read`는 재현용 예시이며 특정 도구만의 문제가 아니었다.

rc.1의 `SubagentStartRequest`는 `persona`·`toolFilter`를 제거했다. native `startActivation()`은 더 이상 두 필드를 적용·저장하지 않는다. 새 `agentPreset` 선택은 spawn만 지원하므로 Fork까지 보존하는 대체가 아니다. 기존 Studio 테스트는 모의 start API가 요청을 받는지만 검사해 이 문제를 잡지 못했다.

근거는 rc.1 태그의 다음 공개 계약·구현이다.

- `packages/subagent/subagent/src/types.ts:31–43`: local child의 예약 `childId`.
- `packages/core/agent/src/runtime-types.ts:249–261`: `agent/created` listener를 순차적으로 기다리며, 실패하면 생성 거부. 완료 전에는 첫 실행을 보류한다.
- `packages/subagent/subagent/src/manager.ts:880–922`: native Fresh/Fork 생성과 cold resume이 공개 Agent 생성·복원 경로를 사용한다.
- `packages/core/tools/src/index.ts:1098–1131`: agent scope의 공개 `tools.restrict()`.
- 같은 파일 `1164–1175`, `1210–1215`: 자기 scope에 다시 등록한 도구는 상속 제한의 대상이 아니다.

## 구현

- `role-tool.ts`는 공개 provider capabilities로 legacy API와 rc.1을 구분한다. Legacy는 기존 native persona·toolFilter를 그대로 쓴다.
- rc.1은 자식 ID를 먼저 예약하고, 최종 persona·deny 목록을 `<profile>/studio-data/child-policies/<childId>.json`에 저장한 뒤 native 위임을 시작한다. 역할 편집 이후에도 기존 자식은 생성 당시의 값을 유지한다.
- `role-child-policy.ts`는 `agent/created`에서 정책을 읽고 persona·제한을 적용한다. 파일 누락·손상·소유 관계 불일치는 실행 전에 실패한다. 한 번 초기화된 자식의 기록은 완료 후에도 재개를 위해 보존하며, 초기화 전 실패한 예약만 정리한다.
- `preset-policy.ts`가 같은 자식 정책을 먼저 적용하고 금지 도구를 override 등록에서 제외한다. 공개 tool guard도 금지 이름의 직접 실행을 차단한다.
- 정책 등록은 자식 Agent 수명에 속한다. Studio unload 동안 새 실행을 막고, 같은 프로세스에서 reload하면 공개 Cordis 서비스에 보존한 설치를 인계해 임시 차단만 해제한다.
- `dev.mjs`, `start-web.mjs`와 배포 manifest에 rc.1을 추가했다. wildcard나 버전 예외 허용은 사용하지 않았다.

## 자동 검사

```sh
npm --prefix studio test
# studio/에서:
node --trace-deprecation --import tsx -e 'console.log("tsx loader ready")'
node --import tsx --test test/release-changelog.test.mjs test/lean-shell.test.mjs test/runtime-peers.test.mjs
```

- Host/Client 타입 검사, Studio 빌드, **688개 테스트 통과**.
- 문서 갱신 후 배포 노트·번들·runtime peer 집중 검사 **5개 통과**.
- DEP0205·DeprecationWarning 출력 없음. 기존 tsx 4.21.0에서는 최소 `--import tsx`만으로 `module.register()` 호출 경고가 재현됐다.
- 새 회귀 검사는 실제 Cordis scope·tools·systemPrompt를 사용한다. default/extend/replace 필터, override 재노출 방지, 동시 자식 격리, 새 owner의 복원, 파일 누락·손상, live child의 unload→reload, native 생성 실패 정리를 확인했다.
- 변경한 lock specifier와 manifest의 일치, `git diff --check`도 통과했다.

## 미수정 rc.1의 실제 역할 실행

[진단 fixture](../../test/fixtures/role-policy-runtime-probe.mjs)를 임시 패키지에만 넣고, Host 진입점의 진단 subclass가 `runRolePolicyProbe(ctx, this)`를 호출하도록 했다. fixture는 실제 Studio 프리셋 저장·적용, 패키징된 `roles.js`와 `policy.js`, 공개 native `startActivation`·`sendMessage`를 사용한다. DSH 실행 파일과 소스는 변경하지 않았다.

LLM 경계에는 공개 `LlmAdapter`로 등록한 로컬 결정적 응답기를 사용했다. 실제 요청에 전달된 system message·도구 schema·대화 이력을 검사하되 외부 모델·credentials는 사용하지 않았다.

| 역할 | 방식 | 최종 금지 목록 | 모델 요청의 persona | 부모 대화 상속 |
| --- | --- | --- | --- | --- |
| 기본 필터 | Fresh | `read` | 유지 | 없음 |
| 기본 + 확장 | Fork | `read`, `write` | 유지 | 유지 |
| 기본 대체 | Fresh | `write` | 유지 | 없음 |

세 역할을 동시에 시작했다. 금지 도구는 schema에 없고 직접 `tools.execute()`도 거부됐다. 허용 도구의 Studio 설명 override는 유지됐고, 부모의 `read`·`write`는 그대로였다.

이후 DSH 프로세스를 완전히 종료하고 **같은 격리 home으로 다시 실행**했다. 현재 역할 정의의 persona·필터를 바꾼 뒤 native `sendMessage()`로 기존 자식들을 cold resume했다. 세 자식 모두 원래 persona·필터·Fork 이력을 유지했다.

정책 파일 하나를 임시로 치우면 `NOT_RESUMABLE` 오류와 `Studio child policy` 원인으로 복원을 거부했고, 모델 호출 횟수는 증가하지 않았다. 파일을 돌려놓은 뒤에는 같은 자식을 이어갈 수 있었다.

로컬 원시 결과는 Git에서 제외되는 다음 위치에 있다.

- `studio/dist/rc1-compat-fixed/create-result.json`
- `studio/dist/rc1-compat-fixed/resume-result.json`
- `studio/dist/rc1-compat-fixed/final-tests.log`

## 진단 코드 없는 최종 패키지 설치

```sh
STUDIO_PACK_DIST=dist/rc1-compat-fixed/release node studio/pack.mjs
DSH_HOME="$PWD/studio/dist/rc1-compat-fixed/home" dsh --profile rc1-final --from-default-profile web --dump-config
DSH_HOME="$PWD/studio/dist/rc1-compat-fixed/home" dsh plugin --profile rc1-final add "$PWD/studio/dist/rc1-compat-fixed/release/matamt-dbg-dsh-studio-0.6.0.tgz"
DSH_HOME="$PWD/studio/dist/rc1-compat-fixed/home" dsh --profile rc1-final --host 127.0.0.1 --port 19388 --no-open
```

`rc1-final`은 새 프로필이며, **정상 `pack.mjs`가 만든 Studio만 설치**했다. staging manifest 수정이나 진단 wrapper가 없다. archive에 probe 파일이 없음을 확인했다.

- 파일: `studio/dist/rc1-compat-fixed/release/matamt-dbg-dsh-studio-0.6.0.tgz`
- SHA256: `6fa9aab1172dcbf25fbc613d8b565d88e68750323172e18024ddb0a0772e9b4b`
- Loader·Web 기동 성공, 호환 버전 차단 없음.
- 인증 URL을 인자로 넘긴 실제 RPC 검사 4개 모두 통과: `check-master-runtime.mjs`, `check-optimized-runtime.mjs`, `check-session-roles-runtime.mjs`, `check-role-runtime.mjs`.
- Master 읽기 전용 보호·38개 도구·파생 프리뷰·설정 덮어쓰기·확장 추가/복원, Optimized 복사/적용, 세션 역할 편집/격리, 역할 저장/재적용/해제/복원을 확인했다.

## 실패 이력과 검증 한계

초기 조사에서 기존 `check-catalog-runtime.mjs`는 config 필드 부재를 가정해 실패했고, `check-preview-runtime.mjs`는 `minimal`에 없는 `read/grep/glob` 요청에서 실패했다. 현재 Studio 소스의 계약과 맞지 않는 기대값으로, rc.1에서 새로 생긴 회귀라고 단정하지 않았으며 이번 수정 범위에서 두 스크립트를 고치지 않았다. 최종 설치에서는 위 4개 계약 검사를 사용했다.

외부 DeepSeek·Jev 호출, Pixie Loop 전체 흐름, GUI 전체 화면, 실제 사용자 프로필 마이그레이션, macOS 이외 OS, 구버전 DSH 재설치는 이번에 검증하지 않았다. 구버전 API 분기와 기존 기능은 workspace 회귀 검사로 확인했다. 진단 fixture를 포함한 tarball은 배포하지 않는다.
