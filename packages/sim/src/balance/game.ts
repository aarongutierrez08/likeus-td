export const GAME = {
  startGold: 120,
  lives: 20,
  firstWaveTick: 100,
  /** Ticks between the last spawn of a wave and the start of the next one. */
  waveGapTicks: 150,
  /** Per-enemy hp variation applied on spawn, in percent of base hp. */
  hpJitterPct: 10,
  /** Spawn spacing variation, in percent of the group spacing. */
  spacingJitterPct: 20,
} as const;
