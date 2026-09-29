import { defineEnemies } from "./define";

/** Adding an enemy is adding an entry here (ADR 008). Each one asks a different question of the defense. */
export const ENEMIES = defineEnemies({
  normal: { label: "Soldado", armor: "none", hp: 55, speed: 50, bounty: 8, livesCost: 1, wallDamage: 2, color: 0xe05252, radius: 0.28 },
  swarm: { label: "Enjambre", armor: "none", hp: 18, speed: 65, bounty: 2, livesCost: 1, wallDamage: 1, color: 0xd98c8c, radius: 0.16 },
  fast: { label: "Veloz", armor: "light", hp: 32, speed: 100, bounty: 8, livesCost: 1, wallDamage: 2, color: 0xf4c542, radius: 0.2 },
  rider: { label: "Jinete", armor: "light", hp: 130, speed: 45, bounty: 14, livesCost: 1, wallDamage: 4, color: 0x8fa3b8, radius: 0.3 },
  tank: { label: "Tanque", armor: "heavy", hp: 320, speed: 30, bounty: 30, livesCost: 2, wallDamage: 8, color: 0x9c2f2f, radius: 0.38 },
  enchanted: {
    label: "Espectro",
    armor: "enchanted",
    hp: 80,
    speed: 55,
    bounty: 12,
    livesCost: 1,
    wallDamage: 2,
    color: 0xb07cf0,
    radius: 0.26,
  },
  shade: {
    label: "Sombra",
    armor: "none",
    hp: 60,
    speed: 60,
    bounty: 10,
    livesCost: 1,
    wallDamage: 2,
    color: 0x6e6e8a,
    radius: 0.24,
    stealth: true,
  },
  healer: {
    label: "Sanador",
    armor: "enchanted",
    hp: 90,
    speed: 45,
    bounty: 14,
    livesCost: 1,
    wallDamage: 1,
    color: 0x7fe0a0,
    radius: 0.26,
    heal: { amount: 5, range: 1500, every: 10 },
  },
  shielded: {
    label: "Escudado",
    armor: "heavy",
    hp: 150,
    speed: 45,
    bounty: 16,
    livesCost: 1,
    wallDamage: 6,
    color: 0xc8d8e8,
    radius: 0.3,
    shieldHits: 1,
  },
  blob: {
    label: "Gelatina",
    armor: "none",
    hp: 120,
    speed: 40,
    bounty: 10,
    livesCost: 1,
    wallDamage: 3,
    color: 0x9be05a,
    radius: 0.32,
    split: { kind: "blobling", count: 3 },
  },
  blobling: {
    label: "Gelatina chica",
    armor: "none",
    hp: 30,
    speed: 55,
    bounty: 3,
    livesCost: 1,
    wallDamage: 1,
    color: 0xb8f07a,
    radius: 0.18,
  },
  boss: { label: "Jefe", armor: "heavy", hp: 600, speed: 35, bounty: 100, livesCost: 5, wallDamage: 20, color: 0xff5c5c, radius: 0.45 },
});

export type EnemyKind = keyof typeof ENEMIES;

export const ENEMY_KINDS = Object.keys(ENEMIES) as EnemyKind[];

export type { EnemyDef, EnemySpec } from "./define";
