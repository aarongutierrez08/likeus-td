# ADR 017 — Infinito, desafío del día y ranking validado por el server

Estado: aceptado
Fecha: 2026-09-30
Extiende al 001 y al 002.

## Contexto
El diseño pide un modo infinito con puntaje y una seed diaria con ranking. Hasta acá la partida tenía exactamente 20 oleadas fijas. Un ranking no puede confiar en el puntaje que manda el cliente, y en solo la sim corre en el navegador.

## Decisión
`GameState.mode` es `"campaign"` (las 20 oleadas) o `"endless"`. `waveDef(state, n)` es la única fuente de oleadas: las de la campaña y, en infinito, desde la 21 una oleada generada como función pura de la seed y el número (dos tipos al azar, vida creciente, jefe cada 10). Así el calendario las muestra antes. Un infinito no se gana: termina al perder las vidas y su puntaje son las oleadas cerradas (`scoreOf`).

El desafío del día es un infinito en solo con `dailySeed("AAAA-MM-DD")`, una función pura: el día UTC lo lee el cliente o el server, nunca la sim. Al terminar, el cliente manda el mazo y sus comandos por tick (`POST /daily`); el server arma la misma partida, la repite y la deja correr hasta que termina, y rankea el puntaje que calculó él. `GET /daily` devuelve el top del día.

## Consecuencias
+ El puntaje del ranking no se puede inventar: un replay que no termina o con otro mazo no cuenta.
+ El mismo `waveDef` sirve para cualquier modo futuro con oleadas propias.
- El ranking vive en memoria del server y se pierde al reiniciar. Persistirlo es parte del punto 17 (cuentas y almacenamiento).
- Repetir una partida larga cuesta CPU en el server; se corta en 400 000 ticks.

## Alternativas descartadas
- Confiar en el puntaje del cliente: cualquiera lo cambia.
- Correr las partidas diarias en el server en vivo, como co-op: obliga a estar conectado para jugar solo.
