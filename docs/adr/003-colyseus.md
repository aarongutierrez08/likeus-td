# ADR 003 — Colyseus sobre Node como backend inicial

Estado: aceptado
Fecha: 2026-09-26

## Contexto
Necesitamos salas con código, listado de públicas, reconexión y expulsión. Fortaleza TD usa Cloudflare Durable Objects y sufrió agotamiento de cuota por salas vivas sin jugadores.

## Decisión
Backend en Node con Colyseus, desplegado en un host de contenedores (Fly.io o similar). La lógica de sala se escribe en un adaptador delgado sobre `sim`, sin acoplarse a Colyseus más allá de ese archivo.

## Consecuencias
+ Lobby, salas y reconexión resueltos; costo fijo predecible; fácil de correr en local.
+ Migrar a Durable Objects u otro host = reescribir solo el adaptador.
- Un proceso Node = un límite de salas concurrentes; escalar horizontal requiere el driver de Colyseus.

## Alternativas descartadas
- Durable Objects: sin servidor que administrar, pero cobra por tiempo vivo y hay que gestionar la cuota desde el día uno.
- Nakama: más pesado, requiere Docker y Go/Lua para lógica.
