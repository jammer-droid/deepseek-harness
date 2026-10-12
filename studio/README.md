# DSH Studio

Studio is a fork-local workspace with independently registered sidebar services. See the [Korean development guide](development.ko.md) for detailed local instructions.

Select **Settings → General → Language → 한국어** to use Studio's Korean UI. The preference persists across reloads; Harness screens without Korean translations use English.

## Development

Run from the repository root using its Node and pnpm versions:

```sh
pnpm install
pnpm --dir studio run prepare:types
pnpm --dir studio test
pnpm --dir studio run watch
```

`prepare:types` builds official Host artifacts, generated Remote declarations, and referenced Client declarations. Repeat it after upstream API changes. Host and Client use separate strict artifact-plane checks with official compiler bases, cleared source aliases, and public package declarations; the prerequisite artifacts must exist before checking Studio. `watch` rebuilds Studio JavaScript only; run `pnpm --dir studio run typecheck` separately.

## Web deployment

Run `npm --prefix studio run deploy:web -- --home /absolute/DSH_HOME --dry-run` from the repository root to preview deployment. Remove `--dry-run` to build, pack, and install into that home's fixed `web` profile using this checkout's DSH CLI. Desktop is excluded. The target server must use the same runtime checkout and home; the script does not restart the server or verify live browser application. See the [Web deployment guide](development.ko.md#web-플러그인-업데이트-자동화) for prerequisites and refresh instructions.

## Packages

- `packages/shell`: sidebar page and profile enablement switch.
- `packages/roles`: profile-persistent implementer/reviewer settings, generated Remote, and locale-owned editor.
- `packages/general`: general DSH preset configuration and its own generated Remote, independent of role services.
- `packages/bundle`: workspace bundle.

Edit `src/`, not generated JavaScript. Native Plugin Manager persists enablement; timer state belongs to each Client instance. Framework types come from official Cordis and DSH packages.

## Settings navigation

Studio lists independently registered services: Preset Builder (the default), DSH settings, Role settings, Design preview, and Experiments. Preset Builder uses the same left-navigation and scrolling-content layout as Design preview; its Workflow menu opens the functional draft editor. Service selection preserves mounted editors and unsaved inputs; plugin removal removes its page and selects an available service. The shell discovers service labels, order, and pages through the `local.dsh-studio.services` Slot. See [service navigation](docs/service-navigation.md) for ownership and verification.

Design preview contains the four mock Workflows, Agents, Components, and Systems pages, with their own navigation and page-local sample data. These pages never read or write Host state. The functional Workflow draft editor is separate from this preview. DSH settings edits profile-owned preset declarations without replacing the built-in Settings screen. Experiments uses the same DetailLayout navigation and content scroller as Preset Builder and contains a profile-persisted agent-optimization editor. The disposable timer and its Client contribution are not shipped. Each optimization independently targets main agents, subagents, both, or neither; saved changes apply only when an agent starts, including resumed sessions. All optimizations default off. See [experiment policies](docs/experiment-policies.md) for preserved test-plugin defaults, Goal suppression, waiting limits, and coexistence restrictions.

### Workflow configuration drafts

The Workflow editor saves independent drafts, not active presets. Registered components and systems provide editable fields and input/output ports. Connections retain stable instance identities when items are reordered or renamed. Host validation reports missing registrations and systems, invalid references, port direction and meaning, connection counts, field values, and unsupported scopes or execution locations. Configuration validation does not confirm model, permission, or execution support.

Structurally valid drafts remain saveable with configuration errors. Registration removal preserves saved and unsaved settings and connections; unavailable or version-mismatched items become read-only and may be explicitly deleted. Re-registering the same version restores interpretation. Catalog refresh never reloads the draft. Failed availability checks remain visible and disable new additions until availability is confirmed. With no registered connection providers, the editor shows an empty state rather than offering simulated execution features.

Live catalog notifications require the runtime's effect-owned `remoteEventContributions` service from api-remotes. Rebuild the runtime before building or deploying this Studio version; updating only the Studio bundle on an older runtime does not provide that service.

Existing drafts normalize on read and acquire stable component instance IDs without an automatic storage write. Their next explicit save writes document version 2. Back up storage before upgrading if a downgrade may be needed; older builds cannot read the new format. See the [draft storage upgrade guide](../docs/upgrade-guide/v0.2.1-alpha.2/studio-workflow-drafts/guide.md) and [workflow package](packages/workflows/README.md) for storage and registration details.

### Preset overrides

Select a preset, change existing text/number/boolean configuration fields or plugin enablement, add components or mark rows for removal, confirm the tools-and-policies warning, and apply explicitly. Nested groups are supported; arrays and executable expressions are retained without editing. Cancel restores the loaded draft, reload reads saved settings, and restore removes the profile configuration override in favor of its inherited definition. Changes are user-only and are not exposed as agent tools.

Apply checks the observed configuration revision inside the configuration editor's serialized write. Concurrent changes reject the edit rather than silently overwriting it. The entire child list becomes a profile override, so subsequent bundle list changes do not merge automatically. Existing Agents retain their revision; new Agents use the current definition. Persistence and preset activation are distinct: a saved definition can be broken, which the editor reports separately and can repair by editing or restoring inherited settings. A failed or disconnected request disables further edits until reload resolves the saved state. Only unique, addressable profile rows are listed; higher-priority overlays may reject writes. The component catalog includes basic DSH leaf templates and top-level components from current and inherited preset declarations, including custom modules and complete groups. Removing a component does not uninstall its package. Copied groups retain conditions and isolation metadata; Loader generates new child IDs. The catalog is not an exhaustive installed-package inventory, does not install missing packages, and does not solve dependencies. Added component settings can be edited after applying and reloading. This editor does not edit schemas or arrays, or validate every child option before persistence. It neither consults nor changes Studio role policies.

## Fixed role settings

Studio owns exactly two roles: implementer and reviewer. Instructions, provider, and model are required; optional reasoning effort must be supported by the exact advertised model. Blank effort requests the adapter default, not a frozen effective effort. Editing never executes a role or saves automatically. Apply validates both roles, checks the observed process/revision/snapshot tokens, durably saves the pair, then revalidates activation. A conflict requires reloading before retrying. Explicit reload replaces the draft; reconnect requery retains it. Locale and Client subscriptions are disposed with the plugin.

The editor distinguishes unconfigured, applied, and saved-but-not-applied states and displays durable saved and applied identities separately from the in-process revision. Failed validation or persistence preserves the previous snapshot. Failed post-save activation blocks new captures and requires repairing model availability/settings and applying again. A transport failure leaves the outcome unknown: requery before retrying. Host storage remains active while the Studio page is closed and uses profile-common Storage Domain persistence rather than browser storage.

`studioRoles.capture(role)` is Host-only and returns a detached creation-time settings snapshot. Later Apply operations do not mutate that capture. Capture does not create, resume, or alter children; consumers own child execution and recording requested versus effective call configuration.

`generate-roles.mjs` uses the public Typert generator with an isolated declaration workspace and writes Host reflection and Client Remote JS/DTS. `build` runs generation, both strict compiler faces, and bundles public Host imports externally. [Focused tests](test/README.md) cover generated Remote dispatch, real-browser Slot rendering with automatic reflection discovery, and cold-process disk persistence.

## Managed delegation

Select Studio as the new-task Agent preset before creating a root session. Its orchestrator exposes planning/read tools and `studio_delegate`, not generic subagent, workflow, shell/write, plugin, or goal management. Executor guards also reject an Agent-owned capability outside the allowlist. Unmanaged presets remain unchanged. Resumed managed roots verify durable child identity, accepted-message terminal evidence, and model availability before recovering ownership; persisted rows alone do not grant execution authority. A managed child without a current admission is rejected during creation, before queued input can run.

To begin a cycle, call `studio_delegate` with `initial`, role `implementer`, a nonempty task prompt, and optional context `fresh` (default) or `fork`; use `status` alone to read recorded progress. Initial captures applied instructions/provider/model/effort, persists Host-generated cycle/operation/child identifiers, then starts one real implementer. The immediate logged receipt identifies the accepted message; status reads recorded output and terminal state without waking children. Unknown admission blocks retry on that live orchestrator. Route/tool overrides are rejected. `rework` accepts the owned cycle ID and a nonempty prompt and wakes the same implementer, retaining its creation context, instructions, provider, model, and effort. Each independent initial call has a new cycle; initial work has rework count zero. Both Agents share the workspace: fresh context is not filesystem isolation.

The conversation’s Agents tab sits beside Trajectory. It summarizes creation settings, membership, and cycle state separately from the current settings editor. Captured instructions/task/output expand on request. Context history opens only when expanded and uses the existing authorized child Session address; one selected event is displayed at a time, with older history loaded on demand. Message content excludes reasoning and adapter-private replay metadata. Compaction summaries remain distinct from retained source records. Reload is explicit. Status reads and full-address child browsing do not wake children; opening the parent may activate its ordinary session without starting a model turn. Blank effort uses the adapter default even if the parent requested another effort. Later settings changes never alter existing captures. Reservations and results use Studio-owned Storage Domain rows, not modified Session formats; cold records convey facts, not executable authority.

Explicit fork inherits the parent prefix through the last completed turn, or no inherited events when no turn has completed. Studio records the actual inherited event count after child creation. The task and captured current-turn message/result text are separate logged input, with their own capture position; they are not part of that inherited prefix. This additional evidence omits reasoning and adapter-private replay metadata. Inherited catalog events do not become the child’s own delegation membership. Both roles retain their creation context and settings through same-ID continuation. Fork does not guarantee cache reuse or exact reconstruction of every model request. Studio settings and cycle annotations are sidecar data and may remain outside ordinary Session exports.

History distinguishes loading, partial results, connection loss, access denial, and unavailable records. The public Session API reports leaving the live registry and not-found errors, neither of which proves durable deletion; Studio does not label them deleted. Paging bounds returned history windows and rendering, but does not promise sparse disk parsing.

### Review and explicit completion

After the implementer completes, `review` accepts its owned `cycleId` and `evidence`: nonempty `requirements` and `summary`, `changedFiles`, `validations` entries with `command`/`result`, `failures`, and `unrun` checks. Its first call accepts optional context `fresh` (default) or `fork` and creates one reviewer using independently captured current reviewer settings; later reviews reject a context override. Evidence and implementer output are logged in the reviewer's input; they are claims to inspect, not permission to execute commands. The reviewer can only read/search and submit native structured output. Shell, writes, generic delegation, workflows, PTC, settings mutation, and arbitrary Agent-owned tools remain denied by the actual executor.

The validated per-review-operation judgment is `pass`, `needs-changes`, or `unable-to-judge`, with explanation, evidence, and requested `additionalVerification`. Missing or invalid output never becomes a pass; runtime failure/interruption remains separate from a review judgment. `complete` requires the owned cycle's validated pass and no requested extra verification. Neither implementation completion nor pass closes the cycle automatically. The operator's validated roles-plugin `reworkCap` defaults to two (a nonnegative safe integer), frozen when the cycle starts. Each admitted implementer wake consumes one allowance, including verification-only work; review and reads consume none. Re-review after rework uses the same reviewer and its original settings, with a fresh operation-specific `studio_review_submit` capture. Prior pass cannot complete newer work. Active or unknown operations refuse further work; cap exhaustion requires stopping and reporting, not replacing the cycle. Same-process natural child unload and verified Host restart recovery retain the same child and frozen allowance. Status and the Agents tab expose judgments and explicit completion without waking children. Existing sidecar rows remain readable; absent review/completion fields mean no such fact was recorded.

### Recovery and stop

A managed root with no durable child records cannot resume. Completed cycles recover only when the original child logs confirm the stored parent, preset, inherited prefix, accepted message, and completed latest turn with no pending input. Recovery validates the captured model route and preserves child IDs, settings, snapshots, and counts before queued input runs. Missing, invalid, unsettled, stopped, or unverifiable records freeze further admission; Studio does not allocate replacements or reconstruct a historical plugin environment.

`stop` accepts a cycle ID, records intent, and freezes new admissions on the owning orchestrator. It drains the selected children and compares their durable message and terminal evidence. `requested` is not a completion receipt; `confirmed` means the execution has ended, including a successful result that arrived before the stop. It does not undo filesystem changes or complete the cycle. Missing evidence or reporting failures remain `unknown`. The Agents view provides related identifiers, the last confirmed state when available, and instructions to inspect records before taking further action.

Storage reservations and native execution acceptance are separate operations. A lost response keeps the reservation and counted allowance. A uniquely matching logged operation may supply an observed message ID separately from the missing receipt; that observation does not authorize resending, refunding, or replacement. Status and history inspection do not restart work.

### Direct child input limitation

The public conversation blocker stores one value per session and has no owner-specific registration or release. A second writer with the same reason is not observable; a writer with a different reason replaces the first. Studio therefore cannot disable managed-child input while preserving independent blockers, and does not install an unsafe blocker. Child browsing and ordinary input remain available. A composable public blocker API is required to meet that input restriction; GUI blocking would still not reject Host Service/Remote calls or make the entire Session read-only.

## Design system

Studio follows its [design system guide](docs/design-system.md): the [token adapter and scoped styles](src/ui-styles.ts), Studio-owned parts in [ui.tsx](src/ui.tsx), and primitive-backed parts in [ui-host.tsx](src/ui-host.tsx). Host tokens flow only through `--studio-*` aliases in the adapter. Each mounted surface owns a stylesheet, removed with that surface; no external CSS asset is required. `ui-host.tsx` is the only module that imports `@deepseek-ai/dsh-client-ui-primitives`, a platform module the shell seeds and Client bundles keep external; modules that Node unit tests load must not depend on it, because primitives import CSS modules. Modals portal outside the Studio surface, so their content uses `DialogBody` and `DialogFooter` to re-enter the style scope. Controls retain native semantics and accept caller-owned localized copy. Studio styles add no animations; primitives keep their own transitions and reduced-motion handling. Renamed or removed DSH tokens require adapter updates; token value changes flow through automatically. `test/design-rules.test.mjs` and `test/design-system.test.mjs` enforce the mechanical rules.

## Installation

Run `pnpm --dir studio run build` followed by `pnpm --dir studio run pack:bundle`. Packaging stages its manifest under `dist/bundle` without changing workspace metadata: source dependencies use `workspace:*`; staged native dependencies use exact versions from their workspace manifests, while Studio components use local tarballs. The bundle references absolute component tarball paths: preserve `dist` and repack after moving the checkout. This format is for local installation, not public distribution.

Use a separate development profile and the matching DSH runtime. `npm --prefix studio run build:desktop` builds a separate Desktop `0.2.0-rc.2` bundle under `dist/desktop-0.2.0-rc.2`; it resolves published dependencies in a temporary workspace, checks both compiler faces, and selects that runtime's public child API. Initial reviews use the operation-specific `studio_review_submit` tool, and native child completion notices may wake the parent. The default build targets the workspace runtime. Neither build installs into an existing profile; watch does not update installed tarballs. See the [Korean development guide](development.ko.md) for installation and [test instructions](test/README.md) for the isolated compatibility probe.
