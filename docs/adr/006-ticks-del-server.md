# ADR 006 — En co-op los clientes avanzan solo con los ticks del server

Estado: aceptado
Fecha: 2026-09-26

## Contexto
ADR 002 fija lockstep: los clientes corren la sim y solo intercambian comandos. Falta decidir quién marca el reloj. Con reloj propio por cliente, un comando que llega tarde obliga a retroceder y re-simular (rollback) o a un input delay fijo; con 8 jugadores y latencias dispares, ambos caminos complican el cliente.

## Decisión
El server corre la sim a 20 ticks/s y difunde un mensaje `tick` por paso con los comandos aceptados en ese tick. El cliente en co-op no tiene reloj de simulación: aplica `step()` únicamente al recibir cada `tick`. Cada 20 ticks el mensaje trae el hash del estado; si el hash local difiere, el cliente reporta `desync` y recibe un snapshot completo. Un comando se valida dos veces en el server: al recibirlo (respuesta inmediata `rejected`) y al aplicarlo en orden dentro del tick, para que dos jugadores no ocupen la misma celda en el mismo tick.

## Consecuencias
+ Un solo camino de código en el cliente: `step()` con comandos que ya vienen ordenados. Sin rollback ni reconciliación.
+ Imposible adelantarse al server; el hash detecta cualquier divergencia en un segundo.
- La vista va medio RTT detrás del server. Aceptable para un TD (200 ms según ADR 002).
- 20 mensajes por segundo aunque no haya comandos. Son bytes mínimos; si molesta, se agrupan ticks vacíos en un ADR nuevo.

## Alternativas descartadas
- Reloj local con input delay fijo: más fluido, pero necesita rollback cuando un comando llega tarde y un segundo mecanismo de sincronía de relojes.
- Snapshots periódicos (Fortaleza): descartado ya en ADR 002.
