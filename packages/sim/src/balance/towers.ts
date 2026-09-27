import { defineTowers } from "./define";

/** Adding a tower is adding an entry here. Types, stats, bot, shop and map derive from it (ADR 008). */
export const TOWERS = defineTowers({
  archer: { cost: 40, label: "Arquero", color: 0x6cc46c, attack: { damage: 8, range: 2500, cooldown: 8 } },
  cannon: { cost: 120, label: "Cañón", color: 0xf0954a, attack: { damage: 40, range: 3000, cooldown: 30, splash: 1000 } },
  aura: { cost: 80, label: "Aura", color: 0xb07cf0, aura: { radius: 2, bonusPct: 25 } },
  mine: { cost: 100, label: "Mina", color: 0xf4c542, income: { perWave: 15 } },
});

export type TowerKind = keyof typeof TOWERS;

/** Declaration order: the bot's "cheapest" tie-break and the shop follow it. */
export const TOWER_KINDS = Object.keys(TOWERS) as TowerKind[];

export type { TowerDef } from "./define";

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
