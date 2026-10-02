import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AddressInfo } from "node:net";
import { Client, type Room } from "@colyseus/sdk";
import type { Server } from "@colyseus/core";
import { DEFAULT_DECKS, createInitialState, soloStart, step, type Command, type GameState } from "@td/sim";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Accounts } from "../src/accounts/service";
import { XP, cappedXp, gameXp, levelOf } from "../src/accounts/xp";
import { ROOM_NAME, type HistoryEntry, type HistoryItem, type Profile, type SoloResultMessage } from "../src/protocol";
import { createGameServer, type AccountsConfig } from "../src/server";

const origin = "http://localhost:5173";
const config: AccountsConfig = { dbPath: ":memory:", publicUrl: "", clientOrigins: [origin], env: { AUTH_FAKE: "1" } };
let gameServer: Server;
let base = "";

beforeAll(async () => {
  const http = createServer();
  gameServer = createGameServer(http, config);
  await gameServer.listen(0);
  base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  config.publicUrl = base;
});

afterAll(async () => {
  await gameServer.gracefullyShutdown(false);
});

const call = async <T>(
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {},
): Promise<{ status: number; body: T }> => {
  const response = await fetch(`${base}${path}`, {
    method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
    headers: { "content-type": "application/json", ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return { status: response.status, body: (await response.json()) as T };
};

const guest = async (name = "Jugador") => (await call<{ token: string; profile: Profile }>("/auth/guest", { body: { name } })).body;

let names = 0;
/** A solo campaign nobody defends: it ends on its own; each one under a fresh name so sessionless sends never share a cooldown. */
const lostSolo = (token?: string) =>
  call<SoloResultMessage>("/games/solo", {
    token,
    body: { kind: "campaign", seed: 5, map: "s", name: `Prueba ${names++}`, deck: DEFAULT_DECKS.solo, history: [] },
  });

/** The claim id in the address the provider round trip sends the browser back to. */
const claimIn = (location: string | null | undefined) => /#claim=(\w+)/.exec(location ?? "")?.[1] ?? null;

/**
 * Follows the fake provider's round trip the way a browser would, cookie included, then claims it with the session of
 * the browser that came back: by default the one the login was started with. Returns the claim's status.
 */
async function linkWithFake(token: string, opts: { browserCookie?: boolean; claimWith?: string } = {}): Promise<number> {
  const start = await fetch(`${base}/auth/fake/start?token=${token}&returnTo=${encodeURIComponent(`${origin}/`)}`, { redirect: "manual" });
  const cookie = start.headers.get("set-cookie")!.split(";")[0]!;
  const callback = await fetch(start.headers.get("location")!, {
    redirect: "manual",
    headers: opts.browserCookie === false ? {} : { cookie },
  });
  const claim = claimIn(callback.headers.get("location"));
  if (!claim) return callback.status;
  return (await call("/auth/claim", { token: opts.claimWith ?? token, body: { claim } })).status;
}

/** Plays a stored replay back the way the replay viewer does, to its end. */
function playBack(replay: { initialState: GameState; history: HistoryEntry[] }): GameState {
  const byTick = new Map<number, Command[]>(replay.history.map((e) => [e.tick, e.commands]));
  let state = replay.initialState;
  while (state.status === "playing") state = step(state, byTick.get(state.tick) ?? []);
  return state;
}

/** A ranked solo game left to lose on its own, and the start it came from. */
function lostRanked(): { start: GameState; final: GameState } {
  const start = soloStart({ seed: 5, mapId: "s", mode: "campaign", deck: DEFAULT_DECKS.solo });
  let final = start;
  while (final.status === "playing") final = step(final, []);
  return { start, final };
}

const memoryAccounts = () =>
  new Accounts({ dbPath: ":memory:", publicUrl: "http://server", clientOrigins: [origin], env: { AUTH_FAKE: "1" } });
const tokenOf = (accounts: Accounts) => (accounts.createGuest("Jugador").body as { token: string }).token;
const profileOf = (accounts: Accounts, token: string) => accounts.me(token).body as Profile;

async function linkDirect(accounts: Accounts, token: string, provider = "fake", code?: string): Promise<number> {
  const start = accounts.startLogin(provider, token, `${origin}/`);
  const url = new URL(start.redirect!);
  const nonce = start.cookie!.split(";")[0]!.split("=")[1]!;
  const back = await accounts.finishLogin(provider, code ?? url.searchParams.get("code"), url.searchParams.get("state"), nonce);
  return accounts.claimLogin(token, claimIn(back.redirect)).status;
}

describe("accounts", () => {
  it("a guest gets a session and a profile right away, and an unknown session is refused", async () => {
    const { token, profile } = await guest("Ana");
    expect(profile).toMatchObject({ kind: "guest", name: "Ana", level: 1, xp: 0 });
    expect((await call<Profile>("/me", { token })).body.name).toBe("Ana");
    expect((await call("/me", { token: "nope" })).status).toBe(401);
  });

  it("a player renames themself and keeps a color, checked by the server", async () => {
    const { token } = await guest();
    expect((await call<Profile>("/me", { token, body: { name: "Beto", color: 3 } })).body).toMatchObject({ name: "Beto", color: 3 });
    expect((await call("/me", { token, body: { color: 99 } })).status).toBe(400);
  });

  it("a solo game the server replays lands in the history with its experience and a replay", async () => {
    const { token } = await guest();
    const sent = await lostSolo(token);
    expect(sent.status).toBe(200);
    expect(sent.body.xp).toBeGreaterThan(0);
    const history = (await call<HistoryItem[]>("/me/history", { token })).body;
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      mode: "campaign",
      map: "s",
      seed: 5,
      result: "lost",
      xp: sent.body.xp,
      deck: DEFAULT_DECKS.solo,
      doctrines: [],
    });
    const replay = await call<{ initialState: GameState; history: HistoryEntry[] }>(`/replays/${history[0]!.replayId}`);
    expect(replay.status).toBe(200);
    expect(playBack(replay.body)).toMatchObject({ status: "lost", wave: history[0]!.wave });
    expect((await call<Profile>("/me", { token })).body.xp).toBe(sent.body.xp);
  });

  it("a solo game without a session is accepted but recorded for nobody", async () => {
    expect((await lostSolo()).body.xp).toBeNull();
  });

  it("linking keeps what the guest played, and the same account from another browser sees it all", async () => {
    const first = await guest();
    const paid = (await lostSolo(first.token)).body.xp!;
    expect(await linkWithFake(first.token)).toBe(200);
    const linked = (await call<Profile>("/me", { token: first.token })).body;
    expect(linked).toMatchObject({ kind: "account", linked: ["fake"], xp: paid });
    const other = await guest();
    const paidThere = (await lostSolo(other.token)).body.xp!;
    await linkWithFake(other.token);
    expect((await call<Profile>("/me", { token: other.token })).body.xp).toBe(paid + paidThere);
    expect((await call<HistoryItem[]>("/me/history", { token: first.token })).body).toHaveLength(2);
  });

  it("a login only sends the browser back to an allowed address", async () => {
    const { token } = await guest();
    const start = await fetch(`${base}/auth/fake/start?token=${token}&returnTo=${encodeURIComponent("https://evil.example/")}`, {
      redirect: "manual",
    });
    expect(start.status).toBe(400);
  });

  it("a provider link opened in a browser that did not start the login links nothing", async () => {
    const attacker = await guest();
    expect(await linkWithFake(attacker.token, { browserCookie: false })).toBe(400);
    expect((await call<Profile>("/me", { token: attacker.token })).body.kind).toBe("guest");
  });

  it("a login link started with someone else's session moves nothing into theirs", async () => {
    const attacker = await guest();
    const victim = await guest("Víctima");
    await linkWithFake(victim.token);
    const before = (await call<Profile>("/me", { token: victim.token })).body;
    expect(await linkWithFake(attacker.token, { claimWith: victim.token })).toBe(400);
    expect((await call<Profile>("/me", { token: attacker.token })).body.kind).toBe("guest");
    expect((await call<Profile>("/me", { token: victim.token })).body).toEqual(before);
  });

  it("logging out ends the session; deleting the account removes it with its history", async () => {
    const out = await guest();
    expect((await call("/me/logout", { token: out.token, body: {} })).status).toBe(200);
    expect((await call("/me", { token: out.token })).status).toBe(401);
    const gone = await guest();
    await lostSolo(gone.token);
    await linkWithFake(gone.token);
    const replayId = (await call<HistoryItem[]>("/me/history", { token: gone.token })).body[0]!.replayId;
    expect((await call("/me/delete", { token: gone.token, body: {} })).status).toBe(200);
    expect((await call("/me", { token: gone.token })).status).toBe(401);
    expect((await call(`/replays/${replayId}`)).status).toBe(404);
  });

  it("a co-op game the server ran to its end goes into each player's history", { timeout: 120000 }, async () => {
    const a = await guest("Ana");
    const b = await guest("Beto");
    const endpoint = base.replace("http", "ws");
    const host = await new Client(endpoint).create(ROOM_NAME, { name: "Ana", token: a.token });
    const guestRoom: Room = await new Client(endpoint).joinById(host.roomId, { name: "Beto", token: b.token });
    guestRoom.send("ready", { ready: true });
    await new Promise((r) => setTimeout(r, 300));
    host.send("setSpeed", { speed: 4 });
    host.send("start", {});
    await new Promise<void>((resolve) => host.onMessage("phase", (phase: string) => phase === "ended" && resolve()));
    for (const token of [a.token, b.token]) {
      const history = (await call<HistoryItem[]>("/me/history", { token })).body;
      expect(history).toHaveLength(1);
      expect(history[0]!.players).toEqual(["Ana", "Beto"]);
      const replay = await call<{ initialState: GameState; history: HistoryEntry[] }>(`/replays/${history[0]!.replayId}`);
      expect(playBack(replay.body)).toMatchObject({ status: history[0]!.result, wave: history[0]!.wave });
    }
    await host.leave(true);
    await guestRoom.leave(true);
  });

  it("a game started with dev parameters is never recorded", () => {
    const accounts = memoryAccounts();
    const token = tokenOf(accounts);
    let state = createInitialState({ seed: 1, gold: 5000, players: [{ id: 0 }] });
    while (state.status === "playing") state = step(state, []);
    accounts.recordRoom([{ token, name: "Dev", playerId: 0 }], state, state, []);
    expect(accounts.history(token).body).toEqual([]);
  });

  it("one person in two seats is recorded once and earns no group bonus", () => {
    const accounts = memoryAccounts();
    const token = tokenOf(accounts);
    const { start, final } = lostRanked();
    accounts.recordRoom(
      [
        { token, name: "Ana", playerId: 0 },
        { token, name: "Ana", playerId: 0 },
      ],
      start,
      final,
      [],
    );
    expect(accounts.history(token).body).toHaveLength(1);
    expect(profileOf(accounts, token).xp).toBe(gameXp({ wave: final.wave, won: false, players: 1 }));
  });

  it("guests merged into one account bring no more than the daily cap", async () => {
    const accounts = memoryAccounts();
    const { start, final } = lostRanked();
    const farmed = { ...final, wave: Math.ceil(XP.dailyCap / XP.perWave) };
    const tokens = [tokenOf(accounts), tokenOf(accounts)];
    for (const token of tokens) {
      accounts.recordRoom([{ token, name: "Ana", playerId: 0 }], start, farmed, []);
      await linkDirect(accounts, token);
    }
    expect(profileOf(accounts, tokens[1]!).xp).toBe(XP.dailyCap);
  });

  it("an account saved when each one had a single provider still opens with it", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "td-accounts-")), "old.db");
    const old = new DatabaseSync(path);
    old.exec(
      "create table subjects (id integer primary key autoincrement, kind text not null, provider text, provider_id text, name text not null, color integer, xp integer not null default 0, created integer not null, unique (provider, provider_id))",
    );
    old.exec("insert into subjects (kind, provider, provider_id, name, xp, created) values ('account', 'fake', '1', 'Ana', 70, 0)");
    old.close();
    const accounts = new Accounts({ dbPath: path, publicUrl: "http://server", clientOrigins: [origin], env: { AUTH_FAKE: "1" } });
    const browser = tokenOf(accounts);
    await linkDirect(accounts, browser);
    expect(profileOf(accounts, browser)).toMatchObject({ name: "Ana", xp: 70, linked: ["fake"] });
    accounts.close();
  });

  it("accounts that cannot open answer unavailable", () => {
    const notADir = join(mkdtempSync(join(tmpdir(), "td-accounts-")), "file");
    writeFileSync(notADir, "");
    const down = new Accounts({ dbPath: join(notADir, "accounts.db"), publicUrl: "", clientOrigins: [], env: {} });
    expect(down.available).toBe(false);
    expect(down.createGuest("x").status).toBe(503);
  });

  it("one player may send a solo game every few seconds, under the name the server knows", () => {
    const accounts = memoryAccounts();
    const token = tokenOf(accounts);
    accounts.update(token, { name: "Ana" });
    const day = "2026-10-01";
    const now = new Date(`${day}T12:00:00Z`);
    const daily = { kind: "daily" as const, day, seed: 0, map: "s", name: "Otra", deck: DEFAULT_DECKS.solo, history: [] };
    const first = accounts.submitSolo(token, daily, now).body as SoloResultMessage;
    expect(first.board!.entries.map((e) => e.name)).toContain("Ana");
    expect(first.board!.entries.map((e) => e.name)).not.toContain("Otra");
    expect(accounts.submitSolo(token, daily, new Date(now.getTime() + 1000)).status).toBe(400);
    expect(accounts.submitSolo(token, daily, new Date(now.getTime() + 11_000)).status).toBe(200);
  });

  it("an account adds a second way in, and either one opens it from another browser", async () => {
    const accounts = memoryAccounts();
    const first = tokenOf(accounts);
    await linkDirect(accounts, first, "fake");
    expect(await linkDirect(accounts, first, "fake2")).toBe(200);
    expect(profileOf(accounts, first).linked).toEqual(["fake", "fake2"]);
    const otherBrowser = tokenOf(accounts);
    await linkDirect(accounts, otherBrowser, "fake2");
    expect(profileOf(accounts, otherBrowser)).toEqual(profileOf(accounts, first));
  });

  it("two accounts with their own progress become one when one adds the other's way in", async () => {
    const accounts = memoryAccounts();
    const { start, final } = lostRanked();
    const discordBrowser = tokenOf(accounts);
    accounts.recordRoom([{ token: discordBrowser, name: "Ana", playerId: 0 }], start, final, []);
    await linkDirect(accounts, discordBrowser, "fake");
    const googleBrowser = tokenOf(accounts);
    accounts.recordRoom([{ token: googleBrowser, name: "Ana", playerId: 0 }], start, final, []);
    await linkDirect(accounts, googleBrowser, "fake2");
    const apart = profileOf(accounts, discordBrowser).xp + profileOf(accounts, googleBrowser).xp;
    await linkDirect(accounts, discordBrowser, "fake2");
    const merged = profileOf(accounts, discordBrowser);
    expect(merged).toMatchObject({ xp: apart, linked: ["fake", "fake2"] });
    expect(accounts.history(discordBrowser).body).toHaveLength(2);
    expect(profileOf(accounts, googleBrowser)).toEqual(merged);
  });

  it("two accounts at the daily cap merge into one capped day", async () => {
    const accounts = memoryAccounts();
    const { start, final } = lostRanked();
    const farmed = { ...final, wave: Math.ceil(XP.dailyCap / XP.perWave) };
    const discordBrowser = tokenOf(accounts);
    const googleBrowser = tokenOf(accounts);
    accounts.recordRoom([{ token: discordBrowser, name: "Ana", playerId: 0 }], start, farmed, []);
    accounts.recordRoom([{ token: googleBrowser, name: "Ana", playerId: 0 }], start, farmed, []);
    await linkDirect(accounts, discordBrowser, "fake");
    await linkDirect(accounts, googleBrowser, "fake2");
    await linkDirect(accounts, discordBrowser, "fake2");
    expect(profileOf(accounts, discordBrowser).xp).toBe(XP.dailyCap);
  });

  it("an account keeps one way in per provider", async () => {
    const accounts = memoryAccounts();
    const token = tokenOf(accounts);
    await linkDirect(accounts, token, "fake");
    expect(await linkDirect(accounts, token, "fake", "fake:9:Otra")).toBe(409);
    expect(profileOf(accounts, token).linked).toEqual(["fake"]);
  });

  it("two accounts that each have the same provider stay apart", async () => {
    const accounts = memoryAccounts();
    const first = tokenOf(accounts);
    const second = tokenOf(accounts);
    await linkDirect(accounts, first, "fake", "fake:1:Ana");
    await linkDirect(accounts, second, "fake", "fake:9:Ana");
    expect(await linkDirect(accounts, first, "fake", "fake:9:Ana")).toBe(409);
    expect(profileOf(accounts, first).linked).toEqual(["fake"]);
    expect(profileOf(accounts, second).linked).toEqual(["fake"]);
  });

  it("a second login from the same session voids the first one", async () => {
    const accounts = memoryAccounts();
    const token = tokenOf(accounts);
    const first = accounts.startLogin("fake", token, `${origin}/`);
    accounts.startLogin("fake", token, `${origin}/`);
    const nonce = first.cookie!.split(";")[0]!.split("=")[1]!;
    const back = await accounts.finishLogin("fake", "fake:1:Ana", new URL(first.redirect!).searchParams.get("state"), nonce);
    expect(back.status).toBe(400);
  });

  it("the fake provider never exists in a production build", () => {
    const accounts = new Accounts({
      dbPath: ":memory:",
      publicUrl: "",
      clientOrigins: [],
      env: { AUTH_FAKE: "1", NODE_ENV: "production" },
    });
    expect((accounts.me(tokenOf(accounts)).body as Profile).providers).toEqual([]);
  });
});

describe("experience rules", () => {
  it("pays for the wave reached and a win, a group bonus capped at 25%, and stops at the daily cap", () => {
    const solo = gameXp({ wave: 10, won: false, players: 1 });
    expect(solo).toBe(10 * XP.perWave);
    expect(gameXp({ wave: 10, won: true, players: 1 })).toBe(10 * XP.perWave + XP.winBonus);
    expect(gameXp({ wave: 10, won: false, players: 8 })).toBe(Math.floor((solo * (100 + XP.maxGroupPct)) / 100));
    expect(cappedXp(100, XP.dailyCap - 30)).toBe(30);
    expect(cappedXp(100, XP.dailyCap)).toBe(0);
    expect(levelOf(0)).toBe(1);
    expect(levelOf(XP.levelBase)).toBe(2);
  });
});
