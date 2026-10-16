#!/bin/bash
# #28 check (tool-before): stop bash commands that delete files; ignore other tools.
[ "$PIXIE_TOOL_NAME" = bash ] || exit 10
case "$PIXIE_TOOL_ARGS" in
  *"rm "*) jq -n '{verdict: "stop", reason: "파일 삭제 명령은 이 세션에서 막혀 있습니다. 삭제 없이 진행하세요."}'; exit 11 ;;
esac
exit 10
