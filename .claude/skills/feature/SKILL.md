---
name: feature
description: Ritual para implementar una mecánica o cambio de comportamiento en packages/sim con TDD estricto. Usar siempre que el usuario pida agregar, cambiar o corregir una torre, enemigo, aura, oleada, economía, fusión o cualquier regla del juego, aunque no mencione "tdd" ni "test". No usar para cambios de UI o de server.
---

# /feature

1. **Spec como escenarios.** Reescribir el pedido del usuario como una lista "dado / cuando / entonces", una línea por escenario, incluyendo los casos borde (no apilable, sin objetivo, oro insuficiente, radio en el límite). Mostrarla y esperar confirmación si hay ambigüedad.
2. **Tests primero.** Un test por escenario en `packages/sim/test/<mecánica>.test.ts` con `scenario()`. Nombres que describen comportamiento. Si `scenario()` necesita un método nuevo, agregarlo al helper primero.
3. **Rojo.** `pnpm test --filter sim`. Pegar las líneas de fallo. Si un test pasa sin implementar nada, el test está mal: corregirlo.
4. **Verde.** Implementación mínima. Números nuevos van a `src/balance/`, no a la lógica.
5. **Refactor** con los tests en verde. Sin cambiar tests.
6. Si cambió comportamiento existente: subir `BALANCE_VERSION`.
7. `/verify`.

Reporte: escenarios cubiertos, archivos tocados, qué cambió de balance. No commitear.
