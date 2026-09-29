import { BOSS_AFFIXES, type BossAffix } from "./balance/affixes";
import { ENEMIES } from "./balance/enemies";
import type { EnemyKind } from "./types";

const MIX = 0x9e3779b9;

/** The affix of the boss of a wave, fixed by seed and wave so the calendar can show it before the wave starts. */
export function bossAffix(seed: number, wave: number): BossAffix {
  const mixed = (Math.imul((seed >>> 0) ^ MIX, 0x01000193) ^ Math.imul(wave, 0x9e37)) >>> 0;
  return BOSS_AFFIXES[mixed % BOSS_AFFIXES.length]!;
}

/** Hits an enemy of this kind absorbs when it spawns: its own shield, plus one for a shielded boss. */
export function initialShield(kind: EnemyKind, affix: BossAffix | null): number {
  return ENEMIES[kind].shieldHits + (affix === "shielded" ? 1 : 0);
}
