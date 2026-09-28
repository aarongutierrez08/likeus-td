---
paths:
  - "packages/sim/src/balance/**"
  - "tools/balance.ts"
  - "packages/sim/src/bot/**"
---
# Criterios de balance

Leer también `docs/diseno.md`. Todo número vive en `balance/`; la lógica no cambia para balancear.

## Umbrales (medidos con `pnpm balance` en N = 1, 2, 4 y 8)
- Torre rota: más del 40% del daño total del equipo. Torre muerta: menos del 10% y con menos del 5% de compras.
- Daño por oro: todas las torres de daño dentro de ±15% entre sí a multiplicador 100%, nivel 1. Área o utilidad pagan con hasta 25% menos.
- Cada armadura tiene entre 20% y 30% de la vida total del calendario.
- Oro inicial (solo y co-op) alcanza para al menos una torre de cada tipo de ataque.
- Oleadas 1 a 3: cualquier compra razonable gana. Desde la 4, la torre equivocada se nota.
- Los bots al azar deberían ganar entre 30% y 60%; el bot informado entre 70% y 95%. 100% en todos los N = el juego no pregunta nada.
- Con más jugadores no debería llegarse sistemáticamente más lejos ni menos lejos que en solo; si pasa, ajustar `synergyPerPlayerPct`, no las oleadas.

## Palancas, en orden de preferencia
1. **Precio.** Cambia cuándo se compra sin cambiar cómo se siente. Primera opción siempre.
2. **Composición de oleadas.** Cuántos y de qué armadura. Segunda opción para torres muertas o rotas.
3. **Cadencia.** Cambia el ritmo; se percibe.
4. **Rango.** Cambia dónde se pone; toca el mapa.
5. **Daño.** Última opción: cambia la identidad de la torre.
6. **Multiplicadores de la tabla tipo×armadura.** No se tocan: son la regla del juego, no balance. Cambiarlos requiere ADR.
7. **Vida por oleada.** Solo para la curva global, nunca para arreglar una torre.

## Protocolo
Datos primero, números después. Antes de proponer un cambio: daño por oro de cada torre, distribución de armaduras por oleada, tabla de resultados por N. Después la propuesta, con el objetivo que persigue y el umbral que corrige. Nunca aplicar sin aprobación del usuario.

Toda mecánica que multiplica (auras, doctrinas, interés) lleva tope o rendimientos decrecientes desde el primer día.

El bot informado debe poder ahorrar para la mejor respuesta a las próximas oleadas; un bot que compra lo primero que alcanza sesga todo hacia la torre más barata.
