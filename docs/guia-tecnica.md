# Guía técnica de Likeus TD

Para quien llega nuevo al proyecto. Explica qué es, cómo está armado, por qué se eligió cada pieza y cuáles son las decisiones que no conviene romper sin pensarlo. No entra en detalles de implementación: para eso está el código, que es chico y está tipado.

## Qué es

Un tower defense minimalista: enemigos caminan por un camino fijo, el jugador pone torres en las celdas libres, y hay que sobrevivir 10 oleadas con 20 vidas. Se juega solo o en cooperativo hasta 8 personas, cada una con su oro, compartiendo vidas y mapa. Corre en el navegador, en escritorio y en móvil, sin instalar nada.

## Cómo está organizado

Un monorepo con tres paquetes y una carpeta de herramientas:

| Paquete | Qué es | Corre en |
|---|---|---|
| `packages/sim` | Las reglas del juego: mapa, torres, enemigos, oleadas, economía. Una función `step(estado, comandos) → estado` y nada más. | Navegador y server, el mismo código |
| `packages/server` | Las salas multijugador: crear, unirse, validar comandos, repartir ticks, reconectar, reportar problemas. | Node, en Fly.io |
| `packages/client` | Lo que se ve: el mapa dibujado, el HUD, la tienda, el lobby, el chat. | Navegador, publicado en Cloudflare Pages |
| `tools/` | Scripts de desarrollo: bot que juega solo, tabla de balance, capturas, pruebas de extremo a extremo, lectura de reportes. | Terminal |

La idea central: **la sim es pura y determinista**. Con la misma semilla y los mismos comandos produce exactamente el mismo estado, en cualquier máquina, tick a tick. Todo lo demás se apoya en eso.

## El stack y por qué

| Tecnología | Para qué | Por qué esta y no otra |
|---|---|---|
| TypeScript estricto | Todo el código | Un solo lenguaje para sim, server y cliente, y los errores salen al compilar, no en una partida. |
| pnpm workspaces | Monorepo | Tres paquetes que se importan entre sí desde el código fuente, sin publicar nada. |
| Vite | Servidor de desarrollo y build del cliente | Recarga instantánea y un build estático de menos de 1 MB. |
| PixiJS | Dibujar el mapa y las entidades | Usa la GPU y agrupa cientos de sprites sin esfuerzo. Solo dibuja el mapa: nada de texto ni menús en el canvas. |
| Solid | HUD, tienda, lobby, chat | Interfaz en HTML normal: accesible, responsive, fácil de iterar. Es chico y rápido; no necesitábamos React. |
| Colyseus | Salas multijugador sobre WebSocket | Trae salas con código, listado, reconexión y expulsión ya resueltos. Se usa como adaptador delgado: la lógica de juego nunca está ahí. |
| vitest | Tests | Rápido, corre TypeScript sin configuración, mismo runner para sim y server. |
| Playwright | Capturas de pantalla y prueba de dos navegadores contra un server real | Automatiza un navegador de verdad: es la única forma de probar el co-op completo sin dos personas. |
| ESLint y Prettier | Lint y formato | Errores comunes (promesas sin manejar, reactividad de Solid mal usada) y un solo estilo, sin discutirlo en cada cambio. |
| GitHub Actions | Integración continua y deploy | En cada push a `master` corre tipos, lint, tests y la partida de referencia; si pasa, publica server y cliente. |
| Fly.io | Hosting del server | Un contenedor Node con costo fijo y predecible. La imagen se arma con el `Dockerfile` del server. |
| Cloudflare Pages | Hosting del cliente | Archivos estáticos, gratis, replicados en todo el mundo. El cliente se compila con la URL del server incrustada. |

## Decisiones importantes

Cada una tiene su ADR de una página en `docs/adr/`. Resumen en lenguaje llano:

1. **Simulación determinista con enteros** (ADR 001). Nada de números al azar del sistema, ni fechas, ni punto flotante en el estado. El azar sale de un generador propio con semilla. Esto permite replays, guardar partidas, detectar trampas y probar todo sin navegador.
2. **Lockstep con servidor árbitro** (ADR 002). Los clientes no reciben el estado del juego, solo los comandos de todos, y cada uno recalcula la partida. El server valida cada comando antes de repartirlo. Estado completo solo al entrar, reconectar o si alguien se desincroniza.
3. **Colyseus como backend inicial** (ADR 003). Cambiar de host o de framework significa reescribir un archivo.
4. **HUD en HTML, mapa en canvas** (ADR 004). Los botones y textos son HTML: funcionan en móvil y se leen bien. El canvas solo dibuja el juego.
5. **Balance como datos** (ADR 005). Todos los números viven en `packages/sim/src/balance/`. Cambiar un número no toca lógica. Cualquier cambio que altere cómo se juega sube `BALANCE_VERSION`, que invalida replays y guardados viejos a propósito.
6. **En co-op el reloj lo marca el server** (ADR 006). El cliente avanza un tick solo cuando el server se lo manda. Cada segundo llega un hash del estado; si el del cliente difiere, pide un estado completo y sigue. Costo: la vista va medio viaje de red detrás del server, imperceptible en un TD.
7. **Economía multijugador** (ADR 007). Vidas del equipo, oro de cada uno. Cuando muere un enemigo cobran todos, un poco menos por cabeza cuanta más gente hay; los enemigos tienen más vida cuantos más jugadores. Interés al cerrar cada oleada, se puede llamar la siguiente antes de tiempo, regalar oro desde la oleada 3, y las minas pagan solo a su dueño.

