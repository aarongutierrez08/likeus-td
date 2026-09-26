import { Client, type Room } from "@colyseus/sdk";
import type {
  ChatMessage,
  ClientMessages,
  Phase,
  PlayerInfo,
  RejectedMessage,
  RoomMetadata,
  SnapshotMessage,
  TickMessage,
} from "@td/server/protocol";
import { KICKED_CLOSE_CODE, ROOM_NAME } from "@td/server/protocol";

export interface RoomHandlers {
  snapshot(msg: SnapshotMessage): void;
  tick(msg: TickMessage): void;
  players(list: PlayerInfo[]): void;
  phase(phase: Phase): void;
  chat(msg: ChatMessage): void;
  rejected(msg: RejectedMessage): void;
  left(code: number, kicked: boolean): void;
}

const TOKEN_KEY_PREFIX = "td:reconnect:";

function defaultEndpoint(): string {
  const configured = (import.meta.env["VITE_SERVER_URL"] as string | undefined) ?? (window as { __VITE_SERVER_URL?: string }).__VITE_SERVER_URL;
  if (configured) return configured;
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${location.hostname}:2567`;
}

function httpEndpoint(wsEndpoint: string): string {
  return wsEndpoint.replace(/^ws/, "http");
}

function readToken(code: string): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY_PREFIX + code);
  } catch {
    return null;
  }
}

function writeToken(code: string, token: string | null): void {
  try {
    if (token === null) sessionStorage.removeItem(TOKEN_KEY_PREFIX + code);
    else sessionStorage.setItem(TOKEN_KEY_PREFIX + code, token);
  } catch {
    // storage may be unavailable (private mode); reconnection just won't survive a reload
  }
}

/** Thin wrapper over the Colyseus SDK: one room at a time, typed messages, reconnection token per room code. */
export class Connection {
  private readonly client: Client;
  private readonly endpoint: string;
  room: Room | null = null;

  constructor(endpoint = defaultEndpoint()) {
    this.endpoint = endpoint;
    this.client = new Client(endpoint);
  }

  get code(): string | null {
    return this.room?.roomId ?? null;
  }

  async listRooms(): Promise<RoomMetadata[]> {
    const response = await fetch(`${httpEndpoint(this.endpoint)}/rooms`);
    if (!response.ok) throw new Error(`rooms list failed: ${response.status}`);
    const body = (await response.json()) as { rooms: RoomMetadata[] };
    return body.rooms;
  }

  async create(opts: { name: string; private: boolean }, handlers: RoomHandlers): Promise<string> {
    return this.attach(await this.client.create(ROOM_NAME, opts), handlers);
  }

  async join(code: string, name: string, handlers: RoomHandlers): Promise<string> {
    return this.attach(await this.client.joinById(code, { name }), handlers);
  }

  /** Reconnects with the stored token for that code, or joins fresh when there is none. */
  async rejoin(code: string, name: string, handlers: RoomHandlers): Promise<string> {
    const token = readToken(code);
    if (token) {
      try {
        return this.attach(await this.client.reconnect(token), handlers);
      } catch {
        writeToken(code, null);
      }
    }
    return this.join(code, name, handlers);
  }

  send<K extends keyof ClientMessages>(type: K, payload: ClientMessages[K]): void {
    const room = this.room as { send(type: string, payload: unknown): void } | null;
    room?.send(type, payload);
  }

  async leave(): Promise<void> {
    const room = this.room;
    this.room = null;
    if (room) {
      writeToken(room.roomId, null);
      await room.leave(true).catch(() => undefined);
    }
  }

  private attach(room: Room, handlers: RoomHandlers): string {
    this.room = room;
    writeToken(room.roomId, room.reconnectionToken);
    room.onMessage<SnapshotMessage>("snapshot", handlers.snapshot);
    room.onMessage<TickMessage>("tick", handlers.tick);
    room.onMessage<PlayerInfo[]>("players", handlers.players);
    room.onMessage<Phase>("phase", handlers.phase);
    room.onMessage<ChatMessage>("chat", handlers.chat);
    room.onMessage<RejectedMessage>("rejected", handlers.rejected);
    room.onLeave((code) => {
      const kicked = code === KICKED_CLOSE_CODE;
      if (kicked) writeToken(room.roomId, null);
      if (this.room === room) this.room = null;
      handlers.left(code, kicked);
    });
    return room.roomId;
  }
}
