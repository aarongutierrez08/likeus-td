import type { MapId } from "./balance/maps";

export type TowerKind = "archer" | "cannon" | "aura";
export type EnemyKind = "normal" | "fast" | "tank";
export type GameStatus = "playing" | "won" | "lost";

export interface Tower {
  id: number;
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
}

export interface SpawnEntry {
  tick: number;
  kind: EnemyKind;
  hp: number;
}

export interface BuildCommand {
  type: "build";
  tick: number;
  playerId: number;
  tower: TowerKind;
  x: number;
  y: number;
}

export type Command = BuildCommand;

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
  gold: number;
  lives: number;
  /** Number of waves started so far (1-based index of the current wave). */
  wave: number;
  nextWaveTick: number;
  spawnQueue: SpawnEntry[];
  nextId: number;
  towers: Tower[];
  enemies: Enemy[];
  stats: GameStats;
}
