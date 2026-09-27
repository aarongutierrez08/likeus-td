# ADR 008 — Contenido como datos: una torre o enemigo es una entrada en `balance/`

Estado: aceptado
Fecha: 2026-09-27
Extiende al 005.

## Contexto
Agregar una torre exigía tocar siete lugares: la unión `TowerKind`, la tabla `TOWERS` con todos los campos de todas las familias, el acumulador de daño por tipo en el estado, la tabla de la herramienta de balance, los colores del render, las etiquetas de la tienda y del panel, y los íconos por tipo. Los enemigos, cuatro. Cada lugar era una tabla paralela que se desactualizaba sola.

## Decisión
Una torre o un enemigo se define en un solo lugar, `packages/sim/src/balance/towers.ts` o `enemies.ts`, y declara solo lo que hace: `cost` más bloques opcionales por familia (`attack`, `aura`, `income`; futuras `control`, `utility`). `defineTowers`/`defineEnemies` normalizan la declaración a un objeto con todos los campos (cero en lo que la torre no hace), y las familias se detectan por dato (`hasAttack`, `hasAura`, `hasIncome`), nunca por nombre de tipo.

Todo lo demás se deriva: `TowerKind = keyof typeof TOWERS`, `TOWER_KINDS = Object.keys(TOWERS)` (el orden de declaración es el orden de la tienda y el desempate del bot), `damageByTower` desde `TOWER_KINDS`, íconos por familia.

La presentación mínima (`label`, `color`, `radius` en enemigos) vive junto al dato porque es parte de "qué es" la torre; sin eso, tienda y render vuelven a enumerar tipos.

## Consecuencias
+ Agregar contenido es agregar una entrada. `pnpm check` en verde sin tocar otro archivo es la prueba.
+ Una familia nueva es un bloque opcional en la declaración, un campo con default en el normalizado y un sistema que lo lea. Las torres existentes no cambian.
+ Los tests siguen leyendo `TOWERS.archer.damage`: la forma normalizada es la misma de siempre.
- `balance/` conoce dos datos de presentación. Aceptado: son datos, no lógica, y evitan las tablas paralelas.
- Una torre con dos familias (ataque y aura) es válida por construcción; los sistemas ya lo soportan, la tienda muestra la primera.

## Alternativas descartadas
- Tablas paralelas en el cliente con `Record<TowerKind, …>`: el tipo obliga a completarlas, pero cada torre nueva sigue siendo siete archivos y los valores no tienen dueño.
- Clases por torre con polimorfismo: mete comportamiento en balance y rompe el ADR 005; las familias como datos cubren lo mismo con `if`.
