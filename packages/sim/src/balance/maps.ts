export interface Point {
  x: number;
  y: number;
}

/**
 * A longer way around a stretch of the path. Opening it replaces the waypoints from `from` to `to` (indices into the
 * map's own waypoints, both kept) with `via`. While closed its cells take towers but block opening; once open, `via`
 * is path and the stretch it skips is never buildable.
 */
export interface DetourDef {
  label: string;
  from: number;
  to: number;
  via: readonly Point[];
}

export interface MapDef {
  width: number;
  height: number;
  /** Axis-aligned polyline. First point is the spawn, last is the exit. */
  waypoints: readonly Point[];
  /** Bounded non-linearity (design: casillas de desvío): a couple per map, never overlapping. */
  detours: readonly DetourDef[];
}

/** What opening a detour costs the host. Permanent for the game. */
export const DETOUR = { cost: 120 } as const;

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
    detours: [
      {
        label: "rodeo de arriba",
        from: 0,
        to: 1,
        via: [
          { x: 6, y: 1 },
          { x: 6, y: 3 },
          { x: 12, y: 3 },
          { x: 12, y: 1 },
        ],
      },
      {
        label: "rodeo de abajo",
        from: 4,
        to: 5,
        via: [
          { x: 8, y: 9 },
          { x: 8, y: 11 },
          { x: 14, y: 11 },
          { x: 14, y: 9 },
        ],
      },
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
    detours: [
      {
        label: "rodeo de arriba",
        from: 0,
        to: 1,
        via: [
          { x: 6, y: 1 },
          { x: 6, y: 2 },
          { x: 12, y: 2 },
          { x: 12, y: 1 },
        ],
      },
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
    detours: [
      {
        label: "rodeo de entrada",
        from: 0,
        to: 1,
        via: [
          { x: 3, y: 3 },
          { x: 3, y: 0 },
          { x: 7, y: 0 },
          { x: 7, y: 3 },
        ],
      },
      {
        label: "rodeo de salida",
        from: 2,
        to: 3,
        via: [
          { x: 13, y: 8 },
          { x: 13, y: 11 },
          { x: 16, y: 11 },
          { x: 16, y: 8 },
        ],
      },
    ],
  },
} as const satisfies Record<string, MapDef>;

export const MAP_IDS = Object.keys(MAPS) as MapId[];

export type MapId = keyof typeof MAPS;

export const DEFAULT_MAP: MapId = "s";

export function isMapId(id: string): id is MapId {
  return Object.prototype.hasOwnProperty.call(MAPS, id);
}
