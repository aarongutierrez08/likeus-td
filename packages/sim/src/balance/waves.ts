import type { EnemyKind } from "../types";

export interface SpawnGroup {
  kind: EnemyKind;
  count: number;
  /** Ticks between consecutive spawns of this group. */
  spacing: number;
}

export interface WaveDef {
  /** Enemy hp multiplier for the whole wave, in percent of the base hp. */
  hpPct: number;
  groups: readonly SpawnGroup[];
}

/** Difficulty comes from composition: each wave from the fourth asks for a specific answer. */
export const WAVES: readonly WaveDef[] = [
  { hpPct: 100, groups: [{ kind: "normal", count: 6, spacing: 20 }] },
  {
    hpPct: 105,
    groups: [
      { kind: "normal", count: 8, spacing: 16 },
      { kind: "fast", count: 4, spacing: 12 },
    ],
  },
  {
    hpPct: 110,
    groups: [
      { kind: "swarm", count: 14, spacing: 6 },
      { kind: "normal", count: 4, spacing: 14 },
    ],
  },
  { hpPct: 115, groups: [{ kind: "fast", count: 12, spacing: 8 }] },
  {
    hpPct: 120,
    groups: [
      { kind: "tank", count: 2, spacing: 40 },
      { kind: "normal", count: 8, spacing: 12 },
    ],
  },
  { hpPct: 130, groups: [{ kind: "enchanted", count: 8, spacing: 12 }] },
  {
    hpPct: 140,
    groups: [
      { kind: "swarm", count: 24, spacing: 5 },
      { kind: "knight", count: 4, spacing: 25 },
    ],
  },
  {
    hpPct: 150,
    groups: [
      { kind: "knight", count: 8, spacing: 18 },
      { kind: "fast", count: 8, spacing: 8 },
    ],
  },
  {
    hpPct: 165,
    groups: [
      { kind: "enchanted", count: 10, spacing: 10 },
      { kind: "tank", count: 3, spacing: 30 },
    ],
  },
  {
    hpPct: 180,
    groups: [
      { kind: "swarm", count: 20, spacing: 5 },
      { kind: "knight", count: 6, spacing: 18 },
      { kind: "enchanted", count: 8, spacing: 10 },
      { kind: "fast", count: 10, spacing: 7 },
      { kind: "tank", count: 3, spacing: 30 },
    ],
  },
];
