# Diseño de Likeus TD

Tower defense cooperativo (1 a 8), minimalista, en navegador. Referente: Fortaleza TD (Element TD en Discord). Objetivo: un poco más profundo que eso, sin más menús.

Frase de identidad que todo lo demás sirve: *defendé con tus amigos, con vuestros memes, y compartí el desastre.*

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

Fortaleza TD y Element TD son referencia de arquitectura (contrajuego, auras, roguelite, curva), no de contenido: no se copian nombres, ramas, fusiones ni enemigos. Todo lo que se ve en pantalla tiene voz propia.

### Voz para nombrar
- Nombres cortos, en español rioplatense, con humor seco.
- Dicen qué hace la torre antes que qué es: "Frena" antes que "Guardián".
- Sin fantasía genérica (arcano, místico, ancestral) ni terminología de otros TDs.
- Cada rama y cada enemigo se explica en una línea que se lee en la tienda o el calendario.

## Vocabulario
- **Pregunta de oleada**: la carencia que castiga esa oleada.
- **Palanca**: el número que se toca para balancear, en orden de preferencia (ver `.claude/rules/balance.md`).
- **Carta**: cualquier cosa que un jugador lleva a la partida: torre, habilidad o doctrina.
- **Mazo**: las cartas que un jugador eligió para una partida.
- **Habilidad**: acción activa con enfriamiento que se usa durante la oleada.
- **Doctrina**: modificador pasivo que cada jugador elige durante la partida, cada 5 oleadas. Afecta solo lo suyo.
- **Anfitrión**: el jugador que libera la oleada antes de tiempo. El rol pasa de mano si se va.

## Cartas
Una carta es cualquier cosa que un jugador lleva a la partida. Tres tipos:
- **Torre**: se compra y coloca. Lo de siempre.
- **Habilidad**: acción activa con enfriamiento. Se usa durante la oleada. Se mejora con oro en partida (3 niveles) igual que una torre: cada nivel reduce el enfriamiento o amplía el efecto, nunca las dos cosas.
- **Doctrina**: modificador pasivo que se elige durante la partida (ver Doctrinas por jugador).

### Mazo
- Antes de la partida cada jugador arma su mazo desde su colección: **5 torres + 2 habilidades**. En solo, 8 torres + 2 habilidades.
- Restricción de cobertura: el mazo debe incluir al menos dos tipos de ataque distintos. El lobby avisa si el equipo no cubre las cuatro armaduras, pero no lo impide: es parte del chiste.
- En una sala, cada jugador solo compra torres de su propio mazo. Las torres ajenas se ven y se benefician de auras ajenas, pero no se compran. Así el equipo se completa entre todos.
- Mazos guardados con nombre (hasta 5 por cuenta). Invitados tienen un mazo por defecto y uno editable no persistente.
- El bot informado juega el mazo por defecto (el simtest lo mide); el bot al azar arma un mazo válido al azar, y así `/balance` mide mazos distintos.

### Colección
- Un **set base** de cartas siempre disponible para todos.
- Cartas de **temporada** que se suman por un tiempo (ver Temporadas).
- Nada se compra con dinero; los desbloqueos están en Cuentas y progreso.

### Reglas de balance de cartas
- Toda carta que multiplica lleva tope o rendimiento decreciente.
- Una habilidad no reemplaza a una torre: su daño total por partida debe ser menor que el de una torre de su costo equivalente. Su valor es el *momento* (salvar una oleada), no el daño por segundo.
- Las doctrinas afectan solo al jugador que las eligió: sus torres, su oro, sus habilidades.

## Ramas de nivel 3
Al pagar el último nivel la torre elige una de dos identidades. Una es "más de lo mismo, mejor", para el que no quiere pensar; la otra "cambia cómo se usa": otro objetivo, otro efecto, otra forma. Cada rama tiene nombre corto y una línea que se lee en el panel. Ninguna rama que cambia el uso es puro número. La Tranquera no se mejora y no tiene ramas.

