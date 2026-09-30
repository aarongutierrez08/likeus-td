import { createServer } from "node:http";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { Client, type Room } from "@colyseus/sdk";
import type { Server } from "@colyseus/core";
import { hashState, startingGold, step, type Command, type GameState } from "@td/sim";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  MAX_COMMANDS_PER_TICK,
  ROOM_CODE_ALPHABET,
  ROOM_NAME,
  type PlayerInfo,
  type RejectedMessage,
  type SnapshotMessage,
  type TickMessage,
} from "../src/protocol";
import type { RoomListing } from "../src/routes";
import { globalReportAllowed } from "../src/reports";
import type { BugReport, ReportedMessage } from "../src/protocol";
import { createGameServer } from "../src/server";

interface Inbox {
  room: Room;
  next<T>(type: string, accept?: (payload: T) => boolean, timeoutMs?: number): Promise<T>;
  none(type: string, withinMs: number): Promise<void>;
  /** Runs for every message of that type as it arrives, before `next` can consume it. */
  tap<T>(type: string, fn: (payload: T) => void): void;
}

let gameServer: Server;
let port = 0;
const openRooms: Room[] = [];

let reportsDir = "";

beforeAll(async () => {
  reportsDir = await mkdtemp(join(tmpdir(), "td-reports-"));
  process.env["REPORTS_DIR"] = reportsDir;
  const http = createServer();
  gameServer = createGameServer(http);
  await gameServer.listen(0);
  port = (http.address() as AddressInfo).port;
});

afterAll(async () => {
  for (const room of openRooms) if (room.connection.isOpen) await room.leave(true).catch(() => undefined);
  await gameServer.gracefullyShutdown(false);
});

function client(): Client {
  return new Client(`ws://127.0.0.1:${port}`);
}

function watch(room: Room): Inbox {
  openRooms.push(room);
  const received: { type: string; payload: unknown }[] = [];
  const waiters = new Set<() => void>();
  const taps = new Map<string, ((payload: unknown) => void)[]>();
  room.onMessage("*", (type, payload) => {
    for (const fn of taps.get(String(type)) ?? []) fn(payload);
    received.push({ type: String(type), payload });
    for (const wake of [...waiters]) wake();
  });
  return {
    room,
    tap<T>(type: string, fn: (payload: T) => void): void {
      taps.set(type, [...(taps.get(type) ?? []), fn as (payload: unknown) => void]);
    },
    next<T>(type: string, accept: (payload: T) => boolean = () => true, timeoutMs = 2000): Promise<T> {
      return new Promise((resolve, reject) => {
        const check = (): void => {
          const index = received.findIndex((m) => m.type === type && accept(m.payload as T));
          if (index < 0) return;
          const [hit] = received.splice(index, 1);
          waiters.delete(check);
          clearTimeout(deadline);
          resolve(hit!.payload as T);
        };
        const deadline = setTimeout(() => {
          waiters.delete(check);
          reject(new Error(`no "${type}" message within ${timeoutMs}ms`));
        }, timeoutMs);
        waiters.add(check);
        check();
      });
    },
    none(type: string, withinMs: number): Promise<void> {
      return new Promise((resolve, reject) => {
        setTimeout(() => (received.some((m) => m.type === type) ? reject(new Error(`unexpected "${type}"`)) : resolve()), withinMs);
      });
    },
  };
}

async function createRoom(options: { name?: string; private?: boolean; seed?: number; map?: string } = {}): Promise<Inbox> {
  return watch(await client().create(ROOM_NAME, options));
}

/** Joins and marks ready, waiting until the server confirms it so a following "start" is never racy. */
async function joinRoom(code: string, name: string): Promise<Inbox> {
  const inbox = watch(await client().joinById(code, { name }));
  inbox.room.send("ready", { ready: true });
  await inbox.next<PlayerInfo[]>("players", (list) => list.some((p) => p.name === name && p.ready));
  return inbox;
}

async function listRooms(): Promise<RoomListing> {
  const response = await fetch(`http://127.0.0.1:${port}/rooms`);
  return (await response.json()) as RoomListing;
}

