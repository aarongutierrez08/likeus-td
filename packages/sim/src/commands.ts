import { TOWERS } from "./balance/towers";
import { isBuildable, isInside } from "./grid";
import { ECONOMY } from "./balance/economy";
import { WAVES } from "./balance/waves";
import { callQuorum, callWaveBonus, startingGold } from "./economy";
import type { BuildCommand, CallWaveCommand, Command, GameState, GiftCommand, JoinCommand, Player } from "./types";

export type RejectReason =
  | "outside"
  | "on_path"
  | "occupied"
  | "no_gold"
  | "unknown_tower"
  | "no_player"
  | "wave_not_pending"
  | "already_called"
  | "gift_too_early"
  | "bad_amount";

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

export function validateCallWave(state: GameState, cmd: CallWaveCommand): RejectReason | null {
  if (!findPlayer(state, cmd.playerId)) return "no_player";
  if (state.wave >= WAVES.length || state.nextWaveTick <= state.tick) return "wave_not_pending";
  if (state.waveCalls.includes(cmd.playerId)) return "already_called";
  return null;
}

export function validateGift(state: GameState, cmd: GiftCommand): RejectReason | null {
  const from = findPlayer(state, cmd.playerId);
  if (!from) return "no_player";
  if (!Number.isInteger(cmd.amount) || cmd.amount <= 0 || cmd.to === cmd.playerId) return "bad_amount";
  if (!findPlayer(state, cmd.to)) return "no_player";
  if (state.wave < ECONOMY.giftFromWave) return "gift_too_early";
  if (from.gold < cmd.amount) return "no_gold";
  return null;
}

export function validateCommand(state: GameState, cmd: Command): RejectReason | null {
  switch (cmd.type) {
    case "build":
      return validateBuild(state, cmd);
    case "join":
      return validateJoin(state, cmd);
    case "callWave":
      return validateCallWave(state, cmd);
    case "gift":
      return validateGift(state, cmd);
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
        state.players.push({ id: cmd.playerId, gold: startingGold(state.players.length + 1) });
        state.players.sort((a, b) => a.id - b.id);
      }
      return true;
    case "callWave":
      state.waveCalls.push(cmd.playerId);
      if (state.waveCalls.length >= callQuorum(state.players.length)) {
        const bonus = callWaveBonus(state.nextWaveTick - state.tick);
        for (const player of state.players) player.gold += bonus;
        state.nextWaveTick = state.tick;
      }
      return true;
    case "gift":
      findPlayer(state, cmd.playerId)!.gold -= cmd.amount;
      findPlayer(state, cmd.to)!.gold += cmd.amount;
      return true;
  }
}
