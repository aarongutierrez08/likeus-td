import type { TowerKind } from "../types";

export interface TowerDef {
  cost: number;
  damage: number;
  /** Attack range from the tower center, in FP units. */
  range: number;
  /** Ticks between shots. */
  cooldown: number;
  /** Splash radius around the target, in FP units. 0 = single target. */
  splash: number;
  /** Chebyshev radius in cells of the damage aura. 0 = no aura. */
  auraRadius: number;
  auraBonusPct: number;
}

export const TOWER_KINDS: readonly TowerKind[] = ["archer", "cannon", "aura"];

/** Percent of the cost a player gets back when selling a tower. */
export const SELL_REFUND_PCT = 75;

export const TOWERS: Record<TowerKind, TowerDef> = {
  archer: { cost: 40, damage: 8, range: 2500, cooldown: 8, splash: 0, auraRadius: 0, auraBonusPct: 0 },
  cannon: { cost: 120, damage: 40, range: 3000, cooldown: 30, splash: 1000, auraRadius: 0, auraBonusPct: 0 },
  aura: { cost: 80, damage: 0, range: 0, cooldown: 0, splash: 0, auraRadius: 2, auraBonusPct: 25 },
};
