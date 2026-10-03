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
| 009 | La tabla tipo de ataque × armadura es regla del juego, no balance |
| 010 | Habilidades: carta como datos, lanzada por comando |
| 011 | Mazo por jugador, validado por la sim |
| 012 | Una kill por habilidad es una kill normal (reemplaza la regla de kills del 010) |
| 013 | Doctrinas como datos, ofrecidas por la sim |
| 014 | El anfitrión libera la oleada (reemplaza el quórum del 007) |
| 015 | Mercado por jugador |
| 016 | Desvíos acotados: el camino depende de la ruta |
| 017 | Infinito, desafío del día y ranking validado por el server |
| 018 | Cuentas en nuestro server: invitado, vincular con Discord o Google, y solo el server registra |
| 019 | Varias formas de entrar por cuenta, unión de cuentas y vinculación confirmada por el navegador |
| 020 | Retención de datos y login por ticket |

Plantilla: `000-template.md`.
