import { Room, type Client } from "@colyseus/core";
import {
  TICKS_PER_SECOND,
  TOWER_KINDS,
  canSubmitRecord,
  cloneState,
  createInitialState,
  hashState,
  applyCommand,
  step,
  validateCommand,
  type Command,
  type GameState,
} from "@td/sim";
import {
  HASH_EVERY_TICKS,
  KICKED_CLOSE_CODE,
  MAX_CHAT_LENGTH,
  MAX_COMMANDS_PER_TICK,
  MAX_NAME_LENGTH,
  PLAYER_LIMIT,
  RECONNECT_SECONDS,
  type ChatMessage,
  type CommandReject,
  type CommandRequest,
  type CreateRoomOptions,
  type DesyncReport,
  type JoinRoomOptions,
  type Phase,
  type PlayerInfo,
  type RoomMetadata,
  type SnapshotMessage,
  type TickMessage,
} from "./protocol";
import { uniqueRoomCode } from "./roomCode";

const TICK_MS = 1000 / TICKS_PER_SECOND;
/** Ticks the server may run in one interval callback when it falls behind. */
const MAX_CATCH_UP_TICKS = 5;
const CONSENTED_CLOSE_CODE = 4000;
const MAX_SEED = 2 ** 31;

interface Player extends PlayerInfo {
  sessionId: string;
}

/**
 * Thin adapter between Colyseus and the sim (ADR 003). Runs the authoritative sim,
 * validates every command, and broadcasts one `tick` per step (ADR 002, ADR 006).
 * No game rules live here.
 */
export class GameRoom extends Room {
  override maxClients = PLAYER_LIMIT;
  override maxMessagesPerSecond = 40;

  private sim: GameState = createInitialState({ seed: 0 });
  private phase: Phase = "lobby";
  private readonly players = new Map<string, Player>();
  private creatorPlayerId = 0;
  private nextPlayerId = 0;
  private seed = 0;
  private pending: Command[] = [];
  private readonly commandsThisTick = new Map<number, number>();
  private accumulator = 0;

  override async onCreate(options: CreateRoomOptions): Promise<void> {
    this.roomId = await uniqueRoomCode();
    this.seed = pickSeed(options.seed);
    this.sim = createInitialState({ seed: this.seed, players: [] });
    await this.setPrivate(options.private === true);
    await this.publishMetadata();

    this.onMessage<CommandRequest>("cmd", (client, request) => this.handleCommand(client, request));
    this.onMessage<{ text?: unknown }>("chat", (client, msg) => this.handleChat(client, msg));
    this.onMessage("start", (client) => this.handleStart(client));
    this.onMessage<{ playerId?: unknown }>("kick", (client, msg) => this.handleKick(client, msg));
    this.onMessage<DesyncReport>("desync", (client, report) => this.handleDesync(client, report));
  }

  override async onJoin(client: Client, options?: JoinRoomOptions): Promise<void> {
    const playerId = this.nextPlayerId++;
    const player: Player = {
      playerId,
      name: sanitizeName(options?.name, playerId),
      connected: true,
      sessionId: client.sessionId,
    };
    this.players.set(client.sessionId, player);
    if (this.players.size === 1) this.creatorPlayerId = playerId;
    if (this.phase === "playing") this.pending.push({ type: "join", tick: this.sim.tick, playerId });
    client.send("snapshot", this.snapshotFor(player));
    this.broadcastPlayers();
    await this.publishMetadata();
  }

  override async onLeave(client: Client, code?: number): Promise<void> {
    const player = this.players.get(client.sessionId);
    if (!player) return;
    const consented = code === CONSENTED_CLOSE_CODE || code === KICKED_CLOSE_CODE;
    if (consented) {
      await this.removePlayer(player);
      return;
    }
    player.connected = false;
    this.broadcastPlayers();
    try {
      const reconnected = await this.allowReconnection(client, RECONNECT_SECONDS);
      player.connected = true;
      player.sessionId = reconnected.sessionId;
      this.broadcastPlayers();
      reconnected.send("snapshot", this.snapshotFor(player));
    } catch {
      await this.removePlayer(player);
    }
  }

