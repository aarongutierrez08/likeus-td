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

export const AURA_STATS = ["damage", "rate", "gold", "range"] as const;
/** What an aura boosts on the towers in its square: damage, fire rate, the gold their kills pay the aura's owner, or range. */
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

export const TARGETINGS = ["furthest", "mostHp"] as const;
export type Targeting = (typeof TARGETINGS)[number];

export type Branch = "a" | "b";

/** A level-3 branch: a patch over the tower's own spec plus the behaviors that make it play differently. */
export interface BranchSpec {
  label: string;
  /** One line for the panel, readable in the shop. */
  line: string;
  attack?: Partial<AttackSpec>;
  aura?: Partial<AuraSpec>;
  control?: Partial<ControlSpec>;
  income?: Partial<IncomeSpec>;
  reveal?: Partial<RevealSpec>;
  targeting?: Targeting;
  /** Extra enemies each hit jumps to, within `chainRange` FP of the last one hit. */
  chain?: number;
  /** FP distance under which the tower does not fire. */
  minRange?: number;
  /** Gold aura: the cut goes to every player instead of the owner. */
  auraShared?: boolean;
  /** Income tower: raise the owner's interest cap by `income` instead of paying gold. */
  incomeMode?: "gold" | "interestCap";
  /** Reveal tower: percent of extra damage revealed enemies take from everyone. */
  markPct?: number;
}

export interface TowerSpec {
  cost: number;
  label: string;
  /** One line in the game's own voice: what it does, before what it is. */
  line: string;
  /** 0xRRGGBB, used by the map and the shop swatch. */
  color: number;
  attack?: AttackSpec;
  aura?: AuraSpec;
  control?: ControlSpec;
  income?: IncomeSpec;
  reveal?: RevealSpec;
  /** Built on a path cell; enemies stop in front of it and hit it until it falls. One active per player. */
  wall?: WallSpec;
  /** Level 3 picks one of two identities. Absent for towers that cannot be upgraded. */
  branches?: Record<Branch, BranchSpec>;
}

export interface BranchDef {
  label: string;
  line: string;
  /** The tower's full definition once this branch is chosen. */
  def: TowerDef;
}

/** Normalized: every family field present, zero when the tower has no such family. */
export interface TowerDef {
  cost: number;
  label: string;
  line: string;
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
  targeting: Targeting;
  chain: number;
  chainRange: number;
  minRange: number;
  auraShared: boolean;
  incomeMode: "gold" | "interestCap";
  markPct: number;
  /** null for a branch definition itself and for towers without branches. */
  branches: Record<Branch, BranchDef> | null;
}

export const CHAIN_RANGE = 1500;

function merged<T extends object>(base: T | undefined, patch: Partial<T> | undefined): T | undefined {
  if (!base) return undefined;
  return patch ? { ...base, ...patch } : base;
}

function normalizeTower(spec: TowerSpec, branch: BranchSpec | null): TowerDef {
  const attack = merged(spec.attack, branch?.attack);
  const aura = merged(spec.aura, branch?.aura);
  const control = merged(spec.control, branch?.control);
  const income = merged(spec.income, branch?.income);
  const reveal = merged(spec.reveal, branch?.reveal);
  return {
    cost: spec.cost,
    label: branch?.label ?? spec.label,
    line: branch?.line ?? spec.line,
    color: spec.color,
    attackType: attack?.type ?? null,
    damage: attack?.damage ?? 0,
    range: attack?.range ?? 0,
    cooldown: attack?.cooldown ?? 0,
    splash: attack?.splash ?? 0,
    auraStat: aura?.stat ?? null,
    auraRadius: aura?.radius ?? 0,
    auraBonusPct: aura?.bonusPct ?? 0,
    controlEffect: control?.effect ?? null,
    controlRange: control?.range ?? 0,
    controlCooldown: control?.cooldown ?? 0,
    controlDuration: control?.duration ?? 0,
    controlPct: control?.pct ?? 0,
    controlSplash: control?.splash ?? 0,
    income: income?.perWave ?? 0,
    revealRange: reveal?.range ?? 0,
    wallHp: spec.wall?.hp ?? 0,
    wallCooldown: spec.wall?.cooldown ?? 0,
    targeting: branch?.targeting ?? "furthest",
    chain: branch?.chain ?? 0,
    chainRange: CHAIN_RANGE,
    minRange: branch?.minRange ?? 0,
    auraShared: branch?.auraShared ?? false,
    incomeMode: branch?.incomeMode ?? "gold",
    markPct: branch?.markPct ?? 0,
    branches: null,
  };
}

