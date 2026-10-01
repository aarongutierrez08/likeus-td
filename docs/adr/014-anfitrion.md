# ADR 014 — El anfitrión libera la oleada

Estado: aceptado
Fecha: 2026-09-30
Reemplaza el quórum para llamar oleadas del 007.

## Contexto
El ADR 007 pedía que, desde 4 jugadores, dos distintos llamaran la misma oleada antes de tiempo. En la práctica nadie sabía quién había pedido y la oleada quedaba a medias. El diseño pide un solo responsable del ritmo, con el bono de oro para todos.

## Decisión
El estado de la sim tiene un `host`. Solo él puede `callWave`; el bono por tiempo ahorrado lo cobran todos, como antes. El anfitrión cede el rol con `passHost`. Si se va, la sim se lo da al asiento siguiente (con vuelta al más bajo); si se desconecta, el server emite `passHost` en su nombre hacia el siguiente asiento conectado. En el lobby el server mueve el rol directo, y al empezar la partida la sim arranca con ese anfitrión.

El anfitrión de la sala (empezar, velocidad, expulsar) y el de la sim son el mismo: el server sigue a `sim.host` después de cada tick y avisa con el mensaje `host`.

## Consecuencias
+ Un solo rol, visible en el HUD, en lugar de un conteo que nadie veía.
+ El quórum y `waveCalls` desaparecen del estado y de la economía.
- Un anfitrión que no llama nunca hace que todos esperen la cuenta regresiva completa; el rol se puede pedir por chat y ceder.

## Alternativas descartadas
- Votación por mayoría: más estado y la misma confusión que el quórum.
