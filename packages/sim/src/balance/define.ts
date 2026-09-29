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

export interface RevealSpec {
  /** FP units from the tower center within which stealth enemies can be targeted. */
  range: number;
}

export interface WallSpec {
  /** Hit points; never repaired and never scaled by the wave. */
  hp: number;
  /** Ticks the owner waits after the wall falls before building another. */
  cooldown: number;
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
  reveal?: RevealSpec;
  /** Built on a path cell; enemies stop in front of it and hit it until it falls. One active per player. */
  wall?: WallSpec;
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
  revealRange: number;
  wallHp: number;
  wallCooldown: number;
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
      revealRange: spec.reveal?.range ?? 0,
      wallHp: spec.wall?.hp ?? 0,
      wallCooldown: spec.wall?.cooldown ?? 0,
    };
  }
  return out;
}

export const hasAttack = (def: TowerDef): boolean => def.damage > 0;
export const hasAura = (def: TowerDef): boolean => def.auraRadius > 0;
export const hasControl = (def: TowerDef): boolean => def.controlEffect !== null;
export const hasIncome = (def: TowerDef): boolean => def.income > 0;
export const hasReveal = (def: TowerDef): boolean => def.revealRange > 0;
export const hasWall = (def: TowerDef): boolean => def.wallHp > 0;

export interface EnemySpec {
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
  /** Towers cannot target it unless a radar reveals it. */
  stealth?: boolean;
  /** Heals other enemies within `range` (FP) by `amount` every `every` ticks. */
  heal?: { amount: number; range: number; every: number };
  /** Hits absorbed before taking damage. */
  shieldHits?: number;
  /** On death, spawns `count` enemies of `kind` where it died. */
  split?: { kind: string; count: number };
  /** Damage dealt per tick to a wall blocking it. */
  wallDamage: number;
}

/** Normalized: every behavior field present, zero or null when the enemy has no such behavior. */
export interface EnemyDef {
  label: string;
  armor: Armor;
  hp: number;
  speed: number;
  bounty: number;
  livesCost: number;
  color: number;
  radius: number;
  stealth: boolean;
  healAmount: number;
  healRange: number;
  healEvery: number;
  shieldHits: number;
  /** Another enemy kind, checked at definition time; null when it does not split. */
  splitKind: string | null;
  splitCount: number;
  wallDamage: number;
}

export function defineEnemies<K extends string>(specs: Record<K, EnemySpec>): Record<K, EnemyDef> {
  const out = {} as Record<K, EnemyDef>;
  for (const kind of Object.keys(specs) as K[]) {
    const spec = specs[kind];
    if (spec.split && !(spec.split.kind in specs)) throw new Error(`enemy ${kind} splits into unknown kind ${spec.split.kind}`);
    out[kind] = {
      label: spec.label,
      armor: spec.armor,
      hp: spec.hp,
      speed: spec.speed,
      bounty: spec.bounty,
      livesCost: spec.livesCost,
      color: spec.color,
      radius: spec.radius,
      stealth: spec.stealth ?? false,
      healAmount: spec.heal?.amount ?? 0,
      healRange: spec.heal?.range ?? 0,
      healEvery: spec.heal?.every ?? 0,
      shieldHits: spec.shieldHits ?? 0,
      splitKind: spec.split?.kind ?? null,
      splitCount: spec.split?.count ?? 0,
      wallDamage: spec.wallDamage,
    };
  }
  return out;
}
