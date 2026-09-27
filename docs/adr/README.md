# ADRs — Architecture Decision Records

Una decisión importante = un archivo de una página. Numerados, nunca se editan: si una decisión cambia, se escribe un ADR nuevo que dice "reemplaza al NNN".

| # | Decisión |
|---|----------|
| 001 | Simulación determinista con enteros, sin I/O |
| 002 | Sincronización lockstep con servidor árbitro |
| 003 | Colyseus sobre Node como backend inicial |
| 004 | HUD en DOM (Solid), mapa en PixiJS |
| 005 | Balance como datos con BALANCE_VERSION |
| 006 | En co-op los clientes avanzan solo con los ticks del server |
| 007 | Economía multijugador: oro propio, vidas del equipo, escalado por N |
| 008 | Contenido como datos: una torre o enemigo es una entrada en `balance/` |

Plantilla: `000-template.md`.
