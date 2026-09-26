---
paths:
  - "packages/sim/**"
---
# Reglas de packages/sim

La sim es una función pura: `step(state, commands) -> state`. Misma seed + mismos comandos = mismo estado, byte a byte, en cualquier máquina.

Prohibido:
- `Math.random`, `Date`, `performance.now`, `setTimeout`, `crypto`.
- Números de punto flotante en estado o cálculos acumulativos. Usar enteros (fixed-point, ej. posiciones ×1000).
- Iterar `Map`/`Set`/`Object.keys` para decisiones de juego sin ordenar primero por id.
- `Array.prototype.sort` sin comparador total (empates deben desempatar por id).
- Importar cualquier cosa de `client/`, `server/`, `pixi`, `colyseus`, DOM o Node APIs.

Obligatorio:
- RNG propio con seed (xorshift o PCG) dentro del estado.
- Toda entidad tiene `id` entero incremental asignado por la sim.
- Estado serializable con `JSON.stringify` (nada de clases con métodos, ni referencias circulares).
- Cada mecánica nueva trae un test en `packages/sim/test/` y no rompe `test/determinism.test.ts`.
- Balance en `src/balance/`; la lógica no contiene números mágicos.
