# ADR 011 — Mazo por jugador, validado por la sim

Estado: aceptado
Fecha: 2026-09-30
Extiende al 010.

## Contexto
El diseño pide que cada jugador lleve a la partida un mazo (5 torres y 2 habilidades en co-op, 8 y 2 en solo) y que solo compre y use lo suyo, así el equipo se completa entre todos. Todavía no hay cuentas ni colección: el set base está siempre disponible. El mazo tiene que entrar en el lockstep y en los replays sin depender del cliente.

## Decisión
El mazo es parte del estado: `Player.deck` y `GameState.deckTowers` (cuántas torres lleva cada mazo en esta partida; 0 es partida sin mazos, con todas las cartas, como en los tests de reglas). La sim valida el mazo al crear la partida y en cada `join` (`deckProblem`: tamaño, sin repetidos, cartas conocidas, al menos dos tipos de ataque) y rechaza con `not_in_deck` construir una torre o usar o mejorar una habilidad fuera del mazo. Las torres del equipo que deja quien se va las sigue manejando cualquiera.

Las reglas del mazo (`DECK`) y los mazos por defecto (`DEFAULT_DECKS`) viven en `balance/deck.ts`. El bot informado juega el mazo por defecto; el bot al azar arma uno válido desde su seed.

El server guarda el mazo de cada asiento: llega al entrar y se cambia con `setDeck` en el lobby, y se lo pasa a la sim al empezar o en el `join` de quien entra tarde. El cliente recuerda el último mazo por modo en el navegador; no es una colección.

## Consecuencias
+ Un replay reproduce los mazos sin datos extra: están en el estado inicial y en los `join`.
+ El server no conoce las reglas del mazo: llama a `deckProblem` igual que la sim.
+ La colección, los mazos guardados con nombre y las cartas de temporada se suman sin tocar la sim: solo cambian qué mazos se pueden armar.
- Cambiar de mazo en el lobby saca el listo, para que nadie empiece contando con el mazo viejo de otro.
- El simtest mide el mazo por defecto; otros mazos se miden con `/balance`. Al leerlo: el bot informado nunca compra torres fuera del mazo por defecto, así que para él esas torres salen "muertas" por mazo, no por balance. El bot al azar sí las prueba.

## Alternativas descartadas
- Validar el mazo solo en el server: el replay y el modo solo quedarían sin la regla, y el cliente podría comprar cartas que la sim acepta.
- Mazo en el cliente, filtrando la tienda: no es regla, es decoración; cualquiera compraría fuera del mazo mandando el comando a mano.
