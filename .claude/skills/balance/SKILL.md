---
name: balance
description: Evaluar y ajustar el balance del juego. Usar cuando el usuario pida "balanceá", "probá el balance", "es muy fácil/difícil", cuando se agregue o cambie una torre, enemigo, oleada o número en packages/sim/src/balance, o antes de subir BALANCE_VERSION. La medición y el diagnóstico los hace el agente balance; esta skill los pide, los presenta y aplica solo lo aprobado.
---

# /balance

Datos primero, números después. Nunca aplicar cambios sin aprobación del usuario.

1. Delegá al agente **balance**. Pasale: qué cambió y por qué, hipótesis del usuario si las hay, y si hay que medir con algún flag extra de `pnpm balance`. Pedile el reporte completo (tablas, diagnóstico, propuesta). Pasale también `docs/balance.md` (estado y propuesta pendiente), y al cerrar la ronda actualizalo.
2. Mostrá el reporte tal cual, sin resumirlo. Debajo, tu lectura en tres líneas: si coincidís con el diagnóstico, y qué sabés del contexto de la sesión que el agente no sabía.
3. Esperá aprobación explícita de cada cambio.
4. Tras aprobación: aplicá solo lo aprobado en `packages/sim/src/balance/`, subí `BALANCE_VERSION`, volvé a delegar al agente para medir de nuevo, y mostrá antes/después. Si el bot informado dejó de ganar la seed 42, explicá por qué antes de tocar el simtest.
