---
name: verify
description: Verificación completa del proyecto antes de dar por terminado cualquier cambio. Usar siempre al final de una tarea, antes de pedir aprobación para commitear, o cuando el usuario pida "verificá", "chequeá", "está listo?". Corre typecheck, tests, simtest y screenshot, y resume en pocas líneas.
---

# /verify

Ejecutar en orden. Si un paso falla, detenerse, arreglar y volver a empezar desde el principio.

1. `pnpm check` — typecheck de todos los paquetes, ESLint y Prettier. Si Prettier falla, `pnpm format` y volver a correr.
2. `pnpm test` — vitest. Prestar atención especial a `determinism.test.ts`.
3. `pnpm simtest` — el bot debe ganar la seed de referencia. Si pierde tras un cambio de balance, es un cambio de balance real: reportarlo, no ajustar el test.
4. Si se tocó `packages/client`: `pnpm shot --seed 42 --tick 900` y abrir el PNG en `tools/out/`. Mirar que el mapa, las torres, los enemigos y el HUD se vean correctos. Comparar con el PNG anterior si existe.
5. Si se tocó `packages/server`: `pnpm test --filter server` (tests de sala: crear, unir, comando inválido rechazado, reconexión).
6. Si se tocó `packages/server` o `packages/client/src/net`: `pnpm coopsmoke` (dos pestañas reales contra el server; debe terminar en `coopsmoke: OK` sin desyncs).

Reporte final, máximo 6 líneas:
- check / test / simtest / shot: OK o qué falló.
- Qué cambió en balance (si algo).
- Qué queda pendiente o dudoso.
- **Dónde, cómo y qué probar** (obligatorio, nunca omitir): una URL de `localhost:5173` con parámetros (`seed`, `wave`, `gold`, `speed`, `tower`…) que deje al usuario parado justo donde está el cambio, sin jugar oleadas previas; los pasos exactos a hacer ahí; y qué tiene que ver para dar el cambio por bueno. Escribir la URL también en `.claude/last-test-url` (un archivo, una línea) para que el hook de notificación la muestre.

No commitear. Pedir aprobación.
