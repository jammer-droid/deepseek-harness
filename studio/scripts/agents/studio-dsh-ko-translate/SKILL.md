---
name: studio-dsh-ko-translate
description: Translate one DSH Client locale namespace into Korean for DSH Studio (#30), judging every string with the judge tool and writing studio/src/dsh-ko/<namespace>.ts. Use when the user asks to translate a DSH namespace, continue Korean DSH translation, or fill missing keys reported by check-dsh-ko-locale.
---

# Translate a DSH namespace into Korean

One run translates **one namespace**. Paths below are relative to the repository root; run commands from `studio/` (that is where `tsx` resolves). Every string goes through `judge`; only passing strings enter the dictionary.

## Preconditions

- Require the `judge` agent tool (Studio Master or a preset that includes it). If it is missing, stop and tell the user; do not substitute a CLI or change presets.
- Tell the user before judging that the strings are sent to the configured decision engine, which may be external.
- Read the glossary and style rules in `studio/docs/research/ko-locale/README.md` (sections 용어집 and 번역 불가 목록). It is the single source for terms; follow it exactly. If a term you need is missing, pick one, use it consistently, and list it in the report as a glossary proposal.

## Inputs

- Namespace `NS`: given by the user, or the smallest entry in `untranslated` from `node --import tsx scripts/check-dsh-ko-locale.mjs --json` (each entry of `reports`).
- Sources: `studio/docs/research/ko-locale/source-rc2.json` and `source-alpha2.json`, shape `namespaces[NS].keys[key] = { en, zh }`. Translate the **union** of keys. Use the alpha.2 English as the reference; when rc.2 English differs for a key, the Korean must pass the meaning question against both.
- If `studio/src/dsh-ko/NS.ts` already exists, keep its passing entries and translate only the keys the check script reports missing.

## Steps

1. **Classify keys.**
   - *Locale values*: `time.locale` and any key whose English is an `Intl` locale tag. Write `ko-KR`. No judgment.
   - *Verbatim*: English that is only product/code tokens, a keyboard shortcut, a placeholder, or punctuation (e.g. `MCP`, `{count}`, `⌘K`). Copy unchanged. No judgment.
   - *Fragments*: strings the UI joins with other keys (trailing/leading spaces, a sentence that stops mid-way, siblings named like `…Or`, `…Undo`, `…Prefix`). Find the joining code with `git grep -n "<key>" dsh-v0.2.1-alpha.2 -- :/packages` and judge the **joined** Korean against the joined English as one item. Write the parts only if the joined item passes.
   - Everything else is a normal string.
2. **Translate** in batches of about 20. Keep `{name}` placeholders exactly (same names, same count), protected tokens (DeepSeek, DSH, MCP, Cron, PTC, UTC, tab names Trajectory and Chat), Markdown and line breaks present in the English. Sentences use 합쇼체 (-습니다); buttons, labels, and headings are short noun phrases. Look at sibling keys so parallel labels read alike.
3. **Judge** each batch in one `judge` call. `state` maps a sanitized id (`/^[A-Za-z][A-Za-z0-9_-]*$/`, e.g. `k01`) to `{ "ko": …, "en": … }`; keep an id → key map. Ask exactly these three questions per id, replacing `K`:

   ```json
   {
     "K_natural": { "type": "score", "instructions": "How natural and clear is `K.ko` as Korean UI text for a developer tool?", "criteria": ["awkward or unclear", "understandable but stiff", "natural and clear"] },
     "K_meaning": { "type": "noul", "instructions": "Does `K.ko` convey the same meaning as `K.en`, including conditions, numbers, and negations?" },
     "K_style": { "type": "noul", "instructions": "Does `K.ko` end sentences in the formal polite style (합쇼체, e.g. -습니다/-합니다) or use a short label/noun phrase?" }
   }
   ```

   Pass = naturalness score ≥ 1.5 **and** meaning yes-probability ≥ 0.6 **and** style yes-probability ≥ 0.5. Read `score` and `noul`, never `confidence`. Do not add context fields; S2 showed they do not change scores.
4. **Rewrite** failing strings and re-judge them, at most **3 rewrites per key**. A tool error or missing answer is *unjudged*: retry that key once; if still unjudged, treat it as unresolved, never as a failure verdict.
5. **Unresolved** keys (no passing version after 3 rewrites, or still unjudged) go into `fallback` and show in English. Record the best candidate and its scores so the user can choose later.
6. **Write** `studio/src/dsh-ko/NS.ts`:

   ```ts
   import type { DshKoNamespace } from '../dsh-ko-locale.ts';

   export default {
     ko: {
       'key.name': '번역문',
     },
     fallback: ['unresolved.key'],
   } satisfies DshKoNamespace;
   ```

   Keys in source order, single-quoted, `\n` and `\'` escaped as in TypeScript. Then add `import <camelCaseNs> from './NS.ts';` and `'NS': <camelCaseNs>,` to `studio/src/dsh-ko/index.ts`, keeping entries sorted by namespace.
7. **Record** `studio/docs/research/ko-locale/judge/NS.json`:

   ```json
   { "namespace": "NS", "date": "YYYY-MM-DD", "engine": "jev", "thresholds": { "natural": 1.5, "meaning": 0.6, "style": 0.5 },
     "rows": [ { "key": "…", "en": "…", "kind": "normal|fragment|verbatim|locale",
       "attempts": [ { "ko": "…", "natural": 1.62, "meaning": 0.91, "style": 0.70, "pass": true } ],
       "result": "pass|fixed|unresolved|verbatim|locale" } ] }
   ```

   Rounded to two decimals; unjudged attempts carry `"error"` instead of scores.
8. **Check**, from `studio/`:

   ```sh
   node --import tsx scripts/check-dsh-ko-locale.mjs
   node --import tsx --test test/dsh-ko-locale.test.mjs
   npx tsc -p tsconfig.client.json
   ```

   The first must print `ok` overall with no `missing`, `placeholder mismatch`, or `stray` lines for `NS`. Fix only `NS` files until all three pass. Leave files outside `studio/src/dsh-ko/` and `studio/docs/research/ko-locale/judge/` untouched.

## Report

Give the namespace, key totals (pass on first judgment, fixed by rewrite, unresolved, verbatim/locale, unjudged), the unresolved keys with their best candidate and scores, glossary proposals, and the three check results. Leave committing to the user unless they asked for it. Jev scores are signals for Korean, not a guarantee; it is strongest in English.
