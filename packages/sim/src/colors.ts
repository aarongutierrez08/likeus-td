import { PLAYER_COLORS } from "./balance/players";

export function isPlayerColor(color: unknown): color is number {
  return Number.isInteger(color) && (color as number) >= 0 && (color as number) < PLAYER_COLORS.length;
}

/** The requested color when it is free, else the first color nobody in `taken` uses. */
export function pickColor(taken: readonly { color: number }[], wanted?: number): number {
  const used = new Set(taken.map((p) => p.color));
  if (wanted !== undefined && isPlayerColor(wanted) && !used.has(wanted)) return wanted;
  for (let c = 0; c < PLAYER_COLORS.length; c++) if (!used.has(c)) return c;
  return 0;
}

/** Color indexes nobody holds, in order. Whoever draws one at random does it outside the sim, which stays deterministic. */
export function freeColors(taken: readonly { color: number }[]): number[] {
  const used = new Set(taken.map((p) => p.color));
  return PLAYER_COLORS.map((_, c) => c).filter((c) => !used.has(c));
}
