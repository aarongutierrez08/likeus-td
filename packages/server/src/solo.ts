import { DECK, dailySeed, deckProblem, isMapId, scoreOf, soloStart, step, DEFAULT_MAP, type Command, type GameState } from "@td/sim";
import type { DailyBoard, DailyEntry, SoloSubmission } from "./protocol";

/** A replay longer than this is refused: an endless game this long would mean something other than play. */
const MAX_TICKS = 400_000;
const SHOWN = 10;
const MAX_NAME = 16;
/** Ticks with commands a submission may carry; more than any real game sends. */
const MAX_HISTORY = 20_000;
/**
 * A replay runs on the event loop the live rooms share: one per player (session, or name without one) in this window,
 * and a global budget of simulated ticks per minute, since a long game costs what many short ones do.
 */
const PLAYER_COOLDOWN_MS = 10_000;
const BUDGET_WINDOW_MS = 60_000;
const TICKS_PER_WINDOW = 2_000_000;
const MAX_MEMORY_ENTRIES = 100;
const DAY_MS = 86_400_000;
const MAX_SEED = 2 ** 31;

/** Where the daily boards live: the accounts database when it is up, memory otherwise. */
export interface BoardStore {
  addDaily(day: string, entry: DailyEntry): void;
  dailyTop(day: string, limit: number): DailyEntry[];
}

const memoryBoards = new Map<string, DailyEntry[]>();
export const memoryBoard: BoardStore = {
  addDaily(day, entry) {
    const board = [...(memoryBoards.get(day) ?? []), entry].sort((a, b) => b.score - a.score || a.ticks - b.ticks);
    memoryBoards.set(day, board.slice(0, MAX_MEMORY_ENTRIES));
  },
  dailyTop(day, limit) {
    return [...(memoryBoards.get(day) ?? [])].sort((a, b) => b.score - a.score || a.ticks - b.ticks).slice(0, limit);
  },
};

const lastByPlayer = new Map<string, number>();
let recentReplays: { at: number; ticks: number }[] = [];

export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Yesterday counts too: a game that started before midnight UTC ends after it. */
function acceptedDays(now: Date): string[] {
  return [todayUtc(now), todayUtc(new Date(now.getTime() - DAY_MS))];
}

export function cleanName(raw: unknown): string {
  return typeof raw === "string" && raw.trim() ? raw.trim().slice(0, MAX_NAME) : "Anónimo";
}

/** The start the client built for this submission, rebuilt here from what it says it played. */
function startOf(submission: SoloSubmission): GameState | string {
  if (deckProblem(submission.deck, DECK.soloTowers) !== null) return "mazo inválido";
  if (submission.kind === "daily")
    return soloStart({ seed: dailySeed(submission.day!), mapId: DEFAULT_MAP, mode: "endless", deck: submission.deck });
  if (!Number.isInteger(submission.seed) || submission.seed < 0 || submission.seed >= MAX_SEED) return "seed inválida";
  if (typeof submission.map !== "string" || !isMapId(submission.map)) return "mapa inválido";
  return soloStart({
    seed: submission.seed,
    mapId: submission.map,
    mode: submission.kind === "endless" ? "endless" : "campaign",
    deck: submission.deck,
  });
}

/** Replays the submitted commands, then lets the game run on its own until it ends; null if it never does. */
function replay(start: GameState, history: SoloSubmission["history"]): GameState | null {
  const byTick = new Map<number, Command[]>();
  for (const entry of history) {
    if (!Number.isInteger(entry?.tick) || !Array.isArray(entry.commands)) return null;
    byTick.set(
      entry.tick,
      entry.commands.filter((c) => c?.playerId === 0),
    );
  }
  let state = start;
  while (state.status === "playing" && state.tick < MAX_TICKS) state = step(state, byTick.get(state.tick) ?? []);
  return state.status === "playing" ? null : state;
}

export interface SoloResult {
  start: GameState;
  final: GameState;
  /** The daily board entry, for daily games. */
  entry: DailyEntry | null;
}

/** Who sent the game: the session's subject when there is one, so its name on the board is the account's, not the request's. */
export interface SoloSender {
  key: string;
  name: string;
}

/**
 * Validates and replays a finished solo game; the result is what the server computed, never what the client said.
 * Daily games also go on the day's board. Returns an error text when the game cannot count.
 */
export function replaySolo(
  submission: SoloSubmission,
  boards: BoardStore,
  now: Date = new Date(),
  sender: SoloSender | null = null,
): SoloResult | string {
  if (!submission || !["campaign", "endless", "daily"].includes(submission.kind)) return "tipo de partida inválido";
  if (submission.kind === "daily" && (typeof submission.day !== "string" || !acceptedDays(now).includes(submission.day)))
    return "solo se acepta el desafío de hoy";
  if (!Array.isArray(submission.history) || submission.history.length > MAX_HISTORY) return "historial inválido";
  const start = startOf(submission);
  if (typeof start === "string") return start;
  const name = sender?.name ?? cleanName(submission.name);
  const key = sender?.key ?? `name:${name}`;
  const at = now.getTime();
  recentReplays = recentReplays.filter((r) => at - r.at < BUDGET_WINDOW_MS);
  const spent = recentReplays.reduce((sum, r) => sum + r.ticks, 0);
  if (spent >= TICKS_PER_WINDOW || at - (lastByPlayer.get(key) ?? -Infinity) < PLAYER_COOLDOWN_MS)
    return "esperá un momento antes de mandar otra";
  lastByPlayer.set(key, at);
  for (const [k, t] of lastByPlayer) if (at - t >= PLAYER_COOLDOWN_MS) lastByPlayer.delete(k);
  const final = replay(start, submission.history);
  recentReplays.push({ at, ticks: final?.tick ?? MAX_TICKS });
  if (!final) return "la partida no terminó";
  let entry: DailyEntry | null = null;
  if (submission.kind === "daily") {
    entry = { name, score: scoreOf(final), ticks: final.tick };
    boards.addDaily(submission.day!, entry);
  }
  return { start, final, entry };
}

export function dailyBoard(boards: BoardStore, today: string = todayUtc()): DailyBoard {
  return { day: today, entries: boards.dailyTop(today, SHOWN) };
}
