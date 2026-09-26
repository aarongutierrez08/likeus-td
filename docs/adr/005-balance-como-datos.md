# ADR 005 — Balance como datos con BALANCE_VERSION

Estado: aceptado
Fecha: 2026-09-26

## Contexto
El balance de un TD se itera cientos de veces. Replays y guardados dependen de que la sim se comporte igual que cuando se grabaron.

## Decisión
Todos los números (torres, enemigos, oleadas, mapas, afijos) viven en `packages/sim/src/balance/`. La lógica no contiene números mágicos. Cualquier cambio que altere el comportamiento de la sim sube `BALANCE_VERSION`; replays y guardados con versión distinta se invalidan a propósito.

## Consecuencias
+ Balancear no toca lógica; `/balance` puede iterar números con bots.
+ Nunca se reproduce un replay con reglas distintas a las que lo generó.
- Cada cambio de balance rompe guardados viejos. Aceptado: partidas cortas.

## Alternativas descartadas
- Balance mezclado en la lógica: cada ajuste es un cambio de código con riesgo de bug.
- Migrar guardados entre versiones: costo alto para partidas de 30 minutos.
