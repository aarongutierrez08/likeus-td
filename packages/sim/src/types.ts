import type { BossAffix } from "./balance/affixes";
import type { MapId } from "./balance/maps";

export type { TowerKind } from "./balance/towers";
export type { EnemyKind } from "./balance/enemies";
import type { TowerKind } from "./balance/towers";
import type { EnemyKind } from "./balance/enemies";
export type GameStatus = "playing" | "won" | "lost";

export interface Tower {
  id: number;
  owner: number;
  kind: TowerKind;
  /** 1 when built; each upgrade adds one, up to UPGRADE.maxLevel. */
  level: number;
  x: number;
  y: number;
  cooldown: number;
  builtTick: number;
  damageDealt: number;
  kills: number;
  /** Walls only: hit points left. 0 for every other tower. */
  hp: number;
  /** Walls only: last tick an enemy hit it; -1 if never. */
  lastHitTick: number;
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
}

/** Issued by the server when a seat expires; never by a client. */
export interface LeaveCommand {
  type: "leave";
  tick: number;
  playerId: number;
}

export type Command =
  BuildCommand | JoinCommand | CallWaveCommand | GiftCommand | SellCommand | UpgradeCommand | LeaveCommand | SetColorCommand;

export interface Player {
  id: number;
  gold: number;
  /** Gold earned in play: bounties, interest, mines, wave bonus. Gifts and sales are transfers, not earnings. */
  earned: number;
  /** First tick this player may build a wall again after theirs fell. */
  wallReadyTick: number;
  /** Index into PLAYER_COLORS; unique among the players present. */
  color: number;
}

export interface GameStats {
  kills: number;
  leaks: number;
  goldEarned: number;
  damageByTower: Record<TowerKind, number>;
}

export interface GameState {
  balanceVersion: number;
  seed: number;
  rng: number;
  mapId: MapId;
  tick: number;
  status: GameStatus;
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
  /** Players who asked to call the next wave since the current one started. */
  waveCalls: number[];
  spawnQueue: SpawnEntry[];
  nextId: number;
  towers: Tower[];
  enemies: Enemy[];
  stats: GameStats;
}
