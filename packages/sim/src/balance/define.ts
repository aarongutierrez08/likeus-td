/**
 * Content is data (ADR 008): a tower or enemy is one entry in balance/, declaring only what it does.
 * The runtime definition is normalized (zeros for what it does not do) so systems, stats and UI
 * derive everything from it without listing kinds anywhere else.
 */

export interface AttackSpec {
  damage: number;
  /** FP units from the tower center. */
  range: number;
  /** Ticks between shots. */
  cooldown: number;
  /** FP radius around the target; omit for single target. */
  splash?: number;
}

export interface AuraSpec {
  /** Chebyshev radius in cells. */
  radius: number;
  bonusPct: number;
}

export interface IncomeSpec {
  /** Gold paid to the owner at every wave close. */
  perWave: number;
}

export interface TowerSpec {
  cost: number;
  label: string;
  /** 0xRRGGBB, used by the map and the shop swatch. */
  color: number;
  attack?: AttackSpec;
  aura?: AuraSpec;
  income?: IncomeSpec;
}

/** Normalized: every family field present, zero when the tower has no such family. */
export interface TowerDef {
  cost: number;
  label: string;
  color: number;
  damage: number;
  range: number;
  cooldown: number;
  splash: number;
  auraRadius: number;
  auraBonusPct: number;
  income: number;
}

export function defineTowers<K extends string>(specs: Record<K, TowerSpec>): Record<K, TowerDef> {
  const out = {} as Record<K, TowerDef>;
  for (const kind of Object.keys(specs) as K[]) {
    const spec = specs[kind];
    out[kind] = {
      cost: spec.cost,
      label: spec.label,
      color: spec.color,
      damage: spec.attack?.damage ?? 0,
      range: spec.attack?.range ?? 0,
      cooldown: spec.attack?.cooldown ?? 0,
      splash: spec.attack?.splash ?? 0,
      auraRadius: spec.aura?.radius ?? 0,
      auraBonusPct: spec.aura?.bonusPct ?? 0,
      income: spec.income?.perWave ?? 0,
    };
  }
  return out;
}

export const hasAttack = (def: TowerDef): boolean => def.damage > 0;
export const hasAura = (def: TowerDef): boolean => def.auraRadius > 0;
export const hasIncome = (def: TowerDef): boolean => def.income > 0;

export interface EnemyDef {
  hp: number;
  /** FP units per tick. 50 = one cell per second at 20 ticks/s. */
  speed: number;
  bounty: number;
  livesCost: number;
  color: number;
  /** Drawn radius in cells. */
  radius: number;
}

export function defineEnemies<K extends string>(specs: Record<K, EnemyDef>): Record<K, EnemyDef> {
  return specs;
}
