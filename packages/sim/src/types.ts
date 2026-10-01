import type { BossAffix } from "./balance/affixes";
import type { Branch } from "./balance/define";
import type { MapId } from "./balance/maps";

export type { TowerKind } from "./balance/towers";
export type { EnemyKind } from "./balance/enemies";
export type { AbilityKind } from "./balance/abilities";
export type { Deck } from "./balance/deck";
export type { DoctrineKind } from "./balance/doctrines";
import type { DoctrineKind } from "./balance/doctrines";
import type { Deck } from "./balance/deck";
import type { AbilityKind } from "./balance/abilities";
import type { TowerKind } from "./balance/towers";
import type { EnemyKind } from "./balance/enemies";
export type GameStatus = "playing" | "won" | "lost";

export interface Tower {
  id: number;
  owner: number;
  kind: TowerKind;
  /** 1 when built; each upgrade adds one, up to UPGRADE.maxLevel. */
  level: number;
  /** Identity chosen at the last level; null before that. */
  branch: Branch | null;
  x: number;
  y: number;
  cooldown: number;
  builtTick: number;
  damageDealt: number;
  kills: number;
  /** Walls only: hit points left. 0 for every other tower. */
  hp: number;
  /** Walls only: hit points when built, the top of its bar. 0 for every other tower. */
  maxHp: number;
  /** Walls only: last tick an enemy hit it; -1 if never. */
  lastHitTick: number;
  /** Fires `overchargePct` percent faster while tick < overchargeUntil. */
  overchargeUntil: number;
  overchargePct: number;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  /** Distance travelled along the path, in FP units. */
  progress: number;
  lastHitBy: number;
  /** 1-based wave this enemy belongs to; 0 for enemies placed outside waves. */
  wave: number;
  /** Percent of speed removed while tick < slowUntil. Same-effect control never stacks: only the strongest slow applies. */
  slowPct: number;
  slowUntil: number;
  /** The enemy stands still while tick < stunUntil. */
  stunUntil: number;
  /** Hits still absorbed before damage goes through. */
  shield: number;
  /** Bosses only. */
  affix: BossAffix | null;
}

export interface SpawnEntry {
  tick: number;
  kind: EnemyKind;
  hp: number;
  wave: number;
  affix: BossAffix | null;
}

export interface BuildCommand {
  type: "build";
  tick: number;
  playerId: number;
  tower: TowerKind;
  x: number;
  y: number;
}

export interface JoinCommand {
  type: "join";
  tick: number;
  playerId: number;
  /** Preferred color; the first free one when absent or taken. */
  color?: number;
  /** Required when the game plays with decks. */
  deck?: Deck;
}

export interface SetColorCommand {
  type: "setColor";
  tick: number;
  playerId: number;
  color: number;
}

export interface CallWaveCommand {
  type: "callWave";
  tick: number;
  playerId: number;
}

/** The host opens one of the map's detours, between waves (ADR 016). */
export interface OpenDetourCommand {
  type: "openDetour";
  tick: number;
  playerId: number;
  detour: number;
}

/** The host hands the role on. The server also issues it for a host who dropped. */
export interface PassHostCommand {
  type: "passHost";
  tick: number;
  playerId: number;
  to: number;
}

export interface GiftCommand {
  type: "gift";
  tick: number;
  playerId: number;
  to: number;
  amount: number;
}

export interface SellCommand {
  type: "sell";
  tick: number;
  playerId: number;
  towerId: number;
}

export interface UpgradeCommand {
  type: "upgrade";
  tick: number;
  playerId: number;
  towerId: number;
  /** Required for the last level, ignored before it. */
  branch?: Branch;
}

export interface UseAbilityCommand {
  type: "useAbility";
  tick: number;
  playerId: number;
  ability: AbilityKind;
  /** Cell aimed at, for abilities that target a cell or the path. */
  x?: number;
  y?: number;
  /** Tower aimed at, for abilities that target an own tower. */
  towerId?: number;
}

export interface ChooseDoctrineCommand {
  type: "chooseDoctrine";
  tick: number;
  playerId: number;
  doctrine: DoctrineKind;
}

