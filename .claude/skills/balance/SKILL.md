---
name: balance
description: Evaluar y ajustar el balance del juego con bots sobre varias seeds y cantidades de jugadores. Usar cuando el usuario pida "balanceá", "probá el balance", "es muy fácil/difícil", cuando se agregue o cambie una torre, enemigo, oleada o número en packages/sim/src/balance, o antes de subir BALANCE_VERSION. Sigue los umbrales y palancas de .claude/rules/balance.md.
---

# /balance

Datos primero, números después. Nunca aplicar cambios sin aprobación.

## 1. Medir
- `pnpm balance --runs 20 --seeds 1-20 --players 1` y lo mismo con `--players 2`, `4`, `8`, con bots al azar y con el bot informado.
- Daño por tick por cada 100 de oro de cada torre de daño, nivel 1, multiplicador 100%. Para torres de área, enemigos tocados por disparo en promedio.
- Por oleada: enemigos y vida total por armadura; totales del calendario en porcentaje.

## 2. Reportar
Tabla por (jugadores, tipo de bot): victorias, oleada media de derrota, porcentaje del daño total por torre, porcentaje de compras por torre. Después, la tabla de daño por oro y la de armaduras.

## 3. Diagnosticar contra los umbrales de `.claude/rules/balance.md`
Nombrar cada umbral que se viola y la causa más probable (eficiencia por oro vs. calendario vs. accesibilidad de compra vs. artefacto del bot). Si puede ser artefacto del bot, decirlo antes de proponer números.

## 4. Proponer
Cambios concretos de números, usando las palancas en orden de preferencia (precio primero, daño último, la tabla tipo×armadura nunca). Cada cambio dice qué umbral corrige. Máximo 5 cambios por ronda: si hacen falta más, algo estructural está mal y hay que decirlo.

## 5. Tras aprobación
Aplicar, subir BALANCE_VERSION, volver a medir, mostrar antes/después. Actualizar el simtest de referencia si el bot informado dejó de ganar la seed 42 y explicar por qué.
