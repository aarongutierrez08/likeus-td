import { MAPS, type MapDef, type MapId, type Point } from "./balance/maps";
import type { GameState } from "./types";

/**
 * A map plus the detours open on it: "s" is the plain map, "s+0,1" the same map with detours 0 and 1 open.
 * Every path query takes a route, so a plain map id is a valid route too.
 */
export type RouteKey = string;

interface GridInfo {
  map: MapDef;
  pathCells: Point[];
  pathSet: Set<number>;
  distanceToPath: number[];
}

const cache = new Map<RouteKey, GridInfo>();
const skippedCache = new Map<RouteKey, Set<number>>();

/** The route enemies walk in this game: its map with the detours opened so far. */
export function routeOf(state: GameState): RouteKey {
  return routeKey(state.mapId, state.detours);
}

export function routeKey(mapId: MapId, detours: readonly number[]): RouteKey {
  return detours.length === 0 ? mapId : `${mapId}+${[...detours].sort((a, b) => a - b).join(",")}`;
}

/** The map id and the open detours of a route, detours in ascending order. */
export function parseRoute(route: RouteKey): { mapId: MapId; detours: number[] } {
  const [mapId, open] = route.split("+") as [MapId, string | undefined];
  return { mapId, detours: open ? open.split(",").map(Number) : [] };
}

const mapCache = new Map<RouteKey, MapDef>();

/** The map with the waypoints of its open detours swapped in; detours replace from the last one so indices hold. */
export function getMap(route: RouteKey): MapDef {
  let map = mapCache.get(route);
  if (!map) {
    map = resolveMap(route);
    mapCache.set(route, map);
  }
  return map;
}

function resolveMap(route: RouteKey): MapDef {
  const { mapId, detours } = parseRoute(route);
  const base: MapDef = MAPS[mapId];
  if (detours.length === 0) return base;
  let waypoints: Point[] = [...base.waypoints];
  for (const index of [...detours].sort((a, b) => b - a)) {
    const detour = base.detours[index]!;
    waypoints = [...waypoints.slice(0, detour.from + 1), ...detour.via, ...waypoints.slice(detour.to)];
  }
  return { ...base, waypoints };
}

function cellKey(map: MapDef, x: number, y: number): number {
  return y * map.width + x;
}

/** Every cell an axis-aligned polyline walks through, in order and without repeats. */
function walk(points: readonly Point[]): Point[] {
  const cells: Point[] = [];
  const seen = new Set<string>();
  const push = (x: number, y: number): void => {
    const key = `${x},${y}`;
    if (seen.has(key)) return;
    seen.add(key);
    cells.push({ x, y });
  };
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    let x = a.x;
    let y = a.y;
    push(x, y);
    while (x !== b.x || y !== b.y) {
      x += dx;
      y += dy;
      push(x, y);
    }
  }
  return cells;
}

function buildGridInfo(map: MapDef): GridInfo {
  const pathCells = walk(map.waypoints);
  const pathSet = new Set(pathCells.map((c) => cellKey(map, c.x, c.y)));
  const distanceToPath: number[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      let best = Number.MAX_SAFE_INTEGER;
      for (const p of pathCells) {
        const d = Math.abs(p.x - x) + Math.abs(p.y - y);
        if (d < best) best = d;
      }
      distanceToPath[cellKey(map, x, y)] = best;
    }
  }
  return { map, pathCells, pathSet, distanceToPath };
}

function gridInfo(route: RouteKey): GridInfo {
  let info = cache.get(route);
  if (!info) {
    info = buildGridInfo(getMap(route));
    cache.set(route, info);
  }
  return info;
}

/** Cells a detour adds to the path (`via`) and the old cells it leaves behind once open (`skipped`). */
export function detourCells(mapId: MapId, index: number): { via: Point[]; skipped: Point[] } {
  const map: MapDef = MAPS[mapId];
  const detour = map.detours[index]!;
  const from = map.waypoints[detour.from]!;
  const to = map.waypoints[detour.to]!;
  const before = walk(map.waypoints.slice(detour.from, detour.to + 1));
  const after = walk([from, ...detour.via, to]);
  const has = (cells: Point[], c: Point): boolean => cells.some((d) => d.x === c.x && d.y === c.y);
  return { via: after.filter((c) => !has(before, c)), skipped: before.filter((c) => !has(after, c)) };
}

/** The old stretches the open detours skip: off the path and never buildable again. */
function skipped(route: RouteKey): Set<number> {
  let set = skippedCache.get(route);
  if (!set) {
    const { mapId, detours } = parseRoute(route);
    const map: MapDef = MAPS[mapId];
    set = new Set<number>();
    for (const i of detours) for (const c of detourCells(mapId, i).skipped) set.add(cellKey(map, c.x, c.y));
    skippedCache.set(route, set);
  }
  return set;
}

export function isInside(route: RouteKey, x: number, y: number): boolean {
  const map = getMap(route);
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < map.width && y < map.height;
}

export function isPathCell(route: RouteKey, x: number, y: number): boolean {
  return isInside(route, x, y) && gridInfo(route).pathSet.has(cellKey(gridInfo(route).map, x, y));
}

/** Whether this cell is a stretch of old path that an open detour skips. */
export function isSkippedCell(route: RouteKey, x: number, y: number): boolean {
  return isInside(route, x, y) && skipped(route).has(cellKey(gridInfo(route).map, x, y));
}

export function isBuildable(route: RouteKey, x: number, y: number): boolean {
  return isInside(route, x, y) && !isPathCell(route, x, y) && !isSkippedCell(route, x, y);
}

/** Cells of the path in walking order, spawn first. */
export function pathCells(route: RouteKey): readonly Point[] {
  return gridInfo(route).pathCells;
}

/** Manhattan distance from a cell to the nearest path cell (0 on the path). */
export function distanceToPath(route: RouteKey, x: number, y: number): number {
  const info = gridInfo(route);
  return info.distanceToPath[cellKey(info.map, x, y)] ?? Number.MAX_SAFE_INTEGER;
}

/** Index of a cell along the path (0 at the spawn), or -1 when it is not a path cell. */
export function pathIndex(route: RouteKey, x: number, y: number): number {
  if (!isPathCell(route, x, y)) return -1;
  return gridInfo(route).pathCells.findIndex((c) => c.x === x && c.y === y);
}
