import { createBot, createInitialState, step, type BotMode, type GameState } from "@td/sim";

export const MAX_TICKS = 40000;

export interface PlayOptions {
  seed: number;
  mode: BotMode;
  botSeed?: number;
  /** Number of players, each driven by its own bot. Default 1. */
  players?: number;
  gold?: number;
  mapId?: string;
  /** Stop after this many ticks even if the game is still running. */
  untilTick?: number;
}

/** Runs a full headless game with one reference bot per player. */
export function playGame(opts: PlayOptions): GameState {
  const count = Math.max(1, opts.players ?? 1);
  const ids = Array.from({ length: count }, (_, i) => i);
  const bots = ids.map((id) => createBot(opts.mode, (opts.botSeed ?? 0) * 100 + id, id));
  const limit = Math.min(opts.untilTick ?? MAX_TICKS, MAX_TICKS);
  let state = createInitialState({ seed: opts.seed, gold: opts.gold, mapId: opts.mapId, players: ids.map((id) => ({ id })) });
  while (state.status === "playing" && state.tick < limit) {
    state = step(state, bots.flatMap((bot) => bot.decide(state)));
  }
  return state;
}
