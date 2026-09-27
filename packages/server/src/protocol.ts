import type { Command, GameState, RejectReason, TowerKind } from "@td/sim";

/** Wire protocol between GameRoom and the client. Types and constants only: no Colyseus imports. */

export const ROOM_NAME = "game";
export const PLAYER_LIMIT = 8;
export const HASH_EVERY_TICKS = 20;
export const MAX_COMMANDS_PER_TICK = 4;
export const RECONNECT_SECONDS = 30;
export const MAX_CHAT_LENGTH = 200;
export const MAX_NAME_LENGTH = 16;
/** Letters that are hard to confuse when read aloud or typed. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export const ROOM_CODE_LENGTH = 4;
/** WebSocket close code used when the creator kicks a player; the client must not reconnect. */
export const KICKED_CLOSE_CODE = 4100;

export type Phase = "lobby" | "playing" | "ended";

export interface PlayerInfo {
  playerId: number;
  name: string;
  connected: boolean;
  /** Marked in the lobby and on the end screen; start and restart wait for every connected player. */
  ready: boolean;
}

export interface CreateRoomOptions {
  seed?: number;
  private?: boolean;
  name?: string;
  map?: string;
}

export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

export interface JoinRoomOptions {
  name?: string;
}

export interface RoomMetadata {
  code: string;
  seed: number;
  map: string;
  phase: Phase;
  /** Seats taken, reconnection reservations included: what decides whether you can join. */
  players: number;
  /** Players currently online. */
  connected: number;
  wave: number;
}

export interface SnapshotMessage {
  state: GameState;
  players: PlayerInfo[];
  you: number;
  creator: number;
  phase: Phase;
  speed: Speed;
}

export interface TickMessage {
  tick: number;
  commands: Command[];
  hash?: string;
}

export interface ChatMessage {
  playerId: number;
  name: string;
  text: string;
}

export type CommandReject = RejectReason | "rate_limited" | "not_playing" | "bad_shape";

export interface RejectedMessage {
  reason: CommandReject;
}

export interface BuildRequest {
  type: "build";
  tower: TowerKind;
  x: number;
  y: number;
}

export interface CallWaveRequest {
  type: "callWave";
}

export interface GiftRequest {
  type: "gift";
  to: number;
  amount: number;
}

export interface SellRequest {
  type: "sell";
  towerId: number;
}

export interface UpgradeRequest {
  type: "upgrade";
  towerId: number;
}

export type CommandRequest = BuildRequest | CallWaveRequest | GiftRequest | SellRequest | UpgradeRequest;

export interface DesyncReport {
  tick: number;
  hash: string;
  /** dumpState() of the client at that tick, for side-by-side diagnosis. */
  dump?: string;
}

export type ReportReason = "manual" | "client_error" | "desync" | "server_error";

/** What a client sends when someone presses "Reportar problema" or an uncaught error fires. */
export interface ReportRequest {
  reason: "manual" | "client_error";
  message: string;
  clientTick: number;
  clientHash: string;
  clientDump: string;
  errors: string[];
  userAgent: string;
}

export interface ReportedMessage {
  ref: string;
}

/** One accepted-commands entry of the room history; ticks without commands are omitted. */
export interface HistoryEntry {
  tick: number;
  commands: Command[];
}

/**
 * Everything needed to replay a game to the reported tick: `initialState` plus `history`,
 * because the sim is deterministic. Written to a file locally or to a GitHub issue in production.
 */
export interface BugReport {
  at: string;
  reason: ReportReason;
  message: string;
  code: string;
  seed: number;
  balanceVersion: number;
  commit: string;
  reporter: number | null;
  players: PlayerInfo[];
  phase: Phase;
  serverTick: number;
  serverHash: string;
  serverDump: string;
  clientTick: number | null;
  clientHash: string | null;
  clientDump: string | null;
  errors: string[];
  userAgent: string | null;
  initialState: GameState | null;
  history: HistoryEntry[];
  historyTruncated: boolean;
}

export interface ServerMessages {
  snapshot: SnapshotMessage;
  tick: TickMessage;
  players: PlayerInfo[];
  phase: Phase;
  chat: ChatMessage;
  rejected: RejectedMessage;
  reported: ReportedMessage;
  /** Simulation speed multiplier chosen by the creator. */
  speed: Speed;
}

export interface ClientMessages {
  cmd: CommandRequest;
  chat: { text: string };
  start: Record<string, never>;
  kick: { playerId: number };
  desync: DesyncReport;
  report: ReportRequest;
  setSpeed: { speed: Speed };
  /** Creator only: back to the lobby with the same players and a fresh seed. */
  restart: Record<string, never>;
  ready: { ready: boolean };
}
