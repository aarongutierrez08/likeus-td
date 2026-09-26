import { Room, type Client } from "@colyseus/core";
import { createInitialState, type GameState } from "@td/sim";

export interface GameRoomOptions {
  seed?: number;
}

/**
 * Skeleton: one room per match running the shared sim. Command validation,
 * lockstep broadcast and snapshots (ADR 002) arrive in the next phase.
 */
export class GameRoom extends Room {
  private sim: GameState = createInitialState({ seed: 0 });

  override onCreate(options: GameRoomOptions): void {
    this.sim = createInitialState({ seed: options.seed ?? 0 });
    console.log(`room ${this.roomId} created, seed ${this.sim.seed}`);
  }

  override onJoin(client: Client): void {
    console.log(`client ${client.sessionId} joined ${this.roomId}`);
  }

  override onLeave(client: Client): void {
    console.log(`client ${client.sessionId} left ${this.roomId}`);
  }

  override onDispose(): void {
    console.log(`room ${this.roomId} disposed`);
  }
}
