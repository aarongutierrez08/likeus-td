# Diseño de Likeus TD

Tower defense cooperativo (1 a 8), minimalista, en navegador. Referente: Fortaleza TD (Element TD en Discord). Objetivo: un poco más profundo que eso, sin más menús.

## Pilares (en orden; si dos chocan, gana el primero)
1. **Legible en 5 segundos.** Antes de cada decisión el jugador sabe qué viene y qué hace cada torre. Rangos visibles antes de comprar, calendario de próximas oleadas, daño mostrado ya con multiplicadores.
2. **Una decisión con peso por oleada.** Cada oleada plantea una pregunta (¿tenés área? ¿algo contra encantados? ¿daño por golpe?) y ninguna torre sola responde todas.
3. **Sinergia antes que stats.** Ganás combinando (tipos, auras, control), no comprando "la mejor torre".
4. **Cada partida distinta.** Seed, doctrinas y mapa cambian la jugada óptima. La meta-progresión es horizontal: desbloquea opciones, nunca poder.
5. **Nunca quieto.** Siempre hay algo que hacer durante la oleada: llamar antes, habilidades, reposicionar.
6. **Co-op con roles emergentes.** Vidas del equipo, oro propio, regalos: alguien puede ser el economista, otro el defensor.

## Lo que aprendimos de otros TDs
- La dificultad viene de la composición y el comportamiento enemigo, no de multiplicar vida. Oleada 10 no es la 1 con números grandes.
- Contrajuego explícito (tipo de ataque × armadura) en un ciclo aprendible: perforante > ligera > contundente > pesada > explosivo > sin armadura > mágico > encantada > perforante.
- Las auras del mismo tipo no apilan; de tipos distintos sí. Con 8 jugadores todo lo apilable rompe.
- Roguelite ligero (elegir 1 de 3 cada N oleadas) resuelve "la partida óptima es siempre la misma". Con pool dirigido, probabilidades visibles y reroll limitado.
- Combos descontrolados matan el juego: topes suaves y rendimientos decrecientes en todo lo que multiplica.
- La curva inicial deja respirar: las tres primeras oleadas se ganan con cualquier cosa razonable.
- Mazing puro es costoso de balancear y un jugador puede arruinar la sala. Vamos a casillas de desvío acotadas.

## Vocabulario
- **Pregunta de oleada**: la carencia que castiga esa oleada.
- **Palanca**: el número que se toca para balancear, en orden de preferencia (ver `.claude/rules/balance.md`).
- **Doctrina**: modificador de partida elegido cada 5 oleadas.

## Camino de mecánicas (estado: ✅ hecho · 🔧 en curso · ⬜ pendiente)
1. ✅ Sim determinista, lockstep, salas, lobby, 3 mapas, vender/mejorar, mina, aura, economía co-op.
2. ✅ Contenido como datos; sin jitter de vida.
3. 🔧 Tipos de ataque × armadura, 6 enemigos, oleadas por composición, calendario en HUD.
4. ⬜ Familias: control (ralentizar, aturdir en área), muro con vida, auras de cadencia y de oro. Mismo tipo no apila.
5. ⬜ Ramas excluyentes en nivel 3: cada torre elige una de dos identidades.
6. ⬜ Enemigos con comportamiento: invisible (pide radar), sanador, escudo al primer golpe, se divide al morir, jefe cada 10 con afijo. Calendario a 20.
7. ⬜ Habilidades del comandante con enfriamiento (2-3).
8. ⬜ Economía: mercado con precios que suben al comprar y bajan por oleada; rebalance de mina.
9. ⬜ Doctrinas cada 5 oleadas: 1 de 3, pool dirigido, un reroll.
10. ⬜ Casillas de desvío acotadas (no-linealidad).
11. ⬜ Infinito con puntaje y seed diaria con ranking (requiere generador de oleadas).
12. ⬜ Versus (mandar enemigos al rival), bots de relleno en públicas, Discord Activity.

Regla: balance serio recién después del punto 6. Antes, los números son de relleno.
Regla: animación y diseño visual quedan para después de que las mecánicas estén cerradas. Todo se muestra con texto y los colores que ya hay.

## Diario de sensaciones
Una línea por sesión de juego, la escribe el usuario. "¿Fue más divertido que la anterior? ¿Qué decisión tomé?"
