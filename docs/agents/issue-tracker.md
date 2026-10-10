# Issue tracker: GitHub

Track work in GitHub Issues on `jammer-droid/deepseek-harness`. Use the `gh` CLI with an explicit `--repo jammer-droid/deepseek-harness` argument; do not infer the tracker from the upstream remote.

## Skill operations

When a skill asks to publish a ticket, create an issue in this repository. When it asks to fetch a ticket, read its title, body, labels, and comments. Preserve repository-qualified references when linking issues from another repository.

Use GitHub sub-issues for parent-child relationships and native issue dependencies for blockers when available. Otherwise, record parent and blocker references explicitly in the issue bodies.

Publishing issues, comments, or other tracker changes requires authorization from the current task; this configuration alone does not authorize those operations.

## Triage

Use the role mapping in [triage labels](triage-labels.md).

**PRs as a request surface: no.**

## Implementation specs

Follow the invoked skill's publication rules. In particular, `refine-issue` keeps its implementation spec repository-local and does not mutate the tracker.