| Torre | Más de lo mismo, mejor | Cambia cómo se usa |
|---|---|---|
| Pincha | **Al gordo**: de lejos y siempre al de más vida | **A lo loco**: el doble de tiros, de cerca |
| Maldice | **Mal de ojo**: más daño por golpe | **Contagio**: el golpe se pasa a un vecino, nunca más de dos |
| Mazazo | **Piña**: más pesado, más lento | **Sacudón**: pega a todos los pegados al objetivo |
| Reviente | **Bombazo**: más daño, misma área | **Cañita voladora**: vuela lejos, no tira a lo que tiene encima |
| Heladera | **Freezer**: frena más y dura más | **Ola polar**: frena a todos en un área, menos |
| Cachetazo | **Nocaut**: aturde más tiempo | **Chirlo**: seguido y a uno solo |
| Hinchada | **Barra brava**: radio 1, bono alto | **Popular**: un radio más, menos bono |
| Mate | **Café**: más cadencia | **Catalejo**: los vecinos llegan más lejos en vez de tirar más seguido |
| Propina | **Coima**: más porcentaje para vos | **Vaquita**: el extra se reparte entre todos, menos |
| Alcancía | **Plazo fijo**: más oro por oleada | **Caja de ahorro**: en vez de oro, sube tu tope de interés |
| Chusma | **Portera**: ve más lejos | **Escrache**: lo que ve recibe más daño de todos |

## Tranquera (muro con vida)
- Se construye sobre el camino. Los enemigos se detienen frente a él y lo golpean hasta destruirlo; el camino es fijo, así que no hay desvío. Jefes y pesados le pegan más fuerte.
- No se repara ni se mejora, y no se puede vender mientras lo están golpeando.
- Uno activo por jugador y un enfriamiento tras caer, para que ocho jugadores no bloqueen el camino en cadena.
- Su vida no escala con la oleada: si en la 15 dura un segundo, está bien; ahí se lo mejora.
- Es la versión que crea decisiones: dónde frenar la oleada para que el cañón y las auras trabajen, y cuándo. Un obstáculo con temporizador sería una habilidad disfrazada.

## Habilidades
Dos por jugador. Primer set (4 en total, el jugador elige 2):
- **Bombardeo**: daño explosivo en un área elegida, con un segundo de retraso visible.
- **Escarcha**: ralentiza todo lo que esté en un tramo del camino durante N segundos.
- **Sobrecarga**: una torre propia dispara al doble de cadencia durante N segundos.
- **Reparación**: recupera 1 vida del equipo. Enfriamiento largo. Es la habilidad "del que cuida".

Mejoras por oro, niveles 1-3. Costo de mejora en `balance/`. Enfriamientos en ticks, mostrados en segundos.

## Doctrinas por jugador
- Cada 5 oleadas (al cierre de la 5, 10, 15…) cada jugador ve **3 doctrinas** y elige 1. Tiene hasta el inicio de la siguiente oleada; si no elige, no recibe nada (no se elige por él).
- Las 3 salen de un pool **dirigido**: al menos una es relevante para lo que el jugador construyó (si tiene auras, aparece una de auras). Las probabilidades se muestran.
- **Un reroll** por elección, cuesta oro (precio en `balance/`).
- Efecto solo sobre lo propio. Ejemplos del set base: auras +1 de radio; tranqueras nuevas +50% de vida; interés +2 puntos (el tope sube 5); primera torre de cada oleada 20% más barata; habilidades enfrían 15% más rápido; explosivo +10% contra pesada (modifica la tabla solo para ese jugador, hasta +10%).
- Todo sale de la RNG de la sim: mismo seed y mismos comandos, mismas ofertas.
- Al final de la partida se muestran las doctrinas de cada uno: es parte del "compartí el desastre".

## Ritmo y economía de oleada
Se mantiene lo que hay, con un cambio de quién llama:
- **Interés** con tope por oleada, personal. Sin cambios.
- **Liberar la oleada antes** lo hace solo el **anfitrión**; el bono de oro por tiempo ahorrado lo cobran todos. Se elimina el quórum.
- Si el anfitrión se desconecta, el rol pasa al siguiente asiento ocupado. El anfitrión puede ceder el rol desde el lobby o durante la partida.

