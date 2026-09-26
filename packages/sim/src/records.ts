import type { GameState } from "./types";

/** Only a ranked game that reached the end can post a record. */
export function canSubmitRecord(state: GameState): boolean {
  return state.ranked && state.status === "won";
}
