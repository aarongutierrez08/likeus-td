import { hasControl } from "../balance/define";
import { TOWERS } from "../balance/towers";
import { controlDurationOf, controlPctOf } from "../commands";
import type { Enemy, GameState, Tower } from "../types";
import { locate, pickTarget, squaredDistance } from "./targeting";

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
  const located = locate(state);
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
