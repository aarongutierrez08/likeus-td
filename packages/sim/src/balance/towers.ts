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
  /** Gold paid to the owner at every wave close. 0 = no income. */
  income: number;
}

export const TOWER_KINDS: readonly TowerKind[] = ["archer", "cannon", "aura", "mine"];

/** Percent of everything invested (build plus upgrades) a player gets back when selling. */
export const SELL_REFUND_PCT = 75;

export const UPGRADE = {
  maxLevel: 3,
  /** Each level adds this percent of the base damage. */
  damagePctPerLevel: 50,
  /** Each aura level adds this many percent points to its bonus. */
  auraBonusPctPerLevel: 10,
  /** Each mine level adds this percent of the base income. */
  incomePctPerLevel: 50,
  /** Each upgrade costs this percent of the tower's base cost. */
  costPctPerLevel: 100,
} as const;

export const TOWERS: Record<TowerKind, TowerDef> = {
  archer: { cost: 40, damage: 8, range: 2500, cooldown: 8, splash: 0, auraRadius: 0, auraBonusPct: 0, income: 0 },
  cannon: { cost: 120, damage: 40, range: 3000, cooldown: 30, splash: 1000, auraRadius: 0, auraBonusPct: 0, income: 0 },
  aura: { cost: 80, damage: 0, range: 0, cooldown: 0, splash: 0, auraRadius: 2, auraBonusPct: 25, income: 0 },
  mine: { cost: 100, damage: 0, range: 0, cooldown: 0, splash: 0, auraRadius: 0, auraBonusPct: 0, income: 15 },
};
