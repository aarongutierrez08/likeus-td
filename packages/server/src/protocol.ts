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
}

export interface CreateRoomOptions {
  seed?: number;
  private?: boolean;
  name?: string;
}

export interface JoinRoomOptions {
  name?: string;
}

export interface RoomMetadata {
  code: string;
  seed: number;
  phase: Phase;
  players: number;
  wave: number;
}

export interface SnapshotMessage {
  state: GameState;
  players: PlayerInfo[];
  you: number;
  creator: number;
  phase: Phase;
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
}

export interface ServerMessages {
  snapshot: SnapshotMessage;
  tick: TickMessage;
  players: PlayerInfo[];
  phase: Phase;
  chat: ChatMessage;
  rejected: RejectedMessage;
}

export interface ClientMessages {
  cmd: CommandRequest;
  chat: { text: string };
  start: Record<string, never>;
  kick: { playerId: number };
  desync: DesyncReport;
}
