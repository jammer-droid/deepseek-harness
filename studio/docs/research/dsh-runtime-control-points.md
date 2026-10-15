# DSH 런타임 개입 지점 조사

기준 소스: `6392f1988d61fb3151377e226bdaf4ff26353c93` checkout. 이 문서는 Studio 구현이 아니라 공개 계약과 브리지 구현을 읽은 조사 기록이다.

## 결론

**DSH 네이티브 플러그인은 입력 검사, 실행 전 승인, 실행 결과 검사, 턴 종료 검사, 실행 중 steer/inject/cancel의 다섯 지점을 모두 제공한다.** 다만 각 지점의 권한과 적용 시점은 다르다. 특히 실행 전 인자 재작성, 이미 표시된 답변의 회수, 외부 에이전트 내부 실행 전체의 통제를 의미하지 않는다.

**command hook은 이 확장점에 연결한 제한된 어댑터다.** Claude Code·Codex 호환 명령이 네이티브 플러그인과 같은 제어면을 모두 받는 것은 아니다. 아래 비교는 외부 제품 일반의 기능이 아니라 **이 checkout의 DSH 브리지**가 실제로 변환하는 결정에 관한 것이다.

## 다섯 핵심 지점 비교

| 목적 | 네이티브 플러그인 | Claude Code command 브리지 | Codex command 브리지 |
|---|---|---|---|
| 입력 검사: `agent/pre-step` | `reject` 또는 `enter`와 교체한 메시지 배열 반환. `next()`로 위임 | `UserPromptSubmit`: 거부 또는 컨텍스트 추가. 임의의 원문 교체 계약은 없음 | 거부 또는 컨텍스트 추가. rewrite/ask 없음 |
| 실행 전 승인: `tools/pre-execute` | `allow` / `deny` / `cancel` / `ask`. 승인 서비스가 없으면 ask는 거부 | `PreToolUse`: deny/ask를 매핑하고 나머지는 다음 정책에 위임. 인자 rewrite 없음 | deny만 매핑. allow/ask를 승인 결정으로 존중하지 않으며 rewrite도 없음 |
| 결과 검사: `tools/post-execute` | accept, content 또는 value 교체, 추가 컨텍스트, block | `PostToolUse`: block 또는 컨텍스트 추가. 임의의 결과 교체 인터페이스는 없음 | block 또는 컨텍스트 추가. 임의의 결과 교체 인터페이스는 없음 |
| 완료 검사: `agent/turn-stopping` | awaited listener가 `agent.steer()`로 같은 턴의 다음 step을 요청 | `Stop` deny → `agent.steer()` | `Stop` deny → `agent.steer()` |
| 실행 중 제어 | 살아 있는 Agent의 `steer` / `inject` / `cancel` 및 `followup`, Inbox API | 이벤트 콜백의 제한된 응답 변환만 제공. 임의 시점 제어 API와 동등하지 않음 | 동일한 제한. 위의 다섯 native 제어를 모두 노출하는 것은 아님 |

