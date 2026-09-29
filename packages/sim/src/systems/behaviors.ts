import { AFFIXES } from "../balance/affixes";
import { ENEMIES } from "../balance/enemies";
import { positionAt } from "../path";
import type { Enemy, GameState } from "../types";
import { squaredDistance } from "./targeting";

function heal(enemy: Enemy, amount: number): void {
  enemy.hp = Math.min(enemy.maxHp, enemy.hp + amount);
}

function every(state: GameState, ticks: number): boolean {
  return ticks > 0 && state.tick % ticks === 0;
}

/** Healers mend their neighbours, and boss affixes regenerate or re-arm. Runs after damage, only on the living. */
export function enemiesAct(state: GameState): void {
  const living = state.enemies.filter((e) => e.hp > 0);
  for (const enemy of living) {
    const def = ENEMIES[enemy.kind];
    if (def.healAmount > 0 && every(state, def.healEvery)) {
      const p = positionAt(state.mapId, enemy.progress);
      for (const other of living) {
        if (other.id === enemy.id) continue;
        const q = positionAt(state.mapId, other.progress);
        if (squaredDistance(p.x, p.y, q.x, q.y) <= def.healRange * def.healRange) heal(other, def.healAmount);
      }
    }
    if (enemy.affix === "regenerating" && every(state, AFFIXES.regenerating.every)) {
      heal(enemy, Math.floor((enemy.maxHp * AFFIXES.regenerating.healPct) / 100));
    }
    if (enemy.affix === "shielded" && enemy.shield === 0 && every(state, AFFIXES.shielded.rearmEvery)) {
      enemy.shield = 1;
    }
  }
}
