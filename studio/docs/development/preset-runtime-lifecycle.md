# DSH preset 런타임 수명 조사

## 결론

**활성 preset 정의는 등록할 때 플러그인 트리를 미리 활성화한다. Agent를 호출할 때마다 preset 플러그인을 새로 초기화하는 구조가 아니다.** 시작 시 프로필의 preset 선언 플러그인이 활성화되면 그때 등록·활성화가 일어난다. 나중에 정의를 등록하면 그 등록 시점에 같은 과정이 일어난다. 따라서 “시작 때 이미 로드되고 Agent에는 선택해서 적용되는가?”라는 질문에는 **등록된 정상 preset에 대해서는 그렇다. 다만 적용은 이미 존재하는 revision의 scope에 Agent를 연결하는 것**이라고 답해야 한다.

이는 이 checkout의 소스에 대한 결론이다. 설치 실행 파일의 `0.2.0-rc.2` 버전 확인은 상위 작업에서 전달받았으나, 설치 아티팩트와 이 checkout의 구현 일치 여부는 이 조사에서 검증하지 않았다. 실행 중인 모든 preset의 성공적 활성화를 관측했다는 뜻도 아니다.

## 1. 등록과 실제 활성화

- 선언 플러그인의 `Service.init`가 `agentPresets.register(config)`를 호출하고 반환 disposer를 yield한다. 단순 메타데이터 저장만 하는 선언이 아니다. [선언 플러그인:25–29](../../../packages/preset/agent-preset/src/index.ts#L25-L29)
- `register`는 정의를 저장하고 즉시 `activate(record)`를 호출해 기다린다. `activate`는 registry 소유 scope를 만들고 `mountPreset`을 호출해 `{ scope, key, mount, users: 0, retired: false }` generation을 보관한다. [register/activate:77–121](../../../packages/preset/agent-preset-registry/src/index.ts#L77-L121)
- `mountPreset`은 실제 Loader `EntryTree`를 만들고 `tree.root.update(...)`한 뒤 row 활성화 상태를 audit한다. scope teardown에는 `tree.root.stop()`을 연결한다. 따라서 여기서 말하는 로드는 **패키지 모듈을 import할 수 있게 준비하는 것만이 아니라 preset별 플러그인 트리를 생성·활성화하는 것**이다. [mountPreset:191–215](../../../packages/preset/agent-preset-registry/src/mount.ts#L191-L215)
- 단, disabled/호환성 정책으로 비활성화된 row는 실행 대상이 아니며, Host 서비스 의존성이 아직 없으면 row는 대기할 수 있다. import/활성화 실패와 서비스 누출도 진단 대상이다. 모든 선언의 모든 플러그인이 무조건 초기화에 성공한다고 일반화하면 안 된다. [활성화 조건:191–213](../../../packages/preset/agent-preset-registry/src/mount.ts#L191-L213), [Host settlement 재진단:124–145](../../../packages/preset/agent-preset-registry/src/index.ts#L124-L145)

### import와 인스턴스의 구분

패키지가 설치되어 있거나 모듈이 import되었다는 사실만으로 특정 preset의 플러그인이 초기화되었다고 할 수 없다. 이 구현에서 중요한 증거는 **각 preset 등록에서 별도 scope와 Loader 트리를 만들고 실제 row를 활성화한다는 점**이다. 같은 패키지 코드를 사용하는 여러 preset이 있어도 이를 하나의 전역 플러그인 인스턴스라고 취급하면 안 된다. 반대로 같은 preset revision을 쓰는 여러 Agent는 이미 만들어진 standing composition을 공유한다. [generation 생성:103–116](../../../packages/preset/agent-preset-registry/src/index.ts#L103-L116), [공유 mount 계약:26–35](../../../packages/preset/agent-preset-registry/src/mount.ts#L26-L35)

## 2. acquireScope는 새 mount가 아니라 기존 revision lease

`acquireScope(id)`는 `retain(id)`를 호출하고 **기존 generation.key**를 반환한다. async disposer는 users를 감소시키고 collect를 호출한다. 이 함수 안에는 `createScope`, `mountPreset`, plugin import가 없다. 읽기 전용 카탈로그 조회를 위해 새 Agent를 만들 필요도 없다. [acquireScope:364–376](../../../packages/preset/agent-preset-registry/src/index.ts#L364-L376)

따라서 올바른 조회 패턴은 다음과 같다.

```ts
await using lease = await ctx.agentPresets.acquireScope(presetId)
const schemas = ctx.tools.schemas(lease.key)
```

이 패턴을 “조회 때 임시로 preset 플러그인을 로드하고 조회 후 내려준다”라고 설명하면 틀리다. **이미 활성화된 revision에 대한 사용권을 확보하고 반환한다.**

## 3. Agent 생성·연결·해제

1. Agent machine은 자체 scope를 만든다. [Agent scope 생성:122–135](../../../packages/core/agent-loop/src/agent.ts#L122-L135)
2. 세션 컨트롤러가 Agent setup callback에서 `presets.mount(agentCtx, resolvedId)`를 호출한다. [setup:385–395](../../../packages/api/session-controller/src/agent.ts#L385-L395)
3. 이름은 `mount`지만 registry의 이 메서드는 기존 generation을 retain하고 Agent scope를 bind한다. `join`은 `bindScopeParent(key, generation.key)`로 Agent scope의 부모를 preset revision으로 지정하고 users를 증가시킨다. **preset Loader 트리를 Agent별로 다시 만드는 호출이 아니다.** [join/mount:265–289](../../../packages/preset/agent-preset-registry/src/index.ts#L265-L289)
4. Agent scope 해제 시 binding effect가 users를 감소시키고 collect한다. Agent loop의 정리 경로는 machine scope를 dispose한다. [binding disposer:269–273](../../../packages/preset/agent-preset-registry/src/index.ts#L269-L273), [machine 정리:545–575](../../../packages/core/agent-loop/src/index.ts#L545-L575)
5. `collect`는 **retired이고 users가 0인 경우에만** generation scope를 dispose한다. 정의가 현재 등록 상태라면 마지막 Agent/lease가 사라져도 preset composition은 유지된다. 정의 unregister는 retired로 표시하고 collect하므로, 이미 사용하는 Agent가 있으면 그 revision은 즉시 파괴되지 않는다. [unregister:88–100](../../../packages/preset/agent-preset-registry/src/index.ts#L88-L100), [collect:148–152](../../../packages/preset/agent-preset-registry/src/index.ts#L148-L152)

## 4. root tools.schemas()에 안 보이는 이유

**시작 타이밍과 scope 가시성은 별개다.** preset 플러그인이 이미 초기화되고 도구를 등록했어도 root 전역 조회에 preset 도구가 보이는 것은 아니다.

`tools.schemas(scope?)`는 지정 scope의 visible definitions를 투영하며, 인자를 생략하면 global view다. [schemas 계약 및 구현:1260–1267](../../../packages/core/tools/src/index.ts#L1260-L1267)

registry 테스트도 preset을 등록한 상태에서 root `tools.schemas()`가 비어 있고 preset/Agent scope에서는 도구가 보이는 동작을 명시한다. 이는 “아직 Agent를 호출하지 않아서 도구가 로드되지 않았다”가 아니라 **도구가 등록된 scope와 조회 scope가 다르다**는 근거다. [scope 격리 테스트:17–35](../../../packages/preset/agent-preset-registry/tests/registry.spec.ts#L17-L35)

| 조회 | 의미 |
| --- | --- |
| `ctx.tools.schemas()` | 전역 view. 모든 preset 도구를 합친 전체 설치 목록이 아니다. |
| `ctx.tools.schemas(lease.key)` | retain한 특정 preset revision에서 보이는 도구 스키마. |
| Agent scope를 지정한 조회 | Agent와 연결된 preset revision 및 해당 scope에서 보이는 도구. |

따라서 root 도구 목록만 수집한 뒤 프런트엔드에 preset별 도구를 보여 주려는 설계는 누락을 일으킬 수 있다. 기다리거나 Agent를 한번 실행하는 것은 scope 누락의 해결책이 아니다. preset별 scope lease를 이용한 조회가 적절하다. 단, 이 목록은 그 scope에서 **보이는** 도구 목록이지 특정 패키지만의 배타적 기여분을 추출하는 API는 아니다.

## 검증 범위

- 읽기 전용으로 checkout의 구현과 기존 테스트 소스를 추적했다. 이 문서만 새로 작성했다.
- 코어·기존 사용자 변경·프로필은 수정하지 않았고 서버·테스트·빌드도 실행하지 않았다.
- 기존 테스트는 근거로 읽었을 뿐 이번 조사에서 실행 통과를 주장하지 않는다.
- 설치 rc.2 아티팩트의 동일성, 실제 런타임 각 preset의 활성화 상태, 독립 배포 동작은 미검증이다.
