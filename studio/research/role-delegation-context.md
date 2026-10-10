# Studio 역할 위임과 컨텍스트 관찰 조사

## 최종 결정과 구현 티켓

이 문서는 공개 확장 가능성을 조사한 참조 자료다. 아래 조사 본문의 질문·대안은 조사 당시 기록이며 현재 미결정 요구사항 목록이 아니다. 최종 정책의 권위는 [Wayfinder 결정 맵](https://github.com/jammer-droid/deepseek-harness/issues/1)의 Resolution 링크에 있다. 맵 종료는 제품 구현이나 통합 검증 완료를 뜻하지 않는다.

승인된 구현 작업은 다음 티켓에서 관리한다. 각 티켓은 사용자 동작부터 저장·실행·화면·테스트까지 필요한 경로를 포함하며 선행 관계는 GitHub native dependencies에 기록한다. 역할 편집 UI는 첫 버전에 포함한다. 기존 조사와 결정이 다르면 최종 Resolution과 구현 티켓을 따른다.

1. [역할 설정을 편집·검증·적용한다](https://github.com/jammer-droid/deepseek-harness/issues/7)
2. [Studio 도구로 최초 구현을 시작하고 실행 정보를 확인한다](https://github.com/jammer-droid/deepseek-harness/issues/8)
3. [리뷰를 요청하고 판정·근거를 확인한다](https://github.com/jammer-droid/deepseek-harness/issues/9)
4. [기존 자식으로 재작업·재리뷰하며 상한을 적용한다](https://github.com/jammer-droid/deepseek-harness/issues/10)
5. [명시적 fork 위임과 컨텍스트 근거를 탐색한다](https://github.com/jammer-droid/deepseek-harness/issues/11)
6. [Studio 관리 자식의 직접 입력을 제한한다](https://github.com/jammer-droid/deepseek-harness/issues/12)
7. [재시작·중단·접수 불명확 상태를 안전하게 처리한다](https://github.com/jammer-droid/deepseek-harness/issues/13)
8. [실제 Studio 변경으로 전체 사이클을 검증한다](https://github.com/jammer-droid/deepseek-harness/issues/14)

## Dev Note — 정적 조사 기록

이하 내용은 실행 검증되지 않은 조사 자료이며 현재 제품 동작이나 별도의 승인 명세가 아니다. 머신별 외부 플러그인 참조는 조사 환경에서만 의미가 있다.

## 요약과 증거 범위

이 문서는 [구현 경로 지도](https://github.com/jammer-droid/deepseek-harness/issues/1)와 의사결정 #2–6의 본문·댓글을 읽고 공개 API와 작업공간 소스를 재조사한 한국어 참조다. 구현 승인, 실행 검증 또는 Agent Note가 아니다. 사용자의 확정 제약은 **DSH 코어·기존 소스 수정 없이 추가 플러그인만으로 Studio를 제공하는 것**이다. 대상은 작업공간 `0.2.1-alpha.2`이며, Studio가 설정을 편집·Apply하고 DSH 플러그인이 실행한다. 역할별 여러 도구가 아니라 하나의 역할 인지 도구를 사용한다. Apply는 이후 생성되는 자식에만 적용하고 기존 자식은 재개 시 생성 당시 역할 설정을 유지한다. 첫 구현에 설정 편집 UI까지 포함할지는 별도 미결정이다.

소스 기준으로는 Studio Host 플러그인이 기존 subagents 서비스를 소비하고 Studio Client 플러그인이 공개 `conversation.view`에 참여하는 경로가 있다. 새 에이전트 런타임이나 코어 UI 수정은 우선 필요하지 않다. 그러나 역할 정책, 실행 시점 설정 기록, 리뷰어 권한, 반복 종료 규칙은 기존 도구를 연결하는 것만으로 완성되지 않는다.

| 증거 | 관찰 범위와 한계 |
| --- | --- |
| 작업공간 소스 | 버전 `0.2.1-alpha.2`. 아래 소스·테스트 인용은 정적 조사이며 테스트 통과 증거가 아니다. |
| 설치 Desktop 및 Host Inspect | 앱 버전 `0.2.0-rc.2`. Host Service에서 `subagents.startContinuable`, `llm.resolveCallConfig` 등을 확인했다. 작업공간의 `startActivation`과 API가 다르다. |
| Client Inspect | `Service.listService`와 `Slots.listSubTree`가 각각 10초 만에 시간 초과했다. 실제 페이지의 탭·슬롯·주입 props는 확인하지 못했다. |
| 조사에서 실행하지 않은 것 | 제품 구현, 빌드, 테스트, 브라우저 검증, 설치·프로필 변경, 커밋·푸시, 이슈 종료. 전체 세션에서는 부모 에이전트가 사용자 제약에 맞춰 지도·일부 이슈 본문과 조사 댓글을 갱신했다. 이 문서 조사 에이전트는 tracker를 변경하지 않았고 세션 내용이나 비밀을 수집하지 않았다. |

[Studio 목표](../goals.ko.md#L46-L61)와 [개발 범위](../development.ko.md#L3)는 Studio 내부와 공식 공개 확장을 우선한다. 현재 제약에서는 코어 수정은 대안이 아니다. 설치 앱 Inspect는 공개 API 탐색 자료일 뿐, 작업공간 버전의 호환성 증거가 아니다. 이 조사에서는 빌드·테스트·프로필 변경·설치·세션 본문 조회를 하지 않았다.

### 플러그인만으로 가능한 범위

| 요구 | 판정 | 조건 또는 부족한 확장 |
| --- | --- | --- |
| 단일 역할 도구와 fresh/fork | 공개 API + 자체 플러그인 구현 | `tools.register`와 `subagents.startActivation`; 기존 도구 schema에 역할 필드를 추가하는 공개 hook은 확인되지 않아 별도 도구가 적합하다. |
| 역할 설정 저장·Apply | 공개 API | volatile Config, settings Remote, config-editor를 재사용한다. 역할 의미 검증과 child별 불변 snapshot은 Studio 소유다. |
| 독립 자식의 역할·revision 조회 | 공개 API + 자체 플러그인 구현 | storageDomain sidecar와 Studio Remote 조회를 추가한다. 기본 child descriptor에 role/revision을 임의 추가하지 않는다. |
| 엄격한 읽기 전용 리뷰 | 공개 API + 자체 플러그인 구현·검증 필요 | 상속 도구 filter와 executor guard를 조합하고 shell·재위임 등 우회 능력을 금지한다. 임의 shell을 허용하면서 무조건 읽기 전용이라는 보장은 확인되지 않았다. |
| Agents 탭 | 공개 API + 자체 Client 플러그인 | `conversation.view` 등록과 공개 type export를 사용한다. 현재 페이지의 live Slot 확인은 실패했다. |
| 재시작 뒤 과거 전체 실행환경 재현 | 기존 API만으로 보장 부족 | descriptor는 route/persona/filter를 저장하지만 과거 preset·플러그인 구현 전체는 보존하지 않는다. 코어 수정 대신 지원 보장 범위를 좁히거나 별도 버전 고정 배포가 필요하다. |

### 실제 외부 플러그인 선례

현재 등록된 `@local/dsh-session-cycle`은 [프로필 symlink](</Users/home/.dsh/profiles/desktop/node_modules/@local/dsh-session-cycle/package.json>)에서 [외부 프로젝트](</Users/home/playground/vibecoding/HarnessEngineeringLab/harnesses/dsh/plugins/dsh-session-cycle/package.json>)로 연결된다. [플러그인](</Users/home/playground/vibecoding/HarnessEngineeringLab/harnesses/dsh/plugins/dsh-session-cycle/plugin.js#L18-L47>)은 effect 소유 `shortcuts.register`, sessions/workspaces snapshot, `uiWorkspace.openSession`을 사용하는 추가 Client 플러그인이다. 다만 [정렬 어댑터](</Users/home/playground/vibecoding/HarnessEngineeringLab/harnesses/dsh/plugins/dsh-session-cycle/order.js#L1-L4>)는 `0.2.0-rc.2`의 사설 localStorage 키 `dsh.workspace.view.v5`에 의존하므로 모든 구현이 공개 API만 사용한다는 선례는 아니다. Studio는 등록·패키징 방식만 참고하고 이 저장 형식 의존은 복제하지 않는다.

## 확장 위치

대상: [역할 기반 위임을 기존 DSH의 어느 확장 지점에 배치할 것인가](https://github.com/jammer-droid/deepseek-harness/issues/2).

### 먼저 결정할 질문

작업공간 대상과 단일 `role + prompt + optional context` 도구는 확정됐다. context를 생략하면 역할 기본값을 사용한다. 남은 질문은 역할별 허용 context 집합과 기본 subagent/fork/workflow 도구를 함께 노출하지 않을 Studio 전용 preset 구성이다.

### 확인한 근거

- [기존 subagent 도구](../../packages/subagent/tool-subagent/src/index.ts#L220-L327)는 설정된 provider와 child 옵션을 소비하고 모델 선택을 사전 검사한 뒤 위임한다. 역할 이름을 받아 역할별 정책을 찾는 도구는 아니다. 설정 인스턴스별 고정값과 호출별 route 선택은 구분된다.
- [공개 activation 타입](../../packages/subagent/subagent/src/types.ts#L30-L59)은 provider, label, request, signal, delivery 및 child 식별자·결과·dispose를 제공한다. [manager](../../packages/subagent/subagent/src/manager.ts#L379-L465)는 자식 옵션과 정책을 먼저 포착한 뒤 기존 준비·생성 경로를 사용한다.
- [child composition](../../packages/subagent/subagent/src/child-agent.ts#L177-L216)은 부모 preset 참여, 위임 권한 설명, persona 덮어쓰기와 tool restriction을 자식 범위에 적용한다. Studio가 이를 별도 런타임으로 복제할 이유는 확인되지 않았다.

### 대안과 남은 검증

우선 검토할 대안은 Studio Host의 역할 도구가 검증된 Config에서 정책을 조회하고 기존 subagents 서비스로 시작하는 방식이다. LLM 입력에는 역할·작업·허용된 컨텍스트 선택만 노출하고 provider/model/effort/persona/tools 임의 덮어쓰기는 받지 않는 편이 지도 합의와 맞는다. 스키마에서 숨기는 것만으로 끝내지 않고 실제 실행 진입점에서 역할과 허용 조합을 검사해야 한다.

역할마다 기본 도구를 여러 인스턴스로 만드는 방안은 단일 도구 결정과 맞지 않는다. 신규 provider는 역할 라우팅 자체의 필수 요소가 아니다. [Web profile](../../packages/bundle/web-app/cordis.patch.yml#L536-L559)은 Host 전역 위임 도구를 비활성화하고 [standard preset](../../packages/bundle/web-app/presets/standard.patch.yml#L83-L121) 안에 scoped 도구를 등록한다. 따라서 전역 row만 끄면 기본 도구가 제거된다고 가정하면 안 된다. Studio 추가 bundle/profile patch 또는 Studio 소유 preset으로 실제 조합에서 기본 생성 도구와 workflow를 제외하되, 기존 subagents 서비스·spawn/fork provider는 유지할 수 있다. 이 구성은 DSH 기존 파일 편집이 아니라 추가 배포 설정으로 제공해야 하며 이번 조사에서 적용하지 않았다.

### 설정 저장와 Apply

[settings](../../packages/settings/settings/README.md#L26-L47)는 활성 프로필의 고유 entry에서 `.volatile()` Config 필드만 편집하고 전체 Config를 검증한다. [Remote update/replace/mutate](../../packages/api/settings-controller/src/index.ts#L97-L157)는 expectedRevision을 받고, [실제 쓰기](../../packages/settings/settings/src/index.ts#L378-L422)는 config-editor 안에서 충돌과 비volatile 경로를 거부한다. [config-editor](../../packages/boot/config-editor/README.md#L12-L41)는 후보 전체를 저장 전에 검증하고 profile 변경과 직렬화하며 파일을 원자적으로 교체한다. reconcile 실패 시 이전 문서·patch 복원을 시도한다. 이를 다중 저장소·child 생성까지 포함하는 분산 transaction으로 해석하면 안 된다.

설정 revision은 [프로세스 내부 Map](../../packages/settings/settings/src/index.ts#L225)이므로 재시작을 넘는 역할 revision으로 쓰면 안 된다. 영속 역할 snapshot 식별자는 Studio가 별도로 저장해야 한다. [volatile 적용](../../vendor/loader/README.md#L53)은 정상적인 volatile-only 변경에서 참조를 갱신하고 fiber를 유지한다. 일반 effective 값까지 바뀌면 remount될 수 있고 volatile-update listener 실패는 이미 commit된 값을 되돌리지 않는다. 따라서 의미 검증은 Apply 승인 전에 끝내고, 새 child 생성 때 snapshot을 복사하며 기존 child의 필터·persona·guard는 갱신하지 않는 설계가 필요하다. 역할 Apply를 preset 교체/HMR/disable과 혼동하면 기존 child 유지 보장이 깨질 수 있다.

프로토타입은 대상 버전에서 시작·결과 수집·중단·재개·dispose를 기존 수명주기 그대로 사용하는지, 설정 교체와 플러그인 해제 시 등록이 정리되는지 확인해야 한다. [기존 도구의 깊이 해석](../../packages/subagent/tool-subagent/src/index.ts#L322-L327)처럼 `resolveMaxDepth`와 기존 설정·재귀 제한을 존중해야 한다. 서비스 직접 호출에서 optional maxDepth를 생략할 수 있다는 이유로 제한을 우회해서는 안 된다. fork가 역할 도구도 상속할 때 자식의 재위임 권한과 깊이·전체 반복 한도의 관계를 별도로 정해야 한다. 설치 버전의 `startContinuable`을 소스의 `startActivation`과 같은 메서드로 취급하거나 자동 호환된다고 가정할 수 없다.

## 역할 설정과 fresh·fork

대상: [역할 설정과 fresh·fork 컨텍스트 생성은 어떻게 결합할 것인가](https://github.com/jammer-droid/deepseek-harness/issues/3).

### 먼저 결정할 질문

역할마다 기본 방식과 허용 방식 집합을 둘 것인가? 역할 고정 모델·persona·도구가 부모와 다른 fork를 허용하고 캐시 재사용 가능성 감소를 받아들일 것인가? 리뷰어의 읽기 전용은 어떤 실행 권한으로 보장할 것인가?

### 확인한 근거

| 항목 | 소스에서 확인한 의미 |
| --- | --- |
| fresh | [spawn 준비](../../packages/subagent/subagent-spawn-in-process/src/index.ts#L39-L55)는 부모 이벤트 seed를 만들지 않는다. 그러나 같은 작업공간과 부모 preset·권한 정책을 사용할 수 있으므로 보안 격리가 아니다. |
| fork | [fork 준비](../../packages/subagent/subagent-fork-in-process/src/index.ts#L38-L79)는 마지막 `turn/end`까지의 완료된 부모 이벤트 prefix를 한 번 복사한다. 완료된 턴이 없으면 seed가 없다. 이후 부모 이벤트는 자동 전파되지 않는다. |
| 현재 턴 | fork 호출이 일어나는 진행 중 부모 턴은 제외된다. 그 턴의 사용자 요청, 구현 결과, 도구 출력은 작업 프롬프트나 명시적 증거 참조로 전달해야 한다. fork라는 이름만으로 리뷰어가 방금 만든 결과를 받았다고 볼 수 없다. |
| 역할 지시 | [persona 적용](../../packages/subagent/subagent/src/child-agent.ts#L203-L216)은 `deployment:persona-prefix` 섹션을 가린다. 과거 seed에 있는 지시나 다른 preset 섹션 전체를 지우지는 않는다. |
| 도구 | [restriction 구현](../../packages/core/tools/src/index.ts#L1162-L1224)은 global뿐 아니라 모든 ancestor에서 상속된 도구를 제한하며 child 자신의 등록만 예외다. [scoped 회귀 사례](../../packages/core/tools/tests/scoped.spec.ts#L215-L249)는 부모 scope의 bash 실행 거부와 child report 유지 사례다. 공개 메서드 설명의 global-only 문구를 현재 구현 전체로 해석하면 안 된다. 목록에 edit/write가 없다는 사실만으로 전체 쓰기 불가가 보장되지 않는다. |
| 권한 | [위임 권한](../../packages/subagent/subagent/src/child-agent.ts#L219-L253)은 부모의 명시적 sandbox override와 권한 identity를 포착하고 approval을 `never`로 고정한다. 자동 승인 불가와 읽기 전용은 다른 속성이다. |
| 모델과 effort | [route 사전 검사](../../packages/subagent/tool-subagent/src/model-selection.ts#L176-L196)와 [LLM 해석](../../packages/llm/llm/src/index.ts#L860-L947)을 사용한다. effort는 해당 모델의 정확한 식별자이며 명시적으로 지원하지 않는 값은 `UNSUPPORTED_REASONING_EFFORT` 실패다. 조용히 가까운 값으로 보정하지 않는다. |

[기존 fork 도구 정책](../../.agents/notes/implemented/feature/2026-08-24-user-authorized-subagent-model-routes.md#L13-L39)은 캐시 재사용 가능성을 보존하려고 호출별 모델 선택을 비활성화한다. 반면 하위 자식 생성 경로는 agentOptions를 받을 수 있다. 따라서 역할 고정 모델을 fork에 적용하는 것은 기술적으로 별도 검토 가능한 선택이지만 기존 도구 기본 정책과 동일하지 않다. 조립된 요청 prefix 일치도 실제 provider 캐시 적중의 증거는 아니다.

### 대안과 남은 검증

역할별 기본 방식과 허용 집합을 분리하면 기본은 설정이 정하고 명시적 호출 선택은 허용 집합 안에서만 사용할 수 있다. 허용되지 않은 조합은 생성 전에 실패시키는 대안과 사용자에게 선택을 되돌리는 대안이 있다. 자동 fresh 전환은 컨텍스트 의미를 바꾸므로 합의 없이 채택하지 않는다.

리뷰어는 파일 편집 도구뿐 아니라 shell, PTC, 재위임, 설정·플러그인 변경, 권한 확대 경로까지 포함해 허용 능력을 정의해야 한다. [공개 execution guard](../../packages/core/tools/src/index.ts#L1132-L1159)는 실행 검사 후보지만, 구체적 도구와 executor·sandbox의 제한을 함께 검증해야 한다. 제한된 도구와 읽기 전용 실행 환경을 함께 사용하는 보수적 대안은 검토 가능하나 현재 Studio에 구현·검증된 보장으로 적지 않는다.

## 실행 기록과 관찰 범위

대상: [에이전트별 컨텍스트를 어떤 실행 기록으로 설명할 것인가](https://github.com/jammer-droid/deepseek-harness/issues/4).

### 먼저 결정할 질문

역할 설정은 child 생성 시점을 기록한다. 남은 질문은 보존 기간과 독립 조회 범위다. 부모 로그에 있는 도구 인자·결과 metadata만으로 충분한가, 부모 없이 자식을 열거나 재개할 때도 역할 설정 revision을 복원해야 하는가? 민감한 요청·도구 결과·과거 reasoning 기록은 기본 화면에서 어느 수준으로 감출 것인가?

### 확인한 근거

- [자식 descriptor](../../packages/subagent/subagent/src/descriptor.ts#L1-L48)와 [복원 데이터](../../packages/subagent/subagent/src/descriptor.ts#L72-L110)는 provider/model/effort/persona/toolFilter 등을 로그에 남기고 compaction 이후에도 사용한다. 임의 agentOptions와 모든 예산을 복원하는 만능 설정 저장소는 아니다.
- [catalog projection](../../packages/subagent/subagent/src/catalog.ts#L120-L150)과 [projection 의미](../../packages/subagent/subagent/src/projection-types.ts#L46-L84)는 inherited prefix를 자식 자신의 관계·identity 근거에서 제외한다. fork로 상속된 부모의 위임 이력을 자식이 실행한 위임으로 표시해서는 안 된다.
- [Session 참조](../../docs/subsystems/session.md#L49-L101)와 [요청 재구성 회귀 사례](../../packages/core/agent-loop/tests/request-reconstruction.spec.ts#L84-L145)는 `request/header`, system 기록과 이벤트 prefix를 기반으로 요청을 설명할 근거다. 현재 설정 화면은 과거 요청의 실효 설정 증거가 아니다.
- [compaction](../../packages/compaction/compaction/README.md#L142-L150)은 모델에 보이는 기록을 로그 기반으로 대체하지만 raw history는 유지한다. 최초 seed와 특정 요청의 실제 입력은 compaction·추가 메시지·route 변경 때문에 달라질 수 있다.
- [adapter replay 처리](../../packages/llm/llm/src/index.ts#L999-L1013)는 현재 adapter가 소유하지 않는 과거 provider 메시지의 replayState를 제거한다. 저장된 과거 assistant reasoning/replayState, 재전송 가능한 내용, 모델 내부의 비공개 추론은 서로 다르다. raw fork 로그에 과거 reasoning 기록이 있을 수 있지만 UI가 비공개 내부 추론에 접근한다는 뜻은 아니다.

### 기록 대안

최소 대안은 부모 도구 인자에 role/prompt를 남기고 결과 metadata에 childId, role revision, 선택된 fresh/fork, 해석된 설정과 seed 기준을 연결하는 것이다. 기존 도구 결과를 활용하므로 새 Session 이벤트 타입을 즉시 요구하지 않는다. 단, 부모 로그를 읽을 수 없거나 자식만 독립적으로 열 때 동일한 설명을 재구성할 수 있는지 검증해야 한다.

독립 자식 열기·cold resume에는 [공개 storageDomain](../../packages/storage/storage-domain/src/index.ts#L19-L38)의 `defineDomain`/`domainTable`, `ctx.storageDomain.open`으로 childId 키의 역할 snapshot을 보존할 수 있다. [Domain API](../../packages/storage/storage-domain/README.md#L28-L73)는 검증된 읽기와 durable write를 제공한다. Studio Host가 이를 공개 Remote로 조회하게 하고 Client는 child catalog와 연결하는 방식은 자체 플러그인 구현 사항이다. 직접 backend 파일, session 내부 저장 경로, 내부 subagent descriptor import는 필요하지 않다. 기본 [도구 결과 meta](../../packages/core/tools/src/index.ts#L302-L314)는 `output.presentationMeta`를 통해 기존 `tool/result` 또는 `tool/ptc-dispatch`에 보존되므로 role/childId/snapshot 식별자 표시에는 새 코어 이벤트가 필요 없다. model-visible 역할 설명은 기존 logged prompt·persona·tool output 경로에 실어야 한다. sidecar는 Session 로그와 별도 저장되므로 기본 Session export에 자동 포함되거나 다른 프로필로 함께 이식된다고 가정하면 안 된다. 내보내기·가져오기와 누락된 sidecar의 표시 정책은 Studio가 별도로 정해야 한다.

[예약 childId](../../packages/subagent/subagent/src/types.ts#L31-L44)를 먼저 만들고 sidecar를 준비한 뒤 `startActivation`에 전달하는 설계를 검토할 수 있다. 그러나 sidecar 저장과 child 생성은 하나의 원자 작업이 아니다. 저장 성공·생성 실패, 생성 성공·응답 손실, 재시작 중 미확정 상태를 별도로 조회·조정해야 하며 미확정 기록을 실행 완료로 표시하면 안 된다. guard가 시작 전에 적용되는지와 cold resume에서 준비되지 않은 정책으로 실행하지 않는지는 추가 실행 검증 대상이다.

생성 당시 설정 유지의 범위도 구분해야 한다. descriptor에 남는 route/persona/toolFilter와 Studio의 과거 snapshot은 유지 가능하지만, [preset registry](../../packages/preset/agent-preset-registry/README.md#L56-L60)는 재시작 때 현재 정의를 사용하며 과거 전체 plugin 구성을 보존하지 않는다. 기존 child 재개 시 전체 환경까지 완전히 동일하다고 약속할 근거는 없다. 코어 이벤트 확장이나 내부 타입 변경은 이번 대안에서 제외한다.

### 표시 정확성과 개인정보

화면의 각 값은 설정값, 실행 기록에서 확인한 값, 로드되지 않음, 관찰 불가를 구분하는 편이 적절하다. role revision은 위임 당시 값을 가리켜야 하며 현재 역할 설정 변경이 과거 자식의 설명을 바꾸면 안 된다. 요청 증거에는 session·request·논리 seq 범위와 상속 종료점을 연결하고 본문이 없는 경우 실패·미로딩·실제 없음의 구분을 유지한다.

원문 프롬프트·도구 출력에는 비밀과 사용자 데이터가 포함될 수 있다. 요약·설정 중심 기본 보기와 명시적 원문 열기, 접근 범위 및 내보내기 정책은 사용자 결정 대상이다. 기존 진단의 [제한된 오류 정보](../../packages/subagent/subagent/src/types.ts#L243-L287)를 원문 로그 공개 허가로 해석하면 안 된다. 토큰 수·비용·캐시 적중도 provider가 기록한 실제 값이 없으면 추정 또는 관찰 불가로 표시해야 한다.

## Agents 탭

대상: [Agents 탭에서 에이전트별 컨텍스트를 어떻게 보여줄 것인가](https://github.com/jammer-droid/deepseek-harness/issues/5).

### 먼저 결정할 질문

작업공간 공개 슬롯으로 Trajectory 옆 Agents 탭을 추가한다는 방향은 코어 수정 없이 가능하다. 남은 질문은 기본 요약과 명시적 원문 열기의 범위, 그리고 첫 UI에 역할 설정 편집·Apply까지 포함할지다.

### 확인한 근거

[공개 슬롯 선언](../../packages/client/ui-conversation/src/client/contract/slots.ts#L184-L185)은 `conversation.view`를 session scope의 list로 정의한다. [Trajectory 등록](../../packages/client/ui-trajectory/src/client/index.ts#L79-L112)은 실제 공개 확장 사용례이며 order는 10이다. [탭 목록 구성](../../packages/client/ui-conversation/src/client/apply.ts#L180-L223)은 슬롯 기여를 표시 목록으로 만들고 등록·locale 변경을 구독한다. [뷰 렌더러](../../packages/client/ui-conversation/src/client/skeleton/DefaultConversationViews.tsx#L17-L41)는 선택된 슬롯을 렌더링한다. 따라서 작업공간 소스에서는 Studio Client가 같은 슬롯에 등록하는 방식으로 코어를 수정하지 않고 Agents 탭을 추가할 수 있다. Trajectory 자체는 developer-tools 설정에 따라 숨겨질 수 있다.

[기존 subagent UI](../../packages/client/ui-subagent/src/client/index.ts#L34-L90)는 catalog·header·열기 동작을 사용한다. [Session Remote](../../packages/api/session-controller/src/index.ts#L477-L530)는 cold-safe page, follow, seq가 붙은 projection을 제공하므로 별도 실행 로그 복제보다 기존 데이터 접근을 우선 검토할 수 있다. 실제 설치 버전의 대응 API와 Client 연결은 이번 조사에서 검증하지 못했다.

### 표시 대안과 남은 검증

최소 화면은 부모·자식 계보와 상태 목록, 선택한 에이전트의 실효 역할 설정·revision, fresh/fork 및 상속 종료점, 이후 메시지·결과를 연결하는 상세 영역으로 구성할 수 있다. 이는 제안이지 승인된 UI 설계가 아니다. 초기 범위는 읽기 전용 관찰로 한정하고 중단·재개 명령은 별도 승인과 실제 수명주기 의미 확인 후 추가하는 대안이 있다.

[요청 inspection 타입](../../packages/client/ui-conversation/src/client/contract/request-inspection.ts#L65-L104)에서 system 문자열이 비어 있는 것은 현재 로드된 창 밖이기 때문일 수도 있다. 미로딩을 컨텍스트 없음으로 표시하면 안 된다. 오래된 요청은 paging 후 같은 논리 seq 시점으로 정합성을 맞추고, 따라오는 이벤트와 초기 페이지 사이의 중복·누락을 막아야 한다. 외부 provider, 지워진 부모, unavailable projection도 빈 성공 화면이 아니라 설명 가능한 상태가 필요하다.

Client 코드는 [공개 client entry](../../packages/client/ui-conversation/src/client/index.ts#L40-L72)에서 `RequestPromptInspector`, `ConvViewProps`, `ConversationStore` 등의 타입만 import하고, 값은 injected service와 slots로 얻는다. 다른 feature의 runtime helper/class를 직접 import하는 방식은 피한다. Trajectory 사용례처럼 `slots.inject('conversation.view', ...)`로 선언을 기다리고 disposer를 소유한다. [Studio sidebar 등록](../src/shell.tsx#L199-L224)은 플러그인 UI 선례일 뿐 Agents 탭 대체물이 아니다. 플러그인 해제·재등록, 세션 전환, cold session, 재연결, 큰 로그, locale·접근성은 프로토타입 검증 대상이다.

## 최소 사이클과 수용 기준

대상: [최소 구현·리뷰 사이클의 수용 기준과 검증 사례는 무엇인가](https://github.com/jammer-droid/deepseek-harness/issues/6).

### 먼저 결정할 질문

첫 수용 기능은 무엇인가? 구현자·리뷰어에 사용할 provider/model/effort와 허용 권한은 무엇인가? 최대 리뷰·재작업 횟수, 시간·비용 제한, 합격 판정, 중단·재개 의미는 어떻게 정할 것인가? 아래 사례는 이 값들을 결정하기 위한 제안이며 구현 착수 승인이 아니다.

### 제안하는 최소 시나리오

작은 파일 변경 과제를 사용해 오케스트레이터가 구현자에게 위임하고, 결과와 명시적 증거를 리뷰어에게 넘긴다. 리뷰어는 파일을 수정하지 않고 검토 결과만 반환한다. 결함 시 오케스트레이터가 재작업을 지시하고 한도 내 재리뷰를 수행한다. 완료 보고는 실제 변경과 검증 결과를 구분하며 자동 커밋·머지를 하지 않는다. 모호한 요구나 역할 간 충돌은 인간 결정으로 돌린다.

| 검증 대상 | 성공 사례 | 반드시 거부하거나 구분할 사례 |
| --- | --- | --- |
| 역할 라우팅 | 같은 role revision이 지정한 설정으로 child 생성 | 알 수 없는 역할, 호출자의 임의 route·effort·tools 변경, unsupported effort는 child 생성 전 실패 |
| fresh/fork | fresh는 과거 대화 seed 없음, fork는 완료 prefix와 이후 자식 기록 구분 | 진행 중 부모 턴의 구현 결과는 fork에 없음; 명시 전달 없이는 검토 완료로 취급하지 않음 |
| 역할 변경 | 실행 중 설정을 바꿔도 기존 자식은 당시 revision으로 설명 | 새 설정을 기존 자식의 실행값으로 소급 표시하지 않음 |
| 읽기 전용 리뷰 | 조회와 검토 결과만 수행 | 파일 도구, shell, PTC, 재위임·설정 변경을 통한 쓰기·권한 확대 시도 거부 |
| 반복 한도 | 결함 → 오케스트레이터 재작업 → 재리뷰 → 합격 | 무한 반복, 리뷰어 직접 수정, 한도 도달 후 조용한 추가 실행 금지 |
| 수명주기 | 결과 전달·중단·재개·cold 복원에서 childId와 관계 유지 | 중단 접수와 실제 정지를 혼동하지 않음; 큐·하위 자식 잔존을 명시 |
| 관찰 | role revision, 설정, seed cut, 요청·결과의 근거 연결 | compaction 전 raw 기록을 현재 요청 입력으로 오표시하지 않음 |
| UI | 탭 선택·세션 전환·오래된 요청 paging·재연결 | 미로딩, unavailable, 삭제된 부모를 빈 정상 데이터로 표시하지 않음 |
| 외부 효과 | 실제 최종 파일과 독립적인 예상 결과를 비교 | 모델의 완료 문장이나 도구 결과 문장만으로 성공 판정하지 않음 |

### 기존 증거와 새 검증의 차이

[fork 테스트](../../packages/subagent/subagent-fork-in-process/tests/subagent-fork-in-process.spec.ts#L62-L125)는 완료 턴이 없는 경우, 여러 완료 턴과 진행 중 턴 제외를 정적으로 확인할 수 있는 회귀 사례다. [continuation 권한 테스트](../../packages/subagent/subagent/tests/continuation-inheritance.spec.ts#L1-L7)는 cold resume에서 저장된 권한을 다시 사용하는 사례다. [Web 중단 테스트](../../apps/web/tests/subagent-interrupt.e2e.ts#L132-L197)는 중단 접수와 정지 완료가 다르고 대기 메시지가 보존되어 이후 FIFO로 재개됨을 명시한다. 이 조사에서 해당 테스트를 실행하지 않았다.

[Studio의 현재 테스트](../test/studio.test.mjs#L9-L69)는 Remote 오류·상태 갱신·dispose·타이머·빌드의 loader 형태를 다룬다. 역할 라우팅, 읽기 전용 리뷰, 반복 한도, Agents 탭의 검증은 아니다. [Studio 테스트 명령](../package.json#L5-L11)은 빌드를 포함하므로 조사에서는 실행하지 않았다.

[저장소 테스트 정책](../../docs/testing.md#L7-L15)에 맞춘 다음 단계의 검증 계획은 역할 정책 단위 테스트, 실제 Loader 조합의 Host 통합, 세션·파일 결과를 비교하는 keyless replay, 사용자 동작 중심 Client 테스트, 실제 조립된 브라우저 검증을 구분해야 한다. [snapshot 소유 규칙](../../snapshots/AGENTS.md#L5-L17)에 따라 프로세스는 지원되는 dsh 진입점으로 시작하고 변경되는 작업공간은 별도 최종 결과 oracle을 둔다. 실제 provider의 effort 지원·과금·캐시 효과는 replay만으로 입증할 수 없으므로 별도 승인된 실 API 검증이 필요하다.

## 미결정 사항과 조사 종료 조건

확정 사항은 plugin-only, 작업공간 대상, 단일 역할 도구, Studio 설정 편집·Apply와 DSH 실행의 분리, 새 child에만 Apply 적용이다. 구현자·리뷰어의 기본 context는 모두 fresh이며 명시적 fresh/fork 선택은 유지한다. 기본 재작업 상한은 최초 구현을 제외한 2회이고, 이후에도 불합격이면 사람에게 반환한다. 역할·사이클 상태는 Studio Host 플러그인이 저장하고 실행 옵션은 기존 subagents API로 변환한다. 역할별 모델·context 허용 집합, 관찰 개인정보, 첫 UI 범위는 아직 결정되지 않았다. `maxDepth`는 위임 깊이이며 재작업 상한과 다르다. 강제 제한의 실행 경로와 영속 상태 검증은 아래 후속 조사 대상이다.

첫 리뷰어는 A로 확정했다. 파일 읽기·검색과 전달받은 검증 증거 검토만 허용하고, 추가 테스트는 오케스트레이터를 통해 구현자에게 요청한다. 직접 수정·범용 shell·임의 PTC 실행·재위임·설정 변경은 허용하지 않는다. 지침과 실제 도구 실행 제한을 함께 적용하며 도구 자체 scope의 예외까지 검증한다. 이는 아직 구현·실행 검증된 권한 보장이 아니다.

후속 검증은 대상 Client Inspect 연결, 실제 preset의 도구 소유 scope와 guard 적용, 저장·child 시작 실패와 cold resume, 역할 snapshot의 독립 조회 순서다. 공개 API가 부족하면 그 기능의 지원 한계를 보고하거나 범위를 좁힌다. DSH 코어·기존 소스 수정으로 해결하는 대안은 제시하지 않는다.

## 후속 메시지·재시작과 재작업 강제 제한 조사

아래는 작업공간 소스에 근거한 설계 가능 범위이며 통합 실행 검증 결과가 아니다. 강제 대상은 Studio가 식별·관리하는 사이클의 재작업 접수다. 자연어로 같은 작업을 새 사이클로 다시 요청하는 행위나 임의 shell 작업까지 의미적으로 동일한 재작업이라고 판정하는 보장은 포함하지 않는다.

### 후속 메시지와 대체 호출

[공개 sendMessage](../../packages/subagent/subagent/src/index.ts#L294-L315)는 정확한 live sender와 인접 관계를 검사하고 실행 중 자식에 전달하거나 유휴·비상주 자식을 깨운다. [cold resume](../../packages/subagent/subagent/src/manager.ts#L1325-L1375)는 저장된 descriptor의 모델·persona·toolFilter를 복원하지만 Studio 사이클이나 재작업 횟수는 모른다. 따라서 최초 생성뿐 아니라 기존 child 후속 요청도 Studio의 사이클 작업으로 접수한 뒤 이 서비스를 호출해야 한다.

[tools.guard](../../packages/core/tools/src/index.ts#L1132-L1159)는 모델의 도구 실행에 대한 거절 수단이지 모든 Service 호출을 가로채는 API가 아니다. 일반 send_message·subagent·fork·workflow 및 다른 실행 수단을 Studio 세션 구성에서 제거하거나 실행 검사로 거절해야 한다. 허용한 다른 플러그인이 직접 subagents 서비스를 호출하는 것까지 자동 통제하지는 못한다. 범용 shell, 외부 자동화, 관리자 설정 변경도 별도 권한 범위이며 Studio wrapper 하나만으로 전체 DSH의 강제 정책을 만들 수 없다.

### 재시작 전에 정책 준비

[agent/created](../../packages/core/agent/src/runtime-types.ts#L247-L261)는 비동기 초기화를 기다리고 완료 전 queued input 실행을 보류한다. [관련 테스트](../../packages/core/agent-loop/tests/scope-lifecycle.spec.ts#L63-L89)는 준비 순서를 확인하는 정적 근거다. Host 플러그인이 이 공개 이벤트에서 관리 대상 identity와 저장된 역할·사이클 정책을 읽고 실행 제한을 준비하는 경로가 있다. [agent/pre-step](../../packages/core/agent/src/runtime-types.ts#L308-L320)도 모델 요청 전 상태 검사를 수행할 후보이나, waterfall은 다른 listener가 next를 호출하지 않으면 이후 listener를 건너뛸 수 있으므로 독립적인 전역 보안 장벽으로 취급하지 않는다.

관리 대상인지 확인할 영속 연결 자체가 사라진 경우를 일반 세션으로 오인해서 허용하면 안 된다. 관리 세션 표시·저장 데이터의 일관성, 플러그인 로드 완료 전 실행 차단, HMR·비활성화 때의 진행 중 작업 처리를 실제 구성에서 검증해야 한다. 필수 관리 플러그인이 제거된 환경이나 임의 다른 Host 플러그인까지 통제하는 보장은 없다.

### 작업 의도와 도구 입력

`role + prompt + optional context`만으로는 최초 구현과 재작업을 확실히 구분할 수 없다. 단일 역할 도구라는 합의는 유지하되 사이클 식별자와 명시적인 작업 종류를 추가하는 설계가 필요하다. 정확한 필드 이름과 최초 사이클 생성 방식은 아직 승인되지 않았다. 구현자에게 자유 메시지를 허용하면서 그 메시지는 재작업이 아니라고 취급하면 제한을 우회할 수 있다. 상태 조회는 자식을 깨우지 않는 기록 조회로 분리하고, 작업을 수행시키는 후속 요청은 검증된 사이클 작업으로 접수해야 한다. 접수 횟수와 실제 모델 turn 횟수는 같지 않으므로 진행 중·대기 중 입력까지 확인한다.

### 횟수 예약과 중간 실패

[DomainTable.update](../../packages/storage/storage-domain/src/domain.ts#L82-L89)는 같은 domain write chain에서 원자적인 읽기·수정·쓰기를 제공한다. 사이클 단계·재작업 횟수·중복 요청 식별자·실행 예약을 한 레코드에 두고, 허용된 전이와 2회 상한을 확인한 뒤 예약을 영속화하는 설계가 가능하다. 외부 프로세스까지 분산 잠금이 보장된다는 뜻은 아니다. 단순 메모리 카운터나 비동기 read 후 put은 이 원자적 갱신을 대신하지 못한다.

저장과 subagents의 메시지 접수는 하나의 트랜잭션이 아니다. 접수 여부가 불명확한 실패에서는 예약을 유지하고 후속 실행을 중단하며, 기존 로그·messageId·childId를 대조해 해소해야 한다. 무조건 횟수를 돌려주거나 같은 메시지를 자동 재전송하면 상한·중복 실행 보장이 깨진다. 실행 예약과 실제 접수 확인은 UI에서 구분한다. 첫 구현 검증은 동시 세 번째 재작업 거절, 중복 요청, 저장 실패, 접수 뒤 응답 손실, cold resume, 일반 메시지·workflow 우회를 포함해야 한다.
