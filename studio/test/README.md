# Studio browser acceptance

English | [中文](README.zh.md)

The browser lane drives the actual Studio sidebar with Playwright through the existing Web test scaffold. The scaffold runs an isolated profile and ephemeral port; it never replaces an existing GUI. Its source test helpers compose built Host/Client packages and Studio package exports through the real Loader, including automatic `./typert` discovery. The editor’s header-only fixture supplies a call-free replay provider catalog. Delegation fixtures contain complete V4 parent/child calls: real tool execution reaches the public activation service and replay adapter, without credentials or a live provider.

Build Studio and the selected runtime's Host packages, Client bundles, and Web distribution first. Install the repository's declared browser test dependencies through its ordinary setup; this test does not install dependencies or browsers. A cached Playwright Chromium is the default; `DSH_TEST_BROWSER_CHANNEL=chrome` uses an already-installed Chrome. Run from the repository root:

```sh
npm --prefix studio run test:browser
```

A worktree can use an already-built matching runtime checkout without altering that checkout's dependencies:

```sh
DSH_TEST_RUNTIME_ROOT=/path/to/runtime-checkout DSH_TEST_BROWSER_CHANNEL=chrome npm --prefix studio run test:browser
```

`DSH_TEST_SCREENSHOT=/absolute/path/accepted.png` optionally records the final confirmed editor. Screenshots contain dynamic snapshot IDs and are evidence, not committed pixel baselines.

The test covers two fixed roles, draft-only edits discarded by Reload, explicit Apply with matching saved/applied snapshot IDs, browser refresh and Reload retaining saved values, and an HTTP read failure disabling Apply while leaving retry available. Browser refresh is not a Host process restart; restart and storage-failure behavior belong to the Host tests.

Delegation acceptance covers captured instructions and actual request effort, independent cycles, immutable earlier settings, model-origin logged receipt/schema snapshots, root/child executor denials including Agent-owned tools, unmanaged positive control, cold managed recovery refusal, durable reservation before publication, uncertain admission fencing, and disposal during pending admission or live execution. Teardown tests reopen the domain and assert persisted outcomes. The Agents browser test selects the managed preset before creating a root, navigates the actual conversation tab and addressed child, switches English to Chinese, and compares the complete persisted child log before/after navigation.

Review acceptance uses native child-owned structured capture through the real executor: fresh settings/evidence input snapshots, foreign-cycle ownership, overlapping admission/completion refusal, write/shell/delegation/PTC/settings and arbitrary child-owned tool denial, and allowed search/submission. Outcome fixtures cover pass, needs-changes, unable-to-judge, pending extra verification, invalid judgment, and missing capture. Only an explicit completion after an unqualified pass closes a cycle; re-review follows a counted same-ID rework. Bounded-operation tests exercise natural unload, a resident reviewer's repeated operation-specific capture, concurrent wake refusal, two counted verification wakes, third-wake refusal, immutable settings/persona, adapter-default effort, and stale-pass rejection. Chrome renders passing, nonpassing, inconclusive, and invalid outcomes in English/Chinese and verifies browsing either child adds no model call.

Fork acceptance uses both roles through the real activation provider: completed-parent prefix equality, a first-turn empty seed with separately logged current evidence, inherited catalog exclusion, and same-ID rework/re-review retaining context, settings, and inherited counts. These are keyless replay checks, not live-provider cache measurements.

For predecessor compatibility, set `DSH_TEST_PREDECESSOR_STUDIO=/path/to/built-ticket9/studio` alongside the runtime variable and run `studio/test/predecessor-reopen.browser.test.ts`. It skips without that variable. The real predecessor Loader writes a sidecar, then the current plugin reopens the same backend with unchanged identities/settings; this is plugin/domain reopen, not a process restart or restoration of execution authority. Use verified ticket9 emitted artifacts, not a path resolving to current Studio.

Run `DSH_TEST_RUNTIME_ROOT=/path/to/runtime-checkout node studio/test/typecheck.mjs` for strict integration-test checking. It uses the selected runtime’s official Host references and service declarations, but the current worktree’s Studio sources and tests. Generated machine-specific config is not written. Product Host/Client artifact checks remain part of `build`.
