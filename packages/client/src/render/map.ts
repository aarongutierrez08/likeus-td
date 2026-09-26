import { Graphics } from "pixi.js";
import { getMap, pathCells, type MapId } from "@td/sim";
import { COLORS } from "./colors";

/** Draws the grid and the path once, in world units (BASE px per cell). */
export function drawMap(g: Graphics, mapId: MapId, base: number): void {
  const map = getMap(mapId);
  g.clear();
  g.rect(0, 0, map.width * base, map.height * base).fill(COLORS.buildable);
  const cells = pathCells(mapId);
  for (const c of cells) g.rect(c.x * base, c.y * base, base, base).fill(COLORS.path);
  const spawn = cells[0]!;
  const exit = cells[cells.length - 1]!;
  g.rect(spawn.x * base, spawn.y * base, base, base).fill(COLORS.spawn);
  g.rect(exit.x * base, exit.y * base, base, base).fill(COLORS.exit);
  for (let x = 0; x <= map.width; x++) g.moveTo(x * base, 0).lineTo(x * base, map.height * base);
  for (let y = 0; y <= map.height; y++) g.moveTo(0, y * base).lineTo(map.width * base, y * base);
  g.stroke({ width: 1, color: COLORS.gridLine });
}
