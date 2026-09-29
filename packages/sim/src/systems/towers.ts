import { damageMultiplier } from "../balance/damage";
import { AURA_STATS, hasAttack, type AuraStat } from "../balance/define";
import { ENEMIES } from "../balance/enemies";
import { TOWERS } from "../balance/towers";
import { auraBonusOf, towerDamage } from "../commands";
import { attenuatedBounty } from "../economy";
import { cellCenterFP, positionAt } from "../path";
import type { Enemy, GameState, Tower } from "../types";

interface EnemyAt {
  enemy: Enemy;
  x: number;
  y: number;
}

function squaredDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Strongest aura of this stat reaching the tower; auras of the same stat never stack. Ties go to the lowest id. */
function strongestAura(state: GameState, tower: Tower, stat: AuraStat): Tower | null {
  let best: Tower | null = null;
  for (const other of state.towers) {
    const def = TOWERS[other.kind];
    if (def.auraStat !== stat || other.id === tower.id) continue;
    if (Math.max(Math.abs(other.x - tower.x), Math.abs(other.y - tower.y)) > def.auraRadius) continue;
    if (best === null || auraBonusOf(other) > auraBonusOf(best)) best = other;
  }
  return best;
}

function auraBonusFor(state: GameState, tower: Tower, stat: AuraStat): number {
  const aura = strongestAura(state, tower, stat);
  return aura === null ? 0 : auraBonusOf(aura);
}

export function isAuraBoosted(state: GameState, tower: Tower): boolean {
  return AURA_STATS.some((stat) => auraBonusFor(state, tower, stat) > 0);
}

export function effectiveDamage(state: GameState, tower: Tower): number {
  return Math.floor((towerDamage(tower) * (100 + auraBonusFor(state, tower, "damage"))) / 100);
}

/** Ticks between shots once rate auras apply. */
export function effectiveCooldown(state: GameState, tower: Tower): number {
  const def = TOWERS[tower.kind];
  return Math.max(1, Math.floor((def.cooldown * 100) / (100 + auraBonusFor(state, tower, "rate"))));
}

/** Damage one hit of the tower deals to this enemy: effective damage times the attack-vs-armor multiplier. */
export function damageAgainst(state: GameState, tower: Tower, enemy: Enemy): number {
  const attack = TOWERS[tower.kind].attackType;
  if (attack === null) return 0;
  return Math.floor((effectiveDamage(state, tower) * damageMultiplier(attack, ENEMIES[enemy.kind].armor)) / 100);
}

/** Enemy furthest along the path within range. Ties go to the lowest id. */
function pickTarget(tower: Tower, range: number, enemies: readonly EnemyAt[]): EnemyAt | null {
  const tx = cellCenterFP(tower.x);
  const ty = cellCenterFP(tower.y);
  let best: EnemyAt | null = null;
  for (const e of enemies) {
    if (squaredDistance(tx, ty, e.x, e.y) > range * range) continue;
    if (
      best === null ||
      e.enemy.progress > best.enemy.progress ||
      (e.enemy.progress === best.enemy.progress && e.enemy.id < best.enemy.id)
    ) {
      best = e;
    }
  }
  return best;
}

function hit(state: GameState, tower: Tower, target: Enemy): void {
  const damage = damageAgainst(state, tower, target);
  const dealt = Math.min(damage, Math.max(0, target.hp));
  target.hp -= damage;
  target.lastHitBy = tower.id;
  tower.damageDealt += dealt;
  state.stats.damageByTower[tower.kind] += dealt;
}

function locate(state: GameState): EnemyAt[] {
  return state.enemies.map((enemy) => {
    const p = positionAt(state.mapId, enemy.progress);
    return { enemy, x: p.x, y: p.y };
  });
}

/** The enemy this tower would shoot at right now, or null. */
export function currentTarget(state: GameState, tower: Tower): Enemy | null {
  const def = TOWERS[tower.kind];
  if (!hasAttack(def)) return null;
  return pickTarget(tower, def.range, locate(state))?.enemy ?? null;
}

export function towersAttack(state: GameState): void {
  const located = locate(state);
  for (const tower of state.towers) {
    const def = TOWERS[tower.kind];
    if (!hasAttack(def)) continue;
    if (tower.cooldown > 0) {
      tower.cooldown--;
      continue;
    }
    const target = pickTarget(tower, def.range, located);
    if (target === null) continue;
    if (def.splash > 0) {
      for (const e of located) {
        if (squaredDistance(target.x, target.y, e.x, e.y) <= def.splash * def.splash) hit(state, tower, e.enemy);
      }
    } else {
      hit(state, tower, target.enemy);
    }
    tower.cooldown = effectiveCooldown(state, tower) - 1;
  }
}

export function collectDead(state: GameState): void {
  const alive: Enemy[] = [];
  for (const enemy of state.enemies) {
    if (enemy.hp > 0) {
      alive.push(enemy);
      continue;
    }
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
  const owner = state.players.find((p) => p.id === aura.owner);
  if (!owner) return;
  const cut = Math.floor((bounty * auraBonusOf(aura)) / 100);
  owner.gold += cut;
  owner.earned += cut;
  state.stats.goldEarned += cut;
}
