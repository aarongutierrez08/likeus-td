import { createEndpoint, createRouter, matchMaker } from "@colyseus/core";
import { dailyBoard, submitDaily } from "./daily";
import { ROOM_NAME, type DailySubmission, type RoomMetadata } from "./protocol";

export interface RoomListing {
  rooms: RoomMetadata[];
}

/** GET /rooms: public, unlocked rooms for the lobby list. Colyseus 0.18 has no built-in listing route. */
const listRooms = createEndpoint("/rooms", { method: "GET" }, async () => {
  const caches = await matchMaker.query({ name: ROOM_NAME, private: false, locked: false });
  const rooms = caches.map((cache) => cache.metadata as RoomMetadata).filter((room) => room.phase !== "ended");
  const listing: RoomListing = { rooms };
  return Response.json(listing);
});

/** GET /daily: today's top of the daily challenge. */
const getDaily = createEndpoint("/daily", { method: "GET" }, () => Promise.resolve(Response.json(dailyBoard())));

/** POST /daily: a finished daily game; the server replays it and ranks the score it computes itself. */
const postDaily = createEndpoint("/daily", { method: "POST" }, (ctx) => {
  const result = submitDaily(ctx.body as DailySubmission);
  return Promise.resolve(typeof result === "string" ? Response.json({ error: result }, { status: 400 }) : Response.json(result));
});

export function createGameRouter() {
  return createRouter({ listRooms, getDaily, postDaily });
}
