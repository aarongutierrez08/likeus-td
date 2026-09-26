import type { Server as HttpServer } from "node:http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./GameRoom";
import { ROOM_NAME } from "./protocol";
import { createGameRouter } from "./routes";

/** One Colyseus server bound to the given HTTP server; shared by the entry point and the tests. */
export function createGameServer(httpServer: HttpServer): Server {
  const gameServer = new Server({
    transport: new WebSocketTransport({ server: httpServer }),
  });
  gameServer.router = createGameRouter();
  gameServer.define(ROOM_NAME, GameRoom);
  return gameServer;
}
