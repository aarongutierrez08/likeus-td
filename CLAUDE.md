# TD cooperativo web

Tower defense minimalista, co-op hasta 8, web. Monorepo pnpm, TypeScript strict en todo.

- `packages/sim`: reglas del juego. Puras, deterministas, sin I/O. Ver `.claude/rules/sim.md`.
- `packages/server`: sala Colyseus. Valida comandos, corre sim, reenvía. Nunca confía en el cliente.
- `packages/client`: Vite + PixiJS (mapa) + Solid (HUD en DOM). Nunca envía estado, solo comandos.
- `tools/`: scripts de desarrollo (screenshots, bots, dumps).
- `docs/adr/`: decisiones de arquitectura. Leer el índice antes de proponer cambios estructurales.

## Comandos
```
pnpm dev                          # cliente (:5173) + server local (:2567)
pnpm check                        # tsc --noEmit en todos los paquetes
pnpm test                         # vitest
pnpm simtest                      # bot juega la seed de referencia; DEBE ganar
pnpm shot --seed 42 --tick 900    # PNG en tools/out/ para inspección visual
pnpm dump --seed 42 --tick 900    # estado del juego como texto
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
- Lo que aprendés (comandos, gotchas, preferencias) va a auto memory. Nunca a este archivo ni a `docs/`.
- Este archivo solo cambia con aprobación explícita.
- Decisión de arquitectura nueva = ADR de una página en `docs/adr/`. No existe otra documentación.
