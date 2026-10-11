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

`studioRoles.capture(role)` is Host-only and returns a detached creation-time settings snapshot. Later Apply operations do not mutate that capture. Child creation, execution, resume, and recording requested versus effective call configuration belong to the subsequent delegation ticket; this feature does not create or alter existing children.

`generate-roles.mjs` uses the public Typert generator with an isolated declaration workspace and writes Host reflection and Client Remote JS/DTS. `build` runs generation, both strict compiler faces, and bundles public Host imports externally. Focused validation lives in `test/`; the Loader fixture explicitly registers generated reflection. Installed-package reflection discovery, a real browser Slot mount, and cold-process durable-backend restart require separate integration verification.

## Installation

Run `pnpm --dir studio run build` followed by `pnpm --dir studio run pack:bundle`. Packaging stages its manifest under `dist/bundle` without changing workspace metadata. The bundle references absolute component tarball paths: preserve `dist` and repack after moving the checkout. This format is for local installation, not public distribution.

Use a separate development profile and the matching DSH runtime. The fork's alpha-version artifacts must not replace an older Desktop installation without compatibility verification. Neither Studio watch nor the official Web watcher automatically updates an installed tarball. Actual browser rendering and cold-restart behavior require manual verification.
