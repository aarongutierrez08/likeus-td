import type { Deck } from "@td/sim";
import type { DailyBoard, DeckMode, HistoryItem, Profile, SoloResultMessage, SoloSubmission } from "@td/server/protocol";
import { defaultEndpoint, httpEndpoint } from "./connection";

const TOKEN_KEY = "td.session";
const base = (): string => httpEndpoint(defaultEndpoint());

export function readSession(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeSession(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode: the session lasts this page only */
  }
}

/** The UTC day the daily challenge belongs to: the same for every player at once. */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function call<T>(path: string, opts: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T | null> {
  const token = readSession();
  try {
    const response = await fetch(`${base()}${path}`, {
      method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    if (response.status === 401) writeSession(null);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/**
 * This browser's profile: its session if it has one, a new guest otherwise. Null when the accounts service is down;
 * the game never waits for this and plays the same without it.
 */
export async function loadProfile(name: string): Promise<Profile | null> {
  if (readSession()) {
    const profile = await call<Profile>("/me");
    if (profile) return profile;
    // Still holding the session means /me failed for another reason than 401: keep it instead of replacing it with a guest.
    if (readSession()) return null;
  }
  const created = await call<{ token: string; profile: Profile }>("/auth/guest", { body: { name } });
  if (!created) return null;
  writeSession(created.token);
  return created.profile;
}

export const updateProfile = (changes: { name?: string; deck?: { mode: DeckMode; deck: Deck } }) => call<Profile>("/me", { body: changes });
export const loadHistory = () => call<HistoryItem[]>("/me/history");

export async function logout(): Promise<void> {
  await call("/me/logout", { body: {} });
  writeSession(null);
}

export async function deleteAccount(): Promise<boolean> {
  const done = await call("/me/delete", { body: {} });
  if (done) writeSession(null);
  return done !== null;
}

/** Links the identity the provider vouched for to this browser's own session; null when it was not this browser's login. */
export const claimLogin = (claim: string) => call<Profile>("/auth/claim", { body: { claim } });

/**
 * Sends the browser to the provider: the session goes in a header to get a one-use address, never in the address itself.
 * It comes back to this same page with #claim=<id> to claim, or #login=error. False when accounts are down.
 */
export async function startLogin(provider: string): Promise<boolean> {
  const returnTo = `${location.origin}${location.pathname}${location.search}`;
  const ticket = await call<{ url: string }>(`/auth/${provider}/ticket`, { body: { returnTo } });
  if (!ticket) return false;
  location.assign(ticket.url);
  return true;
}

export interface ReplayData {
  initialState: unknown;
  history: { tick: number; commands: unknown[] }[];
}

export async function loadReplay(id: number): Promise<ReplayData | null> {
  return call(`/replays/${id}`);
}

const REPLAY_FILE_KEY = "td.replay.file";

function isReplayData(value: unknown): value is ReplayData {
  const data = value as Partial<ReplayData> | null;
  return typeof data?.initialState === "object" && data.initialState !== null && Array.isArray(data.history);
}

/** Saves the replay as a file the player keeps after the server drops it. */
export async function downloadReplay(id: number, name: string): Promise<boolean> {
  const data = await loadReplay(id);
  if (!data) return false;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
  link.download = name;
  link.click();
  // Revoking in the same tick can cut the download short in some browsers.
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  return true;
}

/** Opens a downloaded replay: kept for this tab only, then played back like any other. */
export async function openReplayFile(file: File): Promise<"ok" | "invalid" | "too_big"> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text()) as unknown;
  } catch {
    return "invalid";
  }
  if (!isReplayData(data)) return "invalid";
  try {
    sessionStorage.setItem(REPLAY_FILE_KEY, JSON.stringify(data));
  } catch {
    return "too_big";
  }
  location.assign("?replay=file");
  return "ok";
}

export function readReplayFile(): ReplayData | null {
  try {
    const data = JSON.parse(sessionStorage.getItem(REPLAY_FILE_KEY) ?? "null") as unknown;
    return isReplayData(data) ? data : null;
  } catch {
    return null;
  }
}

/** A finished solo game: the server replays it, records it for this session and answers with the experience it paid. */
export async function submitSolo(submission: SoloSubmission): Promise<SoloResultMessage | string> {
  const token = readSession();
  try {
    const sent = await fetch(`${base()}/games/solo`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(submission),
    });
    const body = (await sent.json()) as SoloResultMessage & { error?: string };
    return sent.ok ? body : (body.error ?? "No se pudo registrar la partida");
  } catch {
    return "No se pudo conectar con el servidor";
  }
}

export type { DailyBoard, HistoryItem, Profile };
