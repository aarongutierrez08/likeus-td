import { DECK, DEFAULT_DECKS, createBot, createInitialState, randomDeck, step, type BotMode, type Deck, type GameState } from "@td/sim";

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

/** The informed bot plays the reference deck; the random one draws a valid deck from its own seed. */
function deckFor(mode: BotMode, botSeed: number, solo: boolean): Deck {
  if (mode === "trivial") return solo ? DEFAULT_DECKS.solo : DEFAULT_DECKS.coop;
  return randomDeck(botSeed, solo ? DECK.soloTowers : DECK.coopTowers);
}

/** Runs a full headless game with one reference bot per player, each with its own deck. */
export function playGame(opts: PlayOptions): GameState {
  const count = Math.max(1, opts.players ?? 1);
  const ids = Array.from({ length: count }, (_, i) => i);
  const botSeed = (id: number): number => (opts.botSeed ?? 0) * 100 + id;
  const bots = ids.map((id) => createBot(opts.mode, botSeed(id), id));
  const limit = Math.min(opts.untilTick ?? MAX_TICKS, MAX_TICKS);
  const solo = count === 1;
  let state = createInitialState({
    seed: opts.seed,
    gold: opts.gold,
    mapId: opts.mapId,
    deckTowers: solo ? DECK.soloTowers : DECK.coopTowers,
    players: ids.map((id) => ({ id, deck: deckFor(opts.mode, botSeed(id), solo) })),
  });
  while (state.status === "playing" && state.tick < limit) {
    state = step(
      state,
      bots.flatMap((bot) => bot.decide(state)),
    );
  }
  return state;
}
