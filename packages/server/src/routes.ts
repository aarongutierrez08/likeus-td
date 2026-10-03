import { createEndpoint, createRouter, matchMaker } from "@colyseus/core";
import { LOGIN_COOKIE, type Accounts, type HttpResult } from "./accounts/service";
import { dailyBoard } from "./solo";
import { ROOM_NAME, type RoomMetadata, type SoloSubmission } from "./protocol";

/** The parts of an endpoint's context these routes read. */
interface Ctx {
  headers?: Headers;
  body?: unknown;
  query?: unknown;
  params?: unknown;
}

export interface RoomListing {
  rooms: RoomMetadata[];
}

function send(result: HttpResult): Response {
  if (result.redirect) {
    const headers = new Headers({ location: result.redirect });
    if (result.cookie) headers.set("set-cookie", result.cookie);
    return new Response(null, { status: result.status, headers });
  }
  return Response.json(result.body ?? {}, { status: result.status });
}

/** The session token, from the Authorization header only: a session never travels in an address. */
function tokenOf(headers: Headers | undefined): string | null {
  const header = headers?.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
}

/** GET /rooms: public, unlocked rooms for the lobby list. Colyseus 0.18 has no built-in listing route. */
const listRooms = createEndpoint("/rooms", { method: "GET" }, async () => {
  const caches = await matchMaker.query({ name: ROOM_NAME, private: false, locked: false });
  const rooms = caches.map((cache) => cache.metadata as RoomMetadata).filter((room) => room.phase !== "ended");
  const listing: RoomListing = { rooms };
  return Response.json(listing);
});

/** One query parameter as text; repeated or missing parameters count as absent. */
function textParam(ctx: Ctx, name: string): string | null {
  const value = ((ctx.query ?? {}) as Record<string, unknown>)[name];
  return typeof value === "string" ? value : null;
}

/** The value of one cookie the browser sent. */
function cookieOf(headers: Headers | undefined, name: string): string | null {
  for (const part of headers?.get("cookie")?.split(";") ?? []) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

export function createGameRouter(accounts: Accounts) {
  const body = (ctx: Ctx) => (ctx.body ?? {}) as Record<string, unknown>;
  const param = (ctx: Ctx, name: string) => (ctx.params as Record<string, string> | undefined)?.[name] ?? "";
  const at = (path: string, method: "GET" | "POST", handle: (ctx: Ctx) => HttpResult | Promise<HttpResult>) =>
    createEndpoint(path, { method }, async (ctx) => send(await handle(ctx as unknown as Ctx)));
  return createRouter({
    listRooms,
    /** GET /daily: today's top of the daily challenge. */
    getDaily: createEndpoint("/daily", { method: "GET" }, () => Promise.resolve(Response.json(dailyBoard(accounts.boards)))),
    /** POST /daily and /games/solo: a finished solo game; the server replays it and records what it computed. */
    postDaily: at("/daily", "POST", (ctx) => accounts.submitSolo(tokenOf(ctx.headers), { ...(ctx.body as SoloSubmission), kind: "daily" })),
    postSolo: at("/games/solo", "POST", (ctx) => accounts.submitSolo(tokenOf(ctx.headers), ctx.body as SoloSubmission)),
    guest: at("/auth/guest", "POST", (ctx) => accounts.createGuest(body(ctx)["name"])),
    me: at("/me", "GET", (ctx) => accounts.me(tokenOf(ctx.headers))),
    updateMe: at("/me", "POST", (ctx) => accounts.update(tokenOf(ctx.headers), body(ctx))),
    history: at("/me/history", "GET", (ctx) => accounts.history(tokenOf(ctx.headers))),
    logout: at("/me/logout", "POST", (ctx) => accounts.logout(tokenOf(ctx.headers))),
    deleteMe: at("/me/delete", "POST", (ctx) => accounts.deleteAccount(tokenOf(ctx.headers))),
    replay: at("/replays/:id", "GET", (ctx) => accounts.replay(Number(param(ctx, "id")))),
    loginClaim: at("/auth/claim", "POST", (ctx) => accounts.claimLogin(tokenOf(ctx.headers), body(ctx)["claim"])),
    loginTicket: at("/auth/:provider/ticket", "POST", (ctx) =>
      accounts.loginTicket(param(ctx, "provider"), tokenOf(ctx.headers), body(ctx)["returnTo"]),
    ),
    loginStart: at("/auth/:provider/start", "GET", (ctx) => accounts.startLogin(param(ctx, "provider"), textParam(ctx, "ticket"))),
    loginCallback: at("/auth/:provider/callback", "GET", (ctx) =>
      accounts.finishLogin(param(ctx, "provider"), textParam(ctx, "code"), textParam(ctx, "state"), cookieOf(ctx.headers, LOGIN_COOKIE)),
    ),
  });
}
