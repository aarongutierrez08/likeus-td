#!/usr/bin/env bash
# Hook PreToolUse (opcional): bloquea editar packages/sim/src si no hay tests modificados sin commitear.
# Activar agregando en settings.json, dentro de "hooks":
#   "PreToolUse": [{ "matcher": "Edit|Write|MultiEdit",
#                    "hooks": [{ "type": "command", "command": "bash .claude/hooks/tdd-guard.sh" }] }]
# Para saltarlo en un refactor puro: TDD_GUARD=off claude
set -u
[[ "${TDD_GUARD:-on}" == "off" ]] && exit 0
input=$(cat)
file=$(echo "$input" | sed -n 's/.*"file_path":"\([^"]*\)".*/\1/p')
[[ "$file" != *packages/sim/src/* ]] && exit 0
[[ "$file" == *packages/sim/src/balance/* ]] && exit 0   # ajustar números no requiere test nuevo
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" || exit 0
if git status --porcelain packages/sim/test | grep -q .; then exit 0; fi
echo "TDD: no hay tests modificados en packages/sim/test. Escribí el test primero, corrélo en rojo, y recién después editá $file. (Refactor puro: TDD_GUARD=off)" >&2
exit 2
