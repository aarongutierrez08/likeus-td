import { SELL_REFUND_PCT, TOWERS, UPGRADE } from "./balance/towers";
import { isBuildable, isInside } from "./grid";
import { ECONOMY } from "./balance/economy";
import { TEAM_OWNER } from "./constants";
import { WAVES } from "./balance/waves";
import { callQuorum, callWaveBonus, startingGold } from "./economy";
import type {
  BuildCommand,
  CallWaveCommand,
  Command,
  GameState,
  GiftCommand,
  JoinCommand,
  LeaveCommand,
  Player,
  SellCommand,
  Tower,
  TowerKind,
  UpgradeCommand,
} from "./types";

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
  | "bad_amount"
  | "no_tower"
  | "not_owner"
  | "wave_in_progress"
  | "max_level";

export function upgradeCost(kind: TowerKind): number {
  return Math.floor((TOWERS[kind].cost * UPGRADE.costPctPerLevel) / 100);
}

export function investedIn(tower: Tower): number {
  return TOWERS[tower.kind].cost + upgradeCost(tower.kind) * (tower.level - 1);
}

export function sellRefund(tower: Tower): number {
  return Math.floor((investedIn(tower) * SELL_REFUND_PCT) / 100);
}

export function towerDamage(tower: Tower): number {
  const def = TOWERS[tower.kind];
  return Math.floor((def.damage * (100 + UPGRADE.damagePctPerLevel * (tower.level - 1))) / 100);
}

/** Gold this tower pays its owner at a wave close (ADR 007: not attenuated, owner only). */
export function towerIncome(tower: Tower): number {
  const def = TOWERS[tower.kind];
  return Math.floor((def.income * (100 + UPGRADE.incomePctPerLevel * (tower.level - 1))) / 100);
}

export function auraBonusOf(tower: Tower): number {
  const def = TOWERS[tower.kind];
  if (def.auraRadius === 0) return 0;
  return def.auraBonusPct + UPGRADE.auraBonusPctPerLevel * (tower.level - 1);
}

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
  if (state.wave >= WAVES.length) return "wave_not_pending";
  if (state.wavesClosed < state.wave) return "wave_in_progress";
  if (state.nextWaveTick === null || state.nextWaveTick <= state.tick) return "wave_not_pending";
  if (state.waveCalls.includes(cmd.playerId)) return "already_called";
  return null;
}

export function mayManage(tower: Tower, playerId: number): boolean {
  return tower.owner === playerId || tower.owner === TEAM_OWNER;
}

export function validateSell(state: GameState, cmd: SellCommand): RejectReason | null {
  if (!findPlayer(state, cmd.playerId)) return "no_player";
  const tower = state.towers.find((t) => t.id === cmd.towerId);
  if (!tower) return "no_tower";
  if (!mayManage(tower, cmd.playerId)) return "not_owner";
  return null;
}

export function validateLeave(state: GameState, cmd: LeaveCommand): RejectReason | null {
  return findPlayer(state, cmd.playerId) ? null : "no_player";
}

export function validateUpgrade(state: GameState, cmd: UpgradeCommand): RejectReason | null {
  const player = findPlayer(state, cmd.playerId);
  if (!player) return "no_player";
  const tower = state.towers.find((t) => t.id === cmd.towerId);
  if (!tower) return "no_tower";
  if (!mayManage(tower, cmd.playerId)) return "not_owner";
  if (tower.level >= UPGRADE.maxLevel) return "max_level";
  if (player.gold < upgradeCost(tower.kind)) return "no_gold";
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
    case "sell":
      return validateSell(state, cmd);
    case "upgrade":
      return validateUpgrade(state, cmd);
    case "leave":
      return validateLeave(state, cmd);
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
        level: 1,
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
        const bonus = callWaveBonus((state.nextWaveTick ?? state.tick) - state.tick);
        for (const player of state.players) player.gold += bonus;
        state.nextWaveTick = state.tick;
      }
      return true;
    case "gift":
      findPlayer(state, cmd.playerId)!.gold -= cmd.amount;
      findPlayer(state, cmd.to)!.gold += cmd.amount;
      return true;
    case "sell": {
      const index = state.towers.findIndex((t) => t.id === cmd.towerId);
      const tower = state.towers[index]!;
      state.towers.splice(index, 1);
      findPlayer(state, cmd.playerId)!.gold += sellRefund(tower);
      return true;
    }
    case "upgrade": {
      const tower = state.towers.find((t) => t.id === cmd.towerId)!;
      tower.level++;
      findPlayer(state, cmd.playerId)!.gold -= upgradeCost(tower.kind);
      return true;
    }
    case "leave": {
      const leaving = findPlayer(state, cmd.playerId)!;
      state.players = state.players.filter((p) => p.id !== cmd.playerId);
      for (const tower of state.towers) if (tower.owner === cmd.playerId) tower.owner = TEAM_OWNER;
      const remaining = state.players.length;
      if (remaining > 0) {
        const share = Math.floor(leaving.gold / remaining);
        for (const player of state.players) player.gold += share;
        state.players[0]!.gold += leaving.gold - share * remaining;
      }
      return true;
    }
  }
}
