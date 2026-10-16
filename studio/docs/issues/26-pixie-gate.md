---
kind: implementation-spec
status: ready
---

# #26 Pixie Gate — 여러 단계로 조립하는 런타임 게이트

## 요약

Pixie Gate는 #25의 Pixie 모델을 DSH 런타임 개입 지점([조사](../research/dsh-runtime-control-points.md))에 연결해, **사용자가 직접 게이트를 조립**할 수 있게 하는 Studio 기능이다. 게이트 하나는 **개입 지점(point)** 하나에 묶인 **여러 단계(stage)의 파이프라인**이다. 단계는 1–N개(이번 범위 상한 5개)이며 명령(command) 단계, Pixie 일반(converse) 단계, Pixie 판정(judge) 단계를 `명령 → 판정 → 일반`처럼 자유롭게 섞어 순서대로 실행한다. 게이트 결과의 `forward` 설정이 무엇을 다음 모델 입력으로 넘길지 정한다. 파이프라인 결과는 개입 지점이 허용하는 동작(통과·교체·거부·교정 지시·주석)으로 바뀐다.

게이트는 **Studio UI로 정의**한다. 사용자는 Studio → Pixie 설정에서 개입 지점을 고르고, 단계를 추가·정렬·편집하고, 샘플 입력으로 시험 실행한 뒤 프리셋에 붙인다. 코드 확장 API는 이번 범위가 아니다.

Studio는 특정 기능(양식 검증, 번역, 검색 요약, 선압축)을 직접 만들어 넣지 않는다. 그런 기능을 **만드는 재료**, 곧 개입 지점 바인딩, 단계 실행기, 결과 매핑, 실패 정책, 실행 기록을 제공한다. 예시 기능은 이 재료로 조립한 **레시피**로 검증한다.

