import { MAPS, type MapDef, type MapId, type Point } from "./balance/maps";

interface GridInfo {
  pathCells: Point[];
  pathSet: Set<number>;
  distanceToPath: number[];
}

const cache = new Map<MapId, GridInfo>();

export function getMap(mapId: MapId): MapDef {
  return MAPS[mapId];
}

function cellKey(map: MapDef, x: number, y: number): number {
  return y * map.width + x;
}

function buildGridInfo(map: MapDef): GridInfo {
  const pathCells: Point[] = [];
  const pathSet = new Set<number>();
  const push = (x: number, y: number): void => {
    const key = cellKey(map, x, y);
    if (pathSet.has(key)) return;
    pathSet.add(key);
    pathCells.push({ x, y });
  };
  for (let i = 0; i + 1 < map.waypoints.length; i++) {
    const a = map.waypoints[i]!;
    const b = map.waypoints[i + 1]!;
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
  return { pathCells, pathSet, distanceToPath };
}

function gridInfo(mapId: MapId): GridInfo {
  let info = cache.get(mapId);
  if (!info) {
    info = buildGridInfo(MAPS[mapId]);
    cache.set(mapId, info);
  }
  return info;
}

export function isInside(mapId: MapId, x: number, y: number): boolean {
  const map = MAPS[mapId];
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < map.width && y < map.height;
}

export function isPathCell(mapId: MapId, x: number, y: number): boolean {
  return isInside(mapId, x, y) && gridInfo(mapId).pathSet.has(cellKey(MAPS[mapId], x, y));
}

export function isBuildable(mapId: MapId, x: number, y: number): boolean {
  return isInside(mapId, x, y) && !isPathCell(mapId, x, y);
}

/** Cells of the path in walking order, spawn first. */
export function pathCells(mapId: MapId): readonly Point[] {
  return gridInfo(mapId).pathCells;
}

/** Manhattan distance from a cell to the nearest path cell (0 on the path). */
export function distanceToPath(mapId: MapId, x: number, y: number): number {
  return gridInfo(mapId).distanceToPath[cellKey(MAPS[mapId], x, y)] ?? Number.MAX_SAFE_INTEGER;
}

/** Index of a cell along the path (0 at the spawn), or -1 when it is not a path cell. */
export function pathIndex(mapId: MapId, x: number, y: number): number {
  if (!isPathCell(mapId, x, y)) return -1;
  return gridInfo(mapId).pathCells.findIndex((c) => c.x === x && c.y === y);
}
