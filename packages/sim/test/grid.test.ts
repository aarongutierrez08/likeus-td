import { describe, expect, it } from "vitest";
import { MAPS } from "../src/balance/maps";
import { distanceToPath, isBuildable, isInside, isPathCell, pathCells } from "../src/grid";
import { FP } from "../src/constants";
import { pathLength, positionAt } from "../src/path";

describe("grid", () => {
  it("map s is 20x12 and its path connects spawn to exit", () => {
    expect(MAPS.s.width).toBe(20);
    expect(MAPS.s.height).toBe(12);
    const cells = pathCells("s");
    const spawn = MAPS.s.waypoints[0]!;
    const exit = MAPS.s.waypoints[MAPS.s.waypoints.length - 1]!;
    expect(cells[0]).toEqual(spawn);
    expect(cells[cells.length - 1]).toEqual(exit);
    for (let i = 1; i < cells.length; i++) {
      const a = cells[i - 1]!;
      const b = cells[i]!;
      expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBe(1);
    }
  });

  it("path cells are not buildable, other inside cells are", () => {
    for (const c of pathCells("s")) {
      expect(isPathCell("s", c.x, c.y)).toBe(true);
      expect(isBuildable("s", c.x, c.y)).toBe(false);
    }
    expect(isBuildable("s", 0, 0)).toBe(true);
    expect(isInside("s", 20, 0)).toBe(false);
    expect(isInside("s", -1, 3)).toBe(false);
    expect(isInside("s", 1.5, 3)).toBe(false);
  });

  it("distanceToPath is zero on the path and one next to it", () => {
    expect(distanceToPath("s", 5, 1)).toBe(0);
    expect(distanceToPath("s", 5, 0)).toBe(1);
    expect(distanceToPath("s", 5, 3)).toBe(2);
  });

  it("positionAt walks the path in cell centers and clamps at the end", () => {
    const start = positionAt("s", 0);
    expect(start).toEqual({ x: FP / 2, y: FP + FP / 2 });
    const oneCell = positionAt("s", FP);
    expect(oneCell).toEqual({ x: FP + FP / 2, y: FP + FP / 2 });
    const end = positionAt("s", pathLength("s"));
    const exit = MAPS.s.waypoints[MAPS.s.waypoints.length - 1]!;
    expect(end).toEqual({ x: exit.x * FP + FP / 2, y: exit.y * FP + FP / 2 });
    expect(positionAt("s", pathLength("s") + 5000)).toEqual(end);
  });
});