export function defineTowers<K extends string>(specs: Record<K, TowerSpec>): Record<K, TowerDef> {
  const out = {} as Record<K, TowerDef>;
  for (const kind of Object.keys(specs) as K[]) {
    const spec = specs[kind];
    const def = normalizeTower(spec, null);
    if (spec.branches) {
      const branch = (b: Branch): BranchDef => ({
        label: spec.branches![b].label,
        line: spec.branches![b].line,
        def: normalizeTower(spec, spec.branches![b]),
      });
      def.branches = { a: branch("a"), b: branch("b") };
    }
    out[kind] = def;
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
  /** One line in the game's own voice, shown next to the calendar. */
  line: string;
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
  line: string;
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
      line: spec.line,
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

export const ABILITY_TARGETS = ["cell", "path", "ownTower", "none"] as const;
/** What an ability is aimed at: any cell, a path cell, one of the player's own attack towers, or nothing. */
export type AbilityTarget = (typeof ABILITY_TARGETS)[number];

/** What one level of an ability does. Fields an ability does not use stay at zero. */
export interface AbilityLevel {
  /** Ticks before the ability can be used again. */
  cooldown: number;
  /** Explosive damage of a blast, before the armor multiplier. */
  damage: number;
  /** FP radius of a blast or a slowed stretch. */
  radius: number;
  /** Ticks between marking a blast and its landing. */
  delay: number;
  /** Ticks a slowed stretch or an overcharge lasts. */
  duration: number;
  /** Percent of speed a slowed stretch removes. */
  slowPct: number;
  /** Percent of fire rate an overcharge adds. */
  ratePct: number;
  /** Team lives a repair restores. */
  lives: number;
}

export interface AbilitySpec {
  label: string;
  /** One line in the game's own voice. */
  line: string;
  target: AbilityTarget;
  /** Gold per upgrade. */
  upgradeCost: number;
  base: Partial<AbilityLevel> & { cooldown: number };
  /** One patch per level after the first; each one changes the cooldown or the effect, never both. */
  upgrades: readonly Partial<AbilityLevel>[];
}

export interface AbilityDef {
  label: string;
  line: string;
  target: AbilityTarget;
  upgradeCost: number;
  /** Full definition of each level, first level at index 0. */
  levels: AbilityLevel[];
}

const NO_EFFECT: Omit<AbilityLevel, "cooldown"> = { damage: 0, radius: 0, delay: 0, duration: 0, slowPct: 0, ratePct: 0, lives: 0 };

export function defineAbilities<K extends string>(specs: Record<K, AbilitySpec>): Record<K, AbilityDef> {
  const out = {} as Record<K, AbilityDef>;
  for (const kind of Object.keys(specs) as K[]) {
    const spec = specs[kind];
    const levels: AbilityLevel[] = [{ ...NO_EFFECT, ...spec.base }];
    for (const patch of spec.upgrades) {
      const touchesEffect = Object.keys(patch).some((key) => key !== "cooldown");
      if ((patch.cooldown !== undefined) === touchesEffect)
        throw new Error(`ability ${kind}: each level changes the cooldown or the effect`);
      levels.push({ ...levels[levels.length - 1]!, ...patch });
    }
    out[kind] = {
      label: spec.label,
      line: spec.line,
      target: spec.target,
      upgradeCost: spec.upgradeCost,
      levels,
    };
  }
  return out;
}