근거: [Agent 입력·종료 계약](<../../../packages/core/agent/src/runtime-types.ts#L308-L381>), [Agent 제어 메서드](<../../../packages/core/agent/src/runtime-types.ts#L176-L241>), [도구 결정 타입](<../../../packages/core/tools/src/index.ts#L600-L621>), [Claude 브리지 매핑](<../../../packages/experimental/hooks-claude-code/src/index.ts#L222-L283>), [Codex 브리지 매핑](<../../../packages/experimental/hooks-codex/src/index.ts#L201-L273>).

Codex 소스 머리말의 “five points”는 `SessionStart`, prompt pre, tool pre/post, `Stop`을 세는 표현이다. 이 문서의 다섯 핵심 제어 범주와 같은 목록이 아니며, 특히 arbitrary-time runtime control을 뜻하지 않는다. Codex 브리지는 regex matcher만 지원하고 hook 환경·command substitution·pre-tool approval/rewrite를 제공하지 않는다고 명시한다. [Codex 범위 선언](<../../../packages/experimental/hooks-codex/src/index.ts#L1-L8>)

## 이벤트 이름보다 dispatch mode가 중요하다

- **emit**: 관찰 알림이다. 반환값으로 허용/거부를 판정하는 계약이 아니다. `agent/status`, `agent/assistant-stream`, `subagent/start`, `subagent/end` 등이 이에 해당한다. 별도의 서비스 호출로 상태를 바꿀 수 있다는 것과 이벤트 자체가 veto 지점이라는 것은 다르다. [Agent 알림](<../../../packages/core/agent/src/runtime-types.ts#L271-L307>), [스트림 알림](<../../../packages/core/agent/src/runtime-types.ts#L354-L363>), [subagent 알림](<../../../packages/subagent/subagent/src/index.ts#L149-L166>)
- **waterfall**: `next()`로 다음 리스너/기본 동작에 위임하거나, 계약에 맞는 결정을 직접 반환하는 협력적 체인이다. `pre-step`, `request`, `request-error`, 도구 pre/execute/post가 해당한다. 단순한 브로드캐스트도, 모든 플러그인의 거부를 자동 합산하는 투표도 아니다. command 브리지도 컨텍스트만 있을 때는 `next()`를 호출하여 뒤 정책의 reject/block/replace를 보존한다. [Agent waterfall](<../../../packages/core/agent/src/runtime-types.ts#L308-L353>), [도구 waterfall](<../../../packages/core/tools/src/index.ts#L143-L177>), [Claude 위임](<../../../packages/experimental/hooks-claude-code/src/index.ts#L232-L270>)
- **serial**: 리스너를 순서대로 기다리는 경계다. `agent/created`와 `agent/turn-stopping`이 해당한다. 특히 종료에서는 반환한 boolean이 아니라 리스너 처리 후 Inbox에 남은 입력이 계속 실행할지를 결정한다. [생성 경계](<../../../packages/core/agent/src/runtime-types.ts#L248-L261>), [종료 경계](<../../../packages/core/agent/src/runtime-types.ts#L364-L381>)

## 1. 입력과 런타임 제어

`agent/pre-step`은 제안된 step에 들어갈 메시지를 거부하거나 교체하는 지점이다. UI 입력창의 문자열만 다루는 이벤트로 축소해서는 안 된다. payload는 해당 step을 위해 Inbox에서 꺼낸 메시지들이다. command 브리지는 이를 텍스트 prompt로 변환하지만, 응답을 원문 대체로 매핑하지 않고 승인된 downstream 메시지 뒤에 컨텍스트를 추가한다. [pre-step 계약](<../../../packages/core/agent/src/runtime-types.ts#L309-L320>), [Claude 입력 매핑](<../../../packages/experimental/hooks-claude-code/src/index.ts#L222-L240>), [Codex 입력 매핑](<../../../packages/experimental/hooks-codex/src/index.ts#L201-L225>)

실행 중 메서드의 의미는 다음처럼 구별한다.

| API | 적용 시점과 의미 |
|---|---|
| `steer(message)` | 실행 중이면 가장 가까운 다음 step 경계에 반영. idle이면 턴을 시작한다. 현재 진행 중인 모델 요청을 소급 수정하지 않는다. |
| `inject(message)` | 다음 pre-step에 넣을 컨텍스트를 대기시킨다. idle driver를 깨우지 않으며 이미 batch를 가져간 요청에는 늦을 수 있다. |
| `followup(message)` | 별도의 일반 후속 턴을 대기시키고 driver를 깨운다. |
| `cancel(cause, options)` | 현재 턴/턴 사이 작업을 abort한다. 기본적으로 대기 입력도 지우며 `keepInbox`로 보존 가능. 활성 작업이 없으면 이후 작업을 취소하도록 예약하지 않는다. |
| `inbox` | `nextTurn`/`nextStep`을 관찰하고 append/prepend/replace/remove/splice/clear로 아직 대기 중인 입력을 조작한다. 이미 소비한 메시지의 임의 수정 API가 아니다. |

근거: [Inbox](<../../../packages/core/agent/src/runtime-types.ts#L37-L100>), [cancel·whenIdle](<../../../packages/core/agent/src/runtime-types.ts#L176-L191>), [send·followup·steer·inject](<../../../packages/core/agent/src/runtime-types.ts#L204-L241>). 따라서 command 프로세스가 이벤트 응답을 돌려주는 것과, 네이티브 플러그인이 적절한 Agent 참조로 외부 신호에 반응하는 것은 별도 능력이다.

## 2. 도구 실행 승인과 결과 검사

`tools/pre-execute`는 실행 전 정책 경계다. **네이티브에서도 인자 rewrite는 제외**된다. 인자가 이미 기록되고 제시된 상태이기 때문이다. `ask`는 승인 서비스가 `allowed-once`를 반환해야 실행한다. 따라서 “플러그인이 다섯 지점을 지원”한다는 결론을 “모든 단계의 모든 데이터를 마음대로 바꾼다”로 확대하면 안 된다. [PreToolDecision](<../../../packages/core/tools/src/index.ts#L600-L612>)

`tools/execute`는 dispatch 주변의 waterfall로 timeout/retry/metrics 등을 감싼다. call identity는 불변이고 wrapper가 변경할 수 있는 실행 입력은 `signal`뿐이며 원래 caller cancellation은 다시 결합된다. [execute 계약](<../../../packages/core/tools/src/index.ts#L155-L165>)

`tools/post-execute`는 정규화된 결과를 accept/replace/enrich/block한다. 던져진 도구 오류도 정규화되어 이 경로에 들어온다. 교체는 content 또는 value 중 하나이며, block은 피드백을 오류 결과로 만든다. **이미 실행된 파일 쓰기·네트워크 호출의 부작용을 되돌리는 트랜잭션은 아니다.** [post-execute 계약](<../../../packages/core/tools/src/index.ts#L166-L177>), [결정 타입](<../../../packages/core/tools/src/index.ts#L614-L621>)

### 도구 경로와 직접 서비스 호출의 차이

`send_message`와 `interrupt_agent`는 각각 `ctx.subagents.sendMessage()`와 `ctx.subagents.interrupt()`를 호출하는 얇은 도구 어댑터다. 모델이 이 도구를 실행하면 도구 정책 경계에서 판단할 수 있지만, 플러그인이 서비스를 직접 호출하는 것은 이 도구 어댑터를 경유하지 않는다. 따라서 도구 hook만으로 모든 서비스 호출을 통제한다고 주장할 수 없다. 권한 검사는 서비스 책임이며, 도구가 추가 권한을 주지는 않는다. [어댑터 역할](<../../../packages/subagent/tool-subagent-control/src/index.ts#L1-L8>), [send_message 실행](<../../../packages/subagent/tool-subagent-control/src/index.ts#L58-L70>), [interrupt 실행과 권한](<../../../packages/subagent/tool-subagent-control/src/index.ts#L74-L108>)

## 3. 완료 검사와 최종 답변 표시의 경계

`agent/turn-stopping`은 **턴을 닫기 직전의 계속 실행 여부 검사**다. 응답을 표시하기 직전 원문을 가로채는 moderation 이벤트가 아니다. assistant stream은 별도 emit 채널로 공개되며, 종료 listener는 새 steering을 넣어 추가 step을 유도한다. 이미 스트리밍/기록된 답변을 숨기거나 교체한다는 보장은 없다. “사용자에게 부적합한 답변을 단 한 토큰도 보여주지 않기”가 요구라면 출력 버퍼링·표시 정책을 별도로 설계하고 검증해야 한다. [assistant stream](<../../../packages/core/agent/src/runtime-types.ts#L354-L363>), [turn-stopping](<../../../packages/core/agent/src/runtime-types.ts#L364-L381>)

command `Stop`의 deny는 취소가 아니라 **계속하라는 steering**으로 바뀐다. 검사에 쓸 최종 답변 본문도 자동 제공된다고 가정할 수 없다. Claude `Stop` payload는 공통 필드와 `stop_hook_active: false`이며 `transcript_path`도 빈 문자열이다. Codex는 `last_assistant_message: null`을 보낸다. [Claude 공통 payload](<../../../packages/experimental/hooks-claude-code/src/index.ts#L329-L336>), [Claude Stop payload](<../../../packages/experimental/hooks-claude-code/src/index.ts#L351-L353>), [Codex Stop](<../../../packages/experimental/hooks-codex/src/index.ts#L258-L272>)

**무한 계속 실행 주의:** 두 브리지 모두 `stop_hook_active`를 항상 false로 보내며 연속 강제 continuation 제한은 TODO다. 무조건 거부하는 Stop hook은 계속 step을 만들 수 있으므로 hook 자체에서 횟수·조건을 제한해야 한다. [Claude loop guard TODO](<../../../packages/experimental/hooks-claude-code/src/index.ts#L273-L283>), [Codex loop guard TODO](<../../../packages/experimental/hooks-codex/src/index.ts#L258-L272>)

## 4. subagent와 외부 실행 경계

`subagent/start`와 `subagent/end`는 emit 관찰 이벤트이지 생성 승인·종료 veto 이벤트가 아니다. in-process child는 start 알림에서 Agent 조회가 가능하지만 이를 모든 provider에 일반화할 수 없다. Claude `SubagentStart` command는 비동기 작업에서 child를 찾은 경우 컨텍스트를 inject할 수 있고, `SubagentStop`은 관찰만 한다. 시작 hook 완료까지 child 실행을 막는 승인 장벽이 아니다. [subagent 이벤트 계약](<../../../packages/subagent/subagent/src/index.ts#L149-L166>), [Claude detached 처리](<../../../packages/experimental/hooks-claude-code/src/index.ts#L285-L302>)

외부 Claude/Codex 실행 내부의 매 step·도구 호출이 DSH 네이티브 이벤트를 모두 통과한다고 추론해서는 안 된다. 이 문서의 command 브리지는 DSH interception point에 호환 명령을 연결하는 것이지 외부 프로세스 내부 전체를 자동 계측하는 장치가 아니다. 외부 provider의 프로토콜·취소·결과 경계는 별도로 확인해야 한다. 실제 control tool 설명도 local direct child의 후속 대화와 달리 외부 실행은 interrupt 뒤 영구 종료되며 follow-up을 받을 수 없다고 구별한다. [Codex 브리지의 대상](<../../../packages/experimental/hooks-codex/src/index.ts#L1-L8>), [외부 실행 interrupt 제한](<../../../packages/subagent/tool-subagent-control/src/index.ts#L74-L85>)

## 추가 네이티브 확장점

- `agent/request`: frozen call configuration 교체. 모델·provider 등의 요청 설정 경계이며 메시지 변조 경로가 아니다. `agent/request-error`: 복구를 맡는 리스너가 `retry`를 반환하거나 위임하며 기본 undefined는 terminal failure다. [요청·오류 계약](<../../../packages/core/agent/src/runtime-types.ts#L321-L353>)
- `system-prompt/assemble`: sections/contexts/tools/variables에 대한 expert waterfall. 반환 assembly가 기준이지만 complete section은 후처리에서 복원되므로 해당 system prompt를 임의 대체할 수 없다. [assembly 계약](<../../../packages/core/system-prompt/src/index.ts#L18-L31>)
- `llm/stream`: adapter stream을 감싸거나 직접 chunk를 제공하는 waterfall. AgentLoop가 만든 요청은 로그에서 재구성 가능해야 하므로 deep-frozen이며 여기서 입력 내용을 rewrite하지 않는다. 입력 변경은 위의 기록 가능한 경계와 구별해야 한다. [stream 계약](<../../../packages/llm/llm/src/index.ts#L62-L75>)

## 근거 수준과 검증 한계

1. 이 조사에서는 소스와 테스트 코드를 읽었다. **테스트·빌드·hook 명령은 실행하지 않았다.** 회귀 테스트에는 turn-stopping listener의 steer가 두 번째 모델 요청을 만드는 사례와 post-execute의 content 교체에도 원래 tool call ID를 유지하는 사례가 있다. 테스트의 존재와 기대 assertion을 확인한 것이지 이번 환경에서 통과를 확인한 것은 아니다. [steer 회귀 테스트](<../../../packages/core/agent-loop/tests/contract-regressions.spec.ts#L319-L341>), [결과 교체 회귀 테스트](<../../../packages/core/agent-loop/tests/contract-regressions.spec.ts#L1239-L1279>)
2. 이전 세션의 Host Inspect Event catalog에서는 여기 언급한 핵심 이벤트 이름과 mode를 확인했다. 이는 이전 조사에서 전달된 관찰이며, 이번 문서 작성 중 재조회한 결과는 아니다. 이벤트 등록 사실은 command 브리지 활성화나 특정 정책 적용의 증거가 아니다.
3. **실행 중인 설치 런타임이 이 checkout과 정확히 같은 소스인지 확인하지 않았다.** Claude/Codex 브리지 설치·활성화, 설정 파일 로딩, hook 프로세스 실행, 실제 승인 서비스 연결도 확인하지 않았다.
4. Studio 플러그인 구현·설치·독립 배포 검증을 수행하지 않았다. 적용 시에는 대상 런타임 버전과 공개 API를 재확인하고, 각 경계의 실제 dispatch·취소·오류·중복 continuation을 좁은 통합 시나리오로 검증해야 한다.
