import { ECONOMY } from "./balance/economy";
import { GAME } from "./balance/game";
import { TICKS_PER_SECOND } from "./constants";

/** floor(bounty · (1 + g·(N−1)) / N) with g = teamGoldGrowthPct/100, in integers. */
export function attenuatedBounty(bounty: number, players: number): number {
  const n = Math.max(1, players);
  return Math.floor((bounty * (100 + ECONOMY.teamGoldGrowthPct * (n - 1))) / (100 * n));
}

/** floor(hp · (1 + g·(N−1)) · (1 + s·(N−1))) in integers. */
export function scaledEnemyHp(hp: number, players: number): number {
  const n = Math.max(1, players);
  const gold = 100 + ECONOMY.teamGoldGrowthPct * (n - 1);
  const synergy = 100 + ECONOMY.synergyPerPlayerPct * (n - 1);
  return Math.floor((hp * gold * synergy) / 10000);
}

export function startingGold(players: number): number {
  if (players <= 1) return GAME.startGold;
  return Math.floor((GAME.startGold * ECONOMY.multiplayerStartGoldPct) / 100);
}

export function interestOn(gold: number, cap: number = ECONOMY.interestCapGold, pct: number = ECONOMY.interestPct): number {
  return Math.min(Math.floor((gold * pct) / 100), cap);
}

export function callWaveBonus(ticksSaved: number): number {
  return Math.floor(ticksSaved / TICKS_PER_SECOND) * ECONOMY.callWaveBonusPerSecond;
}

export function callQuorum(players: number): number {
  return players >= ECONOMY.callQuorumFromPlayers ? ECONOMY.callQuorum : 1;
}
