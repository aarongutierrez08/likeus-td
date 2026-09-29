import { hasControl } from "../balance/define";
import { TOWERS } from "../balance/towers";
import { controlDurationOf, controlPctOf } from "../commands";
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

/**
 * Same effect never stacks: a stronger slow replaces a weaker one, an equal one only lasts longer; a stun only refreshes.
 * The effect lasts its full duration from the next tick, since the enemy already moved this tick.
 */
function apply(state: GameState, tower: Tower, enemy: Enemy): void {
  const until = state.tick + 1 + controlDurationOf(tower);
  if (TOWERS[tower.kind].controlEffect === "stun") {
    enemy.stunUntil = Math.max(enemy.stunUntil, until);
    return;
  }
  const pct = controlPctOf(tower);
  const active = state.tick < enemy.slowUntil;
  if (!active || pct > enemy.slowPct) {
    enemy.slowPct = pct;
    enemy.slowUntil = until;
  } else if (pct === enemy.slowPct) {
    enemy.slowUntil = Math.max(enemy.slowUntil, until);
  }
}

/** Control towers act after attacks and share the tower's single cooldown timer. */
export function towersControl(state: GameState): void {
  const located: EnemyAt[] = state.enemies.map((enemy) => {
    const p = positionAt(state.mapId, enemy.progress);
    return { enemy, x: p.x, y: p.y };
  });
  for (const tower of state.towers) {
    const def = TOWERS[tower.kind];
    if (!hasControl(def)) continue;
    if (tower.cooldown > 0) {
      tower.cooldown--;
      continue;
    }
    const target = pickTarget(tower, def.controlRange, located);
    if (target === null) continue;
    if (def.controlSplash > 0) {
      for (const e of located) {
        if (squaredDistance(target.x, target.y, e.x, e.y) <= def.controlSplash * def.controlSplash) apply(state, tower, e.enemy);
      }
    } else {
      apply(state, tower, target.enemy);
    }
    tower.cooldown = def.controlCooldown - 1;
  }
}