## Temporadas
- Una temporada dura unas 8 semanas. Trae: un set de cartas nuevas (3-5), 1 mapa, cosméticos, un tema (a definir más adelante; acá solo el sistema).
- Al terminar, sus cartas pasan al **archivo**: usables en salas privadas y en solo, no en públicas ni en la seed diaria. Así nada se pierde, pero las públicas mantienen un pool acotado y balanceado.
- Cada temporada sube `BALANCE_VERSION`. La seed diaria y los rankings se resetean por temporada.
- Nivel de temporada (XP de la temporada) y nivel de cuenta (acumulado) son distintos.

## Cuentas y progreso
### Identidad
- **Invitado por defecto**: al entrar se genera una identidad local (id + nombre editable) guardada en el navegador. Se juega al instante.
- **Vincular cuenta**: con Discord o Google. Al vincular, el historial del invitado de ese navegador se adopta. Una cuenta puede tener Discord y Google a la vez: se agrega el segundo desde la sesión abierta, y si tenía progreso propio, se unen (ADR 019). Nunca se unen por mail. Sin contraseñas propias, nunca.
- El server valida el token del proveedor y es la única autoridad sobre XP, nivel, historial y desbloqueos. El cliente nunca escribe nada de eso.

### Historial
Por partida terminada: fecha, modo, mapa, seed, jugadores, resultado, oleada alcanzada, mazo usado, doctrinas elegidas, link al replay. Las partidas con parámetros de desarrollo no se registran.

### XP y nivel
- XP por partida = f(oleada alcanzada, victoria, N jugadores). Bonus chico por co-op (nunca más del 25%). Tope diario para que grindear no sea la forma de subir.
- Los niveles desbloquean **solo cosméticos y opciones**: colores extra, marcos de nombre, ranuras de diseño propio, mazos guardados extra. Nunca cartas con poder ni ventajas de partida.
- Las cartas de temporada se desbloquean por *jugar* (misiones simples: "ganá una partida con 3 tipos de ataque"), no por nivel.

## Identidad visual del jugador
### Color de jugador
- 8 colores fijos, distinguibles entre sí y para daltónicos (paleta a definir; contraste probado sobre el mapa).
- Se asigna al entrar y se puede cambiar en el lobby si está libre. Persistente en la cuenta como preferencia.
- Aparece en: las torres propias (base o anillo), el nombre en el HUD y el chat, el oro flotante, la marca en el calendario de doctrinas, la pantalla de fin.
- Una torre siempre se identifica por *forma* (tipo) y *color* (dueño), nunca solo por color.

### Diseños propios
- Desde cierto nivel, el jugador puede reemplazar el sprite de una torre y de su disparo por un diseño propio: un gif o una secuencia de imágenes.
- La app asiste: recorta, redimensiona a un tamaño fijo, limita frames y peso, muestra la vista previa sobre el mapa y con el anillo de color. Se sube como sprite sheet ya normalizado.
- El color de jugador se aplica como **anillo/contorno** que dibuja el juego alrededor del diseño; el diseño nunca lo tapa.
- Alcance: el dueño lo ve siempre. Los demás lo ven en salas privadas, o en públicas solo si activaron "ver diseños ajenos". Nunca en rankings ni capturas oficiales. Botón de reportar en el panel de torre.
- Ranuras: 1 al desbloquear, más por nivel.
- Nada de esto toca la sim: es cosmético puro, y así debe quedar.

