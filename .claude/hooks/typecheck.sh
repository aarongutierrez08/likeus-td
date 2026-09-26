#!/usr/bin/env bash
# Hook PostToolUse: typecheck rápido del paquete tocado tras Edit/Write.
# Recibe JSON por stdin con tool_input.file_path. Exit 2 = devolver stderr a Claude.
set -u
input=$(cat)
file=$(echo "$input" | sed -n 's/.*"file_path":"\([^"]*\)".*/\1/p')
[[ "$file" != *.ts && "$file" != *.tsx ]] && exit 0
case "$file" in
  *packages/sim/*)    pkg=packages/sim ;;
  *packages/server/*) pkg=packages/server ;;
  *packages/client/*) pkg=packages/client ;;
  *) exit 0 ;;
esac
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" || exit 0
out=$(pnpm --filter "./$pkg" exec tsc --noEmit 2>&1)
if [[ $? -ne 0 ]]; then
  echo "Typecheck falló en $pkg:" >&2
  echo "$out" | head -30 >&2
  exit 2
fi
exit 0
