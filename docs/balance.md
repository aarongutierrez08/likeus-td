# Estado del balance

Foto al cierre de la ronda del 2026-09-29, `BALANCE_VERSION` 22 (commit f324858). Criterios y palancas en `.claude/rules/balance.md`; para retomar, `/balance` con este documento como contexto.

## Dónde estamos

Medido con `pnpm balance`, seeds 1-20 (informado: 1 partida por seed; al azar: 20 por seed).

| | N1 | N2 | N4 | N8 | Umbral |
|---|---|---|---|---|---|
| Informado, victorias | 100% | 100% | 100% | 100% | 70-95% |
| Al azar, victorias | 57% | 36% | 34% | 0% | 30-60% |
| Reviente, % del daño (informado) | 54 | 60 | 56 | 75 | ≤ 40% |
| Mazazo, % del daño (informado) | 12 | 4 | 0 | 3 | ≥ 10% o ≥ 5% de compras |

- Armaduras del calendario: sin 29%, ligera 21%, pesada 30%, encantada 21%. Todas en rango, pesada en el techo.
- Daño por oro: Pincha, Maldice y Mazazo en 33,3 cada 100 de oro; Reviente 25,4 (−24%, al borde del −25% de área).
- El informado no pierde vidas desde la oleada 14: todo lo que pierde es en la 5 (Camiones) y la 10 (Patrón).
- El azar con 8 jugadores pierde siempre en la 9-10, sin dispersión.

## Qué se hizo en esta ronda

- Bots como instrumento: el informado cuenta auras, Heladeras y torres de todo el equipo, y valora construir o mejorar por daño por segundo; el azar es "ataque al azar más mejoras", con Chusma solo si viene sigilo y el equipo no tiene.
- Mazazo 95 → 90, oro inicial 300 → 325, oleadas 16, 19 y 20 recompuestas por armadura, `wallDamage` vuelto a los valores previos a 5d040fb.

## Propuesta pendiente (no aplicada)

En orden. Volver a medir entre pasos.

1. Mazazo 90 → 80. Torre muerta con el informado en N2 y N4; su rango de 2000 le resta cobertura. Queda en +12,5% de daño por oro, dentro del ±15%.
2. Radio de explosión de Reviente 700 → 600. Rota en todos los N. Precio y cadencia están bloqueados por el umbral de daño por oro de área, que mide un solo objetivo.
3. Vida de las oleadas 17 a 20 +10% (`hpPct` 430/460/500/550 → 470/505/550/605). El informado gana 100% porque el final no pregunta nada.
4. `synergyPerPlayerPct` 5 → 0, solo si el azar sigue cayendo con N después de 1-3. Con 8 jugadores la vida escala ×6,08 y el botín ×4,5.

## Huecos de medición

`tools/balance.ts` no registra enemigos tocados por disparo de área, fugas por oleada, distribución de oleadas de derrota ni oleada de primera compra por torre. Sin el primero, Reviente se afina a ciegas.

## Para revisar

- Ñoquitos: según el análisis nacen siempre con la vida base (38), sin escalar por oleada ni por jugadores. Sin verificar; si es así, es un bug de sim.
- Curandero: la curación es un monto fijo, así que con 8 jugadores pesa unas 6 veces menos que en solo. Pasarla a % de la vida máxima es cambio de lógica.
- Oro inicial en co-op: 243 por jugador no alcanza para una torre de cada tipo de ataque; por equipo sí. El umbral no dice cuál vale.