## Camino de mecánicas (estado: ✅ hecho · 🔧 en curso · ⬜ pendiente)
1. ✅ Sim determinista, lockstep, salas, lobby, 3 mapas, vender/mejorar, mina, aura, economía co-op.
2. ✅ Contenido como datos; sin jitter de vida.
3. 🔧 Tipos de ataque × armadura, 6 enemigos, oleadas por composición, calendario en HUD.
4. ✅ Familias: control (ralentizar, aturdir en área), muro con vida, auras de cadencia y de oro. Mismo tipo no apila.
5. ✅ Ramas excluyentes en nivel 3: cada torre elige una de dos identidades.
6. ✅ Enemigos con comportamiento: invisible (pide radar), sanador, escudo al primer golpe, se divide al morir, jefe cada 10 con afijo. Calendario a 20.
7. ✅ Color de jugador, sin diseños propios. Torre: forma por familia, color de dueño en el anillo, tipo por glifo y panel, nivel por marcas.
8. ✅ Bichos al azar dentro de la oleada: los comunes salen en orden mezclado con la RNG de la sim y los jefes siempre después de todos los comunes; el calendario muestra la composición, no el orden. Si algún día hay comunes con afijo, se decide ahí dónde salen.
9. ✅ Habilidades, como primer tipo de carta nuevo (ADR 010). Cada habilidad es carta de su dueño: la mejora, la usa y la espera solo él, aunque su efecto ayude al equipo. Números de relleno hasta el punto 15; el bot todavía no las usa.
10. ✅ Mazo por jugador, con el set base y sin colección persistente (ADR 011). En solo se arma en una pantalla previa; en co-op, en el lobby antes de marcar listo, con aviso de armaduras sin cubrir. El navegador recuerda el último mazo por modo. El bot informado juega el mazo por defecto y el simtest lo mide; `/balance` suma mazos al azar.
11. ✅ Doctrinas por jugador (ADR 013). Seis en el set base: Barrio (auras +1), Candado (tranquera +50% de vida), Colchón (interés +2 y tope +5), Rebaja (primera torre de cada oleada 20% menos), Manija (habilidades 15% más rápidas), Dinamita (explosivo +10% contra pesada). "Muros reflejan" se cambió por Candado: con daños de 1 a 8 por tick, el 10% no existe en enteros. El HUD muestra la probabilidad exacta de cada una en la próxima tirada.
12. ✅ Anfitrión libera la oleada (ADR 014, reemplaza el quórum del 007). Se cede desde el lobby o el HUD; si se va o se desconecta pasa al siguiente asiento. El anfitrión de la sala y el de la partida son el mismo rol.
13. ✅ Economía: mercado por jugador con precios que suben al comprar y bajan por oleada (ADR 015); Alcancía rebalanceada para que cada nivel rinda parecido por oro y Caja de ahorro sea una opción real.
14. ✅ Casillas de desvío acotadas (ADR 016). Uno o dos rodeos por mapa; los abre el anfitrión entre oleadas, por oro, con sus celdas libres; son permanentes y el tramo que saltean deja de construirse.
15. 🔧 Ronda de `/balance` completa + playtest con amigos. La ronda con bots está hecha (`docs/balance.md`); falta el playtest (`docs/playtest.md`). Queda abierto, como cambio de lógica y no de números: el área del Reviente se lleva la sinergia de la Heladera, y el bot informado gana el 100%.
16. ✅ Infinito con puntaje y seed diaria con ranking (ADR 017). Desde la pantalla de mazo: Jugar, Infinito o Desafío del día. El server repite cada partida diaria para validar su puntaje; el ranking vive en memoria hasta el punto 17.
17. ✅ Cuentas: invitado + vincular con Discord o Google, historial con replays, experiencia con tope diario (ADR 018). Todo en nuestro server con SQLite; para producción faltan el volumen y las credenciales (`docs/cuentas.md`).
18. ⬜ Temporadas.
19. ⬜ Diseños propios. Pendiente de ADR: tamaño, cantidad de frames y peso máximo del sprite sheet (orden de 64 px, ≤12 frames, ≤200 KB).
20. ⬜ Versus (mandar enemigos al rival), bots de relleno en públicas, Discord Activity.
21. ⬜ Visual y animación, con todo lo anterior cerrado.

Cada punto es una o dos sesiones de `/feature`.
Regla: balance serio recién después del punto 6. Antes, los números son de relleno.
Regla: animación y diseño visual quedan para después de que las mecánicas estén cerradas. Todo se muestra con texto y los colores que ya hay. El color de jugador (punto 7) es la única excepción: es identidad, no decoración.

## Descartado y por qué
- **Apuesta de oleada** (bono condicionado a no perder vidas): agrega tensión pero también reproches en co-op; no sirve a la identidad.
- **Doctrinas de equipo**: con 8 jugadores todo lo apilable rompe, y una doctrina que afecta a todos borra los roles emergentes. Cada doctrina afecta solo a quien la eligió.

## Diario de sensaciones
Una línea por sesión de juego, la escribe el usuario. "¿Fue más divertido que la anterior? ¿Qué decisión tomé?"
