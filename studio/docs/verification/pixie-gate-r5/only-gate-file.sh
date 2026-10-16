#!/bin/bash
# Pixie Gate R5 check: run the tool-after gate only for read results of gate-sample.txt.
[ "$PIXIE_TOOL_NAME" = read ] || exit 10
case "$PIXIE_TOOL_ARGS" in *gate-sample.txt*) ;; *) exit 10 ;; esac
wc -l | tr -d ' '
