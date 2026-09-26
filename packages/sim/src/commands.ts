import { TOWERS } from "./balance/towers";
import { isBuildable, isInside } from "./grid";
import type { BuildCommand, Command, GameState } from "./types";

export type RejectReason = "outside" | "on_path" | "occupied" | "no_gold" | "unknown_tower";

export function validateBuild(state: GameState, cmd: BuildCommand): RejectReason | null {
  const def = TOWERS[cmd.tower];
  if (!def) return "unknown_tower";
  if (!isInside(state.mapId, cmd.x, cmd.y)) return "outside";
  if (!isBuildable(state.mapId, cmd.x, cmd.y)) return "on_path";
  if (state.towers.some((t) => t.x === cmd.x && t.y === cmd.y)) return "occupied";
  if (state.gold < def.cost) return "no_gold";
  return null;
}

export function validateCommand(state: GameState, cmd: Command): RejectReason | null {
  switch (cmd.type) {
    case "build":
      return validateBuild(state, cmd);
  }
}

/** Mutates state. Returns false when the command was rejected. */
export function applyCommand(state: GameState, cmd: Command): boolean {
  if (validateCommand(state, cmd) !== null) return false;
  switch (cmd.type) {
    case "build":
      state.gold -= TOWERS[cmd.tower].cost;
      state.towers.push({
        id: state.nextId++,
        kind: cmd.tower,
        x: cmd.x,
        y: cmd.y,
        cooldown: 0,
        builtTick: state.tick,
        damageDealt: 0,
        kills: 0,
      });
      return true;
  }
}
