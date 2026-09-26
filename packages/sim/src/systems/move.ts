import { ENEMIES } from "../balance/enemies";
import { pathLength } from "../path";
import type { Enemy, GameState } from "../types";

export function moveEnemies(state: GameState): void {
  const end = pathLength(state.mapId);
  const survivors: Enemy[] = [];
  for (const enemy of state.enemies) {
    enemy.progress += ENEMIES[enemy.kind].speed;
    if (enemy.progress >= end) {
      state.lives = Math.max(0, state.lives - ENEMIES[enemy.kind].livesCost);
      state.stats.leaks++;
    } else {
      survivors.push(enemy);
    }
  }
  state.enemies = survivors;
}
