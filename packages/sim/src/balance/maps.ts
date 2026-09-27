export interface Point {
  x: number;
  y: number;
}

export interface MapDef {
  width: number;
  height: number;
  /** Axis-aligned polyline. First point is the spawn, last is the exit. */
  waypoints: readonly Point[];
}

export const MAPS = {
  /** The reference map: 57 cells in an S. */
  s: {
    width: 20,
    height: 12,
    waypoints: [
      { x: 0, y: 1 },
      { x: 17, y: 1 },
      { x: 17, y: 5 },
      { x: 2, y: 5 },
      { x: 2, y: 9 },
      { x: 19, y: 9 },
    ],
  },
  /** Four passes, 79 cells: long, forgiving, rewards area damage on the turns. */
  zigzag: {
    width: 20,
    height: 12,
    waypoints: [
      { x: 0, y: 1 },
      { x: 18, y: 1 },
      { x: 18, y: 4 },
      { x: 1, y: 4 },
      { x: 1, y: 7 },
      { x: 18, y: 7 },
      { x: 18, y: 10 },
      { x: 0, y: 10 },
    ],
  },
  /** One bend, 30 cells: short and brutal; every tower must count. */
  directo: {
    width: 20,
    height: 12,
    waypoints: [
      { x: 0, y: 3 },
      { x: 10, y: 3 },
      { x: 10, y: 8 },
      { x: 19, y: 8 },
    ],
  },
} as const satisfies Record<string, MapDef>;

export const MAP_IDS = Object.keys(MAPS) as MapId[];

export type MapId = keyof typeof MAPS;

export const DEFAULT_MAP: MapId = "s";

export function isMapId(id: string): id is MapId {
  return Object.prototype.hasOwnProperty.call(MAPS, id);
}
