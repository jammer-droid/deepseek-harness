# Issue tracker: GitHub

Track issues in `jammer-droid/deepseek-harness`. Always pass `--repo jammer-droid/deepseek-harness` to `gh`; do not infer the tracker from the upstream remote.

## Operations

- Read: `gh issue view <number> --repo jammer-droid/deepseek-harness`
- List: `gh issue list --repo jammer-droid/deepseek-harness`
- Create: `gh issue create --repo jammer-droid/deepseek-harness --title "..." --body "..."`
- Close: `gh issue close <number> --repo jammer-droid/deepseek-harness`

Reading and drafting do not authorize tracker mutation. Create, edit, comment, or close only within the user's authorization. Issue updates do not authorize pushing code.

## Implementation specs

Follow the [Studio issue workflow](../../studio/docs/design-workflow.md). Keep implementation specs under [Studio issues](../../studio/docs/issues/README.md). `refine-issue` does not mutate the tracker.

## Request sources

PRs as a request surface: no.
