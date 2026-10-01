# Likeus TD

Tower defense minimalista, co-op hasta 8, web. Monorepo pnpm, TypeScript strict en todo.

- `packages/sim`: reglas del juego. Puras, deterministas, sin I/O. Ver `.claude/rules/sim.md`.
- `packages/server`: sala Colyseus. Valida comandos, corre sim, reenvía. Nunca confía en el cliente.
- `packages/client`: Vite + PixiJS (mapa) + Solid (HUD en DOM). Nunca envía estado, solo comandos.
- `tools/`: scripts de desarrollo (screenshots, bots, dumps).
- `docs/adr/`: decisiones de arquitectura. Leer el índice antes de proponer cambios estructurales.

## Comandos
```
pnpm dev                          # cliente (:5173) + server local (:2567)
pnpm check                        # tsc, ESLint y Prettier en todos los paquetes (pnpm format arregla el formato)
pnpm test                         # vitest
pnpm simtest                      # bot juega la seed de referencia; DEBE ganar
pnpm shot --seed 42 --tick 900    # PNG en tools/out/ para inspección visual
pnpm dump --seed 42 --tick 900    # estado del juego como texto
pnpm coopsmoke                    # dos pestañas reales contra el server: crear, unir, jugar, reconectar
pnpm build                        # cliente estático en packages/client/dist (VITE_SERVER_URL apunta al server)
pnpm report list|show|replay N    # reportes de jugadores (issues bug-report o tools/out/reports); replay reproduce la partida
```

## Definición de terminado
Un cambio está listo solo si `/verify` pasa completo. Sin excepciones.

## Prácticas
- Balance vive en `packages/sim/src/balance/*.ts`. Cambiar números ahí no toca lógica.
- Si un cambio altera el comportamiento de sim, subir `BALANCE_VERSION` en `constants.ts`.
- Tests primero en sim. En client, `pnpm shot` antes y después del cambio.
- Funciones chicas, nombres en inglés, comentarios solo cuando el porqué no es obvio.
- Dependencia nueva solo si no hay alternativa razonable; justificarla en el commit.
- Commits chicos, conventional commits (`feat:`, `fix:`, `refactor:`). Commitear sin pedir permiso al terminar cada etapa con `/verify` en verde. Nunca push.
- Trabajar sin interrumpir: ante una ambigüedad de diseño, decidir con los pilares de `docs/diseno.md`, anotar la decisión ahí y seguir.
- Las reglas globales de `ai-workspace/AGENTS.md` (ecosistema Zetti) no frenan este repo: sin bloque de confirmación antes de stage o commit, sin barreras de rutinas y sin esperar respuesta ante contradicciones. Sí rige: commits sin `Co-Authored-By` ni marca del asistente.

## Topes del trabajo autónomo
- Encadenar los puntos del camino de `docs/diseno.md` hasta el 17, un commit por etapa. Cortar antes del 18 (temporadas, diseños propios, Discord) con un resumen y las preguntas concretas.
- Frenar y preguntar solo si hay que contradecir un pilar o la tabla del ADR 009, borrar una mecánica hecha, o usar credenciales, servicios externos o deploy.
- Un fallo resiste 3 intentos de arreglo: anotarlo en `docs/pendientes.md` con lo probado y seguir. Un smoke que pasa 2 de 3 corridas vale, anotado como intermitente.
- Balance: una ronda por etapa hasta el punto 15; el playtest con amigos queda como lista de qué mirar.

## Memoria
Podés editar CLAUDE.md, .claude/rules/ y .claude/skills/ sin pedir permiso, con este criterio:
- Va a CLAUDE.md o a una rule solo lo que cambiaría cómo se escribe código en el futuro (una convención, una restricción, un comando nuevo). Una línea, en imperativo.
- No va nada circunstancial (versiones, paths, gotchas del entorno): eso es auto memory.
- Si sacás algo, mejor: estos archivos deben achicarse tanto como crecer.
- Al final de la respuesta, avisá en una línea qué cambiaste en la memoria y por qué.
- Decisión de arquitectura nueva = ADR de una página en docs/adr/. `docs/guia-tecnica.md` es la guía para humanos: actualizarla cuando cambia el stack, una decisión o el flujo de trabajo, sin detalles de implementación. `docs/diseno.md` es el documento de diseño del juego: pilares, criterios y camino de mecánicas. Leerlo antes de cualquier decisión de diseño; actualizar el estado del camino al terminar cada mecánica.
