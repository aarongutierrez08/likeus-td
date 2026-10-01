/** Waves past the campaign in endless mode: generated from the seed and the wave number, so the calendar can show them. */
export const ENDLESS = {
  /** Hp percent each generated wave adds on top of the last campaign wave. */
  hpStepPct: 40,
  /** Enemies of the first generated wave, split between its two kinds. */
  baseCount: 12,
  /** Every countEvery waves, countStep more enemies. */
  countEvery: 5,
  countStep: 2,
  /** A boss closes every wave that is a multiple of this. */
  bossEvery: 10,
  spacing: 12,
  /** Ticks before a boss of a generated wave, so it closes the wave. */
  bossSpacing: 60,
  /** Daily seeds fall in [0, dailySeedRange). */
  dailySeedRange: 1_000_000,
} as const;
