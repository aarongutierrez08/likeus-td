import { Room, type Client } from "@colyseus/core";
import {
  BALANCE_VERSION,
  TICKS_PER_SECOND,
  TOWER_KINDS,
  ABILITY_KINDS,
  DOCTRINE_KINDS,
  canSubmitRecord,
  cloneState,
  createInitialState,
  deckProblem,
  DECK,
  DEFAULT_DECKS,
  dumpState,
  isMapId,
  DEFAULT_MAP,
  hashState,
  applyCommand,
  isPlayerColor,
  pickColor,
  step,
  validateCommand,
  type Command,
  type Deck,
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
  type BugReport,
  type ChatMessage,
  type CommandReject,
  type HistoryEntry,
  type ReportRequest,
  type Speed,
  SPEEDS,
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
import { createReportSink, globalReportAllowed, type ReportSink } from "./reports";
import { uniqueRoomCode } from "./roomCode";

const TICK_MS = 1000 / TICKS_PER_SECOND;
/** Ticks the server may run in one interval callback when it falls behind (at 4× it needs 4 per interval). */
const MAX_CATCH_UP_TICKS = 12;
const CONSENTED_CLOSE_CODE = 4000;
/** A finished game stays open this long so players can look at the result, then everyone is disconnected. */
const ENDED_ROOM_TTL_MS = 120_000;
/** One report per player (manual or client error) and one desync report per room within this window. */
const REPORT_COOLDOWN_MS = 30_000;
const MAX_ERRORS_PER_REPORT = 20;
const MAX_MESSAGE_CHARS = 2000;
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
  private mapId: string = DEFAULT_MAP;
  private speed: Speed = 1;
  private pending: Command[] = [];
  private readonly commandsThisTick = new Map<number, number>();
  private accumulator = 0;
  private initialState: GameState | null = null;
  private readonly history: HistoryEntry[] = [];
  private readonly reports: ReportSink = createReportSink({
    githubToken: process.env["GITHUB_TOKEN"],
    githubRepo: process.env["GITHUB_REPO"],
    reportsDir: process.env["REPORTS_DIR"],
  });
  private readonly lastReportAt = new Map<string, number>();
  private endedTimer: ReturnType<typeof this.clock.setTimeout> | null = null;

  override async onCreate(options: CreateRoomOptions): Promise<void> {
    this.roomId = await uniqueRoomCode();
    this.seed = pickSeed(options.seed);
    this.mapId = typeof options.map === "string" && isMapId(options.map) ? options.map : DEFAULT_MAP;
    this.sim = createInitialState({ seed: this.seed, mapId: this.mapId, players: [] });
    await this.setPrivate(options.private === true);
    await this.publishMetadata();

    this.onMessage<CommandRequest>("cmd", (client, request) => this.handleCommand(client, request));
    this.onMessage<{ text?: unknown }>("chat", (client, msg) => this.handleChat(client, msg));
    this.onMessage("start", (client) => this.handleStart(client));
    this.onMessage<{ playerId?: unknown }>("kick", (client, msg) => this.handleKick(client, msg));
    this.onMessage<DesyncReport>("desync", (client, report) => this.handleDesync(client, report));
    this.onMessage<ReportRequest>("report", (client, request) => void this.handleReport(client, request));
    this.onMessage<{ speed?: unknown }>("setSpeed", (client, msg) => this.handleSetSpeed(client, msg));
    this.onMessage("restart", (client) => void this.handleRestart(client));
    this.onMessage<{ ready?: unknown }>("ready", (client, msg) => this.handleReady(client, msg));
    this.onMessage<{ color?: unknown }>("setColor", (client, msg) => this.handleSetColor(client, msg));
    this.onMessage<{ deck?: unknown }>("setDeck", (client, msg) => this.handleSetDeck(client, msg));
    this.onMessage<{ to?: unknown }>("passHost", (client, msg) => this.handlePassHost(client, msg));
  }

  override async onJoin(client: Client, options?: JoinRoomOptions): Promise<void> {
    const playerId = this.nextPlayerId++;
    const player: Player = {
      playerId,
      name: sanitizeName(options?.name, playerId),
      color: pickColor([...this.players.values()], options?.color),
      connected: true,
      ready: false,
      deck: validDeck(options?.deck) ?? DEFAULT_DECKS.coop,
      sessionId: client.sessionId,
    };
    this.players.set(client.sessionId, player);
    if (this.players.size === 1) this.creatorPlayerId = playerId;
    if (this.phase === "playing")
      this.pending.push({ type: "join", tick: this.sim.tick, playerId, color: player.color, deck: player.deck });
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
    if (player.playerId === this.creatorPlayerId) this.handOnHost(player.playerId);
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
    if (!this.isCreator(client) || this.phase !== "lobby" || !this.everyoneReady(client)) return;
    this.clearReady();
    const players = [...this.players.values()].map((p) => ({ id: p.playerId, color: p.color, deck: p.deck }));
    this.sim = createInitialState({ seed: this.seed, mapId: this.mapId, players, deckTowers: DECK.coopTowers, host: this.creatorPlayerId });
    this.initialState = this.sim;
    this.history.length = 0;
    this.setPhase("playing");
    for (const player of this.players.values()) {
      const target = this.clients.find((c) => c.sessionId === player.sessionId);
      target?.send("snapshot", this.snapshotFor(player));
    }
    this.accumulator = 0;
    this.setSimulationInterval((deltaMs) => this.advance(deltaMs), TICK_MS);
  }

  /** With nobody online the sim waits: a dropped team must find the game where it left it. */
  private advance(deltaMs: number): void {
    if (this.connectedCount() === 0) {
      this.accumulator = 0;
      return;
    }
    this.accumulator += deltaMs * this.speed;
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
    if (accepted.length > 0) this.history.push({ tick: this.sim.tick - 1, commands: accepted });
    const message: TickMessage = { tick: this.sim.tick - 1, commands: accepted };
    if (this.sim.tick % HASH_EVERY_TICKS === 0) message.hash = hashState(this.sim);
    this.broadcast("tick", message);
    if (this.sim.wave !== waveBefore) void this.publishMetadata();
    if (this.sim.host !== this.creatorPlayerId) this.setHost(this.sim.host);
    const hostSeat = this.playerList().find((p) => p.playerId === this.sim.host);
    if (hostSeat && !hostSeat.connected) this.handOnHost(hostSeat.playerId);
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
    void this.lock();
    this.endedTimer = this.clock.setTimeout(() => void this.disconnect(), ENDED_ROOM_TTL_MS);
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

  /** Same room, same players, fresh seed: back to the lobby so the creator starts when everyone is ready. */
  private async handleRestart(client: Client): Promise<void> {
    if (!this.isCreator(client) || this.phase === "lobby" || !this.everyoneReady(client)) return;
    this.clearReady();
    this.setSimulationInterval(undefined);
    this.endedTimer?.clear();
    this.endedTimer = null;
    this.pending = [];
    this.history.length = 0;
    this.initialState = null;
    this.seed = pickSeed(undefined);
    this.sim = createInitialState({ seed: this.seed, mapId: this.mapId, players: [] });
    void this.unlock();
    this.setPhase("lobby");
    for (const player of this.players.values()) {
      const target = this.clients.find((c) => c.sessionId === player.sessionId);
      target?.send("snapshot", this.snapshotFor(player));
    }
    await this.publishMetadata();
  }

  private handleReady(client: Client, msg: { ready?: unknown }): void {
    const player = this.players.get(client.sessionId);
    if (!player || typeof msg?.ready !== "boolean" || player.ready === msg.ready) return;
    player.ready = msg.ready;
    this.broadcastPlayers();
  }

  /** The creator counts as ready by acting; every other connected player must have marked it. */
  private everyoneReady(creator: Client): boolean {
    return [...this.players.values()].every((p) => p.sessionId === creator.sessionId || !p.connected || p.ready);
  }

  private clearReady(): void {
    for (const player of this.players.values()) player.ready = false;
  }

  /** Only the creator sets the pace; everyone hears about it so the HUD can show it. */
  private handleSetSpeed(client: Client, msg: { speed?: unknown }): void {
    if (!this.isCreator(client)) return;
    const speed = SPEEDS.find((s) => s === msg?.speed);
    if (speed === undefined || speed === this.speed) return;
    this.speed = speed;
    this.broadcast("speed", speed);
  }

  private handleChat(client: Client, msg: { text?: unknown }): void {
    const player = this.players.get(client.sessionId);
    if (!player || typeof msg?.text !== "string") return;
    const text = msg.text.trim().slice(0, MAX_CHAT_LENGTH);
    if (text.length === 0) return;
    const chat: ChatMessage = { playerId: player.playerId, name: player.name, text };
    this.broadcast("chat", chat);
  }

  /** Colors are picked while nobody plays; during a game the sim owns them. */
  private handleSetColor(client: Client, msg: { color?: unknown }): void {
    const player = this.players.get(client.sessionId);
    if (!player || this.phase === "playing" || !isPlayerColor(msg?.color)) return;
    if ([...this.players.values()].some((p) => p !== player && p.color === msg.color)) return;
    player.color = msg.color;
    this.broadcastPlayers();
  }

  /** Decks are chosen while nobody plays; changing it takes back a ready mark, since the team may have counted on the old one. */
  private handleSetDeck(client: Client, msg: { deck?: unknown }): void {
    const player = this.players.get(client.sessionId);
    if (!player || this.phase === "playing") return;
    const deck = validDeck(msg?.deck);
    if (!deck) {
      client.send("rejected", { reason: "bad_deck" satisfies CommandReject });
      return;
    }
    player.deck = deck;
    player.ready = false;
    this.broadcastPlayers();
  }

  /** In the lobby the host hands the role on directly; in play the sim owns it and this goes through as a command. */
  private handlePassHost(client: Client, msg: { to?: unknown }): void {
    if (!this.isCreator(client) || this.phase === "playing" || typeof msg?.to !== "number") return;
    if (![...this.players.values()].some((p) => p.playerId === msg.to && p.connected)) return;
    this.setHost(msg.to);
  }

  /** A host who drops hands the role to the next connected seat: in play through the sim, in the lobby directly. */
  private handOnHost(from: number): void {
    const seats = this.playerList().filter((p) => p.connected && p.playerId !== from);
    const next = seats.find((p) => p.playerId > from) ?? seats[0];
    if (!next) return;
    if (this.phase === "playing") this.pending.push({ type: "passHost", tick: this.sim.tick, playerId: from, to: next.playerId });
    else this.setHost(next.playerId);
  }

  private setHost(playerId: number): void {
    if (playerId === this.creatorPlayerId) return;
    this.creatorPlayerId = playerId;
    this.broadcast("host", playerId);
    void this.publishMetadata();
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
    if (!this.reportAllowed("desync")) return;
    void this.fileReport({
      reason: "desync",
      message: `hash del cliente ${report?.hash} en tick ${report?.tick}`,
      reporter: player.playerId,
      clientTick: report?.tick ?? null,
      clientHash: report?.hash ?? null,
      clientDump: report?.dump ?? null,
      errors: [],
      userAgent: null,
    });
  }

  private async handleReport(client: Client, request: ReportRequest): Promise<void> {
    const player = this.players.get(client.sessionId);
    if (!player || typeof request !== "object" || request === null) return;
    if (!this.reportAllowed(`player:${player.playerId}`)) return this.reject(client, "rate_limited");
    const ref = await this.fileReport({
      reason: request.reason === "client_error" ? "client_error" : "manual",
      message: String(request.message ?? "").slice(0, MAX_MESSAGE_CHARS),
      reporter: player.playerId,
      clientTick: Number.isInteger(request.clientTick) ? request.clientTick : null,
      clientHash: typeof request.clientHash === "string" ? request.clientHash : null,
      clientDump: typeof request.clientDump === "string" ? request.clientDump : null,
      errors: Array.isArray(request.errors) ? request.errors.slice(0, MAX_ERRORS_PER_REPORT).map(String) : [],
      userAgent: typeof request.userAgent === "string" ? request.userAgent : null,
    });
    if (ref) client.send("reported", { ref });
  }

  override onUncaughtException(error: Error, methodName: string): void {
    console.error(`uncaught in ${this.roomId} (${methodName}):`, error);
    if (!this.reportAllowed("server_error")) return;
    void this.fileReport({
      reason: "server_error",
      message: `${methodName}: ${error.message}\n${error.stack ?? ""}`,
      reporter: null,
      clientTick: null,
      clientHash: null,
      clientDump: null,
      errors: [],
      userAgent: null,
    });
  }

  private reportAllowed(key: string): boolean {
    const now = Date.now();
    const last = this.lastReportAt.get(key) ?? 0;
    if (now - last < REPORT_COOLDOWN_MS) return false;
    this.lastReportAt.set(key, now);
    return true;
  }

  private async fileReport(
    partial: Omit<
      BugReport,
      | "at"
      | "code"
      | "seed"
      | "balanceVersion"
      | "commit"
      | "players"
      | "phase"
      | "serverTick"
      | "serverHash"
      | "serverDump"
      | "initialState"
      | "history"
      | "historyTruncated"
    >,
  ): Promise<string | null> {
    const report: BugReport = {
      at: new Date().toISOString(),
      code: this.roomId,
      seed: this.seed,
      balanceVersion: BALANCE_VERSION,
      commit: process.env["GIT_COMMIT"] ?? "unknown",
      players: this.playerList(),
      phase: this.phase,
      serverTick: this.sim.tick,
      serverHash: hashState(this.sim),
      serverDump: dumpState(this.sim),
      initialState: this.initialState,
      history: this.history,
      historyTruncated: false,
      ...partial,
    };
    if (!globalReportAllowed()) {
      console.warn(`report dropped for ${this.roomId} (${report.reason}): global limit reached`);
      return null;
    }
    try {
      const ref = await this.reports.file(report);
      console.log(`report filed for ${this.roomId} (${report.reason}): ${ref}`);
      return ref;
    } catch (err) {
      console.error(`report failed for ${this.roomId}:`, err);
      return null;
    }
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
    if (this.phase === "playing") this.pending.push({ type: "leave", tick: this.sim.tick, playerId: player.playerId });
    if (player.playerId === this.creatorPlayerId && this.phase !== "playing") this.setHost(this.lowestPlayerId());
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
    return {
      state: this.sim,
      players: this.playerList(),
      you: player.playerId,
      creator: this.creatorPlayerId,
      phase: this.phase,
      speed: this.speed,
    };
  }

  private playerList(): PlayerInfo[] {
    return [...this.players.values()]
      .map(({ playerId, name, color, connected, ready, deck }) => ({ playerId, name, color, connected, ready, deck }))
      .sort((a, b) => a.playerId - b.playerId);
  }

  private broadcastPlayers(): void {
    this.broadcast("players", this.playerList());
    void this.publishMetadata();
  }

  private lowestPlayerId(): number {
    return this.playerList()[0]?.playerId ?? 0;
  }

  private connectedCount(): number {
    return [...this.players.values()].filter((p) => p.connected).length;
  }

  private publishMetadata(): Promise<void> {
    const metadata: RoomMetadata = {
      code: this.roomId,
      seed: this.sim.seed,
      map: this.mapId,
      phase: this.phase,
      players: this.players.size,
      connected: this.connectedCount(),
      wave: this.sim.wave,
    };
    return this.setMetadata(metadata);
  }
}

/** A copy of the deck when it is a valid co-op deck; null otherwise. */
function validDeck(value: unknown): Deck | null {
  const deck = value as Deck | undefined;
  if (deckProblem(deck, DECK.coopTowers) !== null) return null;
  return { towers: [...deck!.towers], abilities: [...deck!.abilities] };
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
      return {
        type: "build",
        tick,
        playerId,
        tower: v["tower"] as CommandRequest extends { tower: infer T } ? T : never,
        x: v["x"] as number,
        y: v["y"] as number,
      };
    case "callWave":
      return { type: "callWave", tick, playerId };
    case "passHost":
      if (!Number.isInteger(v["to"])) return null;
      return { type: "passHost", tick, playerId, to: v["to"] as number };
    case "gift":
      if (!Number.isInteger(v["to"]) || !Number.isInteger(v["amount"])) return null;
      return { type: "gift", tick, playerId, to: v["to"] as number, amount: v["amount"] as number };
    case "sell":
      if (!Number.isInteger(v["towerId"])) return null;
      return { type: "sell", tick, playerId, towerId: v["towerId"] as number };
    case "upgrade": {
      if (!Number.isInteger(v["towerId"])) return null;
      const branch = v["branch"];
      if (branch !== undefined && branch !== "a" && branch !== "b") return null;
      const towerId = v["towerId"] as number;
      return branch === undefined ? { type: "upgrade", tick, playerId, towerId } : { type: "upgrade", tick, playerId, towerId, branch };
    }
    case "useAbility": {
      const ability = v["ability"];
      if (!ABILITY_KINDS.includes(ability as never)) return null;
      const optionalInts = ["x", "y", "towerId"] as const;
      if (optionalInts.some((k) => v[k] !== undefined && !Number.isInteger(v[k]))) return null;
      const cmd: Command = { type: "useAbility", tick, playerId, ability: ability as (typeof ABILITY_KINDS)[number] };
      for (const k of optionalInts) if (v[k] !== undefined) cmd[k] = v[k] as number;
      return cmd;
    }
    case "chooseDoctrine": {
      const doctrine = v["doctrine"];
      if (!DOCTRINE_KINDS.includes(doctrine as never)) return null;
      return { type: "chooseDoctrine", tick, playerId, doctrine: doctrine as (typeof DOCTRINE_KINDS)[number] };
    }
    case "rerollDoctrines":
      return { type: "rerollDoctrines", tick, playerId };
    case "upgradeAbility": {
      const ability = v["ability"];
      if (!ABILITY_KINDS.includes(ability as never)) return null;
      return { type: "upgradeAbility", tick, playerId, ability: ability as (typeof ABILITY_KINDS)[number] };
    }
    default:
      return null;
  }
}
