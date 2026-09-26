# ADR 001 — Simulación determinista con enteros, sin I/O

Estado: aceptado
Fecha: 2026-09-26

## Contexto
La misma lógica de juego tiene que correr en navegador y servidor y producir resultados idénticos. Necesitamos replays, guardado de partida, anti-trampas y tests headless.

## Decisión
`packages/sim` es TypeScript puro: `step(state, commands) -> state`. Enteros (fixed-point) para posiciones y cálculos, RNG propio con seed dentro del estado, sin `Math.random`/`Date`/timers, sin imports de client/server/DOM/Node.

## Consecuencias
+ Replay y guardado = seed + log de comandos. Anti-trampa = comparar hashes de estado.
+ Se testea sin navegador; bots juegan miles de partidas en CI.
- Cualquier fuente de no-determinismo es un bug grave. `determinism.test.ts` es obligatorio.
- Fixed-point es menos cómodo que floats; se paga una vez.

## Alternativas descartadas
- Lógica en el cliente con floats: imposible validar en server, replays divergen entre máquinas.
- Lógica solo en server: modo solo necesitaría servidor; sin predicción local.
