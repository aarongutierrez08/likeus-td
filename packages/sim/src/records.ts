import type { GameState } from "./types";

/** Only a ranked game that reached its end can post a record: a won campaign, or an endless game that fell. */
export function canSubmitRecord(state: GameState): boolean {
  if (!state.ranked) return false;
  return state.mode === "endless" ? state.status === "lost" : state.status === "won";
}
