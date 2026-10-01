import type { DailyBoard, HistoryItem, Profile, SoloResultMessage, SoloSubmission } from "@td/server/protocol";
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

export const updateProfile = (changes: { name?: string; color?: number | null }) => call<Profile>("/me", { body: changes });
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

/** Sends the browser to the provider; it comes back to this same page with #login=ok or #login=error. */
export function loginUrl(provider: string): string {
  const returnTo = `${location.origin}${location.pathname}${location.search}`;
  return `${base()}/auth/${provider}/start?${new URLSearchParams({ token: readSession() ?? "", returnTo }).toString()}`;
}

export async function loadReplay(id: number): Promise<{ initialState: unknown; history: { tick: number; commands: unknown[] }[] } | null> {
  return call(`/replays/${id}`);
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
