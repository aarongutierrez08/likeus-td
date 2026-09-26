import type { GameState } from "./types";

const SEED_MIX = 0x9e3779b9;

export function seedRng(seed: number): number {
  let s = ((seed >>> 0) ^ SEED_MIX) >>> 0;
  if (s === 0) s = 1;
  for (let i = 0; i < 4; i++) s = nextRng(s);
  return s;
}

/** xorshift32: returns the next 32-bit unsigned state. */
export function nextRng(s: number): number {
  s ^= s << 13;
  s >>>= 0;
  s ^= s >>> 17;
  s ^= s << 5;
  return s >>> 0;
}

/** Advances the state RNG and returns an integer in [0, n). */
export function rollInt(state: GameState, n: number): number {
  state.rng = nextRng(state.rng);
  return state.rng % n;
}

/** Advances the state RNG and returns an integer in [-spread, +spread]. */
export function rollJitter(state: GameState, spread: number): number {
  if (spread <= 0) return 0;
  return rollInt(state, spread * 2 + 1) - spread;
}
