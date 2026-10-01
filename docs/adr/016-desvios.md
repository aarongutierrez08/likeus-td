# ADR 016 — Desvíos acotados: el camino depende de la ruta

Estado: aceptado
Fecha: 2026-09-30
Extiende al 001.

## Contexto
El diseño pide no-linealidad sin mazing: un mazing libre es costoso de balancear y un jugador puede arruinar la sala. Hasta acá el camino dependía solo del mapa, y todo (grilla, posiciones, largo, cobertura del bot, dibujo) se calculaba una vez por mapa.

## Decisión
Cada mapa declara uno o dos desvíos como datos (`MapDef.detours`): reemplazan un tramo de waypoints por otro más largo. El estado guarda los abiertos (`GameState.detours`) y la ruta es el mapa más esos desvíos (`RouteKey`, por ejemplo `"s+0"`). Toda consulta de camino toma una ruta (`routeOf(state)`) y se cachea por ruta; un id de mapa sin desvíos sigue siendo una ruta válida.

Abrir un desvío (`openDetour`) lo hace solo el anfitrión, solo entre oleadas (ningún enemigo en el mapa, así ninguno cambia de camino bajo los pies), una vez, pagando oro y con sus celdas libres de torres. Es permanente. El tramo que saltea deja de ser camino y no se vuelve a construir.

## Consecuencias
+ Una decisión con peso entre oleadas: más camino para las torres a cambio de oro y de celdas que dejan de ser construibles.
+ Agregar un desvío es agregar datos a un mapa.
- Las cachés de grilla y camino crecen con las combinaciones abiertas; con dos desvíos por mapa son cuatro rutas.
- Un desvío alejado de las torres del equipo empeora la defensa: por eso lo decide el anfitrión.

## Alternativas descartadas
- Mazing libre con pathfinding: balance caro y una sola persona puede bloquear o alargar sin límite.
- Desvíos que se abren y cierran: enemigos a mitad de camino y una decisión que no pesa.
