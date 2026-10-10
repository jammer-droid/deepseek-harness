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

`prepare:types` builds official Host artifacts, generated Remote declarations, and referenced Client declarations. Repeat it after upstream API changes. Host and Client use separate checks with official compiler bases and project references. `watch` rebuilds Studio JavaScript only; run `pnpm --dir studio run typecheck` separately.

## Packages

- `packages/shell`: sidebar page and profile enablement switch.
- `packages/demo`: disposable Client timer.
- `packages/bundle`: workspace bundle; demo disabled by default.

Edit `src/`, not generated JavaScript. Native Plugin Manager persists enablement; timer state belongs to each Client instance. Framework types come from official Cordis and DSH packages.

## Installation

Run `pnpm --dir studio run build` followed by `pnpm --dir studio run pack:bundle`. Packaging stages its manifest under `dist/bundle` without changing workspace metadata. The bundle references absolute component tarball paths: preserve `dist` and repack after moving the checkout. This format is for local installation, not public distribution.

Use a separate development profile and the matching DSH runtime. The fork's alpha-version artifacts must not replace an older Desktop installation without compatibility verification. Neither Studio watch nor the official Web watcher automatically updates an installed tarball. Actual browser rendering and cold-restart behavior require manual verification.
