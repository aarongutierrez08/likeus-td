# Pendientes

Lo que quedó abierto mientras se avanza el camino de mecánicas. Se resuelve en su punto o en la ronda de balance (punto 15).

## Decisiones para el usuario
- Reparación sin tope de vidas: con 8 jugadores el equipo recupera hasta 8 vidas por enfriamiento y puede pasar de 20.

## Bugs y deuda
- En el celular el calendario de oleadas tapa los botones de velocidad de la barra superior (ya pasaba antes del punto 11).
- coopsmoke: a veces un clic en "Mejorar" no tiene efecto en co-op. El botón no se recrea entre ticks, hay oro y no aparece ningún aviso; el script reintenta hasta tres veces. Causa sin encontrar: revisar si el comando llega al server.
- En el celular la oferta de doctrinas se ancla a una altura fija sobre la barra de habilidades; si la barra crece (detalle de habilidad) puede taparla. Anclarla midiendo la barra y sumar un paso móvil al uismoke.
- `.doctrines-taken` está a una altura fija debajo del calendario; si el calendario crece se superponen.
- `doctrineEffect`/`doctrinesOf` buscan al jugador en cada golpe y en el doble loop de auras; dos tests de 20 oleadas pasaron de ~4 s a ~5 s. Resolver el jugador una vez por tick si se nota en `/balance`.

## Balance
- Desde las doctrinas (BALANCE_VERSION 27) el informado gana la seed 42 con 15 vidas en vez de 20: las ofertas consumen RNG y corren el jitter de las oleadas.
