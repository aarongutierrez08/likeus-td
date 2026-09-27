import { TOWERS } from "./balance/towers";
import { isBuildable, isInside } from "./grid";
import { GAME } from "./balance/game";
import type { BuildCommand, Command, GameState, JoinCommand, Player } from "./types";

export type RejectReason = "outside" | "on_path" | "occupied" | "no_gold" | "unknown_tower" | "no_player";

export function findPlayer(state: GameState, playerId: number): Player | undefined {
  return state.players.find((p) => p.id === playerId);
}

export function validateBuild(state: GameState, cmd: BuildCommand): RejectReason | null {
  const def = TOWERS[cmd.tower];
  if (!def) return "unknown_tower";
  const player = findPlayer(state, cmd.playerId);
  if (!player) return "no_player";
  if (!isInside(state.mapId, cmd.x, cmd.y)) return "outside";
  if (!isBuildable(state.mapId, cmd.x, cmd.y)) return "on_path";
  if (state.towers.some((t) => t.x === cmd.x && t.y === cmd.y)) return "occupied";
  if (player.gold < def.cost) return "no_gold";
  return null;
}

/** Joining twice is harmless: the second join is ignored. */
export function validateJoin(_state: GameState, _cmd: JoinCommand): RejectReason | null {
  return null;
}

export function validateCommand(state: GameState, cmd: Command): RejectReason | null {
  switch (cmd.type) {
    case "build":
      return validateBuild(state, cmd);
    case "join":
      return validateJoin(state, cmd);
  }
}

/** Mutates state. Returns false when the command was rejected. */
export function applyCommand(state: GameState, cmd: Command): boolean {
  if (validateCommand(state, cmd) !== null) return false;
  switch (cmd.type) {
    case "build":
      findPlayer(state, cmd.playerId)!.gold -= TOWERS[cmd.tower].cost;
      state.towers.push({
        id: state.nextId++,
        owner: cmd.playerId,
        kind: cmd.tower,
        x: cmd.x,
        y: cmd.y,
        cooldown: 0,
        builtTick: state.tick,
        damageDealt: 0,
        kills: 0,
      });
      return true;
    case "join":
      if (!findPlayer(state, cmd.playerId)) {
        state.players.push({ id: cmd.playerId, gold: GAME.startGold });
        state.players.sort((a, b) => a.id - b.id);
      }
      return true;
  }
}