## Cómo se juega, en dos párrafos

Solo: se abre la página, arranca una partida con semilla al azar. Cuatro torres: arquero (barata, rápida), cañón (caro, daño en área), aura (potencia a las torres vecinas) y mina (oro por oleada). Cada torre se puede mejorar dos veces o vender al 75%. Botones de velocidad 1×, 2×, 4×. Parámetros de URL para pruebas, solo en desarrollo: `?seed=&map=&gold=&wave=&tick=&tower=&bot=1&dump=1`.

Co-op: `?mode=coop&name=Tu nombre`. Uno crea la sala (pública o privada, elige mapa) y comparte el código de 4 letras; los demás entran con el código o desde la lista. El anfitrión empieza, controla la velocidad y puede expulsar. Si alguien pierde conexión tiene 30 segundos para volver con su oro y sus torres; si no vuelve, sus torres pasan al equipo y su oro se reparte. Con nadie conectado la partida se pausa. Hay chat y un botón "Reportar problema".

## Cómo se trabaja

Las prácticas del proyecto, en orden de importancia:

- **Nada se da por terminado sin la verificación completa**: tipos, lint, formato, tests, la partida de referencia (un bot debe ganar la semilla 42), una captura de pantalla para mirar, y si se tocó la red, `pnpm coopsmoke` (dos navegadores reales contra un server real).
- **Las reglas del juego se cambian con tests primero**: se escribe el escenario en lenguaje llano ("dado dos auras, el bonus no se apila"), después el test con el helper `scenario()` de `packages/sim/test/helpers/`, se lo ve fallar, y recién entonces la implementación mínima. Los tests de sim son la especificación del juego; no usan mocks ni funciones internas, solo `step()` y el estado.
- **Los números se cambian con datos**: `pnpm balance` juega cientos de partidas con bots, con 1, 2, 4 y 8 jugadores, y arma una tabla. Se mira antes de tocar `balance/`.
- **Los problemas llegan con la partida adentro**: el botón "Reportar problema", un desync o una excepción generan un issue en GitHub con el estado inicial y el log de comandos. `pnpm report replay N` la reproduce exacta en la terminal.
- **Commits chicos, en español, con prefijo** (`feat:`, `fix:`, `chore:`), y `master` siempre en verde.

Comandos del día a día, todos desde la raíz:

```
pnpm dev                 # cliente en :5173 y server en :2567
pnpm check               # tipos, ESLint y Prettier
pnpm test                # tests de sim y de server
pnpm simtest             # el bot juega la semilla de referencia; debe ganar
pnpm balance --players 4 # tabla de balance con bots
pnpm shot --seed 42 --tick 900   # captura en tools/out/
pnpm coopsmoke           # dos navegadores contra un server real
pnpm report list         # reportes de jugadores
```

Requiere Node 22 (hay `.nvmrc`) y pnpm, que se activa con `corepack enable`.

## Publicación

Un push a `master` que pasa las verificaciones publica solo: primero el server en Fly (`https://likeus-td.fly.dev`), después el cliente en Cloudflare Pages (`https://likeus-td.pages.dev`), en ese orden para que un cliente nuevo nunca encuentre un server viejo. Si cambió `packages/sim` o el protocolo, los dos tienen que ir juntos, y CI lo garantiza.

Dos límites actuales, elegidos a propósito: la cuenta de Fly está en modo prueba y apaga la máquina a los 5 minutos hasta que se cargue una tarjeta; y las salas viven en memoria, así que un reinicio del server termina las partidas en curso. Ambas cosas están planeadas para más adelante.

## Dónde mirar cuando algo no cierra

- Una regla del juego: `packages/sim/src/systems/` y `packages/sim/src/commands.ts`; los tests en `packages/sim/test/` son la especificación.
- Un número: `packages/sim/src/balance/`.
- Algo de red o de salas: `packages/server/src/GameRoom.ts` y su test `packages/server/test/room.test.ts`.
- Algo visual: `packages/client/src/render/` para el canvas, `packages/client/src/ui/` para el HTML.
- Por qué se decidió algo: `docs/adr/`.
