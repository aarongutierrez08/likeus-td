import { createEndpoint, createRouter, matchMaker } from "@colyseus/core";
import { ROOM_NAME, type RoomMetadata } from "./protocol";

export interface RoomListing {
  rooms: RoomMetadata[];
}

/** GET /rooms: public, unlocked rooms for the lobby list. Colyseus 0.18 has no built-in listing route. */
const listRooms = createEndpoint("/rooms", { method: "GET" }, async () => {
  const caches = await matchMaker.query({ name: ROOM_NAME, private: false, locked: false });
  const listing: RoomListing = { rooms: caches.map((cache) => cache.metadata as RoomMetadata) };
  return Response.json(listing);
});

export function createGameRouter() {
  return createRouter({ listRooms });
}
