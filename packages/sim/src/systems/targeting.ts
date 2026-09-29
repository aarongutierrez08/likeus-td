import { hasReveal } from "../balance/define";
import { ENEMIES } from "../balance/enemies";
import { TOWERS } from "../balance/towers";
import { cellCenterFP, positionAt } from "../path";
import type { Enemy, GameState, Tower } from "../types";

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
    const def = TOWERS[tower.kind];
    if (!hasReveal(def)) continue;
    if (squaredDistance(cellCenterFP(tower.x), cellCenterFP(tower.y), x, y) <= def.revealRange * def.revealRange) return true;
  }
  return false;
}

export function locate(state: GameState): EnemyAt[] {
  return state.enemies.map((enemy) => {
    const p = positionAt(state.mapId, enemy.progress);
    const targetable = !ENEMIES[enemy.kind].stealth || withinReveal(state, p.x, p.y);
    return { enemy, x: p.x, y: p.y, targetable };
  });
}

/** Whether towers can aim at this enemy right now. */
export function isRevealed(state: GameState, enemy: Enemy): boolean {
  if (!ENEMIES[enemy.kind].stealth) return true;
  const p = positionAt(state.mapId, enemy.progress);
  return withinReveal(state, p.x, p.y);
}

/** Targetable enemy furthest along the path within range. Ties go to the lowest id. */
export function pickTarget(tower: Tower, range: number, enemies: readonly EnemyAt[]): EnemyAt | null {
  const tx = cellCenterFP(tower.x);
  const ty = cellCenterFP(tower.y);
  let best: EnemyAt | null = null;
  for (const e of enemies) {
    if (!e.targetable) continue;
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
