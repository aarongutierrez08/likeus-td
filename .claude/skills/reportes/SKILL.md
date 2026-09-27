---
name: reportes
description: Leer y reproducir reportes de problemas que llegan desde el juego (issues de GitHub con etiqueta bug-report, o archivos en tools/out/reports). Usar al empezar una sesión, cuando el usuario diga "hay reportes", "mirá los issues", "reprodu­cí el reporte N", o después de que alguien jugó en producción.
---

# /reportes

1. `pnpm report list` — issues abiertos con etiqueta `bug-report` y archivos locales.
2. Para cada uno, `pnpm report replay <n|archivo>`: reconstruye la partida desde el estado inicial y el log de comandos y compara el hash con el del server y el del cliente.
   - Coincide con el server pero no con el cliente → desync real: buscar no-determinismo en sim o en el orden de aplicación en el cliente.
   - No coincide con el server → el server no aplicó lo que dice su historial: bug en `GameRoom` (cola, `acceptInOrder`, pausa).
   - `pnpm report show` muestra los dos dumps para comparar a ojo.
3. Motivos: `manual` (texto del jugador; leerlo primero), `client_error` (stack en `errors`), `desync`, `server_error` (stack en `message`).
4. Reproducir el bug como test: sim → `scenario()` en `packages/sim/test/`; red → `packages/server/test/room.test.ts`; UI → `coopsmoke` o un probe.
5. Arreglar con `/feature` si toca sim, `/verify` siempre. Cerrar el issue con `gh issue close <n> -c "<qué se arregló y en qué commit>"`.

Notas: sin `GITHUB_TOKEN` en el server los reportes van a `tools/out/reports/` (ignorado por git). En producción el token vive en los secretos de Fly.
