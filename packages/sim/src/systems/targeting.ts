import { hasReveal, type Targeting } from "../balance/define";
import { ENEMIES } from "../balance/enemies";
import { towerDef } from "../balance/towers";
import { cellCenterFP, positionAt } from "../path";
import type { Enemy, GameState, Tower } from "../types";
import { routeOf } from "../grid";

export interface EnemyAt {
  enemy: Enemy;
  x: number;
  y: number;
  /** False for a stealth enemy no radar reaches; area effects still touch it. */
  targetable: boolean;
}

export function squaredDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function withinReveal(state: GameState, x: number, y: number): boolean {
  for (const tower of state.towers) {
    const def = towerDef(tower);
    if (!hasReveal(def)) continue;
    if (squaredDistance(cellCenterFP(tower.x), cellCenterFP(tower.y), x, y) <= def.revealRange * def.revealRange) return true;
  }
  return false;
}

export function locate(state: GameState): EnemyAt[] {
  return state.enemies.map((enemy) => {
    const p = positionAt(routeOf(state), enemy.progress);
    const targetable = !ENEMIES[enemy.kind].stealth || withinReveal(state, p.x, p.y);
    return { enemy, x: p.x, y: p.y, targetable };
  });
}

/** Whether towers can aim at this enemy right now. */
export function isRevealed(state: GameState, enemy: Enemy): boolean {
  if (!ENEMIES[enemy.kind].stealth) return true;
  const p = positionAt(routeOf(state), enemy.progress);
  return withinReveal(state, p.x, p.y);
}

function better(candidate: EnemyAt, best: EnemyAt, targeting: Targeting): boolean {
  if (targeting === "mostHp" && candidate.enemy.hp !== best.enemy.hp) return candidate.enemy.hp > best.enemy.hp;
  if (candidate.enemy.progress !== best.enemy.progress) return candidate.enemy.progress > best.enemy.progress;
  return candidate.enemy.id < best.enemy.id;
}

/**
 * Targetable enemy within range, not closer than `minRange`: the furthest along the path, or the one with the most hp.
 * Ties go to the furthest, then to the lowest id.
 */
export function pickTarget(
  tower: Tower,
  range: number,
  enemies: readonly EnemyAt[],
  targeting: Targeting = "furthest",
  minRange = 0,
): EnemyAt | null {
  const tx = cellCenterFP(tower.x);
  const ty = cellCenterFP(tower.y);
  let best: EnemyAt | null = null;
  for (const e of enemies) {
    if (!e.targetable) continue;
    const d2 = squaredDistance(tx, ty, e.x, e.y);
    if (d2 > range * range || d2 < minRange * minRange) continue;
    if (best === null || better(e, best, targeting)) best = e;
  }
  return best;
}

/** Whether a marking radar reveals this enemy: only stealth enemies get marked. */
export function markOn(state: GameState, enemy: Enemy): number {
  if (!ENEMIES[enemy.kind].stealth) return 0;
  const p = positionAt(routeOf(state), enemy.progress);
  let best = 0;
  for (const tower of state.towers) {
    const def = towerDef(tower);
    if (def.markPct === 0) continue;
    if (squaredDistance(cellCenterFP(tower.x), cellCenterFP(tower.y), p.x, p.y) <= def.revealRange * def.revealRange)
      best = Math.max(best, def.markPct);
  }
  return best;
}
