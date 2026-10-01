import { FP } from "./constants";
import type { Point } from "./balance/maps";
import { getMap, type RouteKey } from "./grid";

interface Segment {
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  start: number;
  length: number;
}

interface PathInfo {
  segments: Segment[];
  length: number;
}

const cache = new Map<RouteKey, PathInfo>();

function cellCenter(v: number): number {
  return v * FP + FP / 2;
}

function buildPathInfo(route: RouteKey): PathInfo {
  const wps = getMap(route).waypoints;
  const segments: Segment[] = [];
  let start = 0;
  for (let i = 0; i + 1 < wps.length; i++) {
    const a = wps[i]!;
    const b = wps[i + 1]!;
    const length = (Math.abs(b.x - a.x) + Math.abs(b.y - a.y)) * FP;
    segments.push({
      x0: cellCenter(a.x),
      y0: cellCenter(a.y),
      dx: Math.sign(b.x - a.x),
      dy: Math.sign(b.y - a.y),
      start,
      length,
    });
    start += length;
  }
  return { segments, length: start };
}

function pathInfo(route: RouteKey): PathInfo {
  let info = cache.get(route);
  if (!info) {
    info = buildPathInfo(route);
    cache.set(route, info);
  }
  return info;
}

/** Total walking distance from spawn center to exit center, in FP units. */
export function pathLength(route: RouteKey): number {
  return pathInfo(route).length;
}

/** Position in FP units for a given progress along the path. Clamped to the path ends. */
export function positionAt(route: RouteKey, progress: number): Point {
  const { segments, length } = pathInfo(route);
  const p = Math.max(0, Math.min(progress, length));
  let seg = segments[segments.length - 1]!;
  for (const s of segments) {
    if (p < s.start + s.length) {
      seg = s;
      break;
    }
  }
  const t = p - seg.start;
  return { x: seg.x0 + seg.dx * t, y: seg.y0 + seg.dy * t };
}

export function cellCenterFP(cell: number): number {
  return cellCenter(cell);
}
