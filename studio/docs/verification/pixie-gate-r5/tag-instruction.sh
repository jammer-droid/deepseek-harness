#!/bin/bash
# Pixie Gate R5 check: skip unless the instruction starts with [GATE], then ask the helper for a one-line summary.
text=$(cat)
case "$text" in "[GATE]"*) ;; *) exit 10 ;; esac
summary=$(pixie ask "Summarize the request in one short English sentence.") || { echo "helper failed" >&2; exit 1; }
# judge: 0 pass, 1 below threshold, 2 helper error (retry once, then fail the gate instead of guessing).
for attempt in 1 2; do
  pixie judge --question "Does the request include a clear done condition?" --threshold 0.5 >/dev/null; code=$?
  [ "$code" = 2 ] || break
done
case "$code" in 0) done_ok=yes ;; 1) done_ok=no ;; *) echo "judge failed" >&2; exit 1 ;; esac
printf '{"point":"%s","turn":"%s","summary":%s,"done_condition":"%s"}\n' "$PIXIE_POINT" "$PIXIE_TURN" "$(printf '%s' "$summary" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read().strip()))')" "$done_ok"
