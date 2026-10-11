# DSH Studio

English | [中文](README.zh.md)

Studio is a fork-local workspace with a sidebar page and an independently enabled demo timer. See the [Korean development guide](development.ko.md) for detailed local instructions.

## Development

Run from the repository root using its Node and pnpm versions:

```sh
pnpm install
pnpm --dir studio run prepare:types
pnpm --dir studio test
pnpm --dir studio run watch
```

`prepare:types` builds official Host artifacts, generated Remote declarations, and referenced Client declarations. Repeat it after upstream API changes. Host and Client use separate strict artifact-plane checks with official compiler bases, cleared source aliases, and public package declarations; the prerequisite artifacts must exist before checking Studio. `watch` rebuilds Studio JavaScript only; run `pnpm --dir studio run typecheck` separately.

## Packages

- `packages/shell`: sidebar page and profile enablement switch.
- `packages/demo`: disposable Client timer.
- `packages/roles`: profile-persistent implementer/reviewer settings, generated Remote, and locale-owned editor.
- `packages/bundle`: workspace bundle; demo disabled by default.

Edit `src/`, not generated JavaScript. Native Plugin Manager persists enablement; timer state belongs to each Client instance. Framework types come from official Cordis and DSH packages.

## Fixed role settings

Studio owns exactly two roles: implementer and reviewer. Instructions, provider, and model are required; optional reasoning effort must be supported by the exact advertised model. Blank effort requests the adapter default, not a frozen effective effort. Editing never executes a role or saves automatically. Apply validates both roles, checks the observed process/revision/snapshot tokens, durably saves the pair, then revalidates activation. A conflict requires reloading before retrying. Explicit reload replaces the draft; reconnect requery retains it. Locale and Client subscriptions are disposed with the plugin.

The editor distinguishes unconfigured, applied, and saved-but-not-applied states and displays durable saved and applied identities separately from the in-process revision. Failed validation or persistence preserves the previous snapshot. Failed post-save activation blocks new captures and requires repairing model availability/settings and applying again. A transport failure leaves the outcome unknown: requery before retrying. Host storage remains active while the Studio page is closed and uses profile-common Storage Domain persistence rather than browser storage.

`studioRoles.capture(role)` is Host-only and returns a detached creation-time settings snapshot. Later Apply operations do not mutate that capture. Capture does not create, resume, or alter children; consumers own child execution and recording requested versus effective call configuration.

`generate-roles.mjs` uses the public Typert generator with an isolated declaration workspace and writes Host reflection and Client Remote JS/DTS. `build` runs generation, both strict compiler faces, and bundles public Host imports externally. [Focused tests](test/README.md) cover generated Remote dispatch, real-browser Slot rendering with automatic reflection discovery, and cold-process disk persistence.

## Managed delegation

Select Studio as the new-task Agent preset before creating a root session. Its orchestrator exposes planning/read tools and `studio_delegate`, not generic subagent, workflow, shell/write, plugin, or goal management. Executor guards also reject an Agent-owned capability outside the allowlist. Unmanaged presets remain unchanged; managed tool execution fails closed for a resumed session or child without a live reservation; persisted rows cannot restore execution authority.

To begin a cycle, call `studio_delegate` with `initial`, role `implementer`, a nonempty task prompt, and optional context `fresh`; use `status` alone to read recorded progress. Initial captures applied instructions/provider/model/effort, persists Host-generated cycle/operation/child identifiers, then starts one real fresh implementer. The immediate logged receipt identifies the accepted message; status reads recorded output and terminal state without waking children. Unknown admission blocks retry on that live orchestrator. Route/tool overrides and forks are rejected. `rework` accepts the owned cycle ID and a nonempty prompt and wakes the same implementer, retaining its creation context, instructions, provider, model, and effort. Each independent initial call has a new cycle; initial work has rework count zero. Both Agents share the workspace: fresh context is not filesystem isolation.

The conversation’s Agents tab sits beside Trajectory. It displays captured settings and instructions separately from observed persisted request configuration, task/output, membership identifiers, and state. Reload is explicit. Status reads and full-address child browsing do not wake children; opening the parent may activate its ordinary session without starting a model turn. Blank effort uses the adapter default even if the parent requested another effort. Later settings changes never alter existing captures. Reservations and results use Studio-owned Storage Domain rows, not modified Session formats; cold records convey facts, not executable authority.

### Review and explicit completion

After the implementer completes, `review` accepts its owned `cycleId` and `evidence`: nonempty `requirements` and `summary`, `changedFiles`, `validations` entries with `command`/`result`, `failures`, and `unrun` checks. It creates one fresh reviewer using independently captured current reviewer settings. Evidence and implementer output are logged in the reviewer's input; they are claims to inspect, not permission to execute commands. The reviewer can only read/search and submit native structured output. Shell, writes, generic delegation, workflows, PTC, settings mutation, and arbitrary Agent-owned tools remain denied by the actual executor.

The validated per-review-operation judgment is `pass`, `needs-changes`, or `unable-to-judge`, with explanation, evidence, and requested `additionalVerification`. Missing or invalid output never becomes a pass; runtime failure/interruption remains separate from a review judgment. `complete` requires the owned cycle's validated pass and no requested extra verification. Neither implementation completion nor pass closes the cycle automatically. The operator's validated roles-plugin `reworkCap` defaults to two (a nonnegative safe integer), frozen when the cycle starts. Each admitted implementer wake consumes one allowance, including verification-only work; review and reads consume none. Re-review after rework uses the same reviewer and its original settings, with a fresh operation-specific `studio_review_submit` capture. Prior pass cannot complete newer work. Active or unknown operations refuse further work; cap exhaustion requires stopping and reporting, not replacing the cycle. Same-process natural child unload may resume under the exact live owner; Host restart recovery remains unsupported. Status and the Agents tab expose judgments and explicit completion without waking children. Existing sidecar rows remain readable; absent review/completion fields mean no such fact was recorded.

## Installation

Run `pnpm --dir studio run build` followed by `pnpm --dir studio run pack:bundle`. Packaging stages its manifest under `dist/bundle` without changing workspace metadata: source dependencies use `workspace:*`; staged native dependencies use exact versions from their workspace manifests, while Studio components use local tarballs. The bundle references absolute component tarball paths: preserve `dist` and repack after moving the checkout. This format is for local installation, not public distribution.

Use a separate development profile and the matching DSH runtime. The fork's alpha-version artifacts must not replace an older Desktop installation without compatibility verification. Neither Studio watch nor the official Web watcher automatically updates an installed tarball. Integration tests use an isolated matching Web runtime; they do not validate an existing installed GUI or compatibility with another runtime version.
