# ADR 002 — Sincronización lockstep con servidor árbitro

Estado: aceptado
Fecha: 2026-09-26

## Contexto
Hasta 8 jugadores en una sala. Un TD tolera 200 ms de latencia. Fortaleza TD (referente) usa snapshots del servidor a 15 Hz. Nuestra sim ya es determinista (ADR 001).

## Decisión
Los clientes corren la sim localmente y solo intercambian comandos por tick. El server ordena los comandos por tick, los valida contra su propia sim y los difunde. Estado completo se envía solo al unirse o reconectar, o si el hash de un cliente difiere.

## Consecuencias
+ Ancho de banda mínimo. Replays y guardado gratis.
+ El server sigue siendo autoritativo: rechaza comandos inválidos y detecta desync.
- Un bug de no-determinismo rompe la partida para todos; se detecta por hash y se corrige con snapshot.
- Reconexión y espectadores necesitan snapshot completo (único camino donde viaja estado).

## Alternativas descartadas
- Snapshots + interpolación (Fortaleza): más bytes, misma seguridad, no aprovecha el determinismo.
- Peer-to-peer sin server: no hay árbitro anti-trampa ni salas públicas.
