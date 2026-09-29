/**
 * Content is data (ADR 008): a tower or enemy is one entry in balance/, declaring only what it does.
 * The runtime definition is normalized (zeros for what it does not do) so systems, stats and UI
 * derive everything from it without listing kinds anywhere else.
 */

import type { Armor, AttackType } from "./damage";

export interface AttackSpec {
  type: AttackType;
  damage: number;
  /** FP units from the tower center. */
  range: number;
  /** Ticks between shots. */
  cooldown: number;
  /** FP radius around the target; omit for single target. */
  splash?: number;
}

export const AURA_STATS = ["damage", "rate", "gold"] as const;
/** What an aura boosts on the towers in its square: their damage, their fire rate, or the gold their kills pay the aura's owner. */
export type AuraStat = (typeof AURA_STATS)[number];

export interface AuraSpec {
  stat: AuraStat;
  /** Chebyshev radius in cells. */
  radius: number;
  bonusPct: number;
}

export const CONTROL_EFFECTS = ["slow", "stun"] as const;
export type ControlEffect = (typeof CONTROL_EFFECTS)[number];

export interface ControlSpec {
  effect: ControlEffect;
  /** FP units from the tower center. */
  range: number;
  /** Ticks between applications. */
  cooldown: number;
  /** Ticks the effect lasts on an enemy. */
  duration: number;
  /** Slow only: percent of speed removed. */
  pct?: number;
  /** FP radius around the target hit by the effect; omit for single target. */
  splash?: number;
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
  control?: ControlSpec;
  income?: IncomeSpec;
}

/** Normalized: every family field present, zero when the tower has no such family. */
export interface TowerDef {
  cost: number;
  label: string;
  color: number;
  /** null when the tower has no attack family. */
  attackType: AttackType | null;
  damage: number;
  range: number;
  cooldown: number;
  splash: number;
  /** null when the tower has no aura family. */
  auraStat: AuraStat | null;
  auraRadius: number;
  auraBonusPct: number;
  /** null when the tower has no control family. */
  controlEffect: ControlEffect | null;
  controlRange: number;
  controlCooldown: number;
  controlDuration: number;
  controlPct: number;
  controlSplash: number;
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
      attackType: spec.attack?.type ?? null,
      damage: spec.attack?.damage ?? 0,
      range: spec.attack?.range ?? 0,
      cooldown: spec.attack?.cooldown ?? 0,
      splash: spec.attack?.splash ?? 0,
      auraStat: spec.aura?.stat ?? null,
      auraRadius: spec.aura?.radius ?? 0,
      auraBonusPct: spec.aura?.bonusPct ?? 0,
      controlEffect: spec.control?.effect ?? null,
      controlRange: spec.control?.range ?? 0,
      controlCooldown: spec.control?.cooldown ?? 0,
      controlDuration: spec.control?.duration ?? 0,
      controlPct: spec.control?.pct ?? 0,
      controlSplash: spec.control?.splash ?? 0,
      income: spec.income?.perWave ?? 0,
    };
  }
  return out;
}

export const hasAttack = (def: TowerDef): boolean => def.damage > 0;
export const hasAura = (def: TowerDef): boolean => def.auraRadius > 0;
export const hasControl = (def: TowerDef): boolean => def.controlEffect !== null;
export const hasIncome = (def: TowerDef): boolean => def.income > 0;

export interface EnemyDef {
  label: string;
  armor: Armor;
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
