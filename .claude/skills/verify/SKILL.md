---
name: verify
description: Verificación completa del proyecto antes de dar por terminado cualquier cambio. Usar siempre al final de una tarea, antes de commitear, o cuando el usuario pida "verificá", "chequeá", "está listo?". Corre typecheck, tests, simtest, screenshot y smokes, delega la revisión final al agente revisor, y resume en pocas líneas.
---

# /verify

Ejecutar en orden. Si un paso falla, detenerse, arreglar y volver a empezar desde el principio.

1. `pnpm check` — typecheck de todos los paquetes, ESLint y Prettier. Si Prettier falla, `pnpm format` y volver a correr.
2. `pnpm test` — vitest. Prestar atención especial a `determinism.test.ts`.
3. `pnpm simtest` — el bot debe ganar la seed de referencia. Si pierde tras un cambio de balance, es un cambio de balance real: reportarlo, no ajustar el test.
4. Si se tocó `packages/client`: `pnpm shot --seed 42 --tick 900` y abrir el PNG en `tools/out/`. Mirar que el mapa, las torres, los enemigos y el HUD se vean correctos. Comparar con el PNG anterior si existe.
   Además `pnpm uismoke`: juega el flujo solo con la partida en marcha (construir, seleccionar, mejorar, elegir rama, vender, tranquera). Si el cambio agregó una interacción que el script no ejercita, agregarla al script primero; un PNG no prueba que un botón funcione.
5. Si se tocó `packages/server`: `pnpm test --filter server` (tests de sala: crear, unir, comando inválido rechazado, reconexión).
6. Si se tocó `packages/server` o `packages/client/src/net`: `pnpm coopsmoke` (dos pestañas reales contra el server; debe terminar en `coopsmoke: OK` sin desyncs).

7. Delegar al agente **revisor** con el diff de la tarea (`git diff` desde el último commit). Corregir los hallazgos de gravedad 1 a 3 y volver al paso 1; los de 4 a 6, corregir si es rápido o anotar como pendiente en el commit. Máximo 2 pasadas por etapa; la segunda, solo sobre lo que cambió. Un `/verify` no está completo sin este paso.

Reporte final, máximo 7 líneas:
- check / test / simtest / shot / smokes / revisor: OK o qué falló y qué se corrigió.
- Qué cambió en balance (si algo).
- Qué queda pendiente o dudoso.
- **Dónde, cómo y qué probar** (obligatorio, nunca omitir): una URL de `localhost:5173` con parámetros (`seed`, `wave`, `gold`, `speed`, `tower`…) que deje al usuario parado justo donde está el cambio, sin jugar oleadas previas; los pasos exactos a hacer ahí; y qué tiene que ver para dar el cambio por bueno. Sin `speed=0` salvo que el cambio sea sobre la pausa: en pausa no se ven los errores de interacción. Escribir la URL también en `.claude/last-test-url` (un archivo, una línea) para que el hook de notificación la muestre.

Con todo en verde, commitear (nunca push) y seguir con lo siguiente.
