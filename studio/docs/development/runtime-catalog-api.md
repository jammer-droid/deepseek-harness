# Runtime catalog 공개 API 조사

## 범위와 결론

읽기 전용으로 lean-agent checkout `045910fde1448b816ff0394463a29d52e5655ec9`를 조사했다. 루트 선언 버전은 `0.2.1-alpha.2`다([package.json:1–4](</Users/home/playground/vibecoding/deepseek-harness/package.json#L1-L4>)). 아래는 **Host 서비스/라이브러리 호출 경로**이며 임의의 HTTP endpoint를 뜻하지 않는다. `agentPresets`/`acquireScope` 없이 Loader inventory, 모듈의 exported Config, raw config는 조회할 수 있다. 그러나 **설치된 모든 패키지의 모든 scope에 존재하는 tools/prompts를 일괄 나열하는 공개 API는 확인하지 못했다.**

## 조회 경로와 정확한 의미

| 대상 | 공개 경로 | 경계 |
| --- | --- | --- |
| 현재 Loader 플러그인 | `ctx.loader.entries()` → `entry.id`, `entry.options`, `entry.disabled` | 중첩 Loader subtree 포함. 설치 패키지 목록도, 모든 동적 `ctx.plugin()` 인스턴스 목록도 아니다. group은 별도 제외한다. [EntryTree:26–33](</Users/home/playground/vibecoding/deepseek-harness/vendor/loader/src/config/tree.ts#L26-L33>), [Entry:9–23](</Users/home/playground/vibecoding/deepseek-harness/vendor/loader/src/config/entry.ts#L9-L23>) |
| 관리용 플러그인 inventory | `await ctx.pluginManager.listPlugins()` (`@Remote`) | runtime entry와 patch target/read-only 이유. **내부에서** optional `agentPresets.compositionInventory()`를 호출한다. 호출자만 preset API를 안 쓰면 되는 조건에는 가능하지만, 전이 의존까지 금지하면 직접 Loader 경로를 쓴다. [PluginManager:254–273](</Users/home/playground/vibecoding/deepseek-harness/packages/boot/plugin-manager/src/index.ts#L254-L273>), [inventory:82–113](</Users/home/playground/vibecoding/deepseek-harness/packages/host/plugin-inventory/src/index.ts#L82-L113>) |
| 설치/제공 bundle inventory | `await ctx.pluginManager.listBundles()` (`@Remote`) | profile dependency, 설치 제공 bundle, 미설치 official catalog까지 섞인다. `installed`, `availability`, `enabled`, `version`, `rows`, 오류를 구별해야 한다. 모든 npm dependency를 빠짐없이 보여주는 API가 아니다. [PluginManager:276–347](</Users/home/playground/vibecoding/deepseek-harness/packages/boot/plugin-manager/src/index.ts#L276-L347>) |
| 플러그인 exported Config | 아래 Loader import 경로 → normalized plugin의 `Config` | optional Standard Schema validator. JSON Schema나 JSON 직렬화 가능 객체라는 보장은 별개다. [Plugin.Base:98–110](</Users/home/playground/vibecoding/deepseek-harness/vendor/cordis/src/registry.ts#L98-L110>) |
| 현재 raw config | `entry.options.config` | Loader가 보유한 입력값. schema default/변환/`!!js` 적용 후 값과 같다고 보장하지 않는다. [EntryOptions:9–23](</Users/home/playground/vibecoding/deepseek-harness/vendor/loader/src/config/entry.ts#L9-L23>), [Loader:104–113](</Users/home/playground/vibecoding/deepseek-harness/vendor/loader/src/index.ts#L104-L113>) |
| profile config layer | `ctx.configEditor.entries()`, `.configuration()` | Host 공개 메서드이며 `@Remote`가 아니다. unique profile patch id로 주소 지정 가능한 Include 소유 entry만 반환한다. `configuration()`은 `{ entry, inherited, override }`; effective runtime config가 아니다. [ConfigEditor:25–79](</Users/home/playground/vibecoding/deepseek-harness/packages/boot/config-editor/src/index.ts#L25-L79>) |
| 알려진 scope의 tool | `ctx.tools.schemas(scope?)`, `.get(name, scope?)` | 해당 scope가 보는 상속·shadow·restriction 적용 결과. 생략하면 global. 전체 scope의 raw registration 목록이 아니다. [Tools:1227–1267](</Users/home/playground/vibecoding/deepseek-harness/packages/core/tools/src/index.ts#L1227-L1267>) |
| 알려진 scope의 prompt | `await ctx.systemPrompt.assemble({ scope, ...context })` | provider와 waterfall을 **실행**하는 effective assembly. raw prompt registry를 순수 열람하는 API가 아니며 필요한 context가 없으면 실패할 수 있다. [AssembleContext:41–50](</Users/home/playground/vibecoding/deepseek-harness/packages/core/system-prompt/src/index.ts#L41-L50>), [assemble:600–632](</Users/home/playground/vibecoding/deepseek-harness/packages/core/system-prompt/src/index.ts#L600-L632>) |

## Loader 공개 export와 내부 구현 구분

`@deepseek-ai/cordis-plugin-loader`의 package root는 Loader 및 EntryTree를 export한다([package exports:14–22](</Users/home/playground/vibecoding/deepseek-harness/vendor/loader/package.json#L14-L22>), [index:10–21](</Users/home/playground/vibecoding/deepseek-harness/vendor/loader/src/index.ts#L10-L21>)). 공개 경로는 다음과 같다.

1. `ctx.loader.resolve(entryId)`는 **entry id**를 찾는다. 모듈 specifier를 URL로 resolve하는 메서드가 아니다([resolve:60–72](</Users/home/playground/vibecoding/deepseek-harness/vendor/loader/src/config/tree.ts#L60-L72>)).
2. `await entry.parent.tree.import(entry.options.name)`으로 owning tree의 base URL 및 `cordis:` builtin 규칙을 사용한다. 임의의 root URL로 import하지 않는다([import:111–129](</Users/home/playground/vibecoding/deepseek-harness/vendor/loader/src/config/tree.ts#L111-L129>)).
3. `ctx.loader.unwrapExports(namespace)`로 default/ESM/CJS 모양을 정규화하고 `plugin.Config`를 읽는다. 실제 Entry 초기화도 같은 순서를 따른다([unwrapExports:200–207](</Users/home/playground/vibecoding/deepseek-harness/vendor/loader/src/index.ts#L200-L207>), [Entry init:223–237](</Users/home/playground/vibecoding/deepseek-harness/vendor/loader/src/config/entry.ts#L223-L237>)).

이미 import된 entry에는 public `entry.moduleNamespace`도 있다([Entry:42–54](</Users/home/playground/vibecoding/deepseek-harness/vendor/loader/src/config/entry.ts#L42-L54>)). 다만 disabled/실패 entry에는 값이 없을 수 있다. `import()`는 activation을 직접 수행하지 않지만 모듈 최상위 코드를 실행할 수 있으므로 **엄밀한 무부작용 조회가 아니다**. 미설치 catalog row에는 import 가능한 모듈 자체가 없을 수 있다.

Fiber를 전부 비공개라고 부르는 것도 부정확하다. Cordis는 Fiber를 root에서 export하며 `entry.fiber`, `fiber.config/state/ctx`는 public이다. `fiber.config`는 활성 인스턴스의 validated config를 읽는 저수준 경로이지만, 존재·상태를 확인해야 하며 detached JSON DTO도 모든 scope config inventory도 아니다. `_runner`, `_store` 등 private 상태를 뒤지는 방식과 구분한다([Cordis exports:1–10](</Users/home/playground/vibecoding/deepseek-harness/vendor/cordis/src/index.ts#L1-L10>), [Fiber:184–210](</Users/home/playground/vibecoding/deepseek-harness/vendor/cordis/src/fiber.ts#L184-L210>)). Config schema 조회에 그런 내부 탐색은 필요하지 않다.

## 전체 scopes의 한계

Context의 `root`/`extend`/`isolate`는 context 또는 서비스 격리 기능이지 scope roster가 아니다([Context:16–32](</Users/home/playground/vibecoding/deepseek-harness/vendor/cordis/src/context.ts#L16-L32>), [isolate:109–124](</Users/home/playground/vibecoding/deepseek-harness/vendor/cordis/src/context.ts#L109-L124>)). DSH `ScopeKey`는 identity 비교하는 객체이며 parent 관계는 WeakMap에 저장된다. 공개 `scopeChainOf(key)`는 **이미 아는 key**의 조상만 반환한다([scope:14–39](</Users/home/playground/vibecoding/deepseek-harness/packages/core/scope/src/index.ts#L14-L39>), [scopeChainOf:84–101](</Users/home/playground/vibecoding/deepseek-harness/packages/core/scope/src/index.ts#L84-L101>)). Tools/SystemPrompt의 registry `layers`는 private다([Tools:834–839](</Users/home/playground/vibecoding/deepseek-harness/packages/core/tools/src/index.ts#L834-L839>), [SystemPrompt:435–439](</Users/home/playground/vibecoding/deepseek-harness/packages/core/system-prompt/src/index.ts#L435-L439>)).

따라서 Studio가 합법적으로 보유한 live scope key별 effective view는 만들 수 있으나, 모든 미실행/숨겨진 scope를 발견하거나 모든 설치 플러그인의 tools/prompts를 코드 실행 없이 추출하는 기능은 위 API만으로 보장하지 못한다. Config export는 tool/prompt 선언 manifest가 아니다.

## 초기화 완료 이후에만 조회하기

- `loader.await()`는 현재 tree의 `_initTask` 및 fiber lifecycle `inertia`가 없어질 때까지 기다린다. `Promise.allSettled`이므로 **대기 완료 ≠ 모든 플러그인 성공/ACTIVE**다. 실패·pending·disabled 상태를 결과와 분리해 표시해야 한다([EntryTree:35–49](</Users/home/playground/vibecoding/deepseek-harness/vendor/loader/src/config/tree.ts#L35-L49>)).
- 자신의 async activation/apply 반환값이 기다리는 체인 안에서 같은 tree의 `loader.await()`를 기다리면, Loader가 그 자신의 inertia를 기다리는 순환이 된다. `fiber.await()`도 자신의 activation 내부에서 기다리지 않는다([Fiber.await:698–709](</Users/home/playground/vibecoding/deepseek-harness/vendor/cordis/src/fiber.ts#L698-L709>)).
- 권장 설계는 **activation은 API 등록 후 완료**하고, 그 activation 완료와 분리된 snapshot 작업/후속 요청에서 `loader.await()` 후 조회하는 것이다. 준비 promise를 공개 조회가 기다리게 하되 activation 반환값으로 그 promise를 반환하지 않는다. 자체 활성화 완료를 public fiber 경계에서 확인하는 경우에도 기다림은 activation 밖에 둔다. 고정 sleep으로 준비를 추정하지 않는다.
- `Loader.Intercept.await: true`와 `Service.check`는 공개된 dependency gate지만 tree에 작업이 하나라도 있으면 차단한다. 자체 Loader entry 활성화와의 순환 가능성을 검증하지 않고 ready hook 대용으로 권장하지 않는다([Loader:65–69](</Users/home/playground/vibecoding/deepseek-harness/vendor/loader/src/index.ts#L65-L69>), [check:175–178](</Users/home/playground/vibecoding/deepseek-harness/vendor/loader/src/index.ts#L175-L178>), [notify:209–220](</Users/home/playground/vibecoding/deepseek-harness/vendor/loader/src/config/entry.ts#L209-L220>)).
- 이 보장은 관측 시점의 Loader task 정착이다. 이후 HMR/새 scope/등록 변경까지 영구 고정하거나 별도 scope 내부 작업까지 모두 완료한다는 보장은 아니다. 다중 async 조회의 원자적 snapshot도 별도 설계가 필요하다.

## 설치본과 검증 한계

설치 대상은 상위 조사에서 `--version`으로만 확인한 `rc.2`다. 이를 위 checkout의 API 의미와 동일하다는 증거로 쓰지 않는다. 앱의 asar 내부 경로는 일반 filesystem 탐색에서 `Not a directory`였으며, 이 조사에서는 설치본 서비스 호출·타입 export·lifecycle 동작을 검증하지 않았다. 특히 `moduleNamespace`, configEditor, scope 메서드 및 Loader 준비 경계는 **rc.2에서 별도 확인이 필요**하다.

검증은 소스/exports 읽기와 revision 확인만 수행했다. 코드 수정·서버 기동·패키지 import 실행·설치본 변경·독립 배포 테스트는 하지 않았다. lifecycle 권장안은 코드에 근거한 설계 제약이지 실행 검증 결과가 아니다.
