import type { MapId } from "./balance/maps";

export type TowerKind = "archer" | "cannon" | "aura";
export type EnemyKind = "normal" | "fast" | "tank";
export type GameStatus = "playing" | "won" | "lost";

export interface Tower {
  id: number;
  owner: number;
  kind: TowerKind;
  x: number;
  y: number;
  cooldown: number;
  builtTick: number;
  damageDealt: number;
  kills: number;
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
}

export interface SpawnEntry {
  tick: number;
  kind: EnemyKind;
  hp: number;
  wave: number;
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

export type Command = BuildCommand | JoinCommand | CallWaveCommand | GiftCommand | SellCommand;

export interface Player {
  id: number;
  gold: number;
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
  nextWaveTick: number;
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
