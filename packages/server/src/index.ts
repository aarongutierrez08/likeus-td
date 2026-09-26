import { createServer } from "node:http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./GameRoom";

const PORT = Number.parseInt(process.env["PORT"] ?? "2567", 10);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: createServer() }),
});

gameServer.define("game", GameRoom);

gameServer.listen(PORT).then(() => {
  console.log(`td server listening on ws://localhost:${PORT}`);
});
