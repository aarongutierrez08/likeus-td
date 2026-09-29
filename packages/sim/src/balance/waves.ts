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
  { hpPct: 173, groups: [{ kind: "fast", count: 12, spacing: 8 }] },
  {
    hpPct: 270,
    groups: [
      { kind: "tank", count: 2, spacing: 40 },
      { kind: "normal", count: 8, spacing: 12 },
    ],
  },
  { hpPct: 195, groups: [{ kind: "enchanted", count: 8, spacing: 12 }] },
  {
    hpPct: 210,
    groups: [
      { kind: "swarm", count: 24, spacing: 5 },
      { kind: "rider", count: 3, spacing: 25 },
    ],
  },
  {
    hpPct: 225,
    groups: [
      { kind: "rider", count: 6, spacing: 18 },
      { kind: "tank", count: 2, spacing: 40 },
    ],
  },
  {
    hpPct: 248,
    groups: [
      { kind: "enchanted", count: 10, spacing: 10 },
      { kind: "tank", count: 2, spacing: 30 },
    ],
  },
  {
    hpPct: 270,
    groups: [
      { kind: "swarm", count: 20, spacing: 5 },
      { kind: "rider", count: 4, spacing: 18 },
      { kind: "enchanted", count: 10, spacing: 10 },
      { kind: "fast", count: 10, spacing: 7 },
      { kind: "tank", count: 2, spacing: 30 },
      { kind: "boss", count: 1, spacing: 60 },
    ],
  },
  { hpPct: 300, groups: [{ kind: "shade", count: 10, spacing: 12 }] },
  {
    hpPct: 320,
    groups: [
      { kind: "normal", count: 10, spacing: 12 },
      { kind: "healer", count: 3, spacing: 30 },
    ],
  },
  {
    hpPct: 340,
    groups: [
      { kind: "shielded", count: 8, spacing: 18 },
      { kind: "fast", count: 8, spacing: 8 },
    ],
  },
  { hpPct: 360, groups: [{ kind: "blob", count: 8, spacing: 25 }] },
  {
    hpPct: 380,
    groups: [
      { kind: "shade", count: 12, spacing: 10 },
      { kind: "healer", count: 3, spacing: 30 },
    ],
  },
  {
    hpPct: 400,
    groups: [
      { kind: "swarm", count: 30, spacing: 4 },
      { kind: "shielded", count: 6, spacing: 18 },
    ],
  },
  {
    hpPct: 430,
    groups: [
      { kind: "blob", count: 6, spacing: 25 },
      { kind: "enchanted", count: 10, spacing: 10 },
      { kind: "healer", count: 2, spacing: 30 },
    ],
  },
  {
    hpPct: 460,
    groups: [
      { kind: "shade", count: 10, spacing: 10 },
      { kind: "rider", count: 8, spacing: 15 },
      { kind: "tank", count: 3, spacing: 30 },
    ],
  },
  {
    hpPct: 500,
    groups: [
      { kind: "shielded", count: 8, spacing: 15 },
      { kind: "healer", count: 4, spacing: 25 },
      { kind: "fast", count: 12, spacing: 6 },
    ],
  },
  {
    hpPct: 550,
    groups: [
      { kind: "swarm", count: 30, spacing: 4 },
      { kind: "blob", count: 6, spacing: 20 },
      { kind: "shade", count: 10, spacing: 10 },
      { kind: "shielded", count: 6, spacing: 15 },
      { kind: "healer", count: 3, spacing: 30 },
      { kind: "boss", count: 1, spacing: 60 },
    ],
  },
];
