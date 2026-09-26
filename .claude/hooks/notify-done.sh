#!/usr/bin/env bash
# Hook Stop: si hay cambios sin commitear en packages/, avisa con notificación del sistema
# y muestra la URL de prueba. No abre pestañas nuevas: se asume `pnpm dev` corriendo
# y una pestaña abierta en localhost:5173 (Vite recarga sola).
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" || exit 0
git status --porcelain packages tools 2>/dev/null | grep -q . || exit 0

url="http://localhost:5173/?seed=42&speed=3"
[[ -f .claude/last-test-url ]] && url=$(cat .claude/last-test-url)
msg="Claude terminó. Probar: $url"

case "$(uname -s)" in
  Darwin) osascript -e "display notification \"$msg\" with title \"TD\" sound name \"Glass\"" ;;
  Linux)
    if grep -qi microsoft /proc/version 2>/dev/null; then
      powershell.exe -c "[Console]::Beep(800,200)" >/dev/null 2>&1   # WSL
    else
      command -v notify-send >/dev/null && notify-send "TD" "$msg"
    fi ;;
esac
echo "$msg"
exit 0
