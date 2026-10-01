import { damageMultiplier } from "../balance/damage";
import { AURA_STATS, hasAttack, type AuraStat } from "../balance/define";
import { ENEMIES } from "../balance/enemies";
import { towerDef } from "../balance/towers";
import { auraBonusOf, towerDamage } from "../commands";
import { attenuatedBounty, scaledEnemyHp } from "../economy";
import { waveDef } from "../waveDefs";
import type { Enemy, EnemyKind, GameState, Tower } from "../types";
import { doctrineEffect, doctrinesOf } from "./doctrines";
import { locate, markOn, pickTarget, squaredDistance, type EnemyAt } from "./targeting";

/** Whether a cell lies in the square an aura of this radius covers around its center. */
export function inAuraSquare(center: { x: number; y: number }, radius: number, cell: { x: number; y: number }): boolean {
  return Math.max(Math.abs(center.x - cell.x), Math.abs(center.y - cell.y)) <= radius;
}

/** Strongest aura of this stat reaching the tower; auras of the same stat never stack. Ties go to the lowest id. */
function strongestAura(state: GameState, tower: Tower, stat: AuraStat): Tower | null {
  let best: Tower | null = null;
  for (const other of state.towers) {
    const def = towerDef(other);
    if (def.auraStat !== stat || other.id === tower.id) continue;
    if (!inAuraSquare(other, auraRadiusOf(state, other), tower)) continue;
    if (best === null || auraBonusOf(other) > auraBonusOf(best)) best = other;
  }
  return best;
}

function auraBonusFor(state: GameState, tower: Tower, stat: AuraStat): number {
  const aura = strongestAura(state, tower, stat);
  return aura === null ? 0 : auraBonusOf(aura);
}

/** The square an aura covers: its own radius plus the owner's doctrines; 0 for towers without an aura. */
export function auraRadiusOf(state: GameState, tower: Tower): number {
  const radius = towerDef(tower).auraRadius;
  return radius === 0 ? 0 : radius + doctrineEffect(state, tower.owner, "auraRadius");
}

export function isAuraBoosted(state: GameState, tower: Tower): boolean {
  return AURA_STATS.some((stat) => auraBonusFor(state, tower, stat) > 0);
}

export function effectiveDamage(state: GameState, tower: Tower): number {
  return Math.floor((towerDamage(tower) * (100 + auraBonusFor(state, tower, "damage"))) / 100);
}

/** Ticks between shots once rate auras apply. */
export function effectiveCooldown(state: GameState, tower: Tower): number {
  const def = towerDef(tower);
  const overcharge = state.tick < tower.overchargeUntil ? tower.overchargePct : 0;
  return Math.max(1, Math.floor((def.cooldown * 100) / (100 + auraBonusFor(state, tower, "rate") + overcharge)));
}

/** Damage one hit of the tower deals to this enemy: effective damage times the attack-vs-armor multiplier, plus any mark. */
export function damageAgainst(state: GameState, tower: Tower, enemy: Enemy): number {
  const attack = towerDef(tower).attackType;
  if (attack === null) return 0;
  const armor = ENEMIES[enemy.kind].armor;
  const bonus = doctrinesOf(state, tower.owner).reduce(
    (sum, d) => sum + (d.armorBonus && d.armorBonus.attack === attack && d.armorBonus.armor === armor ? d.armorBonus.pct : 0),
    0,
  );
  const base = Math.floor((effectiveDamage(state, tower) * (damageMultiplier(attack, armor) + bonus)) / 100);
  return Math.floor((base * (100 + markOn(state, enemy))) / 100);
}

/** Attack range once range auras apply. */
export function effectiveRange(state: GameState, tower: Tower): number {
  return Math.floor((towerDef(tower).range * (100 + auraBonusFor(state, tower, "range"))) / 100);
}

function hit(state: GameState, tower: Tower, target: Enemy): void {
  state.stats.hitsByTower[tower.kind]++;
  if (target.shield > 0) {
    target.shield--;
    return;
  }
  const damage = damageAgainst(state, tower, target);
  const dealt = Math.min(damage, Math.max(0, target.hp));
  target.hp -= damage;
  target.lastHitBy = tower.id;
  tower.damageDealt += dealt;
  state.stats.damageByTower[tower.kind] += dealt;
}

/** The enemy this tower would shoot at right now, or null. */
export function currentTarget(state: GameState, tower: Tower): Enemy | null {
  const def = towerDef(tower);
  if (!hasAttack(def)) return null;
  return pickTarget(tower, effectiveRange(state, tower), locate(state), def.targeting, def.minRange)?.enemy ?? null;
}

