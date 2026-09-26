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
} as const satisfies Record<string, MapDef>;

export type MapId = keyof typeof MAPS;

export const DEFAULT_MAP: MapId = "s";

export function isMapId(id: string): id is MapId {
  return Object.prototype.hasOwnProperty.call(MAPS, id);
}
