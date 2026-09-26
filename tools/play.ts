import { createBot, createInitialState, step, type BotMode, type GameState } from "@td/sim";

export const MAX_TICKS = 40000;

export interface PlayOptions {
  seed: number;
  mode: BotMode;
  botSeed?: number;
  gold?: number;
  mapId?: string;
  /** Stop after this many ticks even if the game is still running. */
  untilTick?: number;
}

/** Runs a full headless game with the reference bot. */
export function playGame(opts: PlayOptions): GameState {
  const bot = createBot(opts.mode, opts.botSeed ?? 0);
  const limit = Math.min(opts.untilTick ?? MAX_TICKS, MAX_TICKS);
  let state = createInitialState({ seed: opts.seed, gold: opts.gold, mapId: opts.mapId });
  while (state.status === "playing" && state.tick < limit) {
    state = step(state, bot.decide(state));
  }
  return state;
}
