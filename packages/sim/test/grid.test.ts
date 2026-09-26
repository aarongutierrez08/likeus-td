import { describe, expect, it } from "vitest";
import { FP, MAPS, TICKS_PER_SECOND, isBuildable, pathCells } from "../src/index";
import { scenario } from "./helpers/scenario";

const exit = MAPS.s.waypoints[MAPS.s.waypoints.length - 1]!;

describe("map", () => {
  it("map s is 20x12 and its path connects spawn to exit one cell at a time", () => {
    expect(MAPS.s.width).toBe(20);
    expect(MAPS.s.height).toBe(12);
    const cells = pathCells("s");
    expect(cells[0]).toEqual(MAPS.s.waypoints[0]);
    expect(cells[cells.length - 1]).toEqual(exit);
    for (let i = 1; i < cells.length; i++) {
      const previous = cells[i - 1]!;
      const current = cells[i]!;
      expect(Math.abs(previous.x - current.x) + Math.abs(previous.y - current.y)).toBe(1);
    }
  });

  it("path cells are not buildable, other cells inside the map are, outside is not", () => {
    for (const c of pathCells("s")) expect(isBuildable("s", c.x, c.y)).toBe(false);
    expect(isBuildable("s", 0, 0)).toBe(true);
    expect(isBuildable("s", 20, 0)).toBe(false);
    expect(isBuildable("s", -1, 3)).toBe(false);
    expect(isBuildable("s", 1.5, 3)).toBe(false);
  });

  it("an enemy walks the path one cell per second at normal speed", () => {
    const walker = scenario({ seed: 1 }).enemy("normal", { x: 3, y: 1 }).run(TICKS_PER_SECOND);
    expect(walker.enemy(0).progress).toBe(4 * FP);
  });

  it("an enemy on the exit cell leaks on the next tick", () => {
    const leaker = scenario({ seed: 1 }).enemy("normal", { x: exit.x, y: exit.y }).run(1);
    expect(leaker.alive(0)).toBe(false);
    expect(leaker.lives()).toBe(19);
  });

  it("enemies cannot be placed off the path", () => {
    expect(() => scenario({ seed: 1 }).enemy("normal", { x: 0, y: 0 }).run(1)).toThrow(/not a path cell/);
  });
});
