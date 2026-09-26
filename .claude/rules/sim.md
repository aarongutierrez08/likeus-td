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

## TDD en sim (obligatorio)

Orden fijo para cualquier cambio de comportamiento:
1. Escribir el test en `packages/sim/test/` usando `scenario()` de `test/helpers/scenario.ts`.
2. Correrlo y confirmar que falla por la razón correcta. Mostrar la salida al usuario.
3. Implementar lo mínimo para que pase.
4. Refactorizar con el test en verde.

Un test de sim es de caja negra: construye un estado con `scenario()`, ejecuta `step()` N veces, afirma sobre el estado resultante. Nada más.

Prohibido:
- Mocks, spies, `vi.mock`. La sim es pura; no hay nada que mockear.
- Importar funciones internas (`resolveTargeting`, `applyDamage`) en tests. Solo `step()`, `scenario()` y consultas del estado.
- Snapshot del estado completo (`toMatchSnapshot`). Se rompe con cualquier cambio y no dice qué falló.
- Nombres tipo `test("archer works")`. El nombre describe comportamiento: `test("archer kills a 40hp orc in 3 ticks at 15 dmg")`.

Bien:
```ts
test("damage aura boosts towers in radius by 25%, does not stack", () => {
  const s = scenario({ seed: 1 })
    .tower("archer", { x: 5, y: 3 })
    .tower("aura_damage", { x: 6, y: 3 })
    .tower("aura_damage", { x: 4, y: 3 })
    .enemy("orc", { hp: 100, x: 5, y: 2 });
  s.run(1);
  expect(s.enemy(0).hp).toBe(100 - Math.floor(15 * 1.25));
});
```

Mal:
```ts
test("aura", () => {
  const spy = vi.spyOn(targeting, "resolveTargeting");
  step(state, []);
  expect(spy).toHaveBeenCalled();   // testea la implementación, no el juego
});
```

Excepción: refactors sin cambio de comportamiento no requieren test nuevo; los existentes deben seguir en verde.

El bot de referencia vive en `src/bot/` y ningún archivo fuera de esa carpeta lo importa.
