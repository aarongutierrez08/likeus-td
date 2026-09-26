import type { EnemyKind } from "../types";

export interface EnemyDef {
  hp: number;
  /** FP units per tick. 50 = one cell per second at 20 ticks/s. */
  speed: number;
  bounty: number;
  livesCost: number;
}

export const ENEMY_KINDS: readonly EnemyKind[] = ["normal", "fast", "tank"];

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  normal: { hp: 55, speed: 50, bounty: 8, livesCost: 1 },
  fast: { hp: 32, speed: 100, bounty: 8, livesCost: 1 },
  tank: { hp: 320, speed: 30, bounty: 30, livesCost: 2 },
};
