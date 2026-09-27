import { defineEnemies } from "./define";

/** Adding an enemy is adding an entry here (ADR 008). */
export const ENEMIES = defineEnemies({
  normal: { hp: 55, speed: 50, bounty: 8, livesCost: 1, color: 0xe05252, radius: 0.28 },
  fast: { hp: 32, speed: 100, bounty: 8, livesCost: 1, color: 0xf4c542, radius: 0.2 },
  tank: { hp: 320, speed: 30, bounty: 30, livesCost: 2, color: 0x9c2f2f, radius: 0.38 },
});

export type EnemyKind = keyof typeof ENEMIES;

export const ENEMY_KINDS = Object.keys(ENEMIES) as EnemyKind[];

export type { EnemyDef } from "./define";
