# ADR 020 — Retención de datos y login por ticket

Estado: aceptado
Fecha: 2026-10-03
Extiende al 018 y al 019.

## Contexto
La base de cuentas crecía sin límite: replays, invitados abandonados y sesiones viejas quedaban para siempre. Las sesiones no vencían nunca, y el inicio del login llevaba la sesión en la dirección, que queda en logs y en el historial del navegador.

## Decisión
- Los replays se guardan comprimidos con gzip (unas 5 veces menos) y vencen a los 30 días. La partida queda en el historial sin replay. El jugador puede descargarlo antes y abrir el archivo descargado desde el perfil; se reproduce igual, sin pasar por el server.
- Los invitados se borran 30 días después de su última partida terminada, o a los 7 días de creados si nunca terminaron una (los que ya existían cuentan desde la migración). Las cuentas vinculadas y su historial no se borran nunca.
- Una sesión deja de servir a los 90 días sin uso; usarla corre la fecha.
- El perfil avisa al invitado y en el historial cuándo vence cada replay. Los plazos viven en `accounts/retention.ts` y el perfil los recibe del server, así el aviso no puede quedar distinto de lo que pasa.
- La limpieza corre al arrancar y cada hora.
- El login empieza con un `POST /auth/:proveedor/ticket`, con la sesión en un header, que devuelve una dirección con un ticket de un solo uso que vence en un minuto. Ninguna sesión viaja en una dirección.
- Las bases anteriores se migran al abrir; las fechas nuevas arrancan ese día, así nada existente se borra el día del deploy.

## Consecuencias
+ La base crece con lo que se juega en el último mes, no con todo lo jugado.
+ Un log o un historial del navegador ya no alcanzan para entrar a la cuenta de otro.
- Un replay que no se descargó a tiempo se pierde.
- Un invitado que no juega por un mes pierde su progreso.