- GitHub 이슈: **아직 만들지 않음**(번호 26은 가정. 만들면 파일명·링크를 맞춘다)
- 선행: [#25 Pixie](25-pixie.md)(마무리, 제한 포함)
- 기준 브랜치·시작 커밋: `studio/feat/workflow` @ `f989f09b61`
- 대상 DSH: Studio peer 범위 `0.2.0-rc.2 || 0.2.1-alpha.2`. 공개 API 존재 여부는 S1에서 확인한다.
- 본체 수정: 없음. 공개 Service·Event·Slot만 쓴다.
- 판정(Judge) 엔진: 단계 계약과 파이프라인은 `judge` 단계를 처음부터 같은 자리에 둘 수 있게 설계한다. **이번 구현은 일반 모델(converse) 단계로 완성**하고, `judge` 단계 실행은 마지막 확장 단계(S8)에서 #25의 `JudgeEngine` 포트로 연결한다.

## 현재 진행 상황

**작업 완료 (2026-10-16).** 재설계 R1–R5와 사용자 피드백 반영을 마쳤다. 최종 커밋 `f1c5186703`(`studio/feat/workflow`), `studio/research/catalog-scope`에 머지(`3935271982`). Studio 테스트 414/414 2회 연속 통과, 실모델 통합 검증은 [R5 기록](../verification/pixie-gate-r5/README.md).

- **최종 범위:** 게이트는 미들웨어 제어 지점(5개)과 출력 계약·지점별 적용을 제공한다. 처리는 Pixie 지시 1회이며, 선택한 훅 스크립트를 먼저 실행하고 그 출력을 지시에 넣는다. 스크립트 안에서 `pixie ask/judge` 헬퍼를 쓸 수 있다. 게이트는 Studio 프리셋의 **게이트 추가**로 걸고 프리셋별로 켜고 끈다.
- **제외(U25–U26, R3 후속 4):** 게이트의 판정 옵션, Pixie 설정의 판정 페이지, 세션 Pixie 탭의 판정 탭, 수동 판정 Remote. 판정(결정) 모델은 별도 기능으로 후속 설계한다.
- **남은 미검증:** 0.2.1-alpha.2, Linux·read-only 세션·Windows, `agent-message`·`tool-before` 실세션, 거부 카드 버튼 클릭, 사용자 desktop 프로필 배포, 일괄 코드 리뷰. 판정 UI 제거 후 실세션 재검증은 하지 않았다(헬퍼 `pixie judge` 경로는 단위 테스트로만 확인).
- **후속 후보:** 별도 판정(결정) 기능, 판정 기반 탐색 도구, 실행 기록 용어 정리(결론/바꿀 내용 키 분리).

이전 진행 기록: 사용자 결정 U1–U8을 [확정된 결정](#확정된-결정)에 기록했다.

- **재설계(U11–U24):** 작업 중심 게이트로 다시 정했다. [재설계 절](#재설계-작업-중심-게이트-u11u22) 참조. R1–R5 구현·로컬 검증과 실모델 통합 검증을 마쳤다([R5 기록](../verification/pixie-gate-r5/README.md)). 남은 것은 미검증 항목과 코드 리뷰다.
- **S7 UI 재설계(U10):** 사용자 피드백(필드 나열형 편집기가 혼란스러움)에 따라 게이트를 Pixie 설정의 별도 메뉴 그룹 `게이트 › 게이트 구성 / 적용 범위`로 분리하고, 편집을 흐름 시각화 모달로 바꿨다. 아래 [S7 UI 재설계](#s7-ui-재설계--게이트-구성과-적용-범위) 참조. 이 변경은 일괄 리뷰 이후라 리뷰를 거치지 않았다.
- **일괄 리뷰 완료·수정 반영:** Host `db8499c716`, Client `dbdd703856`. [리뷰 수정 기록](#일괄-리뷰-수정-기록)을 참조한다. S9는 부분 검증이며 전체 완료가 아니다. 남은 미검증은 모델이 필요한 R2/R3/tool/판정 실제 호출 및 alpha.2의 일부 흐름이다. 아래 단계별 과거 기록과 S1 표는 당시 증거로 보존한다.

- **S1 부분 확인:** rc.2 설치 모듈 + 가짜 모델 수준이며 전체 통과가 아니다. 미확인 목록은 [S1 결과 표](#s1-확인-결과)를 참조한다. 실험 스크립트·로그가 삭제되어 표는 재현 가능한 첨부 증거가 아닌 작업자 기록 수준이다. 표 내용은 그대로 보존한다.
- **S2 구현·로컬 검증 완료:** 게이트 계약·command/converse 실행기·순차 파이프라인, 내부 결과 분리 및 회귀 테스트를 구현했다. `npm --prefix studio run typecheck`, `npm --prefix studio test`(빌드 포함), `git diff --check` 통과. Studio **219개 테스트 통과**(게이트 파이프라인 39개 + Pixie 선택 타임아웃 1개 포함). 이번 보강에서 회귀 8개를 추가했다. Node deprecation 및 기존 React DOM nesting 경고는 있으나 실패는 없다. 설치 앱·실제 모델·GUI 검증을 대신하지 않는다.
- **S3 구현·로컬 검증 완료:** 공유 `GateRun` 계약, `PixieGateStore`와 내부 `PixieGateRecorder`, Remote `gateRuns`·`resolveGateRejection`·`followGates`를 구현했다. 세션별 직렬화·임시 파일 rename, 한 번만 정착·늦은 결과 폐기, 재시작 running→cancelled, 보존·prune, 거부 상태 전이, sync·진행 중 재전송, 독립 사용량을 검증했다. `npm --prefix studio run typecheck`, `npm --prefix studio test`(빌드 포함), `git diff --check` 통과: **234개 테스트 통과**(S3 회귀 15개 추가). 기존 Node deprecation·React DOM nesting 경고는 남아 있다. 생산자·DSH 이벤트·UI·실제 모델·독립 설치 검증은 이번 범위가 아니다.
- **S3 리뷰 보강:** 저장 경로를 요청 sessionId로 고정하고 envelope 객체·runs 배열 및 envelope/각 run의 sessionId를 검증하여 손상 시 fail-closed로 쓰기를 거부한다. live를 저장 전에 예약하고 실패 시 rollback하며, Remote 세션 ID는 정규식 전에 문자열 타입을 검증한다. rename 직후 읽기·저장 실패·save/prune 큐 경합·손상 파일·Remote 입력 회귀를 보강했다.
- **S3 구독 재리뷰 보강:** read/prune용 소유권 예약과 follow용 커밋된 running 집합을 분리했다. 저장 성공 후 재전송 집합 갱신·publish 및 구독 snapshot·등록을 각각 await 없이 처리하여 저장 전 노출·실패 후 유령 running·snapshot/publish 중복을 방지하며, A/B/C 회귀 테스트로 검증한다.
- **수용한 S3 tradeoff:** running/pending 보호 기록이 해소되지 않으면 200건 상한을 넘어 계속 성장할 수 있다. 엄격한 용량 상한보다 진행 중 소유권과 미처리 원문 보존을 우선한다.
- **S3 완료 기준:** 구독 수정 커밋 `3e155af79b`를 포함한다. 사용자 결정에 따라 코드 리뷰는 **S9 이후 일괄 진행**하며 단계별 리뷰를 기다리지 않는다.
- **S4 구현·로컬 검증 완료:** 프리셋 연결 정의 저장소, Remote 조회·저장, input waterfall 바인딩, 명령/모델 어댑터, 실행 기록·관찰 이벤트를 연결했다. 타입 검사·Studio 빌드 포함 전체 테스트 **272개 통과**(이번 S4 20개 추가), `git diff --check` 통과. 실제 모델·실제 훅 브리지 Loader·독립 설치는 미검증이므로 S4 전체 수용 완료와 구별한다.
- **S5 구현·로컬 검증 완료:** turn-stopping 뒤 등록, 마지막 assistant text 수집, 기존 steer 관찰, 게이트·턴별 상한을 연결했다. 타입 검사·Studio 테스트(빌드 포함) **285개 통과**, diff 검사 통과. S6도 아래와 같이 로컬 검증했으며 다음은 S7, S8–S9는 대기한다. S1 미확인 사항은 완료로 간주하지 않는다.

### S5 구현 결과와 남은 검증

- `prepend` 없이 serial 리스너를 등록한다. `nextStep`이 있더라도 검사는 실행하여 note/실패 기록을 남기되 `hooks.decision: steer`, context로 알리고 중복 steer하지 않는다. 뒤 리스너의 미래 steer까지 관측한다는 보장은 없다.
- 마지막 assistant의 text만 합친다. pass/note는 applied none, fail 및 onError block은 교정 메시지(source `studio-pixie-gate`)로 이어간다. 원 답변은 교체/숨김하지 않는다.
- Agent WeakMap에 현재 turn과 gateId별 누적 횟수를 보관하여 같은 턴의 반복 stopping에서도 상한이 유지된다. 다음 턴은 초기화한다. `reason`, `turn`, `steerCount`를 기록하며 기존 steering/상한은 applied none이다.
- 단일 확정점 뒤 finish→emit→steer 순서를 유지한다. finish 중 취소는 확정 결정을 바꾸지 않는다. applied는 게이트가 확정한 동작이지 이후 루프의 실제 소비 보장이 아니다.
- 신규 단위 테스트 11개: pass/note/fail, 반복 상한·다음 턴 초기화, 기존 steer 관찰, 확정 전/finish 중 취소, 프리셋/root/child 필터. 실제 모델, Loader 종단간 continuation, 독립 설치 및 UI 카드는 미검증(S7/S9 인계).

### S6 구현 결과와 S7 인계

- Host Inspect로 pre/post waterfall, PreToolDecision/PostToolDecision/ToolExecution 계약을 확인했다. 두 리스너는 prepend + next 먼저이며 deny/cancel/block은 실행 없이 그대로 반환한다. ask는 hooks.decision으로 전달하고 pass 시 원 결정을 보존한다. 뒤에 prepend되는 바깥 리스너까지 관측하는 보장은 없다.
- fail은 before deny(reason), after block(feedback)이다. after subject는 downstream content가 있으면 그것을, 없으면 결과 content의 text를 합친다. before subject는 인자 JSON이며 tool stdin에 name/call_id/arguments를 전달한다. 인자는 수정하지 않는다.
- content replace는 value 없는 결과에만 적용한다. 성공 결과에 value가 있으면(null 포함) 원 decision + applied none + reason `value-bearing result`로 보존한다. 따라서 일반 구조화 성공 도구의 요약 교체는 지원하지 않으며 append를 사용한다. downstream value 결정도 보존한다. callId/exec는 변경하지 않는다.
- append는 downstream additionalContexts를 유지하고 게이트 source 메시지를 추가한다. 원 결과 additionalContexts는 런타임이 합치므로 반환 결정에 중복 복사하지 않는다. 훅 context에는 양쪽을 관측한다.
- turn은 공개 session.snapshotEvents()의 마지막 turn/start에서 구하며 agent 없는 호출은 건너뛴다. 공통 프리셋/root·child/cwd/policy 어댑터를 재사용한다. 취소 확정은 finish 이전 한 번뿐이다.
- 검증: 타입 검사, Studio 전체 테스트(빌드 포함) **308개 통과**(S6 23개 추가), diff 검사 통과. 기존 deprecation/React nesting 경고는 남아 있다. 실제 모델/API 호출, 실제 Loader·도구 dispatch→모델 기록의 call ID 종단간, 설치 sandbox 강제 실행, GUI 및 독립 설치는 미검증이다. 단위 테스트에서 exec callId 불변과 stdin/기록 연결은 확인했다.
- S7 공통 카드 필드: id/gateId/gateName/point/sessionId, startedAt/endedAt/status, original/finalText, result.verdict/subject/notes/stages/records/hooks/forward/forwardError/appliedPolicy, applied, hooksInput, usage. 판정과 적용은 별도로 표시하며 observed는 완전한 훅 관측 보장이 아니다.
- 지점별 추가 표시: input은 rejection.original/reason/suggestion/status 및 replaced/appended/rejected; turn-end는 turn/steerCount/reason(상한·기존 steer·취소) 및 steered/none; tool-before는 tool.name/callId, turn/reason 및 denied/none; tool-after는 동일 식별 필드와 replaced/appended/blocked/none, 특히 value-bearing result 이유를 표시한다. pass/note 기록만인 S5/S6는 applied none이다.
- 정의 편집 Remote: `studioPixie.gateDefinitions()` → `{ definition: GateDefinition, presetIds: string[] }[]`; `studioPixie.saveGateDefinitions(payload: string)` → 같은 배열의 JSON 문자열로 전체 교체(추가/수정/삭제/정렬 모두 이 메서드). 같은 preset·point 활성 중복 금지, 1–5단계, judge 미지원, turn-end/tool-before는 revise 및 replace/append 금지. 샘플 시험 실행 Remote는 아직 없으며 S7에서 구현해야 한다.
- 카드 Remote: `gateRuns(sessionId: string)`, `followGates(sessionId: string, signal: AbortSignal)` 스트림, `resolveGateRejection(sessionId: string, runId: string, status: 'resent' | 'dismissed')`. 마지막 메서드는 상태만 바꾸며 실제 입력 재전송은 UI가 별도로 수행한다.

### S4 취소 경합 보강 (A)

- 반환 결정과 `applied`를 finish 이전 단일 동기 확정점에서 함께 확정한다. 확정 전 취소는 원 decision + applied none이며, finish 저장 중 취소는 이미 확정한 결정을 그대로 반환한다. `applied`는 게이트가 반환한 결정이며 이후 턴 취소로 DSH 루프가 적용하지 않을 수 있다. terminal 기록을 재작성하지 않아 S3 한 번만 정착 불변을 유지한다.
- 먼저 finish 저장 직후 abort를 발생시키는 revise/fail 회귀 2개를 추가했다. 수정 전 각각 original/new, enter/reject 불일치로 실패(20개 중 2개 실패)를 확인했다. 기존 before/stage/end 취소 회귀는 확정 전 applied none을 검증한다.
- 검증: `npm --prefix studio run typecheck`, `npm --prefix studio test`(빌드 포함, **274개 통과**), `git diff --check` 통과. 실제 모델·GUI·독립 설치는 이 보강 범위에서 미검증이다.

### S4 구현 결과와 남은 검증

- **정의 저장 경로 보강:** 일반 Pixie 세션 prune이 `<pixie root>/gates.json`을 sessionId `gates`로 오인해 삭제하는 경합을 발견했다. 정의는 `<data>/pixie-gate/definitions.json`으로 분리하며 첫 읽기에서 기존 파일을 검증 후 원자적 rename한다(실패 시 원본 유지, 없으면 빈 목록). 일반 prune도 파일명과 일치하는 sessionId·threads 배열을 가진 세션 envelope만 삭제한다. 결정적 이전·실패·prune 보존 테스트를 추가했다.

- 정의는 `<pixie root>/gates.json`의 `{ definition, presetIds }[]`로 저장한다. 전체 목록을 검증·정규화한 뒤 직렬화된 임시 파일 rename으로 교체하며 검증/저장 오류는 Remote에 반환한다. `gateDefinitions()`·`saveGateDefinitions(payload)`는 S7 편집기용이다. 같은 프리셋·지점의 활성 게이트 중복은 거부한다(복수 게이트 실행 순서는 후속). 실행 기록 디렉터리 `gates/`와 충돌하지 않는다.
- 프리셋 판별은 공개 `agentPresets.composedPreset(agent.ctx)`를 매 호출 사용한다. `preset-policy`의 scope ancestry 방식과 달리 연결 id 목록을 직접 대조하므로 재선택/recompose 후 별도 리스너 재설치가 필요 없다. root/child는 공개 `agents.roots()`의 현재 runtime 소유 관계이며 durable parent lineage를 추정하지 않는다.
- 대상 메시지는 각각 실행하여 원래 source 객체(중계 sender/form 포함)와 비텍스트 content를 보존한다. 원문 text 블록은 줄바꿈으로 합쳐 전달하고 교체 시 첫 text 위치에 결과를 넣는다. runtime-context/model-selection/일반 훅/게이트 컨텍스트는 대상에서 제외한다. 여러 메시지 결과는 하나의 enter/reject로 적용하며 뒤의 거부가 앞의 교체를 폐기하면 앞 run은 applied=none이다.
- append는 pipeline forward를 따른다. note만 있어 pipeline verdict가 pass여도 명시적 append가 있으면 원문과 `studio-pixie-gate` 컨텍스트를 보낸다(기준 자막 레시피). 순수 pass/original은 next 결과 객체 그대로다. confirmRevision인 revise는 pending 거부와 제안으로 남긴다.
- Host Inspect에서 `agent/pre-step`, `shell`, `agentPresets`, `agents`, `sandboxPolicy` 계약을 조회했다. 명령은 `agent.session.header.cwd`, `sandboxPolicy.resolve({ session: agent.session })`를 공개 shell resolve→execute→result에 명시 전달한다. 정책이나 cwd/shell이 없으면 명령을 실행하지 않고 error→onError로 처리한다. 모델은 기존 Pixie llm stream 경로와 S2 stageTimeoutMs를 사용한다.
- prepend 등록 후 next 결과를 읽는다. 나중 prepend는 더 바깥이므로 영구 최외곽 보장은 없다. hooks-claude-code/hooks-codex 메시지를 실제 관측한 run은 `hooksInput: observed`, 없으면 `unverified`다. observed도 모든 바깥 리스너 관측을 보장하지 않는다. start/end 관찰 emit의 payload는 GateRun 스냅샷이며 end에 result·applied·usage를 담는다.
- 가짜 agent/session/next와 실제 Cordis plugin composition으로 pass/replace/append/reject/confirm/error pass·block/단계 및 end 훅 취소, 다른 리스너 reject, source 보존, root/child/프리셋 필터, 다중 메시지, usage, 정의 오류, 공개 shell 정책 전달·정책 부재 시 미실행을 검증했다. 기존 Studio 테스트에 실제 Loader 배포 조합 패턴은 없어 **Cordis 조합을 Loader 검증으로 부르지 않는다**.
- 환경의 DEEPSEEK_API_KEY/OPENAI_API_KEY/ANTHROPIC_API_KEY 존재 여부만 검사했고 모두 없었다. 사용자 프로필의 자격 증명은 조회하지 않았다. 실제 모델 호출과 19391 서버 실행은 생략했으며 사용자 GUI 19387·프로필은 변경하지 않았다. 실제 브리지 활성 순서, 모델 선택 생성 시점, 실제 sendMessage relay/화면, enforcing sandbox의 실제 deny/허용, rc.2·alpha.2 독립 설치는 S9까지 확인해야 한다. 기존 Node deprecation·React DOM nesting 경고는 남아 있다.

### S3 설계 확정 및 명세와 달라진 점

- 저장 경로는 `<pixie root>/gates/<sessionId>.json`. 기록은 id·gateId·이름/point 스냅샷·sessionId·시각·원문·최종 텍스트·전체 GateResult·실제 적용 동작·usage·상태를 가진다. 실행 전에는 result·endedAt이 없다. 재시작 중단 기록은 #25처럼 읽을 때 cancelled로 정규화하며 알 수 없는 종료 시각을 만들지 않는다.
- `MAX_GATE_RUNS = 200`: 최근 실행을 기본 보존한다. 오래된 것부터 삭제하되 **running 및 pending 거부는 보호**하여 미처리 원문과 진행 중 소유권을 잃지 않는다. 보호 기록만으로 200건을 넘으면 일시 초과를 허용하고 다음 저장/거부 처리 때 다시 정리한다. 이는 엄격한 상한보다 U3 원문 복구를 우선한 선택이다.
- `applied`: `pass/replaced/appended/rejected/steered/blocked/denied/none`. 판정에서 추론하지 않고 S4–S6 호출자가 채운다. 상태는 `running/done/cancelled/error`. 거부는 원문·이유·선택 제안과 `pending/resent/dismissed`를 보존하며 `pending → resent|dismissed`만 허용한다. `resent` 변경 자체는 입력 전송이 아니다.
- `GateResult.records[].result.usage`가 이미 converse 사용량을 노출하므로 별도 GateResult 집계 필드는 추가하지 않았다. 저장 시 records만 합산해 stages와 중복 계산하지 않는다. runner는 출력 검증 오류에도 이미 받은 usage를 보존하도록 최소 보강했다. 취소/타임아웃 뒤 늦은 결과·usage는 폐기하며 관측하지 못한 사용량은 추정하지 않는다. 기록별 합계이며 보존 한도 밖까지 누적하는 청구 장부는 아니다.
- 삭제 추적은 #25 실제 구현처럼 시작 시·10분마다 `sessionController.list()` 대조를 사용한다. 보관 세션은 유지하고 목록 실패 시 아무것도 지우지 않는다. 진행 중 실행이 있는 삭제 세션은 정착 후 다음 prune에서 제거한다. 삭제 이벤트를 추가하지 않는다.
- 구독은 `sync`(조회 재요청 신호) → 현재 running 실행의 `run` 프레임 → 저장 완료된 변경의 `run` 프레임이다. snapshot/구독 등록 사이 await가 없어 중복 재전송하지 않는다. 재접속 시 완료 기록은 `gateRuns` 조회로 복구한다. Remote 생산자와 화면은 아직 연결하지 않았다.

## 사용자 목표와 레시피

사용자가 든 예시를 개입 지점과 동작으로 옮기면 다음과 같다. 이 표는 이번 이슈가 **직접 만드는 기능 목록이 아니다**. 프레임워크가 표현할 수 있어야 하는 범위다.

| 레시피 | 개입 지점 | 단계 구성 예 | 결과 동작 | 이번 범위 |
|---|---|---|---|---|
| R1 작업 지시 양식 검증 | `input`(`agent/pre-step`, source `user`) | 일반(check): 양식 항목 누락·모호함 판정 → 일반(revise): 양식에 맞게 다시 쓰기 → (확장) 판정: 다시 쓴 결과 승인 | 통과 / 다시 쓴 메시지로 교체 / 거부하고 이유 표시 | 포함(첫 종단간 목표) |
| R2 에이전트 간 대화 중계 검증 | `input`(source `agent-message`) | R1과 같고 대상만 다름 | 통과 / 교체 / 거부 | 포함(R1과 같은 바인딩) |
| R3 최종 출력 번역·교정 | `turn-end`(`agent/turn-stopping`) | 일반(check): 영어 출력인지 → 일반(note): 한국어 번역 / 일반(check): 출력 검증 | 주석(번역을 Pixie 카드로) / 교정 지시(`steer`, 횟수 상한) | 포함 |
| R4 대량 검색 결과 선검수 | `tool-after`(`tools/post-execute`) | 일반(revise): 결과 요약·선별 (인덱스 기준 선별은 후속) | 결과 교체 / 그대로 통과 | 지점 바인딩만. **인덱스 제공자는 후속** |
| R5 선압축 | `compaction`(`llm/stream`, `purpose: 'compaction'`) | 백그라운드에서 미리 요약 → 압축 요청 시 범위가 맞으면 반환 | 미리 만든 요약을 반환 / 기본 요약 | 후속(S1에서 가능성만 확인) |

R1·R2는 같은 지점, R3는 출력 쪽, R4·R5는 데이터 준비(인덱스·사전 요약)가 따로 필요하다. 그래서 이번 범위는 **R1–R3 종단간 + R4 지점 바인딩**으로 잡는다. R4의 인덱스와 R5는 같은 단계 계약 위에 후속 이슈로 올린다.

## 기준 예시: 자막 번역 요청

사용자가 "이 영화 자막을 한국어로 번역해 줘"라고 입력한 경우다. 사용자가 말하는 "첫 번째·두 번째 게이트"는 이 문서에서 한 게이트 안의 **단계 1·2·3**이다.

| 단계 | 종류 | 하는 일 | 결과 |
|---|---|---|---|
| 1 | `command` | bash 명령이 입력에서 자막 파일 경로를 찾아 줄 수·글자 수·인코딩을 잰다 | stdout JSON `{ "data": { "lines": 1820, "chars": 64000 } }` → 단계 1 결과 |
| 2 | `judge` | 판정 모델이 `{{stages.measure.data}}`를 보고 한 번에 번역할 크기인지 판단 | 승인이면 다음 단계, 거부면 게이트 `fail`(입력 거부 + 이유 카드) |
| 3 | `converse`(`note`) | 일반 모델이 번역 방침(구간 분할, 용어, 말투)을 만든다 | 단계 3 텍스트 |
| 출력 | `forward` | `append`: 원문 뒤에 단계 3 텍스트를 컨텍스트로 붙여 메인 모델에 전달 | 메인 모델은 원문 + 번역 방침을 받는다 |

판정 단계는 S8에서 연결하므로, 그 전에는 단계 2를 `converse`(`check`)로 바꿔 같은 흐름을 검증한다.

## 확인한 런타임 사실 (checkout 소스 기준, 설치본은 S1에서 재확인)

| 사실 | 영향 | 근거 |
|---|---|---|
| `pre-step`의 payload는 inbox에서 꺼낸 메시지들이다. `reject`하면 턴이 `blocked`로 끝나고, 꺼낸 메시지는 `user/message`로 **기록되지 않는다**. | 입력 게이트가 거부하면 사용자 원문이 사라진다. 게이트 실행 기록에 원문을 보존하고 다시 보내기를 제공해야 한다(U3). | [preStep·turn](<../../../packages/core/agent-loop/src/agent.ts#L265-L321>), [기록 시점](<../../../packages/core/agent-loop/src/agent.ts#L425-L440>) |
| 메시지 source `kind`로 출처를 구분한다. 사용자 입력은 `user`, 에이전트 간 메시지는 `agent-message`(`form: 'relay'`, `senderSessionId`), 자식 종료 알림은 `subagent-settled`, 런타임 컨텍스트는 `runtime-context`다. | 하나의 `input` 바인딩이 source 필터로 R1·R2를 함께 다룬다. `runtime-context`·`model-selection`처럼 런타임이 붙인 메시지는 기본으로 건드리지 않는다. | [MessageSourceMap](<../../../packages/llm/llm/src/message.ts#L103-L115>), [agent-message](<../../../packages/subagent/subagent/src/continuation-messages.ts#L13-L71>), [관리자 전달](<../../../packages/subagent/subagent/src/manager.ts#L620-L692>) |
| `pre-step` 기본 동작(`next()`)이 런타임 컨텍스트 메시지를 덧붙인다. 다른 리스너(`model-selection`)도 `next()` 결과에 메시지를 더한다. | 게이트는 `next()`를 먼저 부르고 그 결과에서 **대상 메시지만** 바꾼다. 다른 메시지는 그대로 둔다. | [기본 enter](<../../../packages/core/agent-loop/src/agent.ts#L274-L283>), [model-selection](<../../../packages/core/agent/src/model-selection.ts#L113-L126>) |
| `turn-stopping`은 이미 스트리밍된 답변을 숨기거나 바꾸지 못한다. 계속 실행은 `agent.steer()`로만 요청한다. | R3의 번역은 **원문을 대체하지 않고** Pixie 쪽에 덧붙인다. 교정은 steer이며 무한 반복을 막는 상한이 필요하다. | [조사 §3](../research/dsh-runtime-control-points.md#3-완료-검사와-최종-답변-표시의-경계) |
| `tools/post-execute`는 content/value 교체·block·추가 컨텍스트를 받는다. `pre-execute`는 인자 rewrite를 받지 않는다. | R4는 실행 후 결과 교체로만 만든다. 실행 전 검색 범위 축소는 deny + 이유로만 가능하다. | [결정 타입](<../../../packages/core/tools/src/index.ts#L600-L621>) |
| 압축 요약은 `ctx.llm.stream({ purpose: 'compaction', sessionId, … })` 한 번으로 만든다. `llm/stream` waterfall은 자기 청크를 yield해 short-circuit할 수 있다. | R5는 압축 서비스를 교체하지 않고 `llm/stream`에서 미리 만든 요약을 돌려주는 방식이 가능해 보인다. 요청 메시지 범위가 사전 요약 범위와 정확히 같을 때만 쓴다. | [summarizer](<../../../packages/compaction/compaction-basic/src/summarizer.ts#L140-L176>), [llm/stream 계약](<../../../packages/llm/llm/src/index.ts#L62-L75>) |
| 공개 `ctx.shell`(`resolve` → `execute` → `result()`)이 명령·stdin·workdir·timeout·signal·env를 받고 exit code·stdout·stderr·timedOut을 돌려준다. 실패한 종료도 결과로 돌아오며 인프라 오류만 reject한다. Claude Code·Codex 훅 브리지도 같은 서비스로 명령 훅을 실행한다. | 명령 단계는 이 서비스로 만든다. 훅 브리지 패키지(`dsh-hook-protocol`)는 Studio peer가 아니므로 가져오지 않고 같은 규칙을 Studio에서 구현한다. | Host Inspect `shell`, [훅 실행기](<../../../packages/experimental/hook-protocol/src/runner.ts#L75-L110>) |
| 같은 지점의 리스너는 Cordis waterfall 순서(등록 순서, `prepend`는 앞)로 감싼다. Claude Code 브리지의 `pre-step`은 `next()` 결과 뒤에 자기 컨텍스트 메시지(source `hooks-claude-code`)를 붙이고, deny면 `next()` 없이 `reject`한다. `post-execute`는 `additionalContexts`에 붙인다. | 게이트가 바깥쪽에 있으면 `next()` 결과에서 일반 훅의 결정·컨텍스트를 **입력으로 읽을 수 있다**. 순서는 로드 순서에 달려 있어 S1에서 확인한다. | [Claude 브리지 pre-step·tool](<../../../packages/experimental/hooks-claude-code/src/index.ts#L225-L270>), [waterfall](<../../../vendor/cordis/src/events.ts#L225-L260>) |
| waterfall 리스너는 모델 요청을 기다리는 동안 에이전트를 붙잡는다. #25 `/pixie` 요청은 기본 타임아웃 없이 취소 가능하며, 런타임의 선택 `timeoutMs` 포트는 service 생성 경로에 연결하지 않는다. | 게이트 단계의 모델 호출은 필수 `stageTimeoutMs`로 제한한다. `/pixie` 기본 동작은 유지한다. | [#25 남은 제한](25-pixie.md#남은-제한-후속) |

## 용어

- **게이트(gate)**: 개입 지점 하나, 대상 조건(match), 단계 목록, 실패 정책을 가진 정의.
- **개입 지점(point)**: `input`, `tool-before`, `tool-after`, `turn-end`, `compaction`. DSH 이벤트 하나에 대응한다.
- **단계(stage)**: 파이프라인의 한 칸. 종류는 `command`(bash 명령 훅), `converse`(Pixie 일반 모델), `judge`(Pixie 판정 모델). 게이트당 1–5개. `judge` 실행 연결은 S8.
- **일반 훅**: Claude Code·Codex 명령 훅 브리지나 다른 네이티브 플러그인이 같은 개입 지점에 건 리스너.
- **게이트 훅**: 게이트 시작·종료 때 실행하는 명령(`hooks.start`, `hooks.end`)과 다른 플러그인용 Cordis 이벤트(`pixie-gate/start`, `pixie-gate/end`).
- **역할(role)**: converse 단계가 결과를 내는 방식. `check`(통과/실패 판정), `revise`(작업 텍스트 다시 쓰기), `note`(작업 텍스트를 두고 결과만 덧붙이기).
- **작업 텍스트(subject)**: 단계가 검사·변환하는 텍스트. 지점마다 정해진다(입력 메시지 텍스트, 도구 결과 텍스트, 마지막 답변 텍스트).
- **게이트 실행(gate run)**: 게이트 한 번의 실행 기록. 단계별 결과, 최종 판정, 적용된 동작, 원문을 담는다.

## 설계

### 게이트 정의

```ts
type GatePoint = 'input' | 'tool-before' | 'tool-after' | 'turn-end'   // 'compaction'은 후속

interface GateDefinition {
  id: string
  name: string
  enabled: boolean
  point: GatePoint
  match: {
    agents?: 'root' | 'child' | 'any'          // 기본 root
    sources?: string[]                         // input: 기본 ['user'], 'agent-message' 등
    tools?: string[]                           // tool-*: 도구 이름
  }
  stages: StageDefinition[]                    // 1–5개(MAX_GATE_STAGES = 5), 순서대로 실행
  onError: 'pass' | 'block'                    // 기본 'pass'(U4)
  confirmRevision: boolean                     // input 교체 전 사용자 확인, 기본 false(U5)
  forward: ForwardSpec                         // 통과 시 다음 모델 입력으로 무엇을 넘길지
  hooks?: { start?: CommandSpec; end?: CommandSpec }   // 게이트 시작·종료 훅
  limits: { stageTimeoutMs: number; maxSteersPerTurn: number }
}

interface CommandSpec { command: string; timeoutMs?: number }   // 작업 디렉터리 = 에이전트 cwd

type ForwardSpec =
  | { kind: 'original' }                              // 원문 그대로(결과는 기록만)
  | { kind: 'replace'; from: 'subject' | StageId }    // 최종 작업 텍스트 또는 지정 단계 텍스트로 교체
  | { kind: 'append'; from: StageId[] }               // 원문 + 지정 단계 텍스트를 컨텍스트 메시지로 덧붙임

type StageDefinition =
  | { id: string; kind: 'command'; role: 'check' | 'revise' | 'note'; command: CommandSpec }
  | { id: string; kind: 'converse'; role: 'check' | 'revise' | 'note'; model?: PixieModel; system?: string; prompt: string }
  | { id: string; kind: 'judge'; model?: PixieModel; questions: Record<string, JudgeQuestion>; pass: JudgePassRule }

/** 단계 결과는 종류와 상관없이 같은 모양이다. 파이프라인은 이 모양만 본다. */
interface StageResult {
  verdict: 'pass' | 'fail' | 'revise' | 'note' | 'error'
  text?: string          // revise: 새 작업 텍스트, note: 덧붙일 내용, fail: 교정 지시·이유
  reason?: string
  data?: unknown         // check JSON 원본, judge answers
  error?: string         // 오류·타임아웃·잘못된 출력
  usage?: PixieUsage
}
interface StageRecord {
  id: string
  result: StageResult
  appliedPolicy?: 'pass' | 'block'   // error 판정과 실제 적용 정책을 분리
  subjectBytes: number
  textBytes: number
}
type GateForward =
  | { kind: 'none' }
  | { kind: 'original'; text: string }
  | { kind: 'replace'; text: string }
  | { kind: 'append'; text: string; contexts: string[]; source: 'studio-pixie-gate' }
interface GateResult {
  verdict: 'pass' | 'revise' | 'fail' | 'error' | 'skip' | 'cancelled'
  original: string
  subject: string
  notes: string[]
  stages: Record<string, StageResult>   // 실행된 사용자 정의 단계만
  records: StageRecord[]               // 사용자 단계의 크기·적용 정책
  appliedPolicy?: 'pass' | 'block'
  forward: GateForward
  hooks: { start?: StageResult; end?: StageResult }
  forwardError?: StageResult           // forward 계산 오류; 단계 맵과 분리
}
```

- **조립 방식:** 단계 1–5개를 사용자가 정한 순서대로 실행한다. 각 단계는 직전까지의 작업 텍스트를 받는다. `revise`는 작업 텍스트를 바꾸고, `note`는 결과만 쌓고, `fail`은 그 자리에서 파이프라인을 멈춘다. 모든 단계가 끝나면 원문과 최종 텍스트가 다르면 `revise`, 아니면 `pass`로 정리하고 쌓인 `note`를 함께 넘긴다.
- **오류·건너뛰기:** `error`는 즉시 파이프라인을 중단한다. `onError: pass`(fail-open)는 원문만 전달하며 앞 단계의 `revise`·`note`를 적용하지 않는다(중간 subject·notes는 관찰 기록으로 보존). `block` 오류·`fail`·단계 실행 취소는 `forward: none`. 비활성(`enabled: false`) 게이트는 단계와 start/end 훅을 실행하지 않고 `skip` + 원문 전달이다.
- **단계 ID:** 영문자로 시작하는 영문자·숫자·`_`·`-`만 허용하고 중복은 거부한다. 예약 ID는 `start`, `forward`, `subject`, `__proto__`, `constructor`, `prototype`이다. 내부 결과는 `hooks.start/end`·`forwardError`에만 기록한다. `appliedPolicy`는 `StageResult` verdict를 바꾸지 않고 `StageRecord`와 `GateResult`에 둔다.
- **프롬프트 변수:** `{{subject}}`(현재 작업 텍스트), `{{original}}`(원문), `{{stages.<id>.text}}`, `{{stages.<id>.reason}}`, `{{stages.<id>.data}}`(JSON 문자열), `{{hooks.context}}`(일반 훅이 붙인 컨텍스트). 알 수 없는 변수는 저장 시 오류다.
- **게이트 출력(`forward`):** 파이프라인이 `fail`이면 `forward`와 상관없이 지점의 fail 동작을 한다. 통과하면 `forward`가 다음 모델 입력을 정한다. `append`는 원문 메시지를 그대로 두고 단계 텍스트를 별도 컨텍스트 메시지(source `studio-pixie-gate`)로 붙인다. `replace`는 대상 메시지 텍스트만 바꾼다. `turn-end`·`tool-before`의 `forward`는 `original`만 허용하며 `replace`·`append`는 저장 시 거부한다. 지정 단계에 text가 없어 forward 계산이 실패하면 `forwardError`에 기록하고 `onError`를 적용한다.
- **converse `check` 출력:** JSON `{ "pass": boolean, "reason"?: string, "fix"?: string }`을 요구하고 엄격히 검증한다. 잘못된 출력은 `error`이며 통과로 바꾸지 않는다(#25 판정 검증과 같은 원칙). `fix`는 fail일 때 교정 지시·다시 쓰기 제안으로 쓴다.
- **judge 단계(확장):** #25 `JudgeEngine.judge({ state, questions })`를 그대로 쓴다. `state`는 `{ subject, original, stages, hooks }`. `pass` 규칙(예: noul ≥ 0.7, choice ∈ 허용 목록, score ≥ n)이 answers를 `pass`/`fail`로 바꾼다. 파이프라인은 `StageResult`만 보므로 judge 추가가 파이프라인·지점 매핑을 바꾸지 않는다. S8 전까지 정의 검증은 judge 단계를 "아직 지원하지 않음"으로 거부한다.
- 조건부 건너뛰기, 병렬 그룹, 분기 그래프는 후속이다.

### 훅 계약

명령 단계와 게이트 훅은 같은 입출력 계약을 쓴다. Claude Code·Codex 명령 훅과 같은 방식(stdin JSON, exit code, stdout JSON)이라 기존 훅 스크립트를 조금만 고쳐 쓸 수 있다. 다만 **같은 스크립트가 그대로 동작하는 호환은 아니다**(필드 이름이 다르다).

**stdin** (한 줄 JSON):

```json
{
  "pixie_gate": "1",
  "event": "stage",               // "start" | "stage" | "end"
  "gate": { "id": "…", "name": "…", "point": "input" },
  "session_id": "…", "cwd": "/…", "turn": 3,
  "source": "user",              // input: 메시지 source kind
  "tool": { "name": "…", "call_id": "…", "arguments": "…" },  // tool-*에서만
  "original": "원문", "subject": "현재 작업 텍스트",
  "stages": { "measure": { "verdict": "note", "text": "…", "data": { } } },
  "hooks": { "context": ["일반 훅이 붙인 컨텍스트"], "decision": "none" },
  "result": { "verdict": "pass", "forwarded": "append" }      // end에서만
}
```

**결과** (단계·start 훅):

| 종료 | 의미 |
|---|---|
| exit 0, stdout 비었음 | `pass` (`note` 역할이면 텍스트 없음) |
| exit 0, stdout이 일반 텍스트 | `revise`면 새 작업 텍스트, `note`면 덧붙일 텍스트, `check`면 오류(형식 위반). 공백 뒤 `{`·`[`로 시작하는 잘못된 JSON은 **모든 역할에서 오류**이며 텍스트로 우회하지 않는다 |
| exit 0, stdout JSON | `{ "verdict"?: "pass"\|"fail"\|"revise"\|"note", "text"?: string, "reason"?: string, "data"?: unknown }`. 역할이 허용하지 않는 verdict는 오류 |
| exit 2 | `fail`, stderr가 이유 |
| 그 밖의 exit, 타임아웃, 실행 불가 | 오류 → `onError` 정책 |

- **start 훅:** 단계 실행 전에 한 번. `fail`이면 단계를 실행하지 않고 게이트 `fail`. `{"verdict":"pass","data":{"skip":true}}`이면 게이트를 건너뛰고 지점의 `next()` 결과를 그대로 돌려준다. 결과는 `GateResult.hooks.start`에 보존한다. `data`는 기존 `{{stages.start.data}}` 계약을 유지하도록 실행 컨텍스트의 `stages.start` 별칭으로 단계 프롬프트·명령 stdin에만 제공하며, `GateResult.stages`·`records`에는 넣지 않는다.
- **end 훅:** 결과 동작을 적용하기 직전에 한 번. stdin에 최종 `result`가 들어간다. 관찰·알림용이며 결과를 바꾸지 않는다(결과를 바꾸려면 마지막 단계를 명령 단계로 둔다). 실패·end 훅 자체 타임아웃·실행 중 취소는 `GateResult.hooks.end`에 기록만 하고 이미 결정된 verdict·forward·단계 결과를 바꾸지 않는다. end 훅 시작 전에 취소되었다면 훅을 시작하지 않는다.
- **실행 환경:** `ctx.shell`로 에이전트 작업 디렉터리에서 실행한다. 호출자는 세션에서 구한 `sandboxPolicy`(mode·workspaceRoot·sessionId)를 명령 요청에 **명시적으로 전달**해야 한다. 정책 누락, 유효하지 않은 mode·workspaceRoot, sessionId 불일치는 실행 전 오류다. `ctx.shell`의 기본 정책에 기대거나 비샌드박스 실행으로 대체하지 않는다. 기본 타임아웃은 게이트 `stageTimeoutMs`. 환경 변수 `DSH_PIXIE_GATE_ID`, `DSH_SESSION_ID`를 준다. 명령은 사용자가 Studio에서 직접 정의한 신뢰된 설정으로 취급한다(프리셋 공유 시 경고 표시).
- **출력 상한:** stdout은 상한(초안 256KB)을 넘으면 오류다. `subject`·`text`는 다음 단계 프롬프트에 그대로 들어가므로 크기를 기록에 남긴다.

### 일반 훅과의 연결

- **일반 훅 → 게이트 입력:** 게이트 리스너는 같은 지점에서 **바깥쪽**(`prepend`)에 등록하고 먼저 `next()`를 부른다. 그 결과에서 일반 훅이 남긴 것을 읽어 `hooks`로 넘긴다.
  - `input`: 결정이 `reject`이면 게이트는 실행하지 않고 그대로 돌려준다. `enter`이면 대상 외 메시지 중 source가 `hooks-claude-code`·`hooks-codex`인 것을 `hooks.context`로 읽는다.
  - `tool-after`: `block`이면 그대로 돌려준다. `additionalContexts`를 `hooks.context`로 읽는다.
  - `tool-before`: `next()`가 `deny`·`cancel`이면 그대로, `ask`이면 `hooks.decision = "ask"`로 넘긴다.
  - `turn-end`(serial): 다른 리스너가 이미 steer했는지 읽을 공개 방법은 S1에서 확인한다. 없으면 `hooks`는 비어 있다.
  - 다른 플러그인이 더 바깥쪽에 등록되면 게이트가 그 결과를 볼 수 없다. 순서를 보장하지 않는 지점은 UI와 기록에 "일반 훅 입력: 확인 안 됨"으로 표시한다.
- **게이트 → 일반 훅:** 두 가지를 제공한다.
  1. 게이트 정의의 `hooks.start`·`hooks.end` 명령(위 계약).
  2. 다른 네이티브 플러그인이 들을 수 있는 Cordis 이벤트. `pixie-gate/start`(emit: gate, point, sessionId, original), `pixie-gate/end`(emit: 위 + 단계 결과, 최종 verdict, forward). 관찰용이며 게이트 결과를 바꾸지 않는다. 이벤트 계약은 Studio가 선언하고 소유한다.
- **한계:** Claude Code·Codex 훅 브리지의 `hooks.json`에는 Pixie 게이트용 새 이벤트 이름을 추가할 수 없다(브리지가 고정된 지점만 매핑한다). 그 훅들을 게이트 시작·종료에 거는 대신, 같은 스크립트를 게이트의 `hooks.start`·`hooks.end`나 명령 단계에 등록한다.

### 지점별 결과 매핑

| 지점 | pass | revise(최종 텍스트 변경) | fail | note |
|---|---|---|---|---|
| `input` | `next()` 결과 그대로 | 대상 메시지만 같은 source로 텍스트 교체한 `enter` | `reject` + 원문 보존 실행 기록 | 실행 기록에만 |
| `tool-before` | `next()` | 지원 안 함(인자 rewrite 불가) | `deny`(reason) 또는 `ask` | 실행 기록에만 |
| `tool-after` | `next()` | `accept` + content 교체 | `block`(feedback) | `accept` + `additionalContexts`(선택) |
| `turn-end` | 아무것도 안 함 | 지원 안 함(표시된 답변 교체 불가) | `steer`(교정 지시), 턴당 상한 초과 시 기록만 | Pixie 카드로 표시(번역) |

정의 검증은 지점이 지원하지 않는 역할(예: `turn-end`·`tool-before`에 `revise`)과 단계 수 0개·6개 이상을 저장 전에 거부한다. UI는 지점을 고르면 그 지점에서 가능한 역할만 보여 준다.

`input`의 `revise`는 `confirmRevision`이 켜져 있으면 바로 교체하지 않고 거부한 뒤 Pixie 카드에 다시 쓴 제안을 "이대로 보내기 / 수정해서 보내기"로 보여 준다.

### 불변 조건

- 게이트는 다른 리스너의 결정을 지우지 않는다. 항상 `next()`를 먼저 부르고, `next()`가 이미 `reject`/`block`/`deny`이면 그대로 돌려준다. 일반 훅이 붙인 컨텍스트 메시지는 `forward`와 상관없이 보존한다.
- 명령 단계·게이트 훅은 세션 로그에 `hook/*` 이벤트를 쓰지 않는다(그 이벤트는 브리지 전용 형식이다). 기록은 게이트 실행 기록에만 남긴다.
- 거부·교체는 **반드시** 원문과 함께 게이트 실행 기록에 남는다. 사용자 입력이 아무 흔적 없이 사라지지 않는다.
- 게이트 단계의 Pixie 호출도 세션 로그에 메시지를 쓰지 않는다. 모델에 보이는 변화는 지점의 공식 결정(교체된 메시지, steer, 도구 결과)뿐이다.
- 모든 단계에 타임아웃이 있다. 타임아웃·오류는 `onError` 정책대로 처리하고, 정책 결과를 실행 기록에 표시한다. 오류를 `pass` 판정으로 기록하지 않는다(`error → pass 적용`처럼 구분).
- `turn-end`의 steer는 게이트·턴별 횟수 상한을 넘지 않는다.
- 취소된 턴(`signal.aborted`)에서는 단계를 시작하지 않고, 진행 중 호출은 취소한다.
- 게이트 Pixie 사용량은 세션 사용량, #25 따로 묻기 사용량과 분리해 집계한다.

### 실행 기록과 화면

- 실행 기록은 #25 Pixie 저장소 옆에 sessionId별로 둔다(`<studio-data>/pixie/gates/<sessionId>.json`). 세션 수명 규칙(G2)을 따른다.
- Pixie 탭의 카드 목록에 게이트 실행을 `Badge`(통과·교체·거부·교정·오류)로 붙인다([#25 UI 통일 후속](25-pixie.md#ui-통일-후속)에서 전제한 방식).
- 거부된 입력 카드에는 원문, 실패 이유, 다시 쓴 제안(있으면)과 "수정해서 보내기"를 둔다(U3 결과에 따름).
- 게이트 정의는 Studio → Pixie 설정에 `게이트` 페이지로 둔다. 단계 목록 편집, 지점별로 허용되는 결과 표시, 샘플 텍스트로 **시험 실행**(에이전트에 연결하지 않고 파이프라인만 실행)을 제공한다.

## 재설계: 작업 중심 게이트 (U11–U22)

사용자 피드백("단계를 세분화한 구조가 오히려 복잡하다", "UI/UX는 단순하게")에 따라 grilling으로 다시 정했다. 이 절의 결정이 아래 [확정된 결정](#확정된-결정)의 U6–U8·U10과 충돌하면 이 절이 우선한다. **현재 상태: R1–R5 구현·검증 완료(미검증 항목은 R5 기록 참조).**

### 핵심 개념

- Pixie Gate는 **에이전트 런타임 미들웨어**다. 명령 훅(DSH `hooks-claude-code`·`hooks-codex`)이 "규칙으로 막거나 외부 작업"을 한다면, Pixie Gate는 "정해진 순간에 **모델이 읽고 판단·가공**한 결과를 보낸다".
- 화면의 한 문장: **언제 → Pixie가 할 일 → 결과**. 사용자는 앞의 두 칸만 고른다. 결과는 고정 계약에 따라 Pixie가 지점별로 적용한다.

### 결정

| ID | 결정 |
|---|---|
| U11 | 게이트는 "명령 훅의 대체"가 아니라 "명령 훅 위에서 모델로 판단·가공하는 층"으로 설명한다. 훅이 없어도 원문만으로 동작하는 것이 기본이다. |
| U12 | 사용자 입장의 구성은 **언제 + Pixie가 할 일(자연어 지시)** 두 칸이다. 개입 지점·단계·역할·forward 같은 내부 용어는 화면에 노출하지 않는다. |
| U13 | **출력 고정 계약**(모든 지점 공통, 모두 선택): 결론(통과/막음, 기본 통과) · 이유 · 바꿀 내용 · 덧붙일 내용 · 메모. 지점별 적용은 Pixie가 정하고, 지점에서 불가능한 출력은 오류가 아니라 메모로 대체한다. |
| U14 | 결론이 막음이면 바꿀 내용·덧붙일 내용은 메인 모델로 보내지 않는다(입력 지점에서는 바꿀 내용을 거부 카드의 제안으로, 덧붙일 내용은 메모로). |
| U15 | 판정 모델(질문·통과 기준)은 결론을 엄밀하게 정하고 싶을 때 고르는 **고급 옵션**이다. 판정은 원문을 평가하고 최종 결론을 정한다. stop이면 일반 모델 reason 우선, 없으면 기준 미달 질문·판정 실패 사유를 이유로 쓰고 replace/append는 전달하지 않는다(U14). pass이면 일반 모델의 stop도 덮어쓰며 일반 reason은 결론 이유에서 제거하고 사용자 전용 note에 `Pixie 지시 판단: <reason>`으로 보존한다(replace/append/기존 note 유지). |
| U16 | 다단계 파이프라인(단계 1–5), 단계 종류·역할, 명령 단계, 시작·종료 훅은 **삭제**한다. 배포 전이라 마이그레이션은 없다(격리 데이터만). 판정 엔진·실행 기록·지점별 적용·거부 카드는 재사용한다. |
| U17 | 외부 DSH 훅은 그대로 두며 Pixie는 그 출력을 읽지 않는다(Q14·Q19의 봉투/`next()` 읽기 방식은 폐기). |
| U18 | Pixie에 연결하는 훅은 게이트 안의 **진입 지점 하나**: 고급 옵션 "준비 스크립트". 사용자는 명령을 입력하지 않고 **전용 경로의 스크립트를 고른다**. Pixie가 할 일 전에 실행하며 출력은 `{{hooks.<스크립트 이름>.text/data}}`로 쓴다. 실행 위치는 세션 작업 디렉터리, 세션 샌드박스 정책을 명시 전달한다. |
| U19 | 스크립트 경로는 `<프로필>/studio-data/pixie-gate/commands/` 하나. 화면에는 경로 표시·복사와 목록 새로고침을 둔다(공개 API에 폴더 열기 기능이 없음). 작업 공간별 경로는 후속. |
| U20 | 스크립트는 macOS·Linux의 bash 실행기 환경만 지원한다(Windows는 U24에 따라 후속). 설정 화면의 시험 실행에서는 세션 정책을 알 수 없어 스크립트를 실행하지 않는다. |
| U21 | 새 게이트는 **템플릿 우선**으로 시작한다(빈 게이트는 마지막 선택지). 백그라운드형 작업(미리 압축, 파일 인덱싱)은 구현 전까지 "곧 지원" 템플릿으로만 보인다. |
| U22 | 에이전트가 읽고 게이트·스크립트를 조립할 수 있는 `pixie-gate` 스킬 문서를 Studio에 포함한다. 결과 적용 규칙(U13·U14의 지점별 표)은 사용자 가이드 문서의 Pixie Gate 항목 설명에 넣는다. |
| U23 | **Pixie 훅 스크립트 계약 확장.** Studio는 기능을 하나씩 만들지 않고, 스크립트가 쓸 수 있는 수단(입출력·환경 변수·헬퍼)만 제공한다. 실행 조건(예: 특정 도구만)·반복(번역→판정→재번역)·외부 작업은 스크립트가 구현한다. 화면의 도구 지정 칸은 두지 않는다. **입력** stdin = 대상 텍스트. **출력** stdout → `{{hooks.<이름>.text}}`, JSON 객체면 `{{hooks.<이름>.data}}`. **종료 코드** 0 계속 · 10 이 게이트 건너뜀(원래 흐름) · 그 밖·시간 초과 = 오류(오류 정책). **환경 변수** `PIXIE_POINT`(user-message·agent-message·tool-before·tool-after·turn-end), `PIXIE_TOOL_NAME`·`PIXIE_TOOL_ARGS`(도구 지점), `PIXIE_AGENT`(root·child), `PIXIE_SESSION_ID`, `PIXIE_TURN`, `PIXIE_GATE_NAME`, 헬퍼용 `PIXIE_URL`·`PIXIE_TOKEN`(실행별 발급·종료 시 폐기). **헬퍼** `pixie ask "<지시>" [--input]` → stdout 답, `pixie judge --question … [--threshold] [--input]` → 통과 exit 0 / 미달 exit 1, 확률 stdout. 통로는 Studio `webServer.register` 전용 경로 + 실행별 토큰(조사 결과 Q11), 권한은 그 실행의 ask·judge만, 요청 크기·호출 횟수 상한, 호출은 게이트 사용량·실행 기록에 포함. 스크립트와 헬퍼 모두 macOS·Linux의 bash 실행기 환경만 지원하며 Windows는 U24에 따라 후속 구현한다. 이 계약과 예시 스크립트(도구 필터, 번역 반복, 자막 측정, 변경 파일)는 가이드 문서에 상세히 쓴다. |
| U24 | **훅 스크립트·`pixie` 헬퍼 지원 환경:** macOS·Linux(bash 실행기 환경)만 지원하며 Windows는 후속 구현으로 미룬다. 실행 시점에 `ctx.shell`이 bash 실행기가 아니면 스크립트를 실행하지 않고 `이 환경에서는 훅 스크립트를 지원하지 않음` 오류를 기록하고 오류 정책을 적용한다. 샌드박스를 우회하는 경로는 만들지 않는다. 실행기 판별 방법은 R2-b에서 확인한다. 사용자 안내 문구는 "DSH에서 bash 프로필을 지원하는 경우에만 사용 가능합니다."다. |

### 지점별 이름과 결과 적용 (내부 규칙, 가이드 문서용)

| 화면의 "언제" | 내부 지점 | 막음 + 이유 | 바꿀 내용 | 덧붙일 내용 | 메모 |
|---|---|---|---|---|---|
| 사용자가 지시를 보낼 때 | input(source user) | 거부 + 원문 복구 카드 | 메시지 교체(확인 옵션) | 함께 전달 | 카드 |
| 에이전트끼리 메시지를 주고받을 때 | input(source agent-message) | 거부(보낸 쪽 피드백 경로는 구현 단계에서 확인) | 메시지 교체 | 함께 전달 | 카드 |
| 도구를 실행하기 전 | tool-before | 실행 거부 | → 메모 | → 메모 | 카드 |
| 도구 결과가 나왔을 때 | tool-after | 결과 차단 | 결과 교체 | 함께 전달 | 카드 |
| 에이전트 답변이 끝났을 때 | turn-end | 다시 하라고 지시(턴당 상한) | → 메모 | → 메모 | 카드 |

### 구현 단계 (재설계)

- **R1 — UI 시안 (R3에서 Host 연결):** [pixie-gate-task-pages.tsx](../../src/pixie-gate-task-pages.tsx), [pixie-gate-task.ts](../../src/pixie-gate-task.ts). 게이트 구성 카드("언제 → 할 일" 한 줄)·템플릿 선택(백그라운드형 2개는 "곧 지원")·두 칸 편집 모달(언제·Pixie가 할 일, 나머지는 고급)·결과 다섯 칸 모양만 보이는 시험 실행·적용 범위(켜짐·프리셋). 상태는 화면 안에만 있고 저장·실행에 쓰이지 않는다는 안내를 두 페이지에 표시한다. 결과 적용 규칙은 화면에 쓰지 않는다(U22, 가이드 문서로). 후속 반영: 적용 범위의 프리셋 선택을 작은 창으로 옮겨 카드 높이를 고정했고, 도구 지정 칸을 없애고(U23) 고급의 Pixie 훅 스크립트 아래에 스크립트 규칙(입력·출력·종료 코드·환경 변수·헬퍼)을 요약해 보여 준다. 이전 흐름 편집기 모듈은 R3에서 지운다. 검증: Studio 테스트 428개 통과, 격리 프로필 라이트·다크 × 1440·520 화면 확인(콘솔 오류 없음).
- **R2 — Host:** 새 저장 형식(GateTask), 출력 계약 실행기(일반 모델 JSON 출력 / 판정 옵션), 지점별 적용 규칙, Pixie 훅 스크립트 실행(U23 계약, 스크립트 목록 Remote), `pixie` 헬퍼와 로컬 HTTP·토큰 경로. 기능 단위로 나눠 각각 리뷰한다.
#### R2-a / a1 기반 구현 (2026-07-14)

- 범위: `pixie-gate-task-contracts.ts`에 런타임 의존 없는 GateTask 검증·엄격 JSON 출력 파서·지점별 적용 계획, Host `GateTaskRunner`에 일반 모델 1회 + 선택 판정 모델 1회 실행을 추가했다. **아직 저장소·Remote·미들웨어에 연결하지 않았다. 기존 실행 경로는 그대로다.**
- 저장 계약 선택: UI `GateTask`를 기준으로 검증하며 같은 프리셋의 켜진 게이트 중복은 `when` 기준이다. user-message와 agent-message는 같은 input 내부 지점이어도 서로 다른 작업이므로 공존한다. 기존 GateDefinition 래퍼는 이 검증에서 invalid다. U16에 따라 배포 전 형식을 변환하지 않으며, a2에서 항목별 invalid 표시·원본 보존 읽기에 연결한다.
- 출력 계약 선택: U13에 따라 verdict는 선택이며 키가 없으면 pass다. 키가 있으면 pass/stop 문자열만 허용하며 null·비문자열·알 수 없는 값/필드·마크다운은 오류다. 모델 출력 안내도 생략 가능·기본 통과로 맞췄다. 판정 옵션은 기존 LlmJudgeEngine/noul을 사용하고 판정 모델 → 일반 모델 순으로 선택한다. 판정 실패는 stop과 기존 모델 reason 또는 판정 실패 사유를 남긴다. usage는 두 호출을 합산한다.
- 적용 계획은 원문을 받아 실제로 다른 메시지 교체에만 확인 요청을 한다. 동일 교체는 교체 없음(pass)이며 append는 유지한다. reason을 계획에 전달한다. stop/확인 요청 시 replace·append를 전달 계획에서 제외한다. 불가 지점의 replace·append는 notes에 보존한다. 메시지 지점의 replace는 거부 제안으로 보존한다. 이 계획의 5 when × 4 출력 매트릭스는 단위 테스트이며 실제 미들웨어 적용 증거는 아니다.
- 스크립트는 파일명 검증만 하고 실행하지 않는다. 실행기에 지정하면 `스크립트 미지원` error다. 오류 정책 적용은 a2 미들웨어 책임이며 trial의 `skipped: script` 처리도 a2에 남았다.
- 삭제/유지: 이번 a1에서 삭제 없음. 기존 단계 실행기·pipeline·저장·기록·UI 모두 유지. a2에서 저장·3 미들웨어·trial·service를 동시에 전환하고 기존 기록 필드의 호환 전략을 확정한 뒤 b에서 구형 Host 및 테스트를 제거한다.
- 검증: 신규 결정론적 단위 테스트 31개(검증·출력·판정·usage·취소·타임아웃·적용 계획). Studio typecheck 통과. `npm --prefix studio test` 2회 연속 각각 460/460 통과(실패 0), `git diff --check` 통과. 저장 invalid 격리·실제 middleware onError/agents/maxSteers·trial·독립 설치·실모델은 a1에서 미검증. 사용자 GUI/프로필·Client Inspect 접근·배포 없음. S1 표는 변경하지 않았다.

- **a1 리뷰 수정:** U13 선택 verdict, 실제 변경만 확인, U15 판정 결론·이유 귀속을 수정했다. stop의 suggestion/notes 내용·reason, 동일/상이 교체, pass+replace+append, 판정 후 적용 계획 회귀를 보강했다. red 증거: `/tmp/pixie-r2a1-fix/red.txt`(verdict·출력 안내·confirm·판정 이유). 검증: 집중 테스트 36/36, Studio typecheck, 전체 테스트 2회 연속 각각 465/465(실패 0), `git diff --check` 통과. 런타임 연결·화면 마크업/문구 변경 없음. S1 표 불변.
- **a2 인수조건:** when→runtime 지점·source 매핑(user-message→input/source user, agent-message→input/source agent-message, 나머지 tool-before/tool-after/turn-end 동명 지점)을 검증한다. 저장 항목별 invalid 격리와 원본 보존, 실제 middleware의 onError/agents/maxSteers 적용, trial의 새 출력 계약·스크립트 건너뜀을 연결·검증한다. 이 항목들은 a1에서 구현하지 않는다.

#### R2-a / a2 런타임 전환

- 정의 저장·fail-open reader·input/tools/turn·trial·service를 GateTask와 단일 GateTaskRunner 실행으로 전환했다. input은 메시지마다 user/agent-message source에 대응하는 when을 선택하며, enabled·composedPreset·advanced.agents를 필터링한다. 결과 적용은 gateOutputPlan을 사용한다. next 결정 우선, 입력 트랜잭션, signal 확인 후 단일 확정, pending 거부 제안, 턴별 누적 steering 상한을 유지한다.
- 저장은 validateGateTasks를 사용한다. 항목별 index/raw/error를 격리하고 GateEntry 래퍼는 `legacy-gate-definition`으로 표시한다. 읽기는 원본 파일을 변경하지 않는다. `<data>/pixie/gates.json` fallback 이전은 구 GateEntry 전용이므로 제거했다. 자동 변환·이전 없이 기존 파일을 보존한다.
- 실행 기록에 when/output/usage를 저장한다. R3 전까지 카드 호환을 위해 point와 result.verdict/subject/notes/빈 stages·records·hooks/forward를 최소 투영한다. 런타임은 이 투영의 stages를 실행하지 않는다. 구 GateDefinitionsRead/GateEntry 타입은 미사용 구 편집기 컴파일용으로 유지하고 실제 Remote는 GateTasksRead를 사용한다. 카드가 gateDefinitions를 호출하지 않음을 grep으로 확인하여 소비 필드를 제거했다.
- trial 입력은 `{ task, text, toolName? }`, 응답은 `{ output, plan, usage }`다. script 지정은 실행기·모델 호출 없이 `skipped: script` 메모와 skipped 필드를 반환한다. 일반 런타임의 script는 `스크립트 미지원` 오류와 onError 정책을 따른다. service의 DefaultStageRunner·shell·sandboxPolicy 의존을 제거했다. 설정 시안의 로컬 상태·presets 호출과 화면 JSX·문구는 유지했다.
- 삭제: 구 런타임 계약에 종속된 input-service/judge-service/tools/turn 테스트 파일과 review-host의 구 입력 confirmation 사례. 대체 실제 미들웨어 테스트는 input 테스트에 모았다. 유지: 구 파이프라인/runner/command/hook 모듈, 구 UI 및 그 테스트, 카드/결과 표시. 참조 확인 후 삭제하는 b는 후속이다.
- 검증: 실제 미들웨어 when 5종/source 공존/agents/enabled/preset/onError/confirmReplace/maxSteers/취소/확정 경계/기록, 저장 invalid·legacy·원본 보존, trial, 판정 설정 중 일반 출력 오류·판정 API 오류 reason 우선순위·판정 중 timeout/cancel 회귀를 포함한다. 최종 검증: `npm --prefix studio run typecheck` 통과, `npm --prefix studio test` 2회 연속 각각 420/420 통과(실패 0), `git diff --check` 통과.
- 미검증: 사용자 GUI·프로필·실모델·독립 설치·배포·에이전트 송신 측 피드백 경로. Client Inspect 접근 없음. R2-b 스크립트/헬퍼 및 R3 화면 연결은 구현하지 않았다.
- **a2 리뷰 보완 — 기록은 실제 적용 결과 기준:** middleware의 단일 commit 결정 이후 result.subject/forward와 end.finalText를 확정한다. 적용하지 못한 replace/append는 notes에 보존한다. value-bearing 도구 결과의 교체 금지, tool-before/turn-end의 불가 출력, stop·confirmReplace 거부·취소·입력 트랜잭션 rollback을 같은 원칙으로 처리한다. turn-end는 원래 답변을 유지하며 steer 여부와 억제 이유(existing steering/maxSteers)는 applied/reason/steerCount로 구분한다. finish 중 뒤늦은 취소는 이미 확정한 기록·동작을 바꾸지 않는다.
- **커버리지 복원:** tools/turn 실제 리스너 경계의 stop/교체/덧붙임/value-bearing 3종, downstream deny/cancel/block/ask, 기존 context, agents·preset·enabled 필터와 child 성공, 취소 6종, 누적 턴 예산·기존 steer, 기록 metadata 및 input 확인·취소를 포함한 47개 테스트를 추가했다. 실제 Cordis PixieService.trialGate 경로에서 전용 판정 모델·프롬프트·원문·usage와 pass/stop 2개를 복원했다. 구 sandwich/subtitle 단계 조합 자체는 새 단일 작업 계약에 없으므로 재현하지 않는다. shell/session 정책 서비스 조합 2개는 shell을 다시 연결하는 **R2-b에서 복원**한다.
- **수치·증거:** 465→420은 skip이 아니라 구 tools 23·turn 11·judge-service 3·input-service 2·review-host 5 삭제, input +3·invalid-definitions -4·trial -5·task-contracts +5로 순감소 45였다. 이번에는 +49로 469개다. [red 기록](</tmp/pixie-a2-fix/red.txt>)에 value-bearing 3건과 추가 기록 정합 회귀 7건의 실패를 보존했다. 복원 시 이미 통과한 사례는 '기존 동작 확인'으로 구분했다(서비스 fixture의 stream model/system assertion 수정은 제품 결함 red가 아님). Studio typecheck, 전체 테스트 2회 연속 각각 **469/469 통과**, `git diff --check` 통과. 화면 JSX·문구 및 S1 표 불변; 본체·사용자 GUI·프로필·배포·Client query·하위 위임 없음.

#### R2-a / b 구 다단계 파이프라인 삭제

- **완료:** a2 재리뷰 잔여로 downstream ask 보존 시 실행 기록의 `hooksInput === 'observed'`를 직접 검증했다. 테스트 수는 469개로 동일하며 typecheck·전체 테스트 2회 연속 469/469·diff 검사 통과 후 별도 커밋했다.
- **삭제:** Host `pixie-gate-pipeline.ts`·`pixie-gate-runner.ts`(StageRunner·command·시작/종료 hook), 구 UI `pixie-gate-pages.tsx`·`pixie-gate-composer.tsx`·`pixie-gate-editor.tsx`·`pixie-gate-judge-editor.tsx`·`pixie-gate-trial-panel.tsx`. 미사용 GateDefinition·StageDefinition·CommandSpec·GateInput·ForwardSpec·검증기와 GateEntry/GateDefinitionsRead도 제거했다. 삭제 직전에 각 모듈의 src/test 참조가 0건인지 전용 grep 도구로 확인하고 소비자부터 순서대로 삭제했다.
- **유지:** GateRun/GateResult/StageResult/기록 호환 타입과 판정 규칙, 실행 카드·결과 표시·Pixie 탭·수동 판정 Remote·JudgeEngine/LlmJudgeEngine·새 작업 런타임. 판정 설정에서 쓰는 editor/compose locale은 문구 변경 없이 유지했다. presets 최소 구조 타입은 PixieSettingsPage의 props에 두어 구 편집기 의존만 없앴다. 결과 표시의 사용하지 않는 definition 타입 prop을 제거했으며 JSX·화면 문구는 변경하지 않았다.
- **테스트 정리:** editor/trial-panel/review-host/구 gate 테스트 파일은 구 경로 전용이라 삭제했다. judge 테스트의 all/any 판정 규칙, judge-ui의 결과 표시·판정 설정 3건, store의 저장·수명·usage 합산은 유지했다(usage fixture만 파이프라인 실행에서 기록 데이터로 분리). timeout 테스트는 일반 PixieRuntime의 timeout을 검사하므로 유지했다. 새 task 실행기·middleware·trial·서비스 테스트는 유지했다.
- **검증:** 469→370(구 파이프라인·명령·hook·단계 편집/시험 사례 99개 제거, skip 전환 없음). `npm --prefix studio run typecheck` 및 `npm --prefix studio test` 2회 연속 각각 **370/370 통과**, 실패·skip 0. diff 검사에서 테스트 EOF 공백 1건을 발견해 정리한 뒤 최종 재검증했다. S1 표·과거 S2–S9 본문은 보존하고 삭제된 파일 링크만 삭제됨으로 표시했다. 디자인 시스템 부품 표에는 삭제 대상 링크가 없었다.
- **범위 밖/미검증:** R2-b 스크립트·헬퍼, R3 UI 연결, 실모델·독립 설치·시각 확인은 후속이다. 본체 변경·사용자 GUI/프로필·배포·Client query·하위 위임·푸시는 하지 않았다.

#### R2-b1 — Pixie 훅 스크립트 실행

- **범위:** 전용 `<data>/pixie-gate/commands/`의 실행 가능 파일만 선택한다. 이름의 구분자·절대 경로·`..`를 거부하고 파일 realpath의 부모와 commands realpath를 비교한다. 외부 심볼릭 링크·디렉터리·비실행 파일은 실행/목록에서 제외한다. 디렉터리가 없으면 생성하지 않고 빈 목록을 반환한다. realpath 확인과 프로세스 실행 사이의 파일 교체 경쟁까지 원자적으로 막는 API는 없으므로, 프로필 commands 디렉터리는 신뢰하는 사용자가 관리해야 한다.
- **U24 판별 근거/한계:** Host Inspect `Service.listService(shell)`은 shell을 **Abstract bash execution service**로 정의하고 `resolve`/`execute`만 제공한다. `sandboxPolicy.resolve({session})` 계약도 확인했다. 서비스 카탈로그와 `configEditor`의 `entries`/`configuration`은 설정 행만 제공하고 해당 행이 현재 `ctx.shell` 인스턴스를 소유하는지 또는 bash 실행기인지 보장하는 공개 판별 계약은 없다(`loader`는 catalogued service가 아님). 따라서 요청에서 허용한 `process.platform !== 'win32'`를 1차 기준으로 하고 shell 서비스 존재를 추가 확인한다. 이는 비-Windows 사용자 정의 shell 구현이 공개 bash 계약을 지키는지까지 검증하지 못한다. 비지원이면 `hook-script-unsupported: 이 환경에서는 훅 스크립트를 지원하지 않음` 오류 후 onError를 적용한다. 사용자 프로필 설정 값은 조회하지 않았다.
- **실행:** 공개 shell.resolve/execute/result만 사용한다. session.header.cwd와 sandboxPolicy.resolve({session}) 결과를 명시 전달하며 누락/세션 불일치는 실행하지 않는다. stdin은 대상 텍스트, 환경은 PIXIE_POINT/TOOL_NAME/TOOL_ARGS/AGENT/SESSION_ID/TURN/GATE_NAME이다. PIXIE_URL/PIXIE_TOKEN은 전달하지 않는다. advanced.timeoutMs·kill·256KB stdout 상한과 취소 signal을 전달하고 결과의 timeout/abort/truncation/실제 바이트 길이를 확인한다. 별도 spawn 또는 샌드박스 우회는 없다.
- **출력:** exit 0은 앞뒤 개행만 정리한 text 및 JSON 객체 data를 instruction에 치환한다(이름은 기존 taskVariables처럼 마지막 확장자를 제거). 저장 시 미정의 변수를 거부한다. exit 10은 모델/판정을 호출하지 않고 원래 흐름과 applied none을 유지하며 note에 `skipped by hook`을 남긴다. 다른 exit/실행 실패는 onError로 간다. trial의 `skipped: script`는 유지한다. gateScripts Remote는 directory 절대 경로·scripts 이름 목록·supported를 반환하며 Client는 타입만 추가했다.
- **검증:** 실행기/저장 검증 및 실제 PixieService/Cordis 세션 정책 조합 2건에서 red를 먼저 확인했다. [red 요약](</tmp/pixie-r2b1/red.txt>)에 실패 원인과 후속 경계 테스트(추가 시 이미 green)를 구분했다. 다섯 지점의 skip/원문/도구 환경·applied none, 경로 탈출, 비지원·정책 누락 onError, text/JSON, exit/timeout/출력 초과, 취소, 목록을 검증한다. 최종 `npm --prefix studio run typecheck`, `npm --prefix studio test` **404/404 두 회 연속 통과**(fail/cancelled/skipped 모두 0), `git diff --check` 통과. R2-a/b 기준 370개에서 스크립트 경계 32개와 서비스 조합 복원 2개를 추가했다. 로그는 `/tmp/pixie-r2b1/test-1.txt`, `/tmp/pixie-r2b1/test-2.txt`에 남겼다.
- **미검증/후속:** 실제 bash 샌드박스 실행·macOS seatbelt·Linux bwrap·사용자 정의 비bash shell 식별·독립 설치/배포·실모델·GUI는 미검증이다. 사용자 GUI/프로필 접근·Client Inspect·본체 수정·하위 위임은 하지 않았다. R2-b2는 pixie ask/judge 헬퍼, 로컬 HTTP, 실행별 토큰·상한·사용량 통합을 맡는다. R3 화면 JSX·문구는 변경하지 않았다.

#### R2-b2 — `pixie ask/judge` 헬퍼·로컬 HTTP·실행별 토큰

- **통로:** 공개 `webServer.register({ kind: 'prefix', path: '/studio/pixie-gate/helper' })`. `ctx.inject(['webServer'])` 범위의 effect로 등록·해제하며, `PIXIE_URL`은 서버의 `protocol`/`host`/`port` 공개 getter로 만든다. webServer가 없는 구성에서는 스크립트에 `PIXIE_URL`/`PIXIE_TOKEN`을 주지 않고 `pixie`가 "helper is not available" 오류(exit 2)를 낸다. 별도 서버 listen·spawn·샌드박스 우회는 없다.
- **토큰:** 스크립트 실행마다 32바이트 난수 토큰을 발급하고 Host는 SHA-256 해시만 보관한다. 스크립트 종료(성공·오류·취소·timeout) 즉시 `finally`에서 폐기하며, 폐기는 진행 중 헬퍼 호출도 abort한다. 토큰 권한은 그 실행의 `POST /ask`·`POST /judge`뿐이다. 다른 경로 404, 다른 메서드 405, 무효·폐기 토큰 401.
- **상한:** 실행당 호출 20회(429), 요청 본문 256KB(413, 4배 초과 시 연결 종료). 헬퍼 호출 signal은 게이트 실행 signal(취소·`advanced.timeoutMs`)·토큰 폐기·클라이언트 연결 종료를 합친다.
- **헬퍼 명령:** `<data>/pixie-gate/bin/pixie` bash 스크립트를 첫 실행 때 원자적으로 설치하고 스크립트 `PATH` 앞에 둔다. curl을 사용하며 토큰은 명령행이 아닌 `-K <(...)` 설정으로 전달하고 파일을 쓰지 않는다(read-only 샌드박스 대응). `pixie ask "<지시>" [--input]` → 답 stdout, exit 0. `pixie judge --question … [--threshold 0.5] [--input]` → noul 확률 stdout, 통과 exit 0 / 미달 exit 1. 사용법·HTTP 오류는 exit 2. `--input`이 없으면 입력은 게이트 대상 텍스트다.
- **모델·기록:** ask는 Pixie 일반 모델, judge는 판정 모델 → 일반 모델 순(기존 판정 시스템 프롬프트·LlmJudgeEngine). 두 호출의 usage는 게이트 usage에 합산되고, 호출마다 `result.records`에 `pixie-ask-N`(note/error)·`pixie-judge-N`(pass/fail/error, data `{ noul, threshold }`) StageRecord로 남는다. 헬퍼 실패는 스크립트 안에서만 보이며 게이트 결과는 스크립트 종료 코드가 정한다. `HOOK_ENV`에 `PIXIE_URL`·`PIXIE_TOKEN`을 추가했다(화면 JSX·문구 불변).
- **검증:** [헬퍼 테스트](../../test/pixie-gate-helper.test.mjs) 8개는 실제 node:http 서버 + 실제 bash·curl로 헬퍼 명령을 실행해 ask/judge·stdin·유니코드·임계값·토큰 폐기/위조/부재·호출/크기 상한·메서드/경로·취소 전파, runner를 통한 env 전달·usage 합산·records·실행 후 토큰 폐기·헬퍼 실패 후 스크립트 exit 10을 확인한다. [서비스 테스트](../../test/pixie-service.test.mjs)에 실제 Cordis PixieService의 webServer 라우트 등록/해제와 env 전달 1개를 추가했다. 테스트는 구현 전에 작성했으나 모듈 부재 외의 독립 red는 관찰하지 않았다. 최종 `npm --prefix studio run typecheck`, `npm --prefix studio test` **413/413 두 회 연속 통과**(fail/cancelled/skipped 0, 404 + 헬퍼 8 + 서비스 1), `git diff --check` 통과.
- **미검증/한계:** 실제 DSH 샌드박스(macOS seatbelt·Linux bwrap) 안에서 loopback 접속 가능 여부, 실제 bash-local 실행기, curl이 없는 환경, webServer가 loopback이 아닌 주소에 바인드된 구성(토큰이 그 주소로 전송됨), TLS 자체 서명 인증서 구성, 실모델·독립 설치·GUI는 미검증이다. 사용자 GUI/프로필·Client Inspect·본체 수정·하위 위임·푸시는 하지 않았다.

#### R3 — UI 연결

- 게이트 구성·적용 범위 두 페이지가 같은 초안 목록을 `gateDefinitions`로 읽고 페이지 머리의 **저장**으로 `saveGateDefinitions` 전체 교체한다. 저장 전 변경은 안내 띠로 보이고, Host 검증 실패는 오류 줄에 원문 메시지로 남기며 초안을 유지한다. 읽을 수 없는 항목은 개수와 사유를 보여 주고 저장하면 빠진다고 알린다. "화면 시안" 안내를 지웠다.
- 스크립트 선택은 `gateScripts` 목록(편집기 열 때·새로고침)을 쓰고 실제 폴더 경로를 표시·복사한다. 폴더에 없는 저장 스크립트는 `(폴더에 없음)`으로 남기고, 비지원 환경이면 안내한다. `PROTOTYPE_SCRIPTS`는 삭제했다.
- 시험 실행은 `trialGate`를 실제로 부르며 취소할 수 있다. 결과는 출력 다섯 칸 + 실제 적용(막음·교체 전 확인·교체·덧붙임·통과) + 토큰 사용량이다. 스크립트 게이트는 실행하지 않는다는 안내를, 도구 지점은 예시 도구 이름 칸을 둔다.
- 실행 카드: 단계가 없는 작업 실행에서는 빈 "단계" 제목을 숨기고 **Pixie 출력**(다섯 칸·사용량), **메모**, **헬퍼 호출**(`pixie-ask-N`/`pixie-judge-N`, 판정 확률·기준)을 보여 준다.
- 검증: 게이트 UI jsdom 테스트를 저장·실패·시험 실행·취소·스크립트 목록·없음 표시로 갱신했고, 실세션 실행 기록을 fixture로 저장해 카드 렌더링을 검사한다.

- **R3 후속(사용자 피드백):** 적용 범위를 프리셋별 묶음(프리셋마다 걸리는 게이트 행·켜짐 토글·같은 시점 중복 경고, 프리셋 미지정은 맨 아래)으로 바꿨다. 스크립트 폴더는 기본 `<프로필>/studio-data/pixie-gate/commands/`이고 적용 범위의 **스크립트 폴더**에서 절대 경로·`~/…`로 바꾼다(`pixie-gate/settings.json`, Remote `saveGateScriptDirectory`, 실행마다 읽음, 상대 경로 거부, 폴더 자동 생성 없음). U19의 "작업 공간별 경로는 후속"은 유지한다. 게이트 실행 목록 카드는 이름·상태·지점·시각(도구 이름)만 두고, 상세는 적용·판정·이유·턴/도구·토큰 표 + 거부(원문·이유·제안·동작) + Pixie 출력(바꿀·덧붙일·메모) + 원문(변경 없음 표시)/최종 텍스트 + 함께 전달한 내용 + 메모 + 헬퍼 호출 순으로 재구성했다. 긴 텍스트는 높이 제한 상자로 보인다.

- **R3 후속 2(사용자 피드백):** 템플릿은 지점마다 대표 하나(양식 검사·에이전트 대화 규격·위험한 명령 차단·긴 도구 결과 요약·최종 답변 검증)와 빈 게이트만 두고 "곧 지원" 항목을 지웠다(U21 변경: 백그라운드형은 목록에서 제외). 적용 범위는 Studio에서 만든 프리셋(`listPresets`의 readOnly 제외)을 나열하고 프리셋마다 **게이트 추가**·**프리셋에서 빼기**·프리셋별 스위치를 둔다. 프리셋별 스위치는 `disabledPresetIds`(선택, 걸린 프리셋만 유지)에 저장하고 `enabled`는 게이트 전체 스위치(게이트 구성 카드)로 남긴다. 실행 매칭과 "같은 프리셋·같은 시점 하나" 검증은 프리셋별 상태(`enabledFor`)를 쓴다. 수정 전에는 한 프리셋에서 토글하면 `enabled`를 바꿔 모든 프리셋에 영향을 줬다(회귀 테스트 red 확인). Studio 프리셋이 아닌 곳에 걸린 게이트는 "다른 프리셋" 묶음에서 빼기만 가능하다. 새 게이트는 켜진 상태로 만들고 복제본은 프리셋 없이 만든다. 스크립트 폴더의 스크립트 개수 표시는 지우고 공개 `session.openWorkspacePath`로 **폴더 열기**를 추가했다(Host가 경로를 검증, 데스크톱에서만 동작).

- **U25–U26 (사용자 결정):** 게이트의 역할은 **미들웨어 제어 지점 제공**으로 한정한다. 훅 스크립트 처리 형식(준비 스크립트 → Pixie 지시)은 유지한다. 게이트의 "판정 모델로 결론 정하기" 옵션(U15)과 관련 화면·템플릿 질문을 삭제한다. 판정(결정) 모델은 게이트와 분리한 별도 기능으로 후속 설계한다(새 이슈). 스크립트 헬퍼 `pixie judge`와 Pixie 탭의 수동 판정·판정 설정은 유지한다. 저장된 `advanced.judge`는 검증에서 무시·제거하므로 기존 파일도 읽힌다.
- **R3 후속 3:** 적용 범위 맨 위에 스크립트 폴더를 두고, "다른 프리셋에 걸린 게이트" 카드를 없앴다(Studio 프리셋에 걸리지 않은 게이트는 "아직 추가하지 않은 게이트"로 모임). 프리셋 머리(이름·개수 / 게이트 추가)와 게이트 행(이름·시점 / 프리셋에서 빼기·스위치)을 같은 높이·오른쪽 정렬로 맞췄다. 화면 한국어 문구는 의도·용어 표를 담은 브리프로 Worker에게 검토·수정을 맡겼다.

- **R3 후속 4 (사용자 결정):** 판정 기능 UI를 Studio에서 모두 뺀다. Pixie 설정의 **판정** 페이지와 세션 Pixie 탭의 **판정** 탭, 수동 판정 Remote(`studioPixie.judge`)를 삭제했다. 헬퍼 `pixie judge`는 Pixie 모델과 기본 판정 프롬프트를 쓴다. 저장된 `judgeModel`/`judgeSystemPrompt`는 설정 파일 호환을 위해 읽고 그대로 저장하지만 쓰지 않는다(별도 판정 기능에서 다시 정한다). 사용자 한국어 피드백을 그대로 반영했고(모델 설명, "Pixie에게 보낼 내용", 결과 가이드 링크, 스크립트 설명, "게이트 테스트" 등), 설명이 불필요한 문구(게이트 구성 설명, 고급 설명, 최대 토큰 설명, 폴더 생성 안내)는 지웠다. 적용 범위의 "적용 프리셋이 없는 게이트" 카드를 지웠다: 게이트는 프리셋의 **게이트 추가**로만 쓰인다.

#### R4 — 문서·스킬

- 사용자 가이드 [Pixie Gate 가이드](../../release/docs/appendix/pixie-gate.ko.md)([English](../../release/docs/appendix/pixie-gate.md)): 만들기 절차, 지점별 결과 적용 표(U13·U14), 고급 옵션, 스크립트 계약(stdin·stdout·exit·환경 변수), `pixie` 헬퍼, 예시 스크립트 4개(도구 필터·자막 측정·번역 반복·변경 파일), 실행 기록, 문제 해결. 사용 가이드 목차에 연결했고 화면의 가이드 링크(`GATE_GUIDE_URL`)를 이 위치로 맞췄다.
- 스킬 [dsh-studio-pixie-gate](../../release/docs/appendix/pixie-gate/SKILL.md): 지점 선택, 할 일 작성, 스크립트 작성·설치, 정의 형식, 확인 방법. 기존 preset-check 스킬처럼 release 문서와 함께 배포된다.
- 자막 준비 템플릿은 가이드 예시와 같게 `{{hooks.measure-subtitle.data}}`를 쓴다.

#### R5 — 통합 검증

- [검증 기록](../verification/pixie-gate-r5/README.md): 설치 DSH 0.2.0-rc.2 격리 프로필, Pixie·세션 모두 deepseek-flash/low, 실제 API 키. 입력 거부(헬퍼 judge fail) → 완료 조건 추가 후 덧붙임(헬퍼 ask/judge pass) → `gate-sample.txt` 결과에만 덧붙임(그 외 스크립트 exit 10) → 첫 답변 교정 → 재답변 통과를 세션 이벤트·실행 기록·Pixie 탭에서 확인했다. 같은 결과를 최종 세션 2개에서 재현했다.
- 실세션에서 rc.2 `webServer`의 `protocol` getter 부재·지연 port로 헬퍼 URL이 `undefined`가 되는 결함을 발견해 red 테스트 후 수정했다.
- 화면: 게이트 구성·편집기(실모델 시험 실행)·적용 범위·실행 기록을 라이트·다크 × 1440·520 캡처, 콘솔 오류 없음.
- 미검증: 0.2.1-alpha.2, Linux·read-only 세션·Windows, `agent-message`·`tool-before` 실세션, 거부 카드 버튼 클릭, 사용자 GUI(19387)·desktop 프로필 배포.

## 확정된 결정

| ID | 결정 |
|---|---|
| U1 | 게이트는 **Studio UI로 정의**한다. DSH 런타임 개입 지점 중 들어갈 수 있는 곳(`input`, `tool-before`, `tool-after`, `turn-end`)을 대상으로 한다. 코드 확장 API는 범위 밖이다. |
| U2 | 적용 범위는 **프리셋 단위**이며 게이트별 `match`(에이전트·source·도구)로 좁힌다(#25 D1과 같음). |
| U3 | `input` 거부 시 Pixie 탭 카드에 원문·이유·다시 쓴 제안을 보여 주고 "수정해서 보내기"를 제공한다. 원문은 실행 기록에 보존한다. |
| U4 | 단계 오류·타임아웃의 기본 정책은 `pass`(fail-open)이며 게이트별로 `block`을 고를 수 있다. 오류는 기록에 통과와 구분해 표시한다. |
| U5 | `input`의 다시 쓴 텍스트는 기본으로 확인 없이 교체하고 원문을 카드에 보존한다. 게이트 설정 `confirmRevision`으로 확인을 켤 수 있다. |
| U6 | 게이트는 **1–N개 단계의 순차 파이프라인**이다. 명령·일반·판정 단계를 `판정 → 일반 → 판정`처럼 자유롭게 섞는다. 이번 상한은 **5개**다. 판정 단계 실행은 일반 단계 완성 뒤 S8에서 연결한다. |
| U7 | 단계 종류에 **명령(bash) 단계**를 더한다. 명령 단계·게이트 시작/종료 훅은 [훅 계약](#훅-계약)을 따르고, 게이트는 같은 지점의 일반 훅 결과를 입력으로 읽고 시작·종료를 명령 훅과 Cordis 이벤트로 알린다. |
| U8 | 게이트 출력 `forward`(original / replace / append)가 다음 모델 입력을 정한다. 자막 번역 예시(명령 → 판정 → 일반 → append)를 기준 시나리오로 삼는다. |
| U9 | 판정 전용 `judgeModel`·`judgeSystemPrompt` 설정을 분리한다. 모델 미설정 시 Pixie 기본 모델, 프롬프트 미설정 시 Jev JSON 출력 기본 판정 프롬프트를 사용한다. #25 수동 판정 시험도 같은 설정을 사용한다. 단계 model이 최우선이다. |
| U10 | **(U11–U22로 대체됨)** 게이트 설정은 Pixie 설정 왼쪽 메뉴의 별도 `게이트` 그룹으로 분리한다. `게이트 구성`(게이트 카드 + 흐름 편집 모달)과 `적용 범위`(켜짐·연결 프리셋·대상 에이전트·입력 출처·도구 이름) 두 페이지를 둔다. 흐름 모달은 개입 지점 → 시작 훅 → 단계 1–5 → 종료 훅 → 결과 → 시험 실행을 노드로 보여 주고, 각 노드에 입력·출력을 표시한다. 시작 템플릿은 하나(자막 번역 준비)를 둔다. 저장 형식(`GateEntry`)과 Host는 바꾸지 않는다. |

## 구현 단계

### S1 — 설치 런타임 계약 확인

- 선행: 없음.
- 책임: `rc.2`(가능하면 `alpha.2`)에서 다음을 확인한다. `pre-step` 리스너 등록과 reject 시 사용자 화면 표시(원문이 보이는지 사라지는지), 사용자·`agent-message` 메시지의 source 형태, 같은 source로 텍스트를 바꾼 메시지가 기록·표시되는 모양, `turn-stopping`에서 마지막 답변 텍스트를 읽는 방법, `post-execute` content 교체, 프리셋 scope 리스너가 그 프리셋의 에이전트에만 걸리는지, `prepend` 등록 시 Claude Code 훅 브리지·`model-selection`과의 실제 waterfall 순서, `ctx.shell`로 에이전트 cwd·샌드박스 정책 아래 stdin 명령을 실행하는 방법, `turn-stopping`에서 다른 리스너의 steer를 읽을 수 있는지, 리스너가 pre-step에서 Pixie 호출을 기다리는 동안 입력창·상태 표시가 어떻게 보이는지. (R5용 `llm/stream` `purpose: 'compaction'` short-circuit 가능성은 기록만 한다.)
- 수용: 각 항목의 결과와 버전 차이를 이 문서에 기록한다. 불가능한 항목은 해당 레시피·지점을 범위 밖으로 옮긴다.
- 검증: 격리 프로필 + 최소 시험 리스너(커밋하지 않는 실험 또는 테스트 전용).

### S1 확인 결과

2026-10-15, 기준 checkout `1f401ddc02`. **부분 확인이며 S1 전체 통과가 아니다.** 아래의 ‘확인’은 명시한 층위에만 적용된다. Host Inspect는 현재 Host의 공개 계약 조회이며 격리 서버에 실험 리스너를 설치했다는 증거는 아니다. 실제 모델/API 키를 사용하지 않고, 설치 앱 ASAR의 rc.2 모듈을 Electron Node 모드에서 직접 로드한 별도 최소 Context + 가짜 `LlmAdapter`로 실행했다. 사용자 GUI/프로필에는 리스너를 설치하지 않았다.

| 항목 | 결과 | 관찰·근거 | 명세 영향 / 남은 확인 |
|---|---|---|---|
| 설치 버전 | **확인: rc.2 / 미확인: alpha.2 실행** | `dsh --version` → `0.2.0-rc.2`. `/usr/local/bin/dsh`는 앱의 `Contents/Resources/runtime/cli/bin/dsh`를 가리키며 앱 ASAR runtime manifest도 rc.2. `npm view @deepseek-ai/dsh@0.2.1-alpha.2 version` → `0.2.1-alpha.2`(배포 존재 확인). | alpha.2는 구할 수 없는 버전이 아니라 **이번에 별도 설치·실행하지 않은 버전**이다. rc.2 결과를 alpha.2 호환 통과로 간주하지 않는다. 최초 잘못된 이름 `@deepseek/dsh` 조회는 404였고 정확한 이름으로 정정했다. |
| 1a. pre-step 등록·reject 기록 | **확인: 설치 모듈 / 미확인: 화면** | Host Inspect `Event.listEvents(agent/pre-step)`는 waterfall. 실제 `ctx.on(..., { prepend: true })` 등록 후 reject하면 `turn/end.reason.kind = blocked`, `user/message` 없음. **하지만 raw `agent/inbox/spliced` inserted에는 `ORIGINAL` 원문이 남는다.** | 위 런타임 사실의 ‘원문이 사라진다’는 **대화 surface 기록이 만들어지지 않는다**는 뜻으로 한정해야 한다. raw 로그에서 완전히 삭제되는 것이 아니다. U3 별도 원문 카드 보존은 유지한다. 브라우저에서 낙관적 입력 행이 사라지는 시점은 미확인. |
| 1b. source·교체 | **확인: user·교체 로그 / 미확인: 실제 agent-message 전달·화면** | 가짜 모델 실험에서 입력 source `{kind:'user'}`. 같은 source로 만든 `REPLACED`가 `user/message` + `surfaceOp:'append'`로 기록되고 모델 요청으로 진행. 원문은 inbox splice 기록에만 남음. agent-message 형태는 [공개 소스](<../../../packages/subagent/subagent/src/continuation-messages.ts#L13-L71>)의 `{kind:'agent-message', form:'relay', senderSessionId}`이며 본문에는 sender 접두 텍스트도 포함. | 교체가 기존 user/message 이벤트의 수정은 아니다. S4에서 실제 sendMessage 경로·relay 표시를 추가 검증한다. |
| 2. 마지막 assistant·다른 steer | **확인: 설치 모듈** | `agent.session.deriveMessages().filter(m => m.role === 'assistant').at(-1)`의 text content에서 `FAKE ANSWER`를 읽었다. 먼저 등록한 stopping 리스너가 `agent.steer(...)`한 뒤 다음 리스너의 `agent.inbox.nextStep`에서 `STEER`를 읽고 두 번째 step까지 완료했다. [공개 Inbox](<../../../packages/core/agent/src/runtime-types.ts#L47-L52>), Host Inspect stopping mode `serial`. | `agent.inbox` 전체 JSON 직렬화는 Cordis proxy의 `toJSON` 접근 오류를 일으켰으므로 **공개 `nextStep` 배열만** 읽는다. 뒤에 실행될 리스너의 steer를 미리 알 수는 없다. turn-end에 `prepend`를 일괄 적용하면 기존 steer 관찰 목적과 충돌한다. 마지막 text 블록만 모으고 reasoning/tool-call은 제외한다. |
| 3. post-execute content | **확인: 설치 모듈 / 미확인: 모델 tool-call 종단간** | Host Inspect `tools/post-execute`의 accept-content 계약 확인. 설치 ToolRuntime의 실제 `execute`에서 `BEFORE` → `AFTER` 교체, `isError:false`, 원래 `value:'BEFORE'` 유지. | content와 value는 같은 것이 아니다. content 교체로 원래 구조화 value까지 바뀐다고 가정하지 않는다. callId 기록 유지의 종단간은 [기존 회귀 테스트 소스](<../../../packages/core/agent-loop/tests/contract-regressions.spec.ts#L1239-L1279>)만 확인(이번 실행 아님). |
| 4. 프리셋 scope | **확인: 설치 scope primitive / 미확인: 실제 프리셋 Loader 조합** | 설치 `createScope`로 A/B 및 A의 자식 scope를 구성하고 `scopeTarget` serial dispatch → A 리스너만 호출(`['A']`), B 미호출. [scopeTarget 필터](<../../../packages/core/scope/src/index.ts#L158-L184>), [Studio ancestry 처리](<../../src/host/preset-policy.ts#L177-L190>) 참고. | 프리셋 ancestry가 실제 연결된 경우만 제한된다. unscoped root 등록은 전역이다. preset 선택/recompose까지의 격리 Loader 시나리오는 미확인. |
| 5. prepend·브리지·model-selection | **확인: 설치 waterfall primitive / 미확인: 실제 브리지 활성 조합** | 일반 listener → model 역할 prepend → gate 역할 prepend 순으로 등록한 실제 Cordis 결과: `gate-in, model-in, bridge-in, default, bridge-out, model-out, gate-out`. 이는 역할을 모사한 리스너이며 실제 브리지를 켠 결과가 아니다. [브리지 next/deny](<../../../packages/experimental/hooks-claude-code/src/index.ts#L225-L240>), [model-selection도 prepend](<../../../packages/core/agent/src/model-selection.ts#L113-L125>), [등록 unshift](<../../../vendor/cordis/src/events.ts#L254-L259>). | **prepend만으로 영구 최외곽 보장 불가**: 나중 prepend가 더 바깥이다. 브리지를 격리 프로필에 활성화하지 않았으므로 실제 순서는 미확인으로 유지. S4에서 모델 선택 생성 시점·게이트 등록 시점까지 검증해야 한다. |
| 6. shell cwd·stdin·sandbox | **확인: 설치 LocalBash cwd/stdin / 미확인: 세션 sandbox 강제 실행** | 설치 `subprocess-local` + `bash-local`, `resolve → execute → result()`로 `pwd; read -r line; printf ...` 실행: exit 0, 지정 임시 cwd 및 stdin JSON 반환, timeout 2000ms. Host Inspect `shell`/`sandboxPolicy` 계약 확인. [sandbox executor 기본 resolve](<../../../packages/shell/bash-sandbox/src/index.ts#L85-L90>)는 세션 없이 fallback policy를 구한다. | **설계 보강 필요:** command 포트는 `workdir`뿐 아니라 `sandboxPolicy: ctx.sandboxPolicy.resolve({session: agent.session})`를 명시적으로 전달해야 세션 mode/cwd 경계를 적용할 수 있다. `ctx.shell` 호출만으로 자동 적용된다고 쓰면 안 된다. enforcing sandbox provider 아래 deny/허용 시험은 미확인. 서비스가 없을 때 몰래 비샌드박스 실행으로 대체하지 않는다. |
| 7. 오래 기다리는 pre-step UI | **확인: 실행 상태 / 미확인: 장기 대기 UI** | 리스너 안 `agent.status`는 `running`. 지정 격리 서버 실행·HTTP 응답까지만 확인(토큰 없는 요청 401, 정상 인증 경계). 실제 장시간 지연을 걸고 입력창/중지 버튼/상태 문구를 관찰하지 않았다. | `running`을 특정 UI 문구·disabled 상태의 증거로 사용하지 않는다. S7에서 실제 대기 화면 확인 필요. |
| 8. compaction short-circuit (기록만) | **확인: 설치 stream 경계 / 미확인: 압축 종단간** | Host Inspect `llm/stream`은 waterfall, `purpose`에 `compaction` 있음. 설치 `ctx.llm.stream({purpose:'compaction', ...})`에 next 없이 자체 chunk를 yield하여 `CACHED` 수신. | 가짜 요청 + 최소 text-delta 경계 시험이다. 실제 summarizer에 유효한 전체 청크 시퀀스/범위 일치/취소/usage까지 검증한 것은 아니다. R5 후속 유지. |

**실행·정리 기록:** `node studio/dev.mjs --skip-test --port 19391`를 관리형 background job으로 실행하여 Studio 타입 검사·빌드, 격리 프로필 tarball 설치 및 `dsh web: http://127.0.0.1:19391/` 시작을 확인했다. 이 서버에는 시험 리스너를 배포하지 않았다. 별도 실험은 `/tmp/pixie-s1.KxmaAw/probe.cjs`에서 `ELECTRON_RUN_AS_NODE=1 '/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness' <probe>`로 실행했으며, 설치 `app.asar/dsh/package.json` 기준 `createRequire`로 모듈을 해석했다(workspace 코어 아님). 최종 실험 exit 0, 결과는 위 표에 옮겼다. 초기 실험의 proxy 직렬화·존재하지 않는 Context dispose/stop·도구 output 선언 누락 오류는 수정 후 재실행했으며 실패 실행을 통과 증거로 쓰지 않았다. 실험 스크립트·로그는 삭제했으며 보존 증거는 이 표다. background job 종료 결과 `killed`를 수집했고 `lsof -nP -iTCP:19391 -sTCP:LISTEN`에 listener가 없음을 확인했다. 임시 디렉터리의 realpath를 확인한 뒤 해당 디렉터리만 삭제했다. `git diff --check` 통과. 기존 격리 프로필과 지정 dev 명령이 생성한 빌드/패키지는 보존했다. 이 작업자는 Studio 소스/테스트와 DSH 본체를 수정하거나 커밋하지 않았다(최종 status의 Studio 코드 변경은 병행 S2 작업자 소유).

### S2 — 게이트 계약과 파이프라인 실행기

- 선행: S1.
- 책임: `GateDefinition`·`StageDefinition`·`StageResult` 계약과 정의 검증(단계 1–5개, 지점별 허용 역할, 프롬프트 변수), 단계 실행기 포트(`StageRunner`: command·converse 구현, judge 자리), 훅 계약(stdin 생성, exit code·stdout 해석, 출력 상한), start/end 게이트 훅, `forward` 처리, 순차 파이프라인 실행기, check JSON 엄격 검증, 단계 타임아웃·취소, `onError` 처리. 게이트 단계의 모델 호출은 필수 `stageTimeoutMs`로 제한한다. #25 Pixie 런타임에는 선택 `timeoutMs` 포트만 추가하며 `/pixie` 기본 동작(타임아웃 없음, 취소 가능)은 유지한다. service 생성 경로에는 연결하지 않는다.
- 수용: 자막 번역 예시(명령 → check → note → append)를 가짜 shell·llm으로 실행해 단계별 결과와 forward 결과가 맞는다. exit 0/2/기타/타임아웃, 잘못된 JSON, 역할에 맞지 않는 verdict, start 훅 skip·fail이 기대대로 처리된다. 1개·3개·5개 단계 파이프라인을 가짜 llm으로 실행해 pass/revise/fail/note와 fail 즉시 중단, 오류·타임아웃·취소 결과가 기대대로 나온다. 6개 단계와 judge 단계는 저장 시 거부된다. 가짜 `StageRunner`로 judge 자리에 다른 실행기를 넣어도 파이프라인 코드가 바뀌지 않음을 테스트한다.
- 검증: Node 단위 테스트.

### S3 — 실행 기록 저장소

- 선행: S2.
- 책임: 게이트 실행 기록 저장(원문·단계 결과·적용 동작·사용량), 세션 수명 정리, Remote 조회·구독.
- 검증: 단위 테스트(원자적 쓰기, 정리, 늦은 결과 폐기).

### S4 — `input` 지점 연결 (R1·R2)

- 재리뷰 조건 해소: 정의 읽기는 `{ entries, invalid: [{ index, raw, error }], error? }`로 항목 실패를 격리하고 깨진 파일·invalid 이전 원본을 보존한다. 저장은 전체 검증하며 런타임 4개 지점은 읽기 실패 시 fail-open·동일 경고 60초 제한, Remote/편집기는 복구 정보와 삭제·덮어쓰기 확인을 제공한다.

- 선행: S3.
- 책임: `agent/pre-step` 바인딩(바깥쪽 등록), source·에이전트 필터, `next()` 결과에서 일반 훅 컨텍스트 읽기, 대상 메시지 교체·append·거부, `pixie-gate/start`·`end` 이벤트, 프리셋 범위 적용.
- 호출자 책임(S4–S6): end 훅 도중 외부 취소에도 GateResult 판정은 유지되므로 실제 동작 적용 직전에 `signal.aborted`를 확인한다.
- 수용: 자막 번역 예시와 양식 레시피로 통과·교체·append·거부가 모두 동작하고, Claude Code 훅 브리지를 함께 켠 경우 그 컨텍스트가 `hooks.context`로 들어가며 그 reject는 그대로 유지된다. 그리고 거부된 원문이 실행 기록에 남는다. 다른 리스너의 메시지(런타임 컨텍스트 등)는 보존된다.
- 검증: Loader 조합 테스트 + 격리 프로필 실제 모델 1회.

### S5 — `turn-end` 지점 연결 (R3)

- 선행: S4.
- 책임: 마지막 답변 읽기, `note`(번역 카드)와 `fail → steer`(턴당 상한), 상한 초과 기록.
- 수용: 번역 레시피가 원문을 바꾸지 않고 카드로 붙는다. 교정 레시피가 상한 안에서만 steer한다.
- 검증: 단위 + Loader 테스트(무한 continuation 방지 포함).

### S6 — `tool-before`·`tool-after` 지점 연결 (R4 바인딩)

- 선행: S4.
- 책임: 도구 이름 필터, `post-execute` content 교체·block, `pre-execute` deny/ask.
- 수용: 큰 검색 결과를 Pixie 요약으로 바꾸는 단순 레시피가 동작한다(인덱스 없이). 원래 tool call id가 유지된다.

### S7 — 설정·탭 UI

- 선행: S3(카드), S2(시험 실행).
- 책임: Pixie 설정의 `게이트` 페이지(게이트 목록, 지점·match·실패 정책 선택, 단계 1–5개 추가·삭제·순서 변경·종류(명령/일반)·역할·프롬프트·명령 편집, 시작·종료 훅 명령, `forward` 선택, 프리셋 연결, 샘플 텍스트 시험 실행과 단계별 결과 표시), Pixie 탭의 게이트 실행 카드(통과·교체·거부·교정·오류 `Badge`, 거부 카드의 수정해서 보내기). 디자인 시스템과 ko·en·zh 문구를 따른다.
- 검증: UI 단위 테스트, Web 배포 후 라이트·다크·좁은 폭 확인.

#### S7 부분 진행 — 결과 표시 부품 (설정·탭 연결 전)

- [GateResultDetails](../../src/pixie-gate-result.tsx)를 추가했다. 시험 실행과 카드 상세에서 공유할 원문·최종 텍스트, 최종 verdict, 단계별 verdict Badge·text·reason·error·소요 시간, 시작/종료 훅, forward·append contexts·forwardError를 표시한다. applied 상태를 verdict에서 추론하지 않으며 사용량은 표시하지 않는다.
- `skipped` 배열 또는 `data.skipped`를 별도 Badge로 표시한다. 명령 생략과 forward 오류가 함께 있으면 “시험 실행에서 명령 단계를 건너뛰어 전달 결과를 계산할 수 없음” 안내와 실제 오류를 함께 남긴다. ko·en·zh 문구를 제공한다.
- 기존 공용 스타일만 사용하여 스타일/HTML 스냅샷 변경은 없다. jsdom 4개 추가: 생략된 pass와 전달 오류, 훅·단계·append 표시/사용량 비표시, 중국어와 명시적 skipped, 일반 forward 오류의 잘못된 생략 안내 방지.
- 검증: `npm --prefix studio run typecheck`, `npm --prefix studio test` (319개 통과), `git diff --check`. 초기 JSX 런타임 import 문제는 수정 후 전체 재검증했다.
- **S7 미완료:** 부품은 아직 설정이나 탭에 연결하지 않았다. 게이트 목록·편집·필드 검증·프리셋 연결·저장, 시험 실행 호출/취소, 실행 카드 및 followGates 재연결, 거부 처리 모두 다음 작업이다. 화면 구성/새 게이트 탭 선택은 아직 확정하지 않았다.
- **수정해서 보내기 미구현:** Client Inspect 조사도 아직 하지 않았다. 사용자 GUI 무접근 조건을 지키기 위해 향후 격리 GUI가 연결된 Inspect에서 공개 입력 API를 조사하고, 불가하면 복사 + 실제 전송이 아닌 보냈음 표시(resent)로 구현한다.
- **미검증:** 격리 서버 시각 확인·스크린샷, 독립 설치, 사용자 앱 배포, 사용자 시각 확인 모두 미실시. 사용자 GUI(19387)와 desktop 프로필은 접근/변경하지 않았다. S1 표는 변경하지 않았다.

#### S7 부분 진행 — 설정 게이트 편집기

- Pixie 설정의 DetailLayout에 `게이트` 페이지를 연결했다. 목록(이름·지점·켜짐·프리셋 수·단계 수), 추가·복제·삭제, match/정책/forward/limits/훅/Studio 프리셋 연결과 단계 편집을 제공한다. 복제본은 활성 중복을 피하도록 꺼진 상태로 만든다.
- 단계는 1–5개이며 추가 상한 사유, 최소 삭제 제한, 위/아래 이동, 명령/일반 편집, 판정 비활성, 모델 기본값 및 앞 단계 ID 기반 변수 안내를 제공한다. 지점 변경으로 금지된 revise는 check로, forward는 original로 정리하고 Notice로 명시한다. 보이지 않는 불법 값을 남겨 저장을 막는 대신 변경 내용을 즉시 알려 주는 선택이다.
- `validateGateDefinition`의 첫 오류를 locale 문구와 필드 주소로 매핑한다. 목록 전체를 검증한 뒤 `saveGateDefinitions`로 교체한다. 저장 중 편집을 잠그고, 변경 없음/변경/저장 중 버튼 상태 및 Host 오류 Notice·편집 유지·재시도를 제공한다. 기존 공용 부품/스타일만 사용하여 디자인 시스템 표와 HTML 스타일 스냅샷 변경은 없다.
- 검증: `npm --prefix studio run typecheck`, `npm --prefix studio test` **326개 통과**(신규 jsdom 7개), `git diff --check`. Node deprecation 및 기존 RoleEditor heading nesting 경고는 남아 있다. 코드 리뷰는 요청대로 S9 이후로 미룬다.
- **이번 범위의 미완료:** 시간 예산에 따라 편집기를 우선 커밋한다. 시험 실행 패널, trialGate Remote descriptor/취소 연결, GateResultDetails 연결, 현재 세션 공개 API 확인 및 명령 실행 옵션·payload 테스트는 다음 작업이다. 현재 세션을 추측하거나 사용자 GUI Client Inspect를 호출하지 않았다.
- **S7 남은 것:** Pixie 탭 실행 카드/followGates, 거부 카드의 수정해서 보내기, 격리 GUI 라이트·다크·좁은 폭 시각 확인. 사용자 GUI(19387)·desktop 프로필 접근 및 배포, 독립 설치는 하지 않았다. S1 표는 변경하지 않았다.

#### S7 부분 진행 — (A) 설정 시험 실행 패널

- 편집기 아래에 샘플 입력(필수), tool-*의 도구 이름(필수), 일반 훅 컨텍스트(선택), 기본 꺼짐 명령 실행, 실행/취소와 `GateResultDetails`를 연결했다. 저장 API를 호출하지 않고 현재 draft를 복제해 전달한다. 결과·단계 생략·소요 시간·오류 Notice를 표시하며 사용량은 표시하지 않는다. 선택 게이트 변경/언마운트 시 취소하고 취소 이후 늦은 결과는 폐기한다.
- `trialGate` descriptor에 cancellation을 선언하고 `AbortController` 기반 `{ result, cancel }` handle을 연결했다. 공개 Remote의 optional AbortSignal 계약은 [gateway Client](../../../packages/api/gateway/src/client/index.ts#L495-L531)에서 확인했다. 셸의 기존 단일 `$mount` 조립 경로에 descriptor가 합쳐진다.
- **세션 선택:** 공개 Session Slot에는 framework가 sessionId를 전달한다([ui-slots](../../../packages/client/ui-slots/src/index.ts#L614-L625)). 기존 Pixie 사이드바도 해당 prop을 사용한다([pixie-client](../../src/pixie-client.tsx#L149-L152)). 반면 설정 서비스는 [shell](../../src/shell.tsx#L74-L83)의 root scope이다. 따라서 전역의 임의 활성 세션을 추측하지 않고 설정에서는 명령 실행을 비활성화하며 “설정 화면에서는 세션 정책을 알 수 없어 명령 단계를 실행하지 않습니다”를 표시한다. 패널의 명시적 sessionId seam에서는 opt-in 활성/payload를 테스트하되 현재 설정 경로에서는 sessionId를 제공하지 않는다. 실제 실행 정책 검증은 기존 Host가 담당한다.
- **Client Inspect 미사용(사용자 GUI 보호):** Provider 목록만 확인했으며 client query는 사용자 GUI(19387)에 전달되므로 호출하지 않았다. Host `Service/listService(studioPixie)`는 미등록 오류여서 런타임 계약 확인 증거로 사용하지 않았다. 공개 소스 정적 조사로 대체했고 격리 Client Inspect/실제 시각 확인은 다음 워커로 넘긴다.
- 기존 공용 부품·스타일만 사용했다. 새 공용 부품이나 CSS 변경이 없어 디자인 시스템 표 및 HTML 스냅샷 재생성은 필요하지 않다. ko·en·zh 문구를 제공한다.
- 검증: `npm --prefix studio run typecheck`, `npm --prefix studio test` **332개 통과**(신규 jsdom 6개: draft·결과·skipped, 세션 없음 비활성, 명시적 세션 명령 opt-in/tool payload, 취소/늦은 결과 폐기, 오류 Notice, 언마운트 취소), `git diff --check`. 초기 테스트에서 Toggle을 checkbox로 가정한 assertion은 실제 switch의 aria-checked 검사로 수정했다. 기존 Node deprecation 및 RoleEditor heading nesting 경고는 유지된다.
- **다음 작업 (B):** Pixie 탭 실행 카드, applied 상태/상세·pending 거부 처리, followGates sync 재조회·run 반영·재연결, 560px 목록/상세 전환, 공개 입력 채우기 API 정적 조사 및 격리 Client Inspect 확인. B 코드는 아직 변경하지 않았다. 격리 GUI 시각 검증·독립 설치·사용자 배포는 미실시이며 S1 표는 변경하지 않았다. 코드 리뷰는 S9 이후 일괄 수행한다.

#### S7 부분 진행 — (B) Pixie 탭 게이트 실행 카드

- `스레드 / 판정 / 게이트` 중 게이트에 기존 스레드 카드의 목록+상세·560px container 전환과 뒤로 가기 IconButton을 재사용했다. 이름·지점·시각·원문 미리보기, applied 기반 Badge, hooksInput unverified 메타를 표시한다. pending 거부는 별도 상태 Badge와 상단 정렬로 미처리 원문을 먼저 찾게 한다(각 그룹은 최신순). 고정 속성은 Badge로 만들지 않았다.
- Badge 매핑: pass→통과, replaced→교체, appended→덧붙임, rejected→거부, steered→교정, blocked/denied→차단. applied=none일 때만 status running/error/cancelled→진행 중/오류/취소, done→없음이다. verdict로 적용을 추론하지 않는다. 상세는 `GateResultDetails`와 applied·reason, turn-end의 turn/steerCount, tool-*의 name/callId를 표시하며 사용량은 숨긴다.
- **수정해서 보내기:** 공개 [SessionInput.setDraft](../../../packages/client/ui-conversation/src/client/contract/input.ts#L176-L179)와 [focus/SessionInputResolver.for](../../../packages/client/ui-conversation/src/client/contract/input.ts#L202-L214), [conversation.input](../../../packages/client/ui-conversation/src/client/service.ts#L41-L42)을 이용한다. [QueueDock의 sessions.scope → conversation.input.for](../../../packages/client/ui-conversation/src/client/queue/QueueDock.tsx#L399-L405), 다른 플러그인 [ui-commands의 session-routed input 사용](../../../packages/client/ui-commands/src/client/service.ts#L473-L478)을 정적 근거로 삼았다. 현재 Pixie 탭의 sessionId scope를 조회하고 제안(없으면 보존 원문)으로 초안을 교체한 뒤 focus한다. 초안 교체임을 안내한다. 전송/자동 resent 처리는 하지 않고 사용자가 별도 `보냈음 표시`로 확인한다. 해당 버튼은 실제 전송이 아니라는 안내를 표시하며 `무시`는 dismissed를 전달한다. API 부재/실패는 Notice로 표시하고 pending을 유지한다. 다음 input 원문 자동 감지는 과도한 연결을 피하려 생략했다.
- `gateRuns/followGates/resolveGateRejection` descriptor는 기존 단일 Remote contribution에 합쳤다. #25 follow 연결/재시도 로직을 공용 함수로 추출해 기존 스레드와 게이트가 함께 사용한다. sync마다 기록을 재조회하고 run은 id로 갱신한다. snapshot 도중 run 이벤트가 오면 이벤트 값이 우선하며 오래된 snapshot/언마운트 결과는 폐기한다. 재연결의 Host sync로 재조회하고 언마운트에 스트림·재시도 타이머를 해제한다.
- ko·en·zh 제공. 기존 공용 부품/CSS만 재사용하여 새 공용 UI 부품·스타일 변경이 없으며 디자인 시스템 표/HTML 스타일 스냅샷 재생성은 불필요하다.
- 검증: `npm --prefix studio run typecheck`, `npm --prefix studio test` **340개 통과**(신규 8개), `git diff --check`. 목록/상세·전체 Badge 매핑·거부 채우기/명시적 resent/dismissed·오류 유지·sync/run 경합·재연결/해제·560px CSS와 data-open 전환·빈 목록·공개 composer scope/Remote 인자를 검증했다. lean-shell의 단일 `$mount` 검증도 전체 테스트에 포함된다. jsdom은 실제 CSS 배치를 계산하지 않으므로 좁은 폭 시각 검증을 대신하지 않는다. 기존 Node deprecation/RoleEditor heading nesting 경고는 남아 있다.
- **Client Inspect 미사용:** 목록 조회 후 Host `Service/listService(studioPixie)`는 미등록 오류였으며 런타임 확인 증거로 삼지 않았다. Client query는 사용자 GUI로 전달되므로 호출하지 않았고 공개 소스로 대체했다. 사용자 GUI(19387)·desktop 프로필 접근/배포, 독립 설치, 코드 리뷰는 수행하지 않았다. S1 표 불변, 리뷰는 S9 이후 일괄이다.
- **다음 워커: 격리 시각 확인·스크린샷.** 라이트/다크 × 넓은 폭/560px 이하에서 (1) 빈 게이트 탭, (2) 전체 적용 상태 카드와 pending 상단 정렬·unverified, (3) 거부 원문/이유/제안·초안 채우기·보냈음/무시, (4) turn-end 상한 reason/횟수, (5) tool-before/after 이름/callId·공유 단계/훅 결과, (6) running→완료 및 연결 끊김→sync 복구, (7) 기존 스레드/판정 탭 회귀를 확인한다. 데이터 모양은 [신규 테스트](../../test/pixie-gate-runs.test.mjs)의 run/pending/result fixture를 사용한다. 격리 scaffold는 GateRunsPanel/GateRunActions에 fixture·sync/run을 공급하면 모델 없이 화면을 준비할 수 있다. 실제 composer/재연결 확인은 별도 격리 런타임에 Studio를 설치하고 세션을 만든 뒤 게이트 정의를 연결하여 실행한다. 사용자의 프로필/GUI를 데이터 준비에 사용하지 않는다. S7은 이 시각 검증이 남아 미완료이며 S8–S9는 대기한다.

#### S7 UI/UX 검토 반영

- 지점 ko·en·zh 공용 표시, 단계별 건너뜀 Badge·이유, 자연스러운 목록 메타, 유효하지 않은 시각 `—`, 편집기 섹션 분리·모델 select 통일, 명령 실행 인라인 스위치, pending 단일 Badge·거부 상세 제목을 반영했다. 시험 실행은 꺼진 게이트도 정의 사본의 `enabled=true`로 평가하고 결과 위에 실제 실행 미적용 안내를 표시하며, 저장 상태와 런타임 input의 비활성 필터는 유지한다. 검증: Studio typecheck 및 테스트 **347개 통과**, `git diff --check`; 격리 19391에서 라이트·다크 × 1440·520 캡처(`/tmp/pixie-gate-s7-shots-v2/INDEX.md`). 기존 실행 기록을 사용하고 누락된 정의 2개만 승인 후 복구, pending 시각은 0으로 조정했다. 사용자 GUI·desktop 프로필 미접근, S1 표 불변, 코드 리뷰는 S9 이후.

#### S7 UI/UX 2차 다듬기

- 소요 시간은 1ms 미만 `<1 ms`, 그 외 정수 ms, 1000ms 이상 소수 한 자리 초로 ko·en·zh 표시한다. 건너뛴 단계는 중복 없이 집계하여 전체 판정 옆에 보조 표시하며 판정 값은 유지한다.
- 비활성 게이트 시험 안내는 공용 Notice의 `tone="info"`(status)로 표시한다. 기존 기본 error/alert 호출부는 그대로 유지한다. 프리셋 다중 선택은 입력 출처와 공유하는 Node-testable `CheckOption` 체크박스 목록으로 바꾸며 누락된 프리셋 ID도 제거 가능하게 유지한다.
- 검증: `npm --prefix studio run typecheck`, `npm --prefix studio test`(빌드 포함) **350개 통과**, `git diff --check`. 시간 경계·locale·건너뜀 집계·정보 Notice·다중 선택 jsdom 회귀를 확인했다. 기존 Node deprecation/React nesting 경고는 남아 있다.
- `roles-ui.expected.html`과 생성기는 현재 저장소에 없으므로 재생성하지 못했다(#24에도 같은 제약 기록). 기존 디자인 규칙·스타일 격리 테스트는 통과했다. 이번 변경의 GUI 시각 확인·독립 설치·실제 모델은 미검증이며 사용자 GUI/프로필에는 접근하지 않았다. S1 표 불변, 코드 리뷰는 S9 이후.

#### S7 UI 재설계 — 게이트 구성과 적용 범위

- **위치:** Pixie 설정 왼쪽 메뉴에서 `판정` 아래 `게이트` 그룹을 새로 두고 `게이트 구성`, `적용 범위` 두 페이지를 둔다. 기존 단일 `게이트` 편집 페이지는 제거했다(`pixie-gate-pages.tsx`(R2-a/b에서 삭제됨)).
- **게이트 구성:** 게이트를 카드(`studio-card-pair`)로 보여 준다. 카드에는 이름·개입 지점·켜짐 배지, 단계 흐름 요약(시작 훅 → 단계 종류·역할 → 종료 훅), 연결 프리셋 수와 편집·복제·삭제(확인 모달)가 있다. 상단에 `예시로 시작`과 `새 게이트`.
- **흐름 편집 모달:** `pixie-gate-composer.tsx`(R2-a/b에서 삭제됨). 왼쪽은 개입 지점 → 시작 훅 → 단계 1–5(사이 `+`로 삽입, 5개면 사라짐) → 종료 훅 → 결과 → 시험 실행 노드 목록이고, 각 노드에 `입력 → 출력` 요약을 붙인다. 단계의 입력 요약은 앞의 `수정` 단계가 있으면 그 단계 수정본, 없으면 원문으로 표시한다. 오른쪽은 선택한 노드 하나의 설정과 입력/출력 상자(무엇이 들어오고 무엇이 나가는지)다.
  - 개입 지점은 설명이 붙은 선택지로 고르며, 지점에서 불가능한 역할·전달 방식은 선택지에서 숨긴다(지점 변경 시 정리하고 안내).
  - 단계는 종류(명령/일반 모델/판정 모델)·역할을 분할 선택으로 고르고, 쓸 수 있는 변수(시작 훅 포함)를 칩으로 보여 준다.
  - 결과 노드는 전달 방식, 교체 전 확인(입력만), 지점별 실패 동작 설명, 오류 정책, 제한 시간, 턴당 교정 상한(턴 종료만)을 담는다.
  - 저장 시 검증 실패는 해당 노드를 열고 노드에 `확인 필요` 배지와 필드 옆 오류를 보인다. 저장 실패 알림은 닫을 수 있고 편집은 남는다. 저장하지 않고 닫으면 버릴지 묻는다. 시험 실행 패널은 노드를 바꿔도 유지된다.
  - 모달 저장은 그 게이트 하나(정의 + 기존 연결 프리셋)를 저장된 목록에 반영한다. 적용 범위 페이지의 저장 전 편집은 덮어쓰지 않는다. 같은 프리셋·지점의 켜진 게이트 중복은 저장 전에 막는다.
- **적용 범위:** 게이트별 설정 카드에 켜짐, 연결 프리셋(체크 목록), 대상 에이전트, 입력 출처(입력 지점만), 도구 이름(도구 지점만)과 `흐름 편집` 이동을 둔다. 페이지 저장 버튼으로 전체를 저장하며 켜진 게이트 중복이 있으면 저장을 막는다.
- **시작 템플릿:** `예시: 자막 번역 준비` — 명령(`measure`, 메모: 바이트 수 측정) → 판정(`size`, `{{stages.measure.text}}`로 한 번에 처리할 크기인지) → 일반 모델(`plan`, 메모: 번역 방침) → 원문 + `plan` 덧붙임. 꺼진 상태로 만들어진다.
- **불러오지 못한 정의·깨진 파일** 알림과 덮어쓰기 확인은 두 페이지에 같이 보인다.
- **검증:** `npm --prefix studio run typecheck`, `npm --prefix studio test` **429개 통과**, `git diff --check`. 편집기 jsdom 테스트를 새 구조(메뉴 그룹, 카드, 모달 노드·입출력, 단계 추가/이동, 지점 제한, 시작 훅 변수, 검증 위치, 저장 실패·닫기 확인, 적용 범위 편집·중복 차단·모달 저장과의 독립, 불러오지 못한 정의, 깨진 파일, ko·zh)로 다시 썼다. 판정·시험 실행 테스트도 모달 기준으로 바꿨다.
- **시각 확인:** 격리 프로필(`node studio/dev.mjs --skip-test --port 19391`, 설치 DSH 0.2.0-rc.2)과 임시 headless Chrome으로 게이트 구성, 모달(개입 지점·명령·판정·일반 모델·시작 훅·결과·시험 실행), 적용 범위를 라이트·다크 × 1440·520으로 확인했다(콘솔 오류 없음). 모달이 좁아지면 노드 목록이 위쪽 가로 스크롤 줄로 바뀐다. 사용자 GUI(19387) 배포·사용자 시각 확인은 하지 않았다.
- **미검증·제한:** 실제 모델 호출, 이번 변경의 독립 리뷰. 판정 단계 질문 편집 부분은 기존 판정 편집기를 모달 안에 그대로 넣었다.

### S8 — 판정 단계 연결

- 선행: S2, S7.
- 책임: `judge` `StageRunner`(#25 `LlmJudgeEngine`), `pass` 규칙 계약·검증, UI의 판정 단계 편집(질문·통과 규칙). 판정 전용 모델·시스템 프롬프트 분리는 이 단계에서 함께 결정한다.
- 수용: `판정 → 일반 → 판정` 게이트가 시험 실행과 `input` 지점에서 동작한다. 잘못된 판정 출력은 오류다.
- 검증: 단위 테스트 + 실제 모델 1회.

#### S8 부분 구현 — Host 계약·판정 실행·설정

- `JudgePassRule = { mode: 'all' | 'any', conditions: JudgePassCondition[] }`; 조건은 `{question,type:'noul',threshold}` / `{question,type:'score',min}` / `{question,type:'choice',allowed:string[]}`. 비어 있지 않은 평면 조건 목록으로 제한한다. noul 0..1, score 0..levels-1(소수 허용), choice는 존재하는 옵션의 비어 있지 않은 목록이며 질문 참조·형식·타입을 검증한다. 질문 ID는 영문 시작 영숫자/`_`/`-`, prototype 예약어 제외다.
- judge는 계약에 role이 없는 **check 고정** 단계다. 명시 role 필드도 거부하며 revise/note는 일반 단계로 분리한다. 질문 내용·옵션 설명·score levels·noul 기준은 기존 변수 검증/렌더링을 사용한다. state는 `{ subject, original, stages, hooks }`이며 이전 판정의 `data.answers`와 일반 단계 결과, 일반 훅 컨텍스트를 포함한다.
- 기존 `LlmJudgeEngine`을 재사용하고 JSON 검증 실패는 error로 보존한다. 조건 실패 이유에 질문과 실패 조건을 기록하며 답은 `data.answers`에 저장한다. 기존 파이프라인의 `stageTimeoutMs`와 취소 경계를 사용하고 판정 스트림도 `untilAborted`로 늦은 응답을 폐기한다.
- 선택 설정 `judgeModel`, `judgeSystemPrompt`를 저장/복원한다. 생략은 저장 형식 그대로 허용하고 실행 시 기본값을 적용하여 기존 파일과 하위 호환한다. 모델 우선순위는 단계 → 판정 설정 → Pixie 기본 모델이다. 기본 시스템 프롬프트는 기존 Jev JSON 지시문이며 수동 판정 Remote에도 같은 설정을 연결했다.
- 검증: typecheck 및 Studio 전체 테스트 **363개 통과, 3회 연속**, `git diff --check` 통과. 신규 Host 회귀는 all/any·경계값·잘못된 JSON·타임아웃/취소·설정 fallback과 저장 roundtrip·수동 판정 설정을 포함한다. 가짜 llm의 `판정 → 일반 → 판정`, `명령 → 판정 → 일반 → append`를 실제 input waterfall 서비스 조합에서도 확인했다.
- 전체 검증 중 정의 삭제 경합을 발견했다(수정 전 전체 실행 6회 중 4회 실패, 단독 테스트는 통과). 이벤트 emit은 동기이므로 대기 문제 가설을 기각했다. 원인은 일반 세션 prune의 `gates.json` 오인이었고 S4 경로 보강 커밋으로 분리했다. 테스트 대기나 구현 순서를 바꾸어 숨기지 않았다.
- **S8 미완료 / UI 인계:** 단계 종류 판정 활성화, 질문·유형별 옵션/levels/기준 편집, 통과 규칙/모델 편집, `GateResultDetails` answers 요약, 설정 페이지 판정 모델/시스템 프롬프트와 기존 저장 버튼 상태, 관련 jsdom 테스트가 남아 있다. 현재 편집기는 judge 선택을 계속 비활성화한다. 후속 UI는 위 계약을 그대로 사용한다.
- 실제 모델 호출은 미실시이며 키 존재 여부도 확인하지 않았고 키 값은 열람하지 않았다. 사용자 GUI·프로필 접근/배포 및 Client Inspect 없음. 독립 설치·시각 확인 미검증. S1 표 불변, 리뷰는 S9 이후.

#### S8 UI/UX 다듬기

- 기존 reason은 유지하고 구조화 실패 조건 `data.failedConditions`를 추가하여 ko·en·zh 결과 문구·질문/옵션/점수 라벨과 구기록 fallback을 지원했다. 조건 질문 식별 문구, choice·score 압축 편집 행, 오른쪽 정렬 보조 초기화 버튼을 반영했다. Studio typecheck·전체 테스트 369개 2회 연속·diff 검사 통과, 격리 19391에서 라이트·다크 × 1440·520 16장 확인([INDEX](</tmp/pixie-gate-s8-shots-v2/INDEX.md>)). 사용자 GUI·프로필 및 Client Inspect 미접근, S1 표 불변, 실제 모델·S9·일괄 리뷰는 후속이다.

#### S8 UI 구현·로컬 검증

- 판정 단계 선택을 활성화했다. 선택 모델(판정 기본 모델 fallback), check 고정 안내, choice 옵션 ID/문구·score 2–10단계·noul 질문/참/거짓 기준, 질문 추가/삭제와 ID 편집, all/any 및 유형별 통과 조건을 편집한다. 기존 변수 안내와 CheckOption을 재사용한다. 질문 유형 변경·ID 변경·옵션/질문 삭제로 깨진 조건은 자동 삭제하지 않고 유지하며 공유 `validateGateDefinition` 오류를 질문/조건 옆에 표시한다.
- `GateResultDetails`는 answers의 선택 라벨·확률/신뢰도, 점수 단계 문구·신뢰도, noul 값과 실패 조건 reason을 표시한다. 선택적 definition을 시험 실행 draft 및 실행 카드의 저장 정의 조회에서 전달하며, 질문/옵션/단계를 찾지 못하면 ID/숫자로 표시한다. Host 기록 계약은 바꾸지 않았다.
- Pixie 설정은 기존 성격별 DetailLayout 페이지 구조와 일치하도록 독립 **판정** 페이지를 선택했다. 판정 모델의 Pixie 기본 모델 fallback, 빈 시스템 프롬프트의 기본 Jev 지시문, 기본값으로 되돌리기, 수동 판정 탭도 설정을 사용한다는 안내와 기존 저장 버튼 상태/오류 보존 규칙을 적용했다. 선택 필드가 없는 기존 설정을 그대로 지원한다.
- ko·en·zh 문구 제공. 새 공용 부품 및 CSS 변경이 없어 디자인 시스템 부품 표/스타일 스냅샷 변경은 없다.
- 검증: `npm --prefix studio run typecheck`, `npm --prefix studio test` **368개 2회 연속 통과**, `git diff --check`. 신규 jsdom 5개는 단계 생성/noul·trial payload, choice 편집/깨진 옵션, score/깨진 질문, answers·ID fallback, 설정 저장/복원/하위 호환을 다룬다. 기존 테스트의 judge 선택 가능·판정 설정 탐색 기대값 및 실행 카드 Remote mock을 새 계약에 맞췄다. 첫 전체 실행의 기존 테스트 2개 실패는 탐색 기대값/Remote mock 누락이었으며 수정 후 연속 2회 통과했다. 기존 Node deprecation/RoleEditor nesting 경고는 남는다.
- 격리 서버 19391 및 임시 Chrome 프로필로 라이트·다크 × 1440·520에서 질문 3유형·통과 조건·판정 설정·판정 결과를 24장 촬영했다. [스크린샷 INDEX](</tmp/pixie-gate-s8-shots/INDEX.md>). 결과는 격리 프로필에만 추가한 합성 실행 기록 1개이며 기존 기록은 보존했다. 사용자 GUI 19387·desktop 프로필 접근/배포 및 Client Inspect 없음.
- **리뷰 후 갱신:** 판정 라벨 스냅샷 제한은 `db8499c716`·`dbdd703856`으로 해결했다. 렌더된 질문·기준·옵션·점수 문구를 실행 기록에 보관하고, 결과와 실패 조건은 기록만 사용한다. 스냅샷 없는 구기록은 현재 정의가 아니라 id·숫자로 표시한다. 실제 모델 호출은 여전히 미검증이며, S9 부분 검증과 일괄 리뷰 결과는 아래 기록을 참조한다. S1 표 불변.

### 일괄 리뷰 수정 기록

- 정의 하나의 잘못된 choice 옵션이 모든 게이트와 에이전트 턴을 실패시키던 재리뷰 조건을 해소했다. [defs-red.txt](</tmp/pixie-gate-review-fix/defs-red.txt>)에 로더·4개 런타임·편집기 red를 보존했으며 S1 표는 변경하지 않았다.

- 리뷰 자료: [/tmp/pixie-gate-review-all/](</tmp/pixie-gate-review-all/>). 재현 red 근거는 [before.txt](</tmp/pixie-gate-review-fix/before.txt>), [additional-red.txt](</tmp/pixie-gate-review-fix/additional-red.txt>), [client-red.txt](</tmp/pixie-gate-review-fix/client-red.txt>)다. `additional-before.txt`에는 fixture 오류가 섞였으므로 결함 근거로 사용하지 않는다.
- **Host A — `db8499c716`:** 실제 교체되는 forward 텍스트 기준으로 수정 확인·제안을 결정하며 동일 텍스트는 불필요하게 거부하지 않는다. 명령 JSON의 명시적 null/잘못된 verdict는 오류로 처리한다. 판정 사용량을 성공·잘못된 모델 출력 모두 기록하고, `StageResult.data.questions`에 렌더된 질문(noul 질문·기준, choice 옵션 라벨, score 단계 문구)을 저장한다.
- **Client B — `dbdd703856`:** C1 결과·실패 조건 라벨은 저장된 질문만 사용하고 구기록은 id·숫자로 표시한다. 실행 카드의 현재 정의 조회를 제거했다. C2 시험 실행은 제출한 정의 사본을 결과와 보관하여 draft 변경 후에도 꺼진 게이트 안내와 결과가 바뀌지 않는다. C3 공유 `JudgeValidationError.code`를 ko·en·zh 문구에 매핑하고 빈 옵션 문구·깨진 조건·범위 밖 기준값·중복 질문 ID를 검증한다. 기존 throw 메시지는 유지한다. C4 저장 실패 Notice에 닫기 동작을 추가하고 draft는 유지한다.
- **회귀 증거:** C1 기록 라벨 누락, C2 draft 변경 후 꺼짐 안내 소실, C3 빈 옵션 검증 안내 누락, C4 닫기 버튼 부재를 각각 red로 확인한 뒤 수정했다. ko·zh 영문 validator 원문 비노출과 중복 ID 문구도 검증했다. B 커밋 전 typecheck, Studio 전체 테스트 **411개 × 2회 연속**, `git diff --check` 통과. [1회 로그](</tmp/pixie-gate-review-fix/client-test-1.txt>), [2회 로그](</tmp/pixie-gate-review-fix/client-test-2.txt>).
- **문서 정렬:** Studio 작업 지침의 삭제된 역할 UI 스냅샷 재생성 문구를 디자인 시스템의 공용 부품 테스트·새 기능 UI 스냅샷 규칙으로 맞췄다. #24 명세 및 S1 표는 변경하지 않았다.
- **S9 본체 표시 제한:** 실제 `turn/end.reason.kind=blocked`인데 Chat이 Completed 계열로 표시하는 것은 DSH [TurnProcessNodeView.tsx:20–32](../../../packages/client/ui-chat/src/client/chat/TurnProcessNodeView.tsx#L20-L32)가 aborted/error 이외의 blocked도 완료 계열로 표시하기 때문이다. Studio reject는 정상이며 **Pixie 게이트 카드로 확인**한다. 본체 수정 범위가 아니므로 변경하지 않는다.
- **남은 검증:** 모델이 필요한 R2/R3/tool 전후/판정 실제 호출, alpha.2 replace/append/sandbox/재시작/무시 및 모델 필요 흐름. 이번 수정의 사용자 GUI(19387)·프로필 접근·배포·Client Inspect는 수행하지 않았고 로컬 테스트를 독립 배포 검증으로 간주하지 않는다.

### S9 — 독립 설치 검증

- 선행: S1–S8.
- 책임: 수정하지 않은 지정 DSH 버전 격리 프로필에서 R1–R3 흐름 확인. 버전·경로·명령·결과 기록.

#### S9 실행 기록 — 2026-10-16

**현재 진행: 부분 검증, 전체 완료 아님.** rc.2 독립 설치의 명령 기반 R1·샌드박스·저장 수명을 확인했다. alpha.2도 별도 npm 설치 및 실제 Loader/R1 거부까지 확인했다. R2/R3/tool 전후/판정의 모델 응답 종단간은 미검증이다. S1 표 및 S4–S8의 과거 기록은 변경하지 않는다. 코드 결함 수정·본체 수정·사용자 GUI(19387)/desktop 프로필 접근·배포·Client Inspect·키 값 열람·하위 위임은 하지 않았다.

| 항목 | 버전·경로·명령·결과 |
|---|---|
| 기준 | `studio/feat/workflow`, 시작 HEAD `53c882b69e1eb1ebafcee96e515d90f9bd05aace`, 시작 `git status --short` 빈 출력 |
| rc.2 | `dsh --version` 및 앱 Info.plist `CFBundleShortVersionString` 모두 `0.2.0-rc.2`. `/usr/local/bin/dsh` → `/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh`. 앱/코어 수정·재빌드 없음 |
| alpha.2 | `npm view @deepseek-ai/dsh@0.2.1-alpha.2 version` 확인 후 `npm install --prefix /tmp/pixie-gate-s9-alpha2 @deepseek-ai/dsh@0.2.1-alpha.2`; `/tmp/pixie-gate-s9-alpha2/node_modules/.bin/dsh --version` → `0.2.1-alpha.2` |
| Studio 패키지 | `npm --prefix studio run build`(타입 검사 포함) 통과; `STUDIO_PACK_DIST=/tmp/pixie-gate-s9-rc2/pack node studio/pack.mjs`. [tarball](</tmp/pixie-gate-s9-rc2/pack/matamt-dbg-dsh-studio-0.2.9.tgz>) `0.2.9`, SHA256 `a25e3612fe84f4790efa3270108a2ff4b5126d489cf176cead1cab024059c80d`. pack의 삭제 대상 staging은 새 격리 경로 `/tmp/pixie-gate-s9-rc2/pack/package`로 한정 |
| 설치 명령 | 각 버전의 실행 파일로 `DSH_HOME=<격리 root>/home <dsh> --profile lean-agent-web --from-default-profile web --dump-config`, 이어 `DSH_HOME=<격리 root>/home <dsh> plugin --profile lean-agent-web add /tmp/pixie-gate-s9-rc2/pack/matamt-dbg-dsh-studio-0.2.9.tgz`. 둘 다 exit 0. peer 경고는 있었으나 Loader 및 Studio UI가 실제 동작 |
| 실행 명령 | `DSH_HOME=/tmp/pixie-gate-s9-rc2/home dsh --profile lean-agent-web --host 127.0.0.1 --port 19391 --no-open`; alpha는 home 및 실행 파일을 위 alpha 경로로, 포트 19392. 둘 다 관리형 job. workspace 코어/개발 scaffold를 실행하지 않음 |
| dev.mjs와 차이 | #25의 default dev 경로는 build/test → start-web → tarball install → 설치 dsh 실행이다. 실제 구현은 tarball을 설치하지만 주석에는 preview가 tarball install test가 아니라고도 적혀 있다. start-web은 DSH_HOME을 `studio/.dsh-home`으로 강제한다. 이번에는 기존 격리 데이터 재사용 없이 같은 pack/plugin add 절차를 명시 실행하여 `/tmp`의 새 DSH_HOME을 사용했다. OS HOME까지 바꾸지는 않았으며 default workspace는 `/Users/home/Documents/deepseek-harness/default-workspace`였다(명령은 그곳에 쓰지 않음) |
| 브라우저/증거 | 임시 Chrome `--headless=new --remote-debugging-port=19402 --user-data-dir=/tmp/pixie-gate-s9-rc2/chrome`, 기존 S7 방식의 절대 playwright-core 경로 사용. 라이트 1440×1000 [스크린샷 INDEX](</tmp/pixie-gate-s9-shots/INDEX.md>) 및 [자동화](</tmp/pixie-gate-s9-shots/action.cjs>). 비동기 초기 빈 목록은 최종 결과와 구분 |

| 흐름 | 결과 | 관찰·근거 |
|---|---|---|
| rc.2 Loader·UI 저장/연결/활성 | **통과** | Studio v0.2.9 → Pixie → 게이트 추가, command/check, Optimized 체크, 켜짐, 저장. 이후 모든 정의 변경도 UI에서 실행. 정의 직접 주입 없음 |
| R1 입력 거부 | **통과** | `printf '양식 누락\\n' >&2; exit 2`, 원문 `S9 원문 양식 없는 요청`. 세션 `056bc08e-2e8e-462f-867b-2102b860195c`의 실제 로그 `turn/end.reason.kind=blocked`, `user/message` 및 모델 실행 이벤트 없음. 실제 run `rejected/fail`, 원문·이유·pending 보존. UI 카드 `거부 처리 대기` 확인 |
| 수정해서 보내기 / 무시 | **통과** | 클릭 뒤 composer 초안이 원문과 일치(자동 전송 아님). 무시 뒤 dismissed 저장·pending 해소. 스크린샷 06–08. `보냈음 표시` 별도 클릭은 미검증 |
| R1 replace | **통과(게이트) / 실패(모델)** | command/revise `printf 'S9 REPLACED'`, forward replace/subject. 세션 `0fd98497-af11-470c-b29a-acc8ca71019e`의 source user `user/message`가 `S9 REPLACED`; run은 원문과 replaced 보존. 모델은 `MISSING_CREDENTIAL` 실패이며 모델 응답 성공으로 보지 않음 |
| R1 append | **통과(게이트) / 실패(모델)** | command/revise `printf 'S9 APPENDED'`, forward append/stage1. 세션 `0e33ecea-74cc-4572-a1b0-a27d0c34bee0`의 source user는 `S9 append original`, 별도 source `studio-pixie-gate`의 `user/message`는 `S9 APPENDED`. 모델은 같은 키 없음 오류 |
| 명령 샌드박스 | **통과(쓰기 거부)** | UI에서 세션 Read Only 선택, command/check `printf test > /tmp/pixie-gate-s9-rc2/readonly-probe.txt`. 세션 `7930f6c0-9973-4183-a0e8-144bf837817a`의 stage error `exit 1 … Operation not permitted`, 파일 미생성. onError pass로 원문 전달, 카드에 판정 오류와 적용 통과를 구분. 정책 객체 전 필드 계측 및 허용 대조 실행은 미검증 |
| 모델 경로 | **실패 / 테스트 모델 없음 확인 범위 제한** | rc.2 실제 호출 `llm-deepseek: no API key … MISSING_CREDENTIAL`. 키 값/환경/자격 증명 파일 미열람. Host Inspect `Service/listService(sessionController)`로 modelCatalog 공개 계약만 확인(현재 Host 계약이지 격리 catalog 결과 아님). 격리 GUI model catalog에는 DeepSeek-V41-Flash/V4-Pro만 보임; testLLM 없음. 숨은 설치 모듈 전체 탐색이나 가짜 provider 추가는 하지 않음 |
| R2 agent-message, R3 turn-end, tool-before/after | **미검증** | 이용 가능한 테스트 모델 경로를 발견하지 못했고 실 모델은 키 없음. relay/steer 상한/도구 call ID의 실제 모델 종단간, 브리지 활성 순서와 장기 pre-step UI도 이번 증거에 포함하지 않음 |
| 판정 단계 | **미검증** | 같은 모델 제약. S8 단위/합성 결과로 실제 판정 응답을 대신하지 않음 |
| rc.2 재시작·prune | **통과(정의·완료 기록)** | 서버 종료/재시작 뒤 새 경로 `<profile>/studio-data/pixie-gate/definitions.json` 및 실제 run 4건 유지. 별도 빈 고아 envelope `pixie/session-s9-orphan.json`만 추가하고 다시 시작: startup prune이 고아를 삭제, 정의와 실제 4건은 유지. 합성 고아는 prune 실행 확인용이며 게이트 흐름 증거가 아님. running→cancelled 재시작은 미검증 |
| alpha.2 독립 설치 | **통과(제한된 흐름)** | 별도 npm 런타임 + 같은 tarball, UI 정의 `S9 alpha reject` → Optimized → 입력. 세션 `3e514d35-b25b-4d4c-a288-779f21a31009` blocked, user/message 없음; pending·원문·이유 및 수정해서 보내기 초안 복구 확인(17–19). replace/append/sandbox/재시작/무시/모델 필요 흐름은 alpha에서 미검증 |

**관찰된 표시 불일치(수정하지 않음):** 두 설치 버전에서 위 R1 거부를 재현하면 raw 로그는 `blocked`인데 메인 대화 상태는 `Completed`/`Completed in 1s`로 표시되고 원문 대화 행은 남지 않는다. Studio Pixie 카드에서는 거부·원문·이유를 정상 확인할 수 있다. 재현: command/check exit 2 게이트를 Optimized에 활성 연결 → Optimized 새 세션에서 메시지 전송 → Chat 상태와 Pixie pending 카드를 대조(스크린샷 03/06, alpha 18). DSH 상태 라벨의 의미/의도는 확정하지 않았으며 Studio 입력 거부 동작 실패로 바꾸어 기록하지 않는다. 코드 변경 없음. 설치 peer 경고 및 Node deprecation도 남아 있다.

**증거·정리:** rc.2 데이터는 `/tmp/pixie-gate-s9-rc2/home`, alpha는 `/tmp/pixie-gate-s9-alpha2/home`; profile은 각각 `profiles/lean-agent-web`. 실제 run은 `<profile>/studio-data/pixie/gates/session-<위 ID>.json`. `zstd -dc`로 추출한 rc.2 [거부 로그](</tmp/pixie-gate-s9-rc2/session-056bc08e-2e8e-462f-867b-2102b860195c.jsonl>), [교체 로그](</tmp/pixie-gate-s9-rc2/session-0fd98497-af11-470c-b29a-acc8ca71019e.jsonl>), [덧붙임 로그](</tmp/pixie-gate-s9-rc2/session-0e33ecea-74cc-4572-a1b0-a27d0c34bee0.jsonl>), [sandbox 로그](</tmp/pixie-gate-s9-rc2/session-7930f6c0-9973-4183-a0e8-144bf837817a.jsonl>)를 보존했다. 모든 시작 job(서버 743/776/793/797, Chrome 744)은 종료 결과를 수집했다. `lsof -nP -iTCP:19391 -iTCP:19392 -iTCP:19402 -sTCP:LISTEN`에 listener 없음. 패키지·격리 데이터·스크린샷은 재현용으로 보존한다. 이번에는 Studio 빌드/타입 검사와 독립 실행만 수행했고 전체 단위 테스트를 재실행하지 않았다.

## 범위 밖 (후속)

- `JevJudgeEngine`(HTTP)과 자격 증명.
- Claude Code·Codex `hooks.json` 스크립트를 수정 없이 실행하는 호환 모드(필드 이름 변환).
- 게이트 결과를 바꿀 수 있는 waterfall 이벤트(다른 플러그인이 게이트 결과 개입).
- 조건부 건너뛰기, 단계 수 상한(5개) 상향.
- R4의 사전 인덱스 제공자(백그라운드 인덱싱, 변경 추적, 인덱스 검수 단계).
- R5 선압축(백그라운드 사전 요약, 범위 일치 확인, `llm/stream` short-circuit).
- 병렬 단계 그룹·분기 그래프, 같은 지점 게이트 여러 개의 순서 지정.
- 코드 확장 API(다른 플러그인이 단계 종류·게이트를 등록).