  override onDispose(): void {
    console.log(`room ${this.roomId} disposed at tick ${this.sim.tick} (${this.sim.status})`);
  }

  /** The real sim starts here with everyone present; the lobby sim was a placeholder. */
  private handleStart(client: Client): void {
    if (!this.isCreator(client) || this.phase !== "lobby") return;
    const players = [...this.players.values()].map((p) => ({ id: p.playerId }));
    this.sim = createInitialState({ seed: this.seed, players });
    this.setPhase("playing");
    for (const player of this.players.values()) {
      const target = this.clients.find((c) => c.sessionId === player.sessionId);
      target?.send("snapshot", this.snapshotFor(player));
    }
    this.accumulator = 0;
    this.setSimulationInterval((deltaMs) => this.advance(deltaMs), TICK_MS);
  }

  private advance(deltaMs: number): void {
    this.accumulator += deltaMs;
    let ticks = 0;
    while (this.accumulator >= TICK_MS && ticks < MAX_CATCH_UP_TICKS && this.sim.status === "playing") {
      this.tick();
      this.accumulator -= TICK_MS;
      ticks++;
    }
    if (this.sim.status !== "playing") this.finish();
  }

  private tick(): void {
    const requested = this.pending;
    this.pending = [];
    this.commandsThisTick.clear();
    const accepted = this.acceptInOrder(requested);
    const waveBefore = this.sim.wave;
    this.sim = step(this.sim, accepted);
    const message: TickMessage = { tick: this.sim.tick - 1, commands: accepted };
    if (this.sim.tick % HASH_EVERY_TICKS === 0) message.hash = hashState(this.sim);
    this.broadcast("tick", message);
    if (this.sim.wave !== waveBefore) void this.publishMetadata();
  }

  /** Commands are re-validated one after another so two players cannot take the same cell in one tick. */
  private acceptInOrder(requested: Command[]): Command[] {
    const probe = cloneState(this.sim);
    const accepted: Command[] = [];
    for (const cmd of requested) {
      const reason = validateCommand(probe, cmd);
      if (reason === null) {
        applyCommand(probe, cmd);
        accepted.push(cmd);
      } else {
        this.rejectPlayer(cmd.playerId, reason);
      }
    }
    return accepted;
  }

  private finish(): void {
    this.setSimulationInterval(undefined);
    this.setPhase("ended");
    console.log(`room ${this.roomId} ${this.sim.status} at tick ${this.sim.tick}, record eligible: ${canSubmitRecord(this.sim)}`);
  }

  private handleCommand(client: Client, request: CommandRequest): void {
    const player = this.players.get(client.sessionId);
    if (!player) return;
    if (this.phase !== "playing") return this.reject(client, "not_playing");
    const command = toCommand(request, this.sim.tick, player.playerId);
    if (!command) return this.reject(client, "bad_shape");
    const sent = this.commandsThisTick.get(player.playerId) ?? 0;
    if (sent >= MAX_COMMANDS_PER_TICK) return this.reject(client, "rate_limited");
    const reason = validateCommand(this.sim, command);
    if (reason !== null) return this.reject(client, reason);
    this.commandsThisTick.set(player.playerId, sent + 1);
    this.pending.push(command);
  }

  private handleChat(client: Client, msg: { text?: unknown }): void {
    const player = this.players.get(client.sessionId);
    if (!player || typeof msg?.text !== "string") return;
    const text = msg.text.trim().slice(0, MAX_CHAT_LENGTH);
    if (text.length === 0) return;
    const chat: ChatMessage = { playerId: player.playerId, name: player.name, text };
    this.broadcast("chat", chat);
  }

  private handleKick(client: Client, msg: { playerId?: unknown }): void {
    if (!this.isCreator(client) || typeof msg?.playerId !== "number") return;
    const target = [...this.players.values()].find((p) => p.playerId === msg.playerId);
    if (!target || target.playerId === this.creatorPlayerId) return;
    this.kickClient(target.sessionId, KICKED_CLOSE_CODE, "kicked");
  }

