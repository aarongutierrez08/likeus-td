import { DECK, dailyStart, deckProblem, scoreOf, step, type Command, type GameState } from "@td/sim";
import type { DailyBoard, DailyEntry, DailySubmission } from "./protocol";

/** A replay longer than this is refused: an endless game this long would mean something other than play. */
const MAX_TICKS = 400_000;
const MAX_ENTRIES_PER_DAY = 100;
const SHOWN = 10;
const MAX_NAME = 16;
/** Ticks with commands a submission may carry; more than any real game sends. */
const MAX_HISTORY = 20_000;
/** A replay runs on the event loop the live rooms share: one per name in this window, and a global pause between them. */
const NAME_COOLDOWN_MS = 30_000;
const GLOBAL_COOLDOWN_MS = 1_000;
const DAY_MS = 86_400_000;

const lastByName = new Map<string, number>();
let lastReplay = 0;

/**
 * Boards live in memory, one per UTC day: they are lost when the server restarts. Persisting them belongs to the
 * accounts and storage decision of design step 17.
 */
const boards = new Map<string, DailyEntry[]>();

export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Yesterday counts too: a game that started before midnight UTC ends after it. */
function acceptedDays(now: Date): string[] {
  return [todayUtc(now), todayUtc(new Date(now.getTime() - DAY_MS))];
}

/** Replays the submitted commands, then lets the game run on its own until it ends; null if it never does. */
function replay(day: string, submission: DailySubmission): GameState | null {
  const byTick = new Map<number, Command[]>();
  for (const entry of submission.history) {
    if (!Number.isInteger(entry?.tick) || !Array.isArray(entry.commands)) return null;
    byTick.set(
      entry.tick,
      entry.commands.filter((c) => c?.playerId === 0),
    );
  }
  let state = dailyStart(day, submission.deck);
  while (state.status === "playing" && state.tick < MAX_TICKS) state = step(state, byTick.get(state.tick) ?? []);
  return state.status === "playing" ? null : state;
}

/** Scores a submission by replaying it, and ranks it on the day it was played. Returns an error text when it cannot count. */
export function submitDaily(submission: DailySubmission, now: Date = new Date()): DailyEntry | string {
  const day = submission?.day;
  if (typeof day !== "string" || !acceptedDays(now).includes(day)) return "solo se acepta el desafío de hoy";
  if (deckProblem(submission.deck, DECK.soloTowers) !== null) return "mazo inválido";
  if (!Array.isArray(submission.history) || submission.history.length > MAX_HISTORY) return "historial inválido";
  const name = typeof submission.name === "string" && submission.name.trim() ? submission.name.trim().slice(0, MAX_NAME) : "Anónimo";
  const at = now.getTime();
  if (at - lastReplay < GLOBAL_COOLDOWN_MS || at - (lastByName.get(name) ?? -Infinity) < NAME_COOLDOWN_MS)
    return "esperá un momento antes de mandar otra";
  lastReplay = at;
  lastByName.set(name, at);
  const final = replay(day, submission);
  if (!final) return "la partida no terminó";
  const entry: DailyEntry = { name, score: scoreOf(final), ticks: final.tick };
  const board = [...(boards.get(day) ?? []), entry].sort((a, b) => b.score - a.score || a.ticks - b.ticks).slice(0, MAX_ENTRIES_PER_DAY);
  boards.set(day, board);
  return entry;
}

export function dailyBoard(today: string = todayUtc()): DailyBoard {
  return { day: today, entries: (boards.get(today) ?? []).slice(0, SHOWN) };
}
