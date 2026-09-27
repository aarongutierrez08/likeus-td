# ADR 007 — Economía multijugador: oro propio, vidas del equipo, escalado por N

Estado: aceptado
Fecha: 2026-09-26

## Contexto
Con oro por jugador y recompensa al que remata (commit anterior), el equipo tenía exactamente el oro de una partida solo repartido entre N: más gente no daba más recursos y el que ponía auras no cobraba. Además N jugadores combinando torres rinden más que la suma de N partidas solo, así que las oleadas de solo quedan cortas.

## Decisión
Las vidas son del equipo; el oro es de cada jugador. Con N jugadores en la partida:
- Cada muerte paga a **todos** `floor(bounty · (N+1) / (2N))`: 100% en solo, 75% con 2, 62,5% con 4, 56% con 8. El oro total del equipo crece con N.
- Cada enemigo spawnea con `floor(hp · (N+1)(N+19) / 40)`: la parte `(N+1)/2` compensa el oro total y el `(N+19)/20` la sinergia de combinar torres. La cantidad de enemigos por oleada no cambia.
- Con 2 o más jugadores cada uno arranca con el 75% del oro inicial de solo; quien entra tarde recibe lo mismo.
- Al cerrar una oleada (muere o se escapa su último enemigo) cada jugador cobra `min(floor(oro · 10%), 20)`. Solo aplica también.
- La siguiente oleada empieza a contar (7,5 s) recién cuando la actual terminó: su último enemigo murió o cruzó. No hay superposición ni tope de espera. Durante ese conteo cualquier jugador puede llamarla; todos cobran 1 de oro por segundo ahorrado. Con 4 o más jugadores hacen falta dos jugadores distintos en la misma oleada.
- Desde la oleada 3, un jugador puede regalar oro a otro hasta lo que tiene.
- El oro de torres de economía (cuando existan) será solo del dueño y no se atenúa.
Los porcentajes viven en `packages/sim/src/balance/economy.ts`; el modo solo es N = 1 y todas las fórmulas dan identidad, salvo el interés, que es nuevo también en solo.

## Consecuencias
+ Más jugadores = más oro y enemigos más duros, con un solo juego de oleadas.
+ Las auras y el apoyo cobran igual que el que remata.
- Solo cambia por el interés: hay que rebalancear solo con `/balance`.
- El escalado de vida es una apuesta a verificar con bots de 1, 2, 4 y 8: si con más jugadores se llega más lejos, el 5% por jugador de sinergia es bajo.

## Alternativas descartadas
- Recompensa solo al que remata (commit anterior): castiga auras y apoyo, oro total fijo.
- Pool de oro compartido: un jugador puede vaciarlo y nadie es dueño de nada.
- Escalar cantidad de enemigos en vez de vida: más entidades por tick y más ruido visual con 8 jugadores.
