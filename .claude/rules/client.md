---
paths:
  - "packages/client/**"
---
# Reglas de packages/client

- El cliente corre la sim localmente y dibuja el estado. Nunca modifica el estado por fuera de `step()`.
- Solo envía comandos (`{ type, tick, ...payload }`) al server. Nunca envía estado.
- Mapa y entidades en PixiJS. Menús, HUD, tienda y chat en DOM con Solid. No dibujar texto de UI en canvas.
- Parámetros de URL para pruebas rápidas: `?seed=&map=&speed=&gold=&wave=&tick=&dump=1&tower=<id>&deck=<torres>;<habilidades>&doctrines=<ids>` (`tower` preselecciona esa torre en la tienda; `deck` fija el mazo, y cualquier parámetro de desarrollo saltea la pantalla de mazo). Mantenerlos funcionando: son la forma en que el usuario prueba cada cambio sin navegar menús.
- Parámetros de URL públicos: `seed`, `map`, `mode` (`solo`|`coop`), `room`, `name`, `speed`, `endless=1`, `daily=1`, `replay=<id>|file`. Parámetros de desarrollo (`gold`, `wave`, `tick`, `tower`, `bot`, `dump`, `deck`, `doctrines`) se leen solo si `import.meta.env.DEV` y en modo solo; una partida iniciada con ellos no puede enviar récords.
- En co-op el cliente no tiene reloj de sim: aplica `step()` solo al recibir cada `tick` del server (ADR 006). Los tipos del protocolo salen de `@td/server/protocol`.
- Panel de debug con tecla `~`: pausa, +1 tick, rangos de torres, DPS por torre.
- Todo debe funcionar en móvil (táctil) y con ventana chica. Sin dependencias de UI pesadas.
- Listas de Solid (`<For>`) con claves estables: constantes o ids, nunca objetos creados en el render. El HUD se redibuja por tick y una fila recreada pierde el clic que empezó sobre ella.
- Toda interacción nueva se prueba con la partida en marcha, no en pausa: `pnpm uismoke` en solo y `pnpm coopsmoke` en co-op; si el flujo nuevo no está cubierto, agregarlo al script antes de darlo por terminado.
