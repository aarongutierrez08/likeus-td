---
paths:
  - "packages/client/**"
---
# Reglas de packages/client

- El cliente corre la sim localmente y dibuja el estado. Nunca modifica el estado por fuera de `step()`.
- Solo envía comandos (`{ type, tick, ...payload }`) al server. Nunca envía estado.
- Mapa y entidades en PixiJS. Menús, HUD, tienda y chat en DOM con Solid. No dibujar texto de UI en canvas.
- Parámetros de URL para pruebas rápidas: `?seed=&map=&speed=&gold=&wave=&tick=&dump=1&tower=<id>` (`tower` preselecciona esa torre en la tienda). Mantenerlos funcionando: son la forma en que el usuario prueba cada cambio sin navegar menús.
- Parámetros de URL públicos: `seed`, `map`, `mode`, `speed`. Parámetros de desarrollo (`gold`, `wave`, `tick`, `tower`, `bot`, `dump`) se leen solo si `import.meta.env.DEV`; una partida iniciada con ellos no puede enviar récords.
- Panel de debug con tecla `~`: pausa, +1 tick, rangos de torres, DPS por torre.
- Todo debe funcionar en móvil (táctil) y con ventana chica. Sin dependencias de UI pesadas.
