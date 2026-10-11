# Studio browser acceptance

English | [中文](README.zh.md)

The browser lane drives the actual Studio sidebar with Playwright through the existing Web test scaffold. The scaffold runs an isolated profile and ephemeral port; it never replaces an existing GUI. Its source test helpers compose built Host/Client packages and Studio package exports through the real Loader, including automatic `./typert` discovery. The header-only fixture supplies a call-free replay provider catalog. This is not a live-model test.

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