describe("game room", () => {
  it("creates a room with a four letter code and lists it only when public", async () => {
    const shared = await createRoom({ name: "host" });
    const hidden = await createRoom({ name: "host", private: true });
    expect(shared.room.roomId).toHaveLength(4);
    for (const ch of shared.room.roomId) expect(ROOM_CODE_ALPHABET).toContain(ch);
    const codes = (await listRooms()).rooms.map((r) => r.code);
    expect(codes).toContain(shared.room.roomId);
    expect(codes).not.toContain(hidden.room.roomId);
  });

  it("a second player joins by code and gets the same seed; unknown codes fail", async () => {
    const host = await createRoom({ name: "host", seed: 7 });
    const hostSnapshot = await host.next<SnapshotMessage>("snapshot");
    const guest = await joinRoom(host.room.roomId, "guest");
    const guestSnapshot = await guest.next<SnapshotMessage>("snapshot");
    expect(guestSnapshot.state.seed).toBe(hostSnapshot.state.seed);
    expect(guestSnapshot.you).toBe(1);
    expect(guestSnapshot.creator).toBe(0);
    expect(guestSnapshot.players.map((p) => p.name)).toEqual(["host", "guest"]);
    await expect(client().joinById("ZZZZ", { name: "x" })).rejects.toThrow();
  });

  it("only the creator can start, once every guest is ready, and no ticks flow before that", async () => {
    const host = await createRoom({ name: "host" });
    const guest = watch(await client().joinById(host.room.roomId, { name: "guest" }));
    guest.room.send("start", {});
    await guest.none("tick", 200);
    host.room.send("start", {});
    await guest.none("tick", 200);
    guest.room.send("ready", { ready: true });
    await host.next<PlayerInfo[]>("players", (list) => list.some((p) => p.playerId === 1 && p.ready));
    host.room.send("start", {});
    expect(await host.next<string>("phase")).toBe("playing");
    const cleared = await host.next<PlayerInfo[]>("players", (list) => list.length === 2 && list.every((p) => !p.ready));
    expect(cleared).toHaveLength(2);
    const tick = await guest.next<TickMessage>("tick");
    expect(tick.tick).toBeGreaterThanOrEqual(0);
  });

  it("rejects a build on the path and never broadcasts it", async () => {
    const host = await createRoom({ name: "host" });
    host.room.send("start", {});
    await host.next<TickMessage>("tick");
    host.room.send("cmd", { type: "build", tower: "archer", x: 5, y: 1 });
    const rejected = await host.next<RejectedMessage>("rejected");
    expect(rejected.reason).toBe("on_path");
    await expect(host.next<TickMessage>("tick", (t) => t.commands.length > 0, 300)).rejects.toThrow();
  });

  it("rejects commands before the game starts and malformed ones", async () => {
    const host = await createRoom({ name: "host" });
    host.room.send("cmd", { type: "build", tower: "archer", x: 3, y: 3 });
    expect((await host.next<RejectedMessage>("rejected")).reason).toBe("not_playing");
    host.room.send("start", {});
    host.room.send("cmd", { type: "build", tower: "laser", x: 3, y: 3 });
    expect((await host.next<RejectedMessage>("rejected")).reason).toBe("bad_shape");
  });

  it("broadcasts an accepted build with the sender's playerId and both clients match the server hash", async () => {
    const host = await createRoom({ name: "host" });
    await host.next<SnapshotMessage>("snapshot");
    const guest = await joinRoom(host.room.roomId, "guest");
    await guest.next<SnapshotMessage>("snapshot");
    host.room.send("start", {});
    const hostSnapshot = await host.next<SnapshotMessage>("snapshot");
    const guestSnapshot = await guest.next<SnapshotMessage>("snapshot");
    const local = { host: hostSnapshot.state, guest: guestSnapshot.state };
    const hashChecks: { side: string; tick: number; server: string; local: string }[] = [];
    host.tap<TickMessage>("tick", (t) => {
      local.host = step(local.host, t.commands);
      if (t.hash !== undefined) hashChecks.push({ side: "host", tick: t.tick, server: t.hash, local: hashState(local.host) });
    });
    guest.tap<TickMessage>("tick", (t) => {
      local.guest = step(local.guest, t.commands);
      if (t.hash !== undefined) hashChecks.push({ side: "guest", tick: t.tick, server: t.hash, local: hashState(local.guest) });
    });
    await host.next<TickMessage>("tick");
    guest.room.send("cmd", { type: "build", tower: "archer", x: 3, y: 3 });
    const withBuild = await host.next<TickMessage>("tick", (t) => t.commands.length > 0);
    expect(withBuild.commands[0]).toMatchObject({ type: "build", playerId: 1, tower: "archer", x: 3, y: 3, tick: withBuild.tick });
    await guest.next<TickMessage>("tick", (t) => t.hash !== undefined && t.tick > withBuild.tick);
    await host.next<TickMessage>("tick", (t) => t.hash !== undefined && t.tick > withBuild.tick);
    expect(hashChecks.filter((c) => c.side === "host").length).toBeGreaterThan(0);
    expect(hashChecks.filter((c) => c.side === "guest").length).toBeGreaterThan(0);
    for (const check of hashChecks) expect(check.local).toBe(check.server);
    expect(local.guest.towers).toHaveLength(1);
  });

  it("starts the real sim with every player and adds late joiners with a join command", async () => {
    const host = await createRoom({ name: "host" });
    await host.next<SnapshotMessage>("snapshot");
    const guest = await joinRoom(host.room.roomId, "guest");
    await guest.next<SnapshotMessage>("snapshot");
    host.room.send("start", {});
    const started = await guest.next<SnapshotMessage>("snapshot");
    expect(started.state.players.map((p) => p.id)).toEqual([0, 1]);
    expect(started.state.players.every((p) => p.gold === startingGold(2))).toBe(true);
    await guest.next<TickMessage>("tick");
    const late = await joinRoom(host.room.roomId, "late");
    const lateSnapshot = await late.next<SnapshotMessage>("snapshot");
    expect(lateSnapshot.you).toBe(2);
    const joinTick = await host.next<TickMessage>("tick", (t) => t.commands.some((c) => c.type === "join"));
    expect(joinTick.commands).toContainEqual({ type: "join", tick: joinTick.tick, playerId: 2, color: 2 });
  });

  it("relays a wave call: the wave starts and everyone gets the bonus", async () => {
    const host = await createRoom({ name: "host" });
    await host.next<SnapshotMessage>("snapshot");
    const guest = await joinRoom(host.room.roomId, "guest");
    await guest.next<SnapshotMessage>("snapshot");
    host.room.send("start", {});
    const started = await guest.next<SnapshotMessage>("snapshot");
    let local = started.state;
    guest.tap<TickMessage>("tick", (t) => (local = step(local, t.commands)));
    guest.room.send("cmd", { type: "callWave" });
    const called = await guest.next<TickMessage>("tick", (t) => t.commands.some((c) => c.type === "callWave"));
    expect(called.commands).toContainEqual({ type: "callWave", tick: called.tick, playerId: 1 });
    expect(local.wave).toBe(1);
    expect(local.players.every((p) => p.gold > startingGold(2))).toBe(true);
  });

  it("relays abilities with the sender's playerId and rejects malformed ones", async () => {
    const host = await createRoom({ name: "host" });
    await host.next<SnapshotMessage>("snapshot");
    const guest = await joinRoom(host.room.roomId, "guest");
    await guest.next<SnapshotMessage>("snapshot");
    host.room.send("start", {});
    await guest.next<SnapshotMessage>("snapshot");
    guest.room.send("cmd", { type: "useAbility", ability: "bombard", x: 3, y: 3 });
    const cast = await guest.next<TickMessage>("tick", (t) => t.commands.some((c) => c.type === "useAbility"));
    expect(cast.commands).toContainEqual({ type: "useAbility", tick: cast.tick, playerId: 1, ability: "bombard", x: 3, y: 3 });
    guest.room.send("cmd", { type: "upgradeAbility", ability: "repair" });
    const upgraded = await guest.next<TickMessage>("tick", (t) => t.commands.some((c) => c.type === "upgradeAbility"));
    expect(upgraded.commands).toContainEqual({ type: "upgradeAbility", tick: upgraded.tick, playerId: 1, ability: "repair" });
    guest.room.send("cmd", { type: "useAbility", ability: "nuke" });
    expect((await guest.next<RejectedMessage>("rejected")).reason).toBe("bad_shape");
    guest.room.send("cmd", { type: "useAbility", ability: "overcharge", towerId: "x" });
    expect((await guest.next<RejectedMessage>("rejected")).reason).toBe("bad_shape");
  });

  it("limits commands per tick per player", async () => {
    const host = await createRoom({ name: "host" });
    host.room.send("start", {});
    await host.next<TickMessage>("tick");
    const burst = 10;
    for (let i = 0; i < burst; i++) host.room.send("cmd", { type: "build", tower: "archer", x: i, y: 0 });
    const rejections: string[] = [];
    while (rejections.length < burst - 2 * MAX_COMMANDS_PER_TICK) {
      rejections.push((await host.next<RejectedMessage>("rejected")).reason);
    }
    expect(rejections.every((r) => r === "rate_limited" || r === "no_gold")).toBe(true);
    expect(rejections.filter((r) => r === "rate_limited").length).toBeGreaterThanOrEqual(burst - 2 * MAX_COMMANDS_PER_TICK);
  });

  it("keeps the seat of a player who drops and reconnects", async () => {
    const host = await createRoom({ name: "host" });
    const guestClient = client();
    const guest = watch(await guestClient.joinById(host.room.roomId, { name: "guest" }));
    await guest.next<SnapshotMessage>("snapshot");
    const token = guest.room.reconnectionToken;
    await guest.room.leave(false);
    const dropped = await host.next<PlayerInfo[]>("players", (list) => list.some((p) => p.playerId === 1 && !p.connected));
    expect(dropped).toHaveLength(2);
    const back = watch(await guestClient.reconnect(token));
    const snapshot = await back.next<SnapshotMessage>("snapshot");
    expect(snapshot.you).toBe(1);
    const restored = await host.next<PlayerInfo[]>("players", (list) => list.length === 2 && list.every((p) => p.connected));
    expect(restored.map((p) => p.name)).toEqual(["host", "guest"]);
  });

  it("pauses the sim while nobody is connected and resumes on reconnection", async () => {
    const hostClient = client();
    const host = watch(await hostClient.create(ROOM_NAME, { name: "host" }));
    await host.next<SnapshotMessage>("snapshot");
    host.room.send("start", {});
    await host.next<SnapshotMessage>("snapshot");
    const running = await host.next<TickMessage>("tick", (t) => t.tick > 5);
    const token = host.room.reconnectionToken;
    await host.room.leave(false);
    await new Promise((r) => setTimeout(r, 400));
    const back = watch(await hostClient.reconnect(token));
    const resumed = await back.next<SnapshotMessage>("snapshot");
    expect(resumed.state.tick - running.tick).toBeLessThan(6);
    const listing = await listRooms();
    expect(listing.rooms.find((r) => r.code === host.room.roomId)?.connected).toBe(1);
    await back.next<TickMessage>("tick", (t) => t.tick > resumed.state.tick + 2);
  });

  it("files a manual report that replays to the server hash", async () => {
    const host = await createRoom({ name: "host" });
    await host.next<SnapshotMessage>("snapshot");
    host.room.send("start", {});
    await host.next<SnapshotMessage>("snapshot");
    await host.next<TickMessage>("tick");
    host.room.send("cmd", { type: "build", tower: "archer", x: 3, y: 3 });
    await host.next<TickMessage>("tick", (t) => t.commands.length > 0);
    await host.next<TickMessage>("tick", (t) => t.tick > 30);
    host.room.send("report", {
      reason: "manual",
      message: "se ve raro",
      clientTick: 1,
      clientHash: "x",
      clientDump: "d",
      errors: ["e1"],
      userAgent: "test",
    });
    const { ref } = await host.next<ReportedMessage>("reported");
    expect(ref.startsWith(reportsDir)).toBe(true);
    const report = JSON.parse(await readFile(ref, "utf8")) as BugReport;
    expect(report.reason).toBe("manual");
    expect(report.message).toBe("se ve raro");
    expect(report.history.some((h) => h.commands.some((c) => c.type === "build"))).toBe(true);
    let state: GameState = report.initialState!;
    const byTick = new Map<number, Command[]>(report.history.map((h) => [h.tick, h.commands]));
    while (state.tick < report.serverTick) state = step(state, byTick.get(state.tick) ?? []);
    expect(hashState(state)).toBe(report.serverHash);
  });

  it("files a desync report with both dumps and rate limits repeats", async () => {
    const host = await createRoom({ name: "host" });
    await host.next<SnapshotMessage>("snapshot");
    host.room.send("start", {});
    await host.next<SnapshotMessage>("snapshot");
    const tick = await host.next<TickMessage>("tick");
    host.room.send("desync", { tick: tick.tick, hash: "deadbeef", dump: "client dump" });
    await host.next<SnapshotMessage>("snapshot");
    await new Promise((r) => setTimeout(r, 200));
    const { readdir } = await import("node:fs/promises");
    const files = (await readdir(reportsDir)).filter((f) => f.includes(host.room.roomId) && f.includes("desync"));
    expect(files).toHaveLength(1);
    const report = JSON.parse(await readFile(join(reportsDir, files[0]!), "utf8")) as BugReport;
    expect(report.clientDump).toBe("client dump");
    expect(report.clientHash).toBe("deadbeef");
  });

  it("caps reports process-wide", () => {
    const start = Date.now() + 3_600_000;
    let allowed = 0;
    for (let i = 0; i < 15; i++) if (globalReportAllowed(start + i)) allowed++;
    expect(allowed).toBe(10);
    expect(globalReportAllowed(start + 11 * 60_000)).toBe(true);
  });

  it("the creator can speed the game up and a map can be chosen", async () => {
    const host = await createRoom({ name: "host", map: "directo" });
    const snapshot = await host.next<SnapshotMessage>("snapshot");
    expect(snapshot.state.mapId).toBe("directo");
    expect(snapshot.speed).toBe(1);
    host.room.send("start", {});
    await host.next<SnapshotMessage>("snapshot");
    const guest = await joinRoom(host.room.roomId, "guest");
    await guest.next<SnapshotMessage>("snapshot");
    guest.room.send("setSpeed", { speed: 4 });
    await guest.none("speed", 200);
    let latest = 0;
    host.tap<TickMessage>("tick", (t) => (latest = t.tick));
    host.room.send("setSpeed", { speed: 4 });
    expect(await guest.next<number>("speed")).toBe(4);
    const from = latest;
    await new Promise((r) => setTimeout(r, 500));
    expect(latest - from).toBeGreaterThan(25);
  });

  it("the creator can restart: back to the lobby with a new seed, then play again", async () => {
    const host = await createRoom({ name: "host" });
    const first = await host.next<SnapshotMessage>("snapshot");
    const guest = await joinRoom(host.room.roomId, "guest");
    await guest.next<SnapshotMessage>("snapshot");
    host.room.send("start", {});
    await host.next<SnapshotMessage>("snapshot");
    expect(await guest.next<string>("phase")).toBe("playing");
    await guest.next<SnapshotMessage>("snapshot");
    await host.next<TickMessage>("tick", (t) => t.tick > 5);
    guest.room.send("restart", {});
    await guest.none("phase", 200);
    host.room.send("restart", {});
    await guest.none("phase", 200);
    guest.room.send("ready", { ready: true });
    await host.next<PlayerInfo[]>("players", (list) => list.some((p) => p.playerId === 1 && p.ready));
    host.room.send("restart", {});
    expect(await guest.next<string>("phase")).toBe("lobby");
    const again = await guest.next<SnapshotMessage>("snapshot");
    expect(again.state.tick).toBe(0);
    expect(again.state.seed).not.toBe(first.state.seed);
    expect(again.players.map((p) => p.name)).toEqual(["host", "guest"]);
    expect(again.players.every((p) => !p.ready)).toBe(true);
    let ticksAfterRestart = 0;
    guest.tap<TickMessage>("tick", () => ticksAfterRestart++);
    await new Promise((r) => setTimeout(r, 300));
    expect(ticksAfterRestart).toBe(0);
    guest.room.send("ready", { ready: true });
    await host.next<PlayerInfo[]>("players", (list) => list.some((p) => p.playerId === 1 && p.ready));
    host.room.send("start", {});
    const started = await guest.next<SnapshotMessage>("snapshot");
    expect(started.state.players.map((p) => p.id)).toEqual([0, 1]);
    await guest.next<TickMessage>("tick");
  });

  it("answers a desync report with a fresh snapshot", async () => {
    const host = await createRoom({ name: "host" });
    await host.next<SnapshotMessage>("snapshot");
    host.room.send("start", {});
    await host.next<SnapshotMessage>("snapshot");
    const tick = await host.next<TickMessage>("tick");
    host.room.send("desync", { tick: tick.tick, hash: "deadbeef" });
    const snapshot = await host.next<SnapshotMessage>("snapshot");
    expect(snapshot.state.tick).toBeGreaterThan(tick.tick);
    expect(snapshot.phase).toBe("playing");
  });

  it("the creator can kick a player, who leaves for good", async () => {
    const host = await createRoom({ name: "host" });
    const guest = await joinRoom(host.room.roomId, "guest");
    await guest.next<SnapshotMessage>("snapshot");
    const gone = new Promise<number>((resolve) => guest.room.onLeave((code) => resolve(code)));
    host.room.send("kick", { playerId: 1 });
    expect(await gone).toBe(4100);
    const remaining = await host.next<PlayerInfo[]>("players", (list) => list.length === 1);
    expect(remaining[0]!.name).toBe("host");
  });

  it("relays chat with the sender's name", async () => {
    const host = await createRoom({ name: "host" });
    const guest = await joinRoom(host.room.roomId, "guest");
    guest.room.send("chat", { text: "  hola  " });
    expect(await host.next("chat")).toEqual({ playerId: 1, name: "guest", text: "hola" });
  });
});
