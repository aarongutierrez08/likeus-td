/**
 * Experience (design: Cuentas y progreso). Server-only: the sim never learns that accounts exist.
 * A game pays for how far it got and whether it was won; a group pays a little more, capped; a day pays up to a cap.
 */
export const XP = {
  perWave: 10,
  winBonus: 50,
  /** Extra percent per player beyond the first. */
  groupPctPerPlayer: 5,
  /** Playing in a group never pays more than this extra percent. */
  maxGroupPct: 25,
  /** Experience a player can earn per UTC day. */
  dailyCap: 600,
  /** Experience for level n is levelBase · (n − 1)², so each level asks a little more than the last. */
  levelBase: 50,
} as const;

export interface GameOutcome {
  /** Highest wave the game reached. */
  wave: number;
  won: boolean;
  players: number;
}

/** What a finished game is worth, before the daily cap. */
export function gameXp(outcome: GameOutcome): number {
  const base = outcome.wave * XP.perWave + (outcome.won ? XP.winBonus : 0);
  const group = Math.min(XP.maxGroupPct, XP.groupPctPerPlayer * Math.max(0, outcome.players - 1));
  return Math.floor((base * (100 + group)) / 100);
}

/** What actually counts today, given what the player already earned today. */
export function cappedXp(earned: number, earnedToday: number): number {
  return Math.max(0, Math.min(earned, XP.dailyCap - earnedToday));
}

export function levelOf(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / XP.levelBase)) + 1;
}

/** Experience at which a level starts, to show progress towards the next one. */
export function xpForLevel(level: number): number {
  return XP.levelBase * (level - 1) ** 2;
}
