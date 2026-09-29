# ADR 009 — La tabla tipo de ataque × armadura es regla del juego, no balance

Estado: aceptado
Fecha: 2026-09-28
Extiende al 005.

## Contexto
Cada torre de daño tiene un tipo de ataque (perforante, contundente, mágico, explosivo) y cada enemigo una armadura (sin armadura, ligera, pesada, encantada). Una tabla 4×4 dice cuánto rinde cada tipo contra cada armadura. El pilar "una decisión con peso por oleada" depende de que el jugador aprenda esa tabla una vez y la use toda la partida; si sus valores cambiaran en cada ronda de balance, no habría nada que aprender. El ADR 005 dice que todo número vive en `balance/` y se ajusta con `BALANCE_VERSION`, lo que no distingue una regla de un precio.

## Decisión
La tabla es un cuadrado latino: cada tipo de ataque hace 150% contra exactamente una armadura y 50% contra exactamente otra, y 100% contra el resto; cada armadura es débil a un solo tipo y resiste a un solo tipo. Toda fila y toda columna promedian 100%, así ningún tipo es mejor en promedio y ningún enemigo es blando contra todo. El ciclo es perforante > ligera > contundente > pesada > explosivo > sin armadura > mágico > encantada > perforante.

Los valores viven en `packages/sim/src/balance/damage.ts` porque son datos y el resto del código los lee como cualquier otro dato, pero no son palanca de balance: no se modifican para arreglar una torre o una oleada. Cambiar un valor, un tipo o una armadura exige un ADR nuevo que reemplace a este. Los tests de `damage-types.test.ts` verifican la forma de cuadrado latino, no los valores concretos.

## Consecuencias
+ El contrajuego es aprendible y estable entre versiones: la tabla se muestra en tienda y panel y el jugador puede confiar en ella.
+ El balance queda acotado a precio, composición, cadencia, rango, daño y vida por oleada, en ese orden (`.claude/rules/balance.md`).
- Una torre desequilibrada contra cierta armadura se corrige por precio o por composición de oleadas, nunca por su multiplicador, aunque el multiplicador sea la palanca más directa.
- Con cuatro tipos y cuatro armaduras el cuadrado latino no deja lugar a un quinto tipo sin rehacer la tabla completa.

## Alternativas descartadas
- Tratar la tabla como balance y ajustarla por ronda: rompe el aprendizaje del jugador y vuelve a "la mejor torre" en lugar de "la torre correcta".
- Mover la tabla fuera de `balance/` para marcarla como regla: la ubicación no la protege más que este ADR y obliga a que `balance/` deje de ser el único lugar con números.
- Tabla no simétrica (algún tipo con dos armaduras a 150%): un tipo mejor en promedio hace que la decisión de oleada tenga una respuesta fija.
