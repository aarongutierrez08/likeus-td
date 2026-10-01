# ADR 018 — Cuentas en nuestro server: invitado, vincular con Discord o Google, y solo el server registra

Estado: aceptado
Fecha: 2026-10-01
Extiende al 002 y al 017.

## Contexto
El diseño pide jugar al instante como invitado, vincular Discord o Google sin contraseñas propias, ver el mismo progreso desde otro navegador, historial con replays y experiencia con tope diario. Nada de eso puede salir del navegador, y jugar como invitado tiene que seguir andando aunque las cuentas estén caídas. La sim no puede enterarse.

## Decisión
Todo vive en el server de las salas: SQLite con `node:sqlite` (Node 22, sin dependencias nuevas) en `ACCOUNTS_DB`, que en Fly va sobre un volumen. Cada navegador recibe una identidad de invitado con un token de sesión (`POST /auth/guest`). Vincular es OAuth del lado del server (`/auth/:proveedor/start` y `/callback`): una primera vinculación convierte al invitado en la cuenta; una cuenta que ya existía absorbe la historia y la experiencia del invitado. La vuelta del login solo va a orígenes de `CLIENT_ORIGINS`. Un proveedor falso (`AUTH_FAKE=1`) existe solo para desarrollo y tests.

El server registra solo lo que él mismo vio terminar: las salas co-op al terminar, y las partidas en solo que repite a partir del mazo y los comandos (`POST /games/solo`, misma construcción con `soloStart` que el cliente). Las partidas con parámetros de desarrollo no tienen `ranked` y no se registran. La experiencia (`accounts/xp.ts`) sale de la oleada, la victoria y el grupo (+5% por jugador, tope 25%), con tope diario; el nivel es una función de la experiencia y por ahora no desbloquea nada. Cada partida guarda un replay (estado inicial más comandos) que el cliente reproduce en modo espectador. El ranking del desafío del día pasa a la misma base.

Si la base no abre, las cuentas responden 503 y las salas, el solo y el desafío del día siguen igual.

## Consecuencias
+ Un solo sistema que operar; el mismo replay sirve para el historial y para los reportes.
+ Activar Discord y Google es configurar secretos, sin código nuevo.
- SQLite en un volumen ata las cuentas a una máquina de Fly: para escalar a más de una hay que moverlas a un servicio aparte.
- `node:sqlite` todavía es experimental en Node 22.
- Repetir partidas en solo usa CPU del mismo proceso que las salas; está limitado por jugador (sesión, o nombre sin ella), por ticks simulados por minuto y por largo de historial.

## Alternativas descartadas
- Supabase: login, base y archivos gestionados, pero suma un SDK y otro servicio que operar.
- Confiar en el resultado que manda el navegador: cualquiera se daría experiencia.
