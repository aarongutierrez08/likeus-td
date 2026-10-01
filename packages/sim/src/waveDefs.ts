import { ENDLESS } from "./balance/endless";
import { ENEMY_KINDS } from "./balance/enemies";
import { WAVES, type SpawnGroup, type WaveDef } from "./balance/waves";
import { fnv1a } from "./hash";
import type { GameState } from "./types";

/** Kinds a generated wave can bring: everything except the boss, which comes on its own, and pieces of others. */
const GENERATED_KINDS = ENEMY_KINDS.filter((kind) => kind !== "boss" && kind !== "blobling");

function mix(seed: number, wave: number, salt: number): number {
  return (Math.imul((seed >>> 0) ^ 0x9e3779b9, 0x01000193) ^ Math.imul(wave, 0x9e37) ^ Math.imul(salt, 0x85eb)) >>> 0;
}

/** A wave past the campaign: two kinds picked from the seed and the number, growing hp, a boss every ENDLESS.bossEvery. */
function generatedWave(seed: number, n: number): WaveDef {
  const step = n - WAVES.length;
  const first = GENERATED_KINDS[mix(seed, n, 1) % GENERATED_KINDS.length]!;
  const rest = GENERATED_KINDS.filter((kind) => kind !== first);
  const second = rest[mix(seed, n, 2) % rest.length]!;
  const count = ENDLESS.baseCount + ENDLESS.countStep * Math.floor(step / ENDLESS.countEvery);
  const groups: SpawnGroup[] = [
    { kind: first, count: Math.ceil(count / 2), spacing: ENDLESS.spacing },
    { kind: second, count: Math.floor(count / 2), spacing: ENDLESS.spacing },
  ];
  if (n % ENDLESS.bossEvery === 0) groups.push({ kind: "boss", count: 1, spacing: ENDLESS.bossSpacing });
  return { hpPct: WAVES[WAVES.length - 1]!.hpPct + step * ENDLESS.hpStepPct, groups };
}

/** The n-th wave (1-based) of this game: the campaign's, then generated ones in endless mode; null past the end. */
export function waveDef(state: GameState, n: number): WaveDef | null {
  if (n < 1) return null;
  if (n <= WAVES.length) return WAVES[n - 1]!;
  return state.mode === "endless" ? generatedWave(state.seed, n) : null;
}

/** The seed everyone plays on a given UTC day ("2026-09-30"); the caller reads the clock, the sim never does. */
export function dailySeed(day: string): number {
  return fnv1a(day) % ENDLESS.dailySeedRange;
}

/** An endless game's score: the waves its team closed. */
export function scoreOf(state: GameState): number {
  return state.wavesClosed;
}
