#!/bin/bash
# #28 check (turn-end): translate a non-Korean answer to Korean.
text=$(cat)
# grep's [가-힣] range misfires on punctuation such as an em dash; perl matches Hangul exactly.
printf '%s' "$text" | perl -CS -0777 -ne 'exit(/\p{Hangul}/ ? 0 : 1)' && exit 10
draft=$(printf '%s' "$text" | pixie ask "Translate this text into natural Korean. Output only the translation." --input) || exit 1
jq -n --arg t "$draft" '{verdict: "pass", note: ("[한국어 번역]\n" + $t)}'; exit 11
