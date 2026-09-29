import { ENEMIES } from "../balance/enemies";
import { pathLength } from "../path";
import type { Enemy, GameState } from "../types";

/** Speed this tick: zero while stunned, reduced while slowed. */
export function currentSpeed(state: GameState, enemy: Enemy): number {
  if (state.tick < enemy.stunUntil) return 0;
  const speed = ENEMIES[enemy.kind].speed;
  if (state.tick < enemy.slowUntil) return Math.floor((speed * (100 - enemy.slowPct)) / 100);
  return speed;
}

export function moveEnemies(state: GameState): void {
  const end = pathLength(state.mapId);
  const survivors: Enemy[] = [];
  for (const enemy of state.enemies) {
    enemy.progress += currentSpeed(state, enemy);
    if (enemy.progress >= end) {
      state.lives = Math.max(0, state.lives - ENEMIES[enemy.kind].livesCost);
      state.stats.leaks++;
    } else {
      survivors.push(enemy);
    }
  }
  state.enemies = survivors;
}
