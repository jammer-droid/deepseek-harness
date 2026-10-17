---
name: studio-ko-review
description: Review and fix the Korean of one finished DSH Studio issue — its spec, the Korean UI copy of the feature it implemented, and the public docs it changed — using the judge tool, then write the missing ko strings. Use when the user asks to review, proofread, or translate the Korean of an issue, feature, branch, or doc change.
---

# Korean review of an issue's changes

Review only what **one issue changed**. This is a change review, not a sweep of every Studio string. Work from the repository root; run `tsx`/`tsc` commands from `studio/`.

## Preconditions

- Require the `judge` agent tool (Studio Master or a preset that includes it). If it is missing, stop and tell the user; do not substitute a CLI or change presets.
- Tell the user before judging that the text is sent to the configured decision engine, which may be external.

## 1. Find the changes

1. Identify the issue: the user names it, or take it from the branch and `studio/docs/issues/<number>-*.md`. Read the spec's 기준 브랜치·시작 커밋 line; that commit is `BASE`. If the spec has none or the user names another base, use theirs. Confirm `BASE` with the user when it is a guess.
2. `git diff --name-only BASE...HEAD -- studio` (plus uncommitted files from `git status --short studio`) gives the candidate files. Sort them into three targets and drop the rest:

| Target | Files | Unit | Expected style |
| --- | --- | --- | --- |
| **Spec** | the issue's `studio/docs/issues/<number>-*.md` and its `studio/docs/research/**`, `studio/docs/verification/**` | paragraph, list item, table row, heading | 한다체 (-한다/-이다) |
| **UI copy** | changed `studio/src/**/*.ts(x)` holding ko·en·zh copy: `*-locale.ts`, or inline `{ en: {...}, ko: {...}, zh: {...} }` / `[ko, en, zh]` objects | one string | sentences 합쇼체 (-습니다), labels short noun phrases |
| **Public docs** | changed `studio/release/docs/**/*.ko.md`, `studio/README*.md`, `studio/*.ko.md` | paragraph, list item, table row, heading | 합쇼체, matching the file |

3. Within each file take only **added or modified** units (`git diff BASE...HEAD -- <file>`). For UI copy, take a key when its ko or en string changed.
4. Skip fenced code, inline code spans, frontmatter, link targets, file paths, and units that are only product/code tokens. `studio/src/dsh-ko/**` belongs to `studio-dsh-ko-translate`; skip it.

Show the user the target list (file · target · unit count) before judging. Trim it if they ask.

## 2. Fill missing Korean

For UI copy, a key is **missing** when it has en but no ko, or its ko equals its en while the en is ordinary words. Write a ko string from the en (and zh when en is ambiguous). For a public doc whose `.ko.md` lacks a section that the paired English file has, translate that section. Missing items go through the same judging as everything else and are marked `new` in the table.

## 3. Judge

Batch about 20 units per `judge` call, one target type per call. `state` maps a sanitized id (`/^[A-Za-z][A-Za-z0-9_-]*$/`, e.g. `u01`) to `{ "ko": …, "en": … }`, with `en` omitted when the unit has no English counterpart (specs, Korean-only docs). For a paired doc, `en` is the matching unit of the English file, located by heading and order. Keep an id → (file, key or line) map.

Ask per id, replacing `K` and choosing `DOC`/`STYLE` from the target row:

```json
{
  "K_natural": { "type": "score", "instructions": "How natural and clear is `K.ko` as DOC?", "criteria": ["awkward or unclear", "understandable but stiff", "natural and clear"] },
  "K_meaning": { "type": "noul", "instructions": "Does `K.ko` convey the same meaning as `K.en`, including conditions, numbers, and negations?" },
  "K_style": { "type": "noul", "instructions": "STYLE" }
}
```

| Target | DOC | STYLE |
| --- | --- | --- |
| UI copy | `Korean UI text for a developer tool` | ``Does `K.ko` end sentences in the formal polite style (합쇼체, e.g. -습니다/-합니다) or use a short label/noun phrase?`` |
| Spec | `Korean technical documentation for developers` | ``Does `K.ko` use the plain written style (한다체, e.g. -한다/-이다) throughout, without polite or casual endings?`` |
| Public docs | `Korean technical documentation for developers` | ``Does `K.ko` use the formal polite style (합쇼체, e.g. -합니다/-입니다) throughout, without plain or casual endings?`` |

Ask `K_meaning` only when `en` exists. Flag a unit when naturalness < 1.5, meaning < 0.6, or style < 0.5; read `score` and `noul`, never `confidence`. A tool error or missing answer is **unjudged**: retry once, then report it; never count it as a failure.

**Accuracy.** Judge cannot check facts. For spec and doc units that state behavior, also compare the claim with the diff (names, defaults, limits, commands, file paths). List mismatches as `fact` findings with the evidence; they need a rewrite like any flag.

## 4. Rewrite and re-judge

Rewrite flagged and `fact` units yourself; `judge` only judges. Keep meaning, numbers, negations, `{...}` placeholders with their counts, Markdown structure, links, and protected tokens (DSH, Studio, Pixie, Jev, preset and tool names, `exit 0/10/11`, `'pixie judge'`). Follow the Korean terms already used in the same file and in `studio/docs/research/ko-locale/README.md` (용어집). Re-judge with the same questions; at most 3 rewrites per unit. A rewrite that never passes stays a proposal marked `unresolved`, with its best scores.

The naturalness score runs low on plain spec prose; a flagged spec unit that already reads well may be kept. Say so in the table rather than forcing a rewrite.

## 5. Approve, then edit

Present one table per target: **file · key/line · current ko · proposed ko · naturalness/meaning/style before → after · note** (`new`, `fact`, `unresolved`, `keep?`). Then **stop** until the user approves all or selected rows. Re-read each file before editing and stop on conflicting changes. Edit only approved rows, changing nothing else in the line. UI copy keeps keys, en and zh unchanged and contains no Markdown backticks.

## 6. Check

From `studio/`:

```sh
npx tsc -p tsconfig.client.json
node --import tsx --test test/design-rules.test.mjs
```

Add the tests that cover a changed UI file (`grep -l <file-stem> test/*.test.mjs`); a snapshot test that pins edited copy needs its expectation updated to the approved text. If a check fails because of this review's edits, revert those edits only and report. Leave committing to the user unless they asked.

## Report

Per target: units judged, flagged, new, fact findings, approved and applied, unresolved, unjudged. List rewrite judgments separately from first judgments. Give the check results. Jev scores are signals for Korean, not a guarantee; it is strongest in English.
