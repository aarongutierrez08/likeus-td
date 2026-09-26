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

export const WAVES: readonly WaveDef[] = [
  { hpPct: 100, groups: [{ kind: "normal", count: 6, spacing: 20 }] },
  { hpPct: 135, groups: [{ kind: "normal", count: 10, spacing: 16 }] },
  { hpPct: 115, groups: [{ kind: "fast", count: 8, spacing: 12 }] },
  { hpPct: 160, groups: [{ kind: "normal", count: 12, spacing: 14 }, { kind: "fast", count: 6, spacing: 10 }] },
  { hpPct: 190, groups: [{ kind: "tank", count: 2, spacing: 40 }, { kind: "normal", count: 8, spacing: 12 }] },
  { hpPct: 225, groups: [{ kind: "fast", count: 16, spacing: 8 }] },
  { hpPct: 265, groups: [{ kind: "normal", count: 16, spacing: 10 }, { kind: "tank", count: 3, spacing: 30 }] },
  { hpPct: 310, groups: [{ kind: "tank", count: 5, spacing: 25 }, { kind: "fast", count: 12, spacing: 8 }] },
  { hpPct: 360, groups: [{ kind: "normal", count: 20, spacing: 8 }, { kind: "fast", count: 12, spacing: 6 }] },
  { hpPct: 410, groups: [{ kind: "tank", count: 8, spacing: 20 }, { kind: "normal", count: 16, spacing: 8 }, { kind: "fast", count: 16, spacing: 5 }] },
];