/** Chain hits: after the target, the nearest untouched enemy within chainRange of the last one hit, `chain` times. */
function chainFrom(state: GameState, tower: Tower, first: EnemyAt, located: readonly EnemyAt[]): void {
  const def = towerDef(tower);
  const touched = new Set([first.enemy.id]);
  let last = first;
  for (let jump = 0; jump < def.chain; jump++) {
    let next: EnemyAt | null = null;
    let nextD2 = Number.MAX_SAFE_INTEGER;
    for (const e of located) {
      if (touched.has(e.enemy.id)) continue;
      const d2 = squaredDistance(last.x, last.y, e.x, e.y);
      if (d2 > def.chainRange * def.chainRange) continue;
      if (d2 < nextD2 || (d2 === nextD2 && next !== null && e.enemy.id < next.enemy.id)) {
        next = e;
        nextD2 = d2;
      }
    }
    if (next === null) return;
    hit(state, tower, next.enemy);
    touched.add(next.enemy.id);
    last = next;
  }
}

export function towersAttack(state: GameState): void {
  const located = locate(state);
  for (const tower of state.towers) {
    const def = towerDef(tower);
    if (!hasAttack(def)) continue;
    if (tower.cooldown > 0) {
      tower.cooldown--;
      continue;
    }
    const target = pickTarget(tower, effectiveRange(state, tower), located, def.targeting, def.minRange);
    if (target === null) continue;
    state.stats.shotsByTower[tower.kind]++;
    if (def.splash > 0) {
      for (const e of located) {
        if (squaredDistance(target.x, target.y, e.x, e.y) <= def.splash * def.splash) hit(state, tower, e.enemy);
      }
    } else {
      hit(state, tower, target.enemy);
      if (def.chain > 0) chainFrom(state, tower, target, located);
    }
    tower.cooldown = effectiveCooldown(state, tower) - 1;
  }
}

/** A splitting enemy leaves its children where it died, a little behind each other, in the same wave. */
function spawnSplits(state: GameState, parent: Enemy, alive: Enemy[]): void {
  const def = ENEMIES[parent.kind];
  if (def.splitKind === null) return;
  const kind = def.splitKind as EnemyKind;
  const child = ENEMIES[kind];
  const hp = waveHpOf(state, kind, parent.wave);
  for (let i = 0; i < def.splitCount; i++) {
    alive.push({
      id: state.nextId++,
      kind,
      hp,
      maxHp: hp,
      progress: Math.max(0, parent.progress - i * SPLIT_SPACING),
      lastHitBy: 0,
      wave: parent.wave,
      slowPct: 0,
      slowUntil: 0,
      stunUntil: 0,
      shield: child.shieldHits,
      affix: null,
    });
  }
}

const SPLIT_SPACING = 250;

/** Hit points of an enemy of this kind in that wave, scaled like the wave's own spawns; base hp outside waves. */
function waveHpOf(state: GameState, kind: EnemyKind, wave: number): number {
  const def = waveDef(state, wave);
  if (!def) return ENEMIES[kind].hp;
  return scaledEnemyHp(Math.floor((ENEMIES[kind].hp * def.hpPct) / 100), state.players.length);
}

export function collectDead(state: GameState): void {
  const alive: Enemy[] = [];
  for (const enemy of state.enemies) {
    if (enemy.hp > 0) {
      alive.push(enemy);
      continue;
    }
    spawnSplits(state, enemy, alive);
    state.stats.kills++;
    const killer = state.towers.find((t) => t.id === enemy.lastHitBy);
    if (killer) killer.kills++;
    const bounty = ENEMIES[enemy.kind].bounty;
    const share = attenuatedBounty(bounty, state.players.length);
    for (const player of state.players) {
      player.gold += share;
      player.earned += share;
    }
    state.stats.goldEarned += share * state.players.length;
    if (killer) payGoldAura(state, killer, bounty);
  }
  state.enemies = alive;
}

/** A gold aura pays its own owner a cut of the base bounty of kills made inside it (ADR 007: economy pays the owner, unattenuated). */
function payGoldAura(state: GameState, killer: Tower, bounty: number): void {
  const aura = strongestAura(state, killer, "gold");
  if (aura === null) return;
  const cut = Math.floor((bounty * auraBonusOf(aura)) / 100);
  const paid = towerDef(aura).auraShared ? state.players : state.players.filter((p) => p.id === aura.owner);
  for (const player of paid) {
    player.gold += cut;
    player.earned += cut;
    state.stats.goldEarned += cut;
  }
}
