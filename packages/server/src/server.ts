import type { Server as HttpServer } from "node:http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./GameRoom";
import { ROOM_NAME } from "./protocol";
import { createGameRouter } from "./routes";
import { Accounts, setAccounts, type AccountsConfig } from "./accounts/service";

export type { AccountsConfig } from "./accounts/service";

/** Accounts settings from the environment; the database lives on the volume Fly mounts at /data. */
export function accountsConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AccountsConfig {
  return {
    dbPath: env["ACCOUNTS_DB"] ?? "data/accounts.db",
    publicUrl: env["PUBLIC_URL"] ?? `http://localhost:${env["PORT"] ?? "2567"}`,
    clientOrigins: (env["CLIENT_ORIGINS"] ?? "http://localhost:5173").split(",").map((o) => o.trim()),
    env,
  };
}

/** One Colyseus server bound to the given HTTP server; shared by the entry point and the tests. */
export function createGameServer(httpServer: HttpServer, accountsConfig: AccountsConfig = accountsConfigFromEnv()): Server {
  const gameServer = new Server({
    transport: new WebSocketTransport({ server: httpServer }),
  });
  const accounts = new Accounts(accountsConfig);
  setAccounts(accounts);
  gameServer.router = createGameRouter(accounts);
  gameServer.define(ROOM_NAME, GameRoom);
  return gameServer;
}
