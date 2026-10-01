# Estado del balance

Foto al cierre del punto 13 (mercado y Alcancía), 2026-09-30, medida en `BALANCE_VERSION` 29 y aplicada en la 30. Criterios y palancas en `.claude/rules/balance.md`; para retomar, `/balance` con este documento como contexto. La ronda completa es el punto 15 del diseño.

## Dónde estamos

Medido con `pnpm balance`, seeds 1-20 (informado: 1 partida por seed; al azar: 20 por seed). El informado juega el mazo por defecto (en co-op sin Heladera, Tranquera ni Hinchada); el al azar, un mazo al azar.

| | N1 | N2 | N4 | N8 | Umbral |
|---|---|---|---|---|---|
| Informado, victorias | 100% | 100% | 100% | 25% | 70-95% |
| Al azar, victorias | 32% | 26% | 53% | 2% | 30-60% |
| Reviente, % del daño (informado) | 54 | 42 | 40 | 62 | ≤ 40% |
| Mazazo, % del daño (informado) | 7 | 2 | 2 | 2 | ≥ 10% o ≥ 5% de compras |

- La comparación con la foto anterior (v22) no aísla nada: entre medio entraron habilidades, mazos, doctrinas, anfitrión y mercado. Antes de la ronda del punto 15, medir un punto de referencia fijo y decidir con qué mazos se miden los umbrales.
- Armaduras del calendario: sin 29%, ligera 21%, pesada 30%, encantada 21%.
- Daño por oro: Pincha, Maldice y Mazazo 33,3; Reviente 25,4 (−24%, al borde del −25% de área). Con el mercado, la segunda torre igual en una oleada rinde 10% menos por oro.
- Ningún bot compra Cachetazo, Mate, Propina ni Alcancía.

## Qué se hizo en esta ronda

- Alcancía: el crecimiento por nivel pasa de +50% a +100% y Plazo fijo de 30 a 16. Antes el nivel 2 rendía 7 por cada 100 (trampa) y el nivel 3 Plazo fijo 38 (pico); ahora el camino rinde 15, 15 y 18 por cada 100 y se paga en 7 cierres. Caja de ahorro, sin cambios, sube el tope en 60 y le gana a Plazo fijo con más de 680 guardados: deja de ser una rama muerta.
- Mercado por jugador (ADR 015): sin cambios. Solo cobra compras en ráfaga del mismo tipo.

## Propuesta pendiente (no aplicada)

En orden. Volver a medir entre pasos.

1. Mazazo 90 → 80. Torre muerta en co-op; su rango de 2000 le resta cobertura. Queda en +12,5% de daño por oro.
2. Radio de explosión de Reviente 700 → 600. Rota en N1, N2 y N8; precio y cadencia bloqueados por el umbral de área.
3. `synergyPerPlayerPct` 5 → 2, solo si el informado en N8 sigue en 25% con un mazo co-op que tenga control y muro: si no, el problema es el mazo, no la sinergia.
4. Vida de las oleadas 17 a 20 +10% solo después de lo anterior: hoy hundiría al azar en N1-N2 y al informado en N8.

## Huecos de medición

`tools/balance.ts` no registra enemigos tocados por disparo de área, fugas por oleada, distribución de oleadas de derrota, oleada de primera compra por torre ni recargo de mercado pagado. Sin el primero, Reviente se afina a ciegas.

## Para revisar

- Ñoquitos: corregido en `BALANCE_VERSION` 31; ahora escalan con la oleada y los jugadores como cualquier enemigo. Remedir la oleada 14 y la 17 en el punto 15.

- Curandero: la curación es un monto fijo, así que con 8 jugadores pesa unas 6 veces menos que en solo.
- Oro inicial en co-op: 243 por jugador no alcanza para una torre de cada tipo de ataque; por equipo sí.
- La Alcancía no escala con N: con 8 jugadores pesa unas 1,8 veces más en la economía de un jugador (estimado por fórmula).
