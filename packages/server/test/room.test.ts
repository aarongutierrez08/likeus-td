import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Client, type Room } from "@colyseus/sdk";
import type { Server } from "@colyseus/core";
import { hashState, step } from "@td/sim";
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

beforeAll(async () => {
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

async function createRoom(options: { name?: string; private?: boolean; seed?: number } = {}): Promise<Inbox> {
  return watch(await client().create(ROOM_NAME, options));
}

async function joinRoom(code: string, name: string): Promise<Inbox> {
  return watch(await client().joinById(code, { name }));
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

  it("only the creator can start, and no ticks flow before that", async () => {
    const host = await createRoom({ name: "host" });
    const guest = await joinRoom(host.room.roomId, "guest");
    guest.room.send("start", {});
    await guest.none("tick", 200);
    host.room.send("start", {});
    expect(await host.next<string>("phase")).toBe("playing");
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
    const hostSnapshot = await host.next<SnapshotMessage>("snapshot");
    const guest = await joinRoom(host.room.roomId, "guest");
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
    host.room.send("start", {});
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

  it("answers a desync report with a fresh snapshot", async () => {
    const host = await createRoom({ name: "host" });
    await host.next<SnapshotMessage>("snapshot");
    host.room.send("start", {});
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
