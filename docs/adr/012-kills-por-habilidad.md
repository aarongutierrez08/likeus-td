# ADR 012 — Una kill por habilidad es una kill normal

Estado: aceptado
Fecha: 2026-09-30
Reemplaza la regla de kills del 010.

## Contexto
El ADR 010 decía que una muerte por habilidad pagaba el botín pero no sumaba kills a ninguna torre ni pagaba auras de oro. En la práctica eso le sacaba el crédito a la torre que venía pegando y hacía que la Propina no cobrara por algo que su vecina casi mató. El usuario lo pidió como kill normal.

## Decisión
Una habilidad que daña no pisa quién pegó por última vez. Si una torre le venía pegando, esa torre se anota la kill y su aura de oro paga como en cualquier kill; si ninguna torre le pegó, la kill no es de nadie, como pasa hoy con cualquier enemigo sin golpes de torre.

## Consecuencias
+ Las estadísticas por torre y la Propina no cambian según qué terminó al enemigo.
- El daño de la habilidad sigue contándose aparte (`damageByAbility`); la kill no.

## Alternativas descartadas
- Anotar la kill a la habilidad: agrega un contador que nadie mira y le quita el cobro a la Propina.
