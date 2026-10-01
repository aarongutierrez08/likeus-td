# Estado del balance

Foto al cierre de la ronda del punto 15 (bots), 2026-09-30, `BALANCE_VERSION` 35. Criterios y palancas en `.claude/rules/balance.md`; para retomar, `/balance` con este documento como contexto. Falta el playtest con amigos (`docs/playtest.md`).

## Instrumento

`pnpm balance`, seeds 1-20 (informado: 1 partida por seed; al azar: 20 por seed). En co-op los informados alternan el mazo por defecto y uno de apoyo (Pincha, Maldice, Heladera, Tranquera, Hinchada); el al azar arma un mazo al azar. El reporte mide enemigos por disparo y daño efectivo por oro.

## Antes y después de la ronda

| | N1 | N2 | N4 | N8 | Umbral |
|---|---|---|---|---|---|
| Informado, victorias v33 → v35 | 100 → 100 | 100 → 100 | 100 → 100 | 100 → 100 | 70-95% |
| Al azar, victorias v33 → v34 (v35) | 29 → 42 | 23 → 31 | 50 → 57 (58) | 0 → 2 (63) | 30-60% |
| Reviente, % del daño informado v33 → v34 | 55 → 43 | 33 → 29 | 42 → 36 | 57 → 52 | ≤ 40% |
| Reviente, enemigos por disparo (informado) | 1,62 → 1,69 | 1,84 → 1,78 | 1,84 → 1,78 | 1,94 → 1,89 | |

- v34: Mazazo 90 → 80 (37,5 por cada 100 de oro, +12,5%); oleadas 12, 14 y 20 recompuestas (menos vida sin armadura amontonada, más encantada y ligera); radio de Reviente 700 → 600.
- v35: `synergyPerPlayerPct` 5 → 3. Con 4, el azar quedaba en 61% (N4) y 21% (N8); con 3, en 58% y 63%: un solo umbral apenas pasado.
- Armaduras del calendario: 25 / 23 / 29 / 23, todas en rango.
- El Mazazo vive en solo (13% del daño); en co-op el informado casi no lo compra porque solo la mitad del equipo lo tiene en el mazo: artefacto del instrumento.

## Fuera de umbral y por qué

1. **El informado gana el 100% en todos los N.** Ninguna palanca de precio u oleada lo baja a 95% sin hundir otra vez al azar. Es estructural.
2. **Reviente roto con el informado (43% en N1, 52% en N8).** Recortar el radio un 14% bajó los enemigos por disparo solo un 3%. Hipótesis sin medir: la Heladera amontona y multiplica el área (el informado la compra, el azar no). Es una mecánica que multiplica sin tope: pide medir con y sin Heladera y, si se confirma, un cambio de lógica con ADR (por ejemplo daño que cae con la distancia al centro, o que el frenado de control no apile con el área). No es balance.
3. **Azar en N8 en 63%**, apenas por encima del 60%.

## Huecos de medición

Enemigos por disparo con y sin Heladera; oleada de primera compra por torre; fugas por oleada; mejoras y ramas elegidas; recargo de mercado pagado. Los bots no usan habilidades, doctrinas de forma estratégica, desvíos ni economía (Alcancía, Propina, Mate): sobre esas cartas no hay datos, solo el playtest.

## Para revisar

- Curandero: la curación es un monto fijo, así que con 8 jugadores pesa unas 6 veces menos que en solo.
- Oro inicial en co-op: 243 por jugador no alcanza para una torre de cada tipo de ataque; por equipo sí.
- La Alcancía no escala con N: con 8 jugadores pesa unas 1,8 veces más en la economía de un jugador (estimado por fórmula).
- `tools/balance.ts` no cuenta Ñoquitos en la tabla de armaduras.
