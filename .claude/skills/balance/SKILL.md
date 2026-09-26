---
name: balance
description: Evaluar el balance del juego corriendo muchas partidas con bots sobre varias seeds y resumir en una tabla. Usar cuando el usuario pida "balanceá", "probá el balance", "es muy fácil/difícil", cuando se agregue o cambie una torre, enemigo, oleada o número en packages/sim/src/balance, o antes de subir BALANCE_VERSION.
---

# /balance

1. `pnpm balance --runs 200 --seeds 1-20` (tools/balance.ts: corre partidas headless con el bot de referencia).
2. Leer la salida y armar esta tabla:

| Seed | Oleada de derrota (o WIN) | Oro sobrante | Torre más usada | Torre menos usada |

3. Diagnóstico en 5 líneas máximo:
- ¿Hay una torre que gana sola? (más del 50% del daño total) → está rota.
- ¿Hay una torre que nunca se usa? → está muerta o es muy cara.
- ¿La oleada de derrota es siempre la misma? → hay un muro; revisar esa oleada.
- ¿Las seeds difieren mucho? → hay demasiada varianza en el RNG de oleadas.

4. Proponer cambios concretos de números (no de lógica) en `src/balance/`. No aplicarlos sin aprobación.
