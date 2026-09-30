import { applyCommand } from "./commands";
import { abilitiesAct } from "./systems/abilities";
import { enemiesAct } from "./systems/behaviors";
import { towersControl } from "./systems/control";
import { moveEnemies } from "./systems/move";
import { collectDead, towersAttack } from "./systems/towers";
import { checkEnd, closeWaves, scheduleWave, spawnDue } from "./systems/waves";
import type { AbilityKind, AbilitySlot, Command, GameState } from "./types";

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, abilities: cloneAbilities(p.abilities) })),
    spawnQueue: state.spawnQueue.slice(),
    waveCalls: state.waveCalls.slice(),
    towers: state.towers.map((t) => ({ ...t })),
    enemies: state.enemies.map((e) => ({ ...e })),
    blasts: state.blasts.map((b) => ({ ...b })),
    frostZones: state.frostZones.map((z) => ({ ...z })),
    stats: { ...state.stats, damageByTower: { ...state.stats.damageByTower }, damageByAbility: { ...state.stats.damageByAbility } },
  };
}

function cloneAbilities(abilities: Record<AbilityKind, AbilitySlot>): Record<AbilityKind, AbilitySlot> {
  return Object.fromEntries(Object.entries(abilities).map(([kind, slot]) => [kind, { ...slot }])) as Record<AbilityKind, AbilitySlot>;
}

/** Pure: never mutates the input. Returns the same object once the game is over. */
export function step(state: GameState, commands: readonly Command[] = []): GameState {
  if (state.status !== "playing") return state;
  const next = cloneState(state);
  for (const cmd of commands) applyCommand(next, cmd);
  scheduleWave(next);
  spawnDue(next);
  abilitiesAct(next);
  moveEnemies(next);
  towersAttack(next);
  towersControl(next);
  enemiesAct(next);
  collectDead(next);
  closeWaves(next);
  checkEnd(next);
  next.tick++;
  return next;
}
