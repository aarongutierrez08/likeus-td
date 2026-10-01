import { ABILITIES, ABILITY_KINDS } from "./balance/abilities";
import { hasAttack, hasWall } from "./balance/define";
import { SELL_REFUND_PCT, TOWERS, UPGRADE, towerDef } from "./balance/towers";
import { isBuildable, isInside, isPathCell } from "./grid";
import { ECONOMY } from "./balance/economy";
import { TEAM_OWNER } from "./constants";
import { WAVES } from "./balance/waves";
import { isPlayerColor, pickColor } from "./colors";
import { callQuorum, callWaveBonus, startingGold } from "./economy";
import { deckProblem } from "./deck";
import { freshAbilities, freshDoctrines, fullDeck } from "./state";
import { castAbility } from "./systems/abilities";
import { doctrineEffect, drawOffer } from "./systems/doctrines";
import { DOCTRINE } from "./balance/doctrines";
import type {
  AbilityKind,
  BuildCommand,
  CallWaveCommand,
  Command,
  GameState,
  GiftCommand,
  JoinCommand,
  LeaveCommand,
  Player,
  SellCommand,
  SetColorCommand,
  Tower,
  TowerKind,
  UpgradeAbilityCommand,
  UpgradeCommand,
  UseAbilityCommand,
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
  | "max_level"
  | "not_on_path"
  | "wall_active"
  | "wall_cooldown"
  | "wall_under_attack"
  | "bad_color"
  | "color_taken"
  | "branch_required"
  | "bad_branch"
  | "unknown_ability"
  | "ability_cooldown"
  | "bad_target"
  | "not_in_deck"
  | "bad_deck"
  | "no_offer"
  | "bad_doctrine"
  | "already_rerolled";

export function upgradeCost(kind: TowerKind): number {
  return Math.floor((TOWERS[kind].cost * UPGRADE.costPctPerLevel) / 100);
}

export function investedIn(tower: Tower): number {
  return towerDef(tower).cost + upgradeCost(tower.kind) * (tower.level - 1);
}

export function sellRefund(tower: Tower): number {
  return Math.floor((investedIn(tower) * SELL_REFUND_PCT) / 100);
}

export function towerDamage(tower: Tower): number {
  const def = towerDef(tower);
  return Math.floor((def.damage * (100 + UPGRADE.damagePctPerLevel * (tower.level - 1))) / 100);
}

/** Gold this tower pays its owner at a wave close (ADR 007: not attenuated, owner only). */
export function towerIncome(tower: Tower): number {
  const def = towerDef(tower);
  return Math.floor((def.income * (100 + UPGRADE.incomePctPerLevel * (tower.level - 1))) / 100);
}

export function auraBonusOf(tower: Tower): number {
  const def = towerDef(tower);
  if (def.auraRadius === 0) return 0;
  return def.auraBonusPct + UPGRADE.auraBonusPctPerLevel * (tower.level - 1);
}

function controlScale(tower: Tower): number {
  return 100 + UPGRADE.controlPctPerLevel * (tower.level - 1);
}

/** Percent of speed a slow tower removes at its level; 0 for other towers. */
export function controlPctOf(tower: Tower): number {
  return Math.floor((towerDef(tower).controlPct * controlScale(tower)) / 100);
}

/** Ticks a control tower's effect lasts at its level; 0 for other towers. */
export function controlDurationOf(tower: Tower): number {
  return Math.floor((towerDef(tower).controlDuration * controlScale(tower)) / 100);
}

/** What this player pays for the tower now: the first one of each wave is cheaper with the right doctrine. */
export function buildCost(state: GameState, player: Player, kind: TowerKind): number {
  const cost = TOWERS[kind].cost;
  const pct = doctrineEffect(state, player.id, "firstTowerDiscountPct");
  return pct > 0 && player.lastBuildWave !== state.wave ? cost - Math.floor((cost * pct) / 100) : cost;
}

export function findPlayer(state: GameState, playerId: number): Player | undefined {
  return state.players.find((p) => p.id === playerId);
}

export function validateBuild(state: GameState, cmd: BuildCommand): RejectReason | null {
  const def = TOWERS[cmd.tower];
  if (!def) return "unknown_tower";
  const player = findPlayer(state, cmd.playerId);
  if (!player) return "no_player";
  if (!player.deck.towers.includes(cmd.tower)) return "not_in_deck";
  if (!isInside(state.mapId, cmd.x, cmd.y)) return "outside";
  if (hasWall(def)) {
    if (!isPathCell(state.mapId, cmd.x, cmd.y)) return "not_on_path";
    if (state.towers.some((t) => t.owner === cmd.playerId && hasWall(towerDef(t)))) return "wall_active";
    if (state.tick < player.wallReadyTick) return "wall_cooldown";
  } else if (!isBuildable(state.mapId, cmd.x, cmd.y)) {
    return "on_path";
  }
  if (state.towers.some((t) => t.x === cmd.x && t.y === cmd.y)) return "occupied";
  if (player.gold < buildCost(state, player, cmd.tower)) return "no_gold";
  return null;
}

/** A wall is under attack when an enemy hit it this tick or the previous one. */
export function underAttack(state: GameState, tower: Tower): boolean {
  return hasWall(towerDef(tower)) && tower.lastHitTick >= state.tick - 1;
}

/** Joining twice is harmless: the second join is ignored. In a game with decks a newcomer must bring a valid one. */
export function validateJoin(state: GameState, cmd: JoinCommand): RejectReason | null {
  if (state.deckTowers === 0 || findPlayer(state, cmd.playerId)) return null;
  return deckProblem(cmd.deck, state.deckTowers);
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
  if (underAttack(state, tower)) return "wall_under_attack";
  return null;
}

export function validateSetColor(state: GameState, cmd: SetColorCommand): RejectReason | null {
  if (!findPlayer(state, cmd.playerId)) return "no_player";
  if (!isPlayerColor(cmd.color)) return "bad_color";
  if (state.players.some((p) => p.id !== cmd.playerId && p.color === cmd.color)) return "color_taken";
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
  if (tower.level >= UPGRADE.maxLevel || hasWall(towerDef(tower))) return "max_level";
  if (player.gold < upgradeCost(tower.kind)) return "no_gold";
  if (tower.level + 1 === UPGRADE.maxLevel && TOWERS[tower.kind].branches) {
    if (cmd.branch === undefined) return "branch_required";
    if (cmd.branch !== "a" && cmd.branch !== "b") return "bad_branch";
  }
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

const isAbility = (kind: string): kind is AbilityKind => (ABILITY_KINDS as readonly string[]).includes(kind);

function validateAbilityTarget(state: GameState, cmd: UseAbilityCommand): RejectReason | null {
  const target = ABILITIES[cmd.ability].target;
  if (target === "none") return null;
  if (target === "ownTower") {
    const tower = state.towers.find((t) => t.id === cmd.towerId);
    if (!tower) return "no_tower";
    if (!mayManage(tower, cmd.playerId)) return "not_owner";
    return hasAttack(towerDef(tower)) ? null : "bad_target";
  }
  if (!Number.isInteger(cmd.x) || !Number.isInteger(cmd.y) || !isInside(state.mapId, cmd.x!, cmd.y!)) return "outside";
  if (target === "path" && !isPathCell(state.mapId, cmd.x!, cmd.y!)) return "not_on_path";
  return null;
}

export function validateUseAbility(state: GameState, cmd: UseAbilityCommand): RejectReason | null {
  const player = findPlayer(state, cmd.playerId);
  if (!player) return "no_player";
  if (!isAbility(cmd.ability)) return "unknown_ability";
  if (!player.deck.abilities.includes(cmd.ability)) return "not_in_deck";
  if (state.tick < player.abilities[cmd.ability].readyTick) return "ability_cooldown";
  return validateAbilityTarget(state, cmd);
}

export function validateUpgradeAbility(state: GameState, cmd: UpgradeAbilityCommand): RejectReason | null {
  const player = findPlayer(state, cmd.playerId);
  if (!player) return "no_player";
  if (!isAbility(cmd.ability)) return "unknown_ability";
  if (!player.deck.abilities.includes(cmd.ability)) return "not_in_deck";
  const def = ABILITIES[cmd.ability];
  if (player.abilities[cmd.ability].level >= def.levels.length) return "max_level";
  if (player.gold < def.upgradeCost) return "no_gold";
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
    case "setColor":
      return validateSetColor(state, cmd);
    case "useAbility":
      return validateUseAbility(state, cmd);
    case "chooseDoctrine": {
      const player = findPlayer(state, cmd.playerId);
      if (!player) return "no_player";
      if (player.doctrineOffer.length === 0) return "no_offer";
      return player.doctrineOffer.includes(cmd.doctrine) ? null : "bad_doctrine";
    }
    case "rerollDoctrines": {
      const player = findPlayer(state, cmd.playerId);
      if (!player) return "no_player";
      if (player.doctrineOffer.length === 0) return "no_offer";
      if (player.doctrineRerolled) return "already_rerolled";
      return player.gold < DOCTRINE.rerollCost ? "no_gold" : null;
    }
    case "upgradeAbility":
      return validateUpgradeAbility(state, cmd);
  }
}

/** Mutates state. Returns false when the command was rejected. */
export function applyCommand(state: GameState, cmd: Command): boolean {
  if (validateCommand(state, cmd) !== null) return false;
  switch (cmd.type) {
    case "build": {
      const player = findPlayer(state, cmd.playerId)!;
      player.gold -= buildCost(state, player, cmd.tower);
      player.lastBuildWave = state.wave;
      const wallHp = Math.floor((TOWERS[cmd.tower].wallHp * (100 + doctrineEffect(state, player.id, "wallHpPct"))) / 100);
      state.towers.push({
        id: state.nextId++,
        owner: cmd.playerId,
        kind: cmd.tower,
        level: 1,
        branch: null,
        x: cmd.x,
        y: cmd.y,
        cooldown: 0,
        builtTick: state.tick,
        damageDealt: 0,
        kills: 0,
        hp: wallHp,
        maxHp: wallHp,
        lastHitTick: -1,
        overchargeUntil: 0,
        overchargePct: 0,
      });
      return true;
    }
    case "join":
      if (!findPlayer(state, cmd.playerId)) {
        state.players.push({
          id: cmd.playerId,
          gold: startingGold(state.players.length + 1),
          earned: 0,
          wallReadyTick: 0,
          abilities: freshAbilities(),
          ...freshDoctrines(),
          deck: state.deckTowers === 0 ? fullDeck() : { towers: [...cmd.deck!.towers], abilities: [...cmd.deck!.abilities] },
          color: pickColor(state.players, cmd.color),
        });
        state.players.sort((a, b) => a.id - b.id);
      }
      return true;
    case "callWave":
      state.waveCalls.push(cmd.playerId);
      if (state.waveCalls.length >= callQuorum(state.players.length)) {
        const bonus = callWaveBonus((state.nextWaveTick ?? state.tick) - state.tick);
        for (const player of state.players) {
          player.gold += bonus;
          player.earned += bonus;
        }
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
      if (tower.level === UPGRADE.maxLevel && cmd.branch !== undefined && TOWERS[tower.kind].branches) tower.branch = cmd.branch;
      findPlayer(state, cmd.playerId)!.gold -= upgradeCost(tower.kind);
      return true;
    }
    case "setColor":
      findPlayer(state, cmd.playerId)!.color = cmd.color;
      return true;
    case "useAbility":
      castAbility(state, cmd);
      return true;
    case "chooseDoctrine": {
      const player = findPlayer(state, cmd.playerId)!;
      player.doctrines.push(cmd.doctrine);
      player.doctrineOffer = [];
      return true;
    }
    case "rerollDoctrines": {
      const player = findPlayer(state, cmd.playerId)!;
      player.gold -= DOCTRINE.rerollCost;
      player.doctrineRerolled = true;
      player.doctrineOffer = drawOffer(state, player, player.doctrineOffer);
      return true;
    }
    case "upgradeAbility": {
      const player = findPlayer(state, cmd.playerId)!;
      player.gold -= ABILITIES[cmd.ability].upgradeCost;
      player.abilities[cmd.ability].level++;
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
