import { applyCommand } from "./commands";
import { moveEnemies } from "./systems/move";
import { collectDead, towersAttack } from "./systems/towers";
import { checkEnd, scheduleWave, spawnDue } from "./systems/waves";
import type { Command, GameState } from "./types";

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    spawnQueue: state.spawnQueue.slice(),
    towers: state.towers.map((t) => ({ ...t })),
    enemies: state.enemies.map((e) => ({ ...e })),
    stats: { ...state.stats, damageByTower: { ...state.stats.damageByTower } },
  };
}

/** Pure: never mutates the input. Returns the same object once the game is over. */
export function step(state: GameState, commands: readonly Command[] = []): GameState {
  if (state.status !== "playing") return state;
  const next = cloneState(state);
  for (const cmd of commands) applyCommand(next, cmd);
  scheduleWave(next);
  spawnDue(next);
  moveEnemies(next);
  towersAttack(next);
  collectDead(next);
  checkEnd(next);
  next.tick++;
  return next;
}