  private handleDesync(client: Client, report: DesyncReport): void {
    const player = this.players.get(client.sessionId);
    if (!player) return;
    console.warn(
      `desync in ${this.roomId}: player ${player.playerId} tick ${report?.tick} hash ${report?.hash}, server tick ${this.sim.tick} hash ${hashState(this.sim)}`,
    );
    client.send("snapshot", this.snapshotFor(player));
  }

  private reject(client: Client, reason: CommandReject): void {
    client.send("rejected", { reason });
  }

  private rejectPlayer(playerId: number, reason: CommandReject): void {
    const player = [...this.players.values()].find((p) => p.playerId === playerId);
    const client = player && this.clients.find((c) => c.sessionId === player.sessionId);
    if (client) this.reject(client, reason);
  }

  private async removePlayer(player: Player): Promise<void> {
    this.players.delete(player.sessionId);
    if (player.playerId === this.creatorPlayerId) this.creatorPlayerId = this.lowestPlayerId();
    this.broadcastPlayers();
    await this.publishMetadata();
  }

  private isCreator(client: Client): boolean {
    return this.players.get(client.sessionId)?.playerId === this.creatorPlayerId;
  }

  private setPhase(phase: Phase): void {
    this.phase = phase;
    this.broadcast("phase", phase);
    void this.publishMetadata();
  }

  private snapshotFor(player: Player): SnapshotMessage {
    return { state: this.sim, players: this.playerList(), you: player.playerId, creator: this.creatorPlayerId, phase: this.phase };
  }

  private playerList(): PlayerInfo[] {
    return [...this.players.values()]
      .map(({ playerId, name, connected }) => ({ playerId, name, connected }))
      .sort((a, b) => a.playerId - b.playerId);
  }

  private broadcastPlayers(): void {
    this.broadcast("players", this.playerList());
  }

  private lowestPlayerId(): number {
    return this.playerList()[0]?.playerId ?? 0;
  }

  private publishMetadata(): Promise<void> {
    const metadata: RoomMetadata = {
      code: this.roomId,
      seed: this.sim.seed,
      phase: this.phase,
      players: this.players.size,
      wave: this.sim.wave,
    };
    return this.setMetadata(metadata);
  }
}

function pickSeed(requested: number | undefined): number {
  if (Number.isInteger(requested) && requested! >= 0) return requested!;
  return Math.floor(Math.random() * MAX_SEED);
}

function sanitizeName(raw: string | undefined, playerId: number): string {
  const trimmed = typeof raw === "string" ? raw.trim().slice(0, MAX_NAME_LENGTH) : "";
  return trimmed.length > 0 ? trimmed : `Jugador ${playerId + 1}`;
}

/** Shape check of a client request; the sim validates the rules afterwards. */
function toCommand(value: unknown, tick: number, playerId: number): Command | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  switch (v["type"]) {
    case "build":
      if (!TOWER_KINDS.includes(v["tower"] as never) || !Number.isInteger(v["x"]) || !Number.isInteger(v["y"])) return null;
      return { type: "build", tick, playerId, tower: v["tower"] as CommandRequest extends { tower: infer T } ? T : never, x: v["x"] as number, y: v["y"] as number };
    case "callWave":
      return { type: "callWave", tick, playerId };
    case "gift":
      if (!Number.isInteger(v["to"]) || !Number.isInteger(v["amount"])) return null;
      return { type: "gift", tick, playerId, to: v["to"] as number, amount: v["amount"] as number };
    case "sell":
      if (!Number.isInteger(v["towerId"])) return null;
      return { type: "sell", tick, playerId, towerId: v["towerId"] as number };
    case "upgrade":
      if (!Number.isInteger(v["towerId"])) return null;
      return { type: "upgrade", tick, playerId, towerId: v["towerId"] as number };
    default:
      return null;
  }
}