export interface RerollDoctrinesCommand {
  type: "rerollDoctrines";
  tick: number;
  playerId: number;
}

export interface UpgradeAbilityCommand {
  type: "upgradeAbility";
  tick: number;
  playerId: number;
  ability: AbilityKind;
}

/** Issued by the server when a seat expires; never by a client. */
export interface LeaveCommand {
  type: "leave";
  tick: number;
  playerId: number;
}

export type Command =
  | BuildCommand
  | JoinCommand
  | CallWaveCommand
  | GiftCommand
  | SellCommand
  | UpgradeCommand
  | LeaveCommand
  | SetColorCommand
  | UseAbilityCommand
  | UpgradeAbilityCommand
  | ChooseDoctrineCommand
  | RerollDoctrinesCommand
  | PassHostCommand
  | OpenDetourCommand;

/** A player's own level and cooldown of an ability: every ability is its owner's card, even when its effect helps the team. */
export interface AbilitySlot {
  /** 1 at the start; each upgrade adds one, up to the ability's number of levels. */
  level: number;
  /** First tick the ability can be used again. */
  readyTick: number;
}

/** A bombard marked on the map, landing at `tick`. */
export interface Blast {
  id: number;
  tick: number;
  /** FP center. */
  x: number;
  y: number;
  radius: number;
  damage: number;
}

/** A stretch of path that slows everything in it until `until`. */
export interface FrostZone {
  id: number;
  until: number;
  /** FP center. */
  x: number;
  y: number;
  radius: number;
  slowPct: number;
}

export interface Player {
  id: number;
  gold: number;
  /** Gold earned in play: bounties, interest, mines, wave bonus. Gifts and sales are transfers, not earnings. */
  earned: number;
  /** First tick this player may build a wall again after theirs fell. */
  wallReadyTick: number;
  /** Index into PLAYER_COLORS; unique among the players present. */
  color: number;
  abilities: Record<AbilityKind, AbilitySlot>;
  /** Cards this player may buy and use. Every card when the game plays without decks. */
  deck: Deck;
  /** Doctrines picked so far, in order; they touch only this player's towers, gold and abilities. */
  doctrines: DoctrineKind[];
  /** Doctrines on offer right now; empty when there is no offer. It expires when the next wave starts. */
  doctrineOffer: DoctrineKind[];
  /** Whether this offer was already rerolled; one reroll per offer. */
  doctrineRerolled: boolean;
  /** Market surcharge on each tower kind for this player, in percent of its base cost; absent means none. */
  surcharge: Partial<Record<TowerKind, number>>;
  /** Last wave in which this player bought a tower, for the first-tower discount; -1 if never. */
  lastBuildWave: number;
}

export interface GameStats {
  kills: number;
  leaks: number;
  goldEarned: number;
  damageByTower: Record<TowerKind, number>;
  damageByAbility: Record<AbilityKind, number>;
}

export interface GameState {
  balanceVersion: number;
  seed: number;
  rng: number;
  mapId: MapId;
  tick: number;
  status: GameStatus;
  /** Towers each deck must hold; 0 when the game plays without decks and everyone has every card. */
  deckTowers: number;
  /** False when the game started with dev overrides; such games never submit records. */
  ranked: boolean;
  /** Sorted by id. Each player owns their gold and their towers. */
  players: Player[];
  lives: number;
  /** Number of waves started so far (1-based index of the current wave). */
  wave: number;
  /** Tick when the next wave starts, or null while the current wave still has enemies (ADR 007). */
  nextWaveTick: number | null;
  /** Waves whose last enemy already died or leaked; interest was paid for them. */
  wavesClosed: number;
  /** Detours of the map opened so far, ascending; permanent for the game (ADR 016). */
  detours: number[];
  /** The player who calls waves early (ADR 014). Passes to the next seat when they leave. */
  host: number;
  spawnQueue: SpawnEntry[];
  nextId: number;
  towers: Tower[];
  enemies: Enemy[];
  /** Bombards marked and not landed yet. */
  blasts: Blast[];
  frostZones: FrostZone[];
  stats: GameStats;
}
