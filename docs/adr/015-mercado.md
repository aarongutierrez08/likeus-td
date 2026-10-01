# ADR 015 — Mercado por jugador

Estado: aceptado
Fecha: 2026-09-30
Extiende al 007.

## Contexto
El diseño pide precios que suben al comprar y bajan por oleada, para que la respuesta a una oleada no sea siempre "otra más de la misma". Con hasta 8 jugadores, un mercado común haría que las compras de uno encarezcan las torres de los demás: reproches en co-op y roles borrados.

## Decisión
Cada jugador tiene su propio recargo por tipo de torre (`Player.surcharge`, en porcentaje del costo base). Cada compra suma `MARKET.raisePct` hasta `MARKET.maxRaisePct`, y cada cierre de oleada resta `MARKET.decayPct` a todos los tipos, recorridos en orden de declaración. `buildCost` es el único precio: lo usan la validación, la sim, el bot y la tienda. La Rebaja se aplica sobre el precio de mercado. La venta devuelve el porcentaje de siempre sobre el costo base, así que comprar caro y vender no deja ganancia.

## Consecuencias
+ Repetir una torre cuesta, combinar no: empuja la sinergia antes que los stats (pilar 3).
+ Los números del mercado son datos en `balance/economy.ts`.
- La tienda tiene que mostrar el precio del jugador, no el de la tabla; el mazo sigue mostrando el base.

## Alternativas descartadas
- Mercado común del equipo: un jugador encarece las cartas de otro.
- Precio que sube con la cantidad de torres en el mapa: castiga al que defiende bien y no baja nunca.
