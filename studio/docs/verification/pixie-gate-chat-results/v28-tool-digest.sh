#!/bin/bash
# #28 check (tool-after): summarize read results with Pixie; skip other tools.
[ "$PIXIE_TOOL_NAME" = read ] || exit 10
summary=$(pixie ask "이 파일 내용을 한국어 한 문장으로 요약하세요. 요약 문장만 쓰세요.") || exit 1
jq -n --arg s "$summary" '{verdict: "pass", note: ("[읽은 파일 요약]\n" + $s)}'; exit 11
