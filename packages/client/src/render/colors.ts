import type { EnemyKind, TowerKind } from "@td/sim";

export const COLORS = {
  background: 0x14161c,
  gridLine: 0x1f232d,
  buildable: 0x1a1d26,
  path: 0x3b4152,
  spawn: 0x2f6f4f,
  exit: 0x6f2f3a,
  hover: 0x5ab0ff,
  range: 0x5ab0ff,
  aura: 0xb07cf0,
  hpBack: 0x2a2f3a,
  hpFront: 0x6cc46c,
} as const;

export const TOWER_COLORS: Record<TowerKind, number> = {
  archer: 0x6cc46c,
  cannon: 0xf0954a,
  aura: 0xb07cf0,
  mine: 0xf4c542,
};

export const ENEMY_COLORS: Record<EnemyKind, number> = {
  normal: 0xe05252,
  fast: 0xf4c542,
  tank: 0x9c2f2f,
};
