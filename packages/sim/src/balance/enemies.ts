import { defineEnemies } from "./define";

/** Adding an enemy is adding an entry here (ADR 008). Each one asks a different question of the defense. */
export const ENEMIES = defineEnemies({
  normal: { label: "Soldado", armor: "none", hp: 55, speed: 50, bounty: 8, livesCost: 1, color: 0xe05252, radius: 0.28 },
  swarm: { label: "Enjambre", armor: "none", hp: 18, speed: 65, bounty: 2, livesCost: 1, color: 0xd98c8c, radius: 0.16 },
  fast: { label: "Veloz", armor: "light", hp: 32, speed: 100, bounty: 8, livesCost: 1, color: 0xf4c542, radius: 0.2 },
  rider: { label: "Jinete", armor: "light", hp: 130, speed: 45, bounty: 14, livesCost: 1, color: 0x8fa3b8, radius: 0.3 },
  tank: { label: "Tanque", armor: "heavy", hp: 320, speed: 30, bounty: 30, livesCost: 2, color: 0x9c2f2f, radius: 0.38 },
  enchanted: { label: "Espectro", armor: "enchanted", hp: 80, speed: 55, bounty: 12, livesCost: 1, color: 0xb07cf0, radius: 0.26 },
});

export type EnemyKind = keyof typeof ENEMIES;

export const ENEMY_KINDS = Object.keys(ENEMIES) as EnemyKind[];

export type { EnemyDef } from "./define";
