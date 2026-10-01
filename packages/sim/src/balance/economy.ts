/**
 * Each player's market: every tower bought raises that player's price for that kind; every wave close lowers it a step.
 * Per player, so buying never makes a teammate's towers dearer.
 */
export const MARKET = {
  /** Surcharge each purchase adds, in percent of the base cost. */
  raisePct: 10,
  /** The surcharge never goes above this. */
  maxRaisePct: 50,
  /** Surcharge removed from every kind at each wave close. */
  decayPct: 10,
} as const;

/** Multiplayer economy knobs (ADR 007). With one player every formula is the identity. */
export const ECONOMY = {
  /** Team gold grows by this percent of a solo bounty per extra player: share = (1 + growth·(N−1)) / N. */
  teamGoldGrowthPct: 50,
  /** Extra enemy hp per extra player on top of the gold scaling, for tower synergy. */
  synergyPerPlayerPct: 5,
  /** Starting gold of each player when the game has two or more players. */
  multiplayerStartGoldPct: 75,
  interestPct: 10,
  interestCapGold: 20,
  /** Gold every player earns per second saved by calling the next wave early. */
  callWaveBonusPerSecond: 1,
  /** First wave (1-based) in which gifts are allowed. */
  giftFromWave: 3,
} as const;
