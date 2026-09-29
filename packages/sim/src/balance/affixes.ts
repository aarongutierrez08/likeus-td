/** Boss affixes. One per boss, fixed by seed and wave so the calendar can show it before the wave starts. */
export const AFFIXES = {
  fast: { label: "apurado", speedPct: 50 },
  /** The shield comes back this many ticks after it broke. */
  shielded: { label: "con chaleco", rearmEvery: 60 },
  /** Heals this percent of max hp every `every` ticks. */
  regenerating: { label: "con obra social", healPct: 2, every: 20 },
} as const;

export type BossAffix = keyof typeof AFFIXES;

export const BOSS_AFFIXES = Object.keys(AFFIXES) as BossAffix[];
