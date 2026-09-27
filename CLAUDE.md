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
- Sin dependencias nuevas sin preguntar.
- Commits chicos, conventional commits (`feat:`, `fix:`, `refactor:`). No commitear sin aprobación.

## Memoria
Podés editar CLAUDE.md, .claude/rules/ y .claude/skills/ sin pedir permiso, con este criterio:
- Va a CLAUDE.md o a una rule solo lo que cambiaría cómo se escribe código en el futuro (una convención, una restricción, un comando nuevo). Una línea, en imperativo.
- No va nada circunstancial (versiones, paths, gotchas del entorno): eso es auto memory.
- Si sacás algo, mejor: estos archivos deben achicarse tanto como crecer.
- Al final de la respuesta, avisá en una línea qué cambiaste en la memoria y por qué.
- Decisión de arquitectura nueva = ADR de una página en docs/adr/. No existe otra documentación.
