const DAY_MS = 86_400_000;

/**
 * How long the server keeps what nobody claims. Replays and idle guests go away; accounts and their history stay.
 * The profile panel tells players these same numbers.
 */
export const RETENTION = {
  replayDays: 30,
  /** A guest with games, counted from their last finished game. */
  idleGuestDays: 30,
  /** A guest who never finished a game has nothing to lose: counted from their creation (or the migration that dated them). */
  emptyGuestDays: 7,
  /** A session unused this long stops working; using it pushes the date forward. */
  idleSessionDays: 90,
} as const;

export const daysMs = (days: number): number => days * DAY_MS;
