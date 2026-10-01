# ADR 013 — Doctrinas como datos, ofrecidas por la sim

Estado: aceptado
Fecha: 2026-09-30
Extiende al 008.

## Contexto
El diseño pide que cada 5 oleadas cada jugador elija 1 de 3 modificadores pasivos que afectan solo lo suyo, con un pool dirigido, probabilidades visibles y un reroll pago. Tiene que ser determinista (mismo seed y comandos, mismas ofertas) y no puede apilarse entre jugadores.

## Decisión
Una doctrina es una entrada en `balance/doctrines.ts`: nombre, línea, con qué construcción pega (`fits`) y sus efectos como números (`auraRadius`, `wallHpPct`, `interestPct`, `interestCapGold`, `firstTowerDiscountPct`, `abilityCooldownPct`, `armorBonus`). Los sistemas leen la suma de un efecto sobre las doctrinas del dueño (`doctrineEffect`): la doctrina modifica solo lo propio (sus torres, su oro, sus habilidades) y las torres del equipo no tienen ninguna. Como toda carta, puede ayudar a otros: un aura propia con Barrio llega más lejos y potencia también torres ajenas. El reroll excluye la oferta actual mientras el pool alcance para tres distintas.

La oferta vive en el jugador (`doctrineOffer`). La arma la sim con su RNG al cerrar cada oleada múltiplo de 5: un lugar para lo que pega con lo que el jugador construyó, si hay algo, y el resto de todo lo no tomado. Vence cuando empieza la oleada siguiente. `chooseDoctrine` toma una de la oferta; `rerollDoctrines` cobra y tira de nuevo, una vez por oferta. `doctrineOdds` calcula la probabilidad exacta de la próxima tirada para que el HUD la muestre.

## Consecuencias
+ Agregar una doctrina es una entrada; un efecto nuevo es un campo y un lugar que lo lea.
+ Las ofertas consumen la RNG de la sim, así que cambiar el pool cambia el resto de la partida: sube `BALANCE_VERSION`.
- La oferta vence con la oleada siguiente. A 4× la pausa entre oleadas dura menos de dos segundos; con un "llamar oleada" se pierde a propósito.
- Una doctrina no se repite: con seis en el set base, al tercer cierre quedan cuatro para elegir.

## Alternativas descartadas
- Doctrinas de equipo: descartado en el diseño, con 8 jugadores todo lo apilable rompe.
- Pausar la oleada hasta que todos elijan: un jugador colgado frena a ocho.
