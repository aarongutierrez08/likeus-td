#!/usr/bin/env bash
# Hook Notification: Claude está esperando permiso o input tuyo.
case "$(uname -s)" in
  Darwin) osascript -e 'display notification "Claude espera tu respuesta" with title "TD" sound name "Ping"' ;;
  Linux)  command -v notify-send >/dev/null && notify-send "TD" "Claude espera tu respuesta" ;;
esac
exit 0
