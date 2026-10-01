import { Graphics } from "pixi.js";
import { MAPS, detourCells, getMap, parseRoute, pathCells, type RouteKey } from "@td/sim";
import { COLORS } from "./colors";

/** Draws the grid, the path of this route and the detours still closed, in world units (BASE px per cell). */
export function drawMap(g: Graphics, route: RouteKey, base: number): void {
  const map = getMap(route);
  const { mapId, detours } = parseRoute(route);
  g.clear();
  g.rect(0, 0, map.width * base, map.height * base).fill(COLORS.buildable);
  for (let i = 0; i < MAPS[mapId].detours.length; i++) {
    const { via, skipped } = detourCells(mapId, i);
    const open = detours.includes(i);
    for (const c of open ? skipped : via)
      g.rect(c.x * base + 4, c.y * base + 4, base - 8, base - 8).stroke({ width: 2, color: COLORS.detour, alpha: 0.6 });
  }
  const cells = pathCells(route);
  for (const c of cells) g.rect(c.x * base, c.y * base, base, base).fill(COLORS.path);
  const spawn = cells[0]!;
  const exit = cells[cells.length - 1]!;
  g.rect(spawn.x * base, spawn.y * base, base, base).fill(COLORS.spawn);
  g.rect(exit.x * base, exit.y * base, base, base).fill(COLORS.exit);
  for (let x = 0; x <= map.width; x++) g.moveTo(x * base, 0).lineTo(x * base, map.height * base);
  for (let y = 0; y <= map.height; y++) g.moveTo(0, y * base).lineTo(map.width * base, y * base);
  g.stroke({ width: 1, color: COLORS.gridLine });
}
