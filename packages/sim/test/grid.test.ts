import { describe, expect, it } from "vitest";
import { ENEMIES, MAPS, MAP_IDS, TICKS_PER_SECOND, isBuildable, isInside, pathCells } from "../src/index";
import { scenario } from "./helpers/scenario";

const exit = MAPS.s.waypoints[MAPS.s.waypoints.length - 1]!;

describe("map", () => {
  it("map s is 20x12", () => {
    expect(MAPS.s.width).toBe(20);
    expect(MAPS.s.height).toBe(12);
  });

  it("every map's path stays inside the grid and connects spawn to exit one cell at a time", () => {
    for (const id of MAP_IDS) {
      const map = MAPS[id];
      const cells = pathCells(id);
      expect(cells[0]).toEqual(map.waypoints[0]);
      expect(cells[cells.length - 1]).toEqual(map.waypoints[map.waypoints.length - 1]);
      for (const c of cells) expect(isInside(id, c.x, c.y)).toBe(true);
      for (let i = 1; i < cells.length; i++) {
        const previous = cells[i - 1]!;
        const current = cells[i]!;
        expect(Math.abs(previous.x - current.x) + Math.abs(previous.y - current.y)).toBe(1);
      }
      expect(new Set(cells.map((c) => `${c.x},${c.y}`)).size).toBe(cells.length);
    }
  });

  it("a game can be created on every map and its enemies walk to the exit", () => {
    for (const id of MAP_IDS) {
      const game = scenario({ seed: 1, map: id }).enemy("fast", { x: MAPS[id].waypoints[0].x, y: MAPS[id].waypoints[0].y }).run(2000);
      expect(game.alive(0)).toBe(false);
      expect(game.lives()).toBe(19);
    }
  });

  it("path cells are not buildable, other cells inside the map are, outside is not", () => {
    for (const c of pathCells("s")) expect(isBuildable("s", c.x, c.y)).toBe(false);
    expect(isBuildable("s", 0, 0)).toBe(true);
    expect(isBuildable("s", 20, 0)).toBe(false);
    expect(isBuildable("s", -1, 3)).toBe(false);
    expect(isBuildable("s", 1.5, 3)).toBe(false);
  });

  it("an enemy walks the path at a steady pace, the same distance every second", () => {
    const walker = scenario({ seed: 1 }).enemy("normal", { x: 3, y: 1 });
    const start = walker.run(0).enemy(0).progress;
    const afterOneSecond = walker.run(TICKS_PER_SECOND).enemy(0).progress;
    const afterTwoSeconds = walker.run(TICKS_PER_SECOND).enemy(0).progress;
    expect(afterOneSecond).toBeGreaterThan(start);
    expect(afterTwoSeconds - afterOneSecond).toBe(afterOneSecond - start);
    expect(afterTwoSeconds - afterOneSecond).toBe(ENEMIES.normal.speed * TICKS_PER_SECOND);
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
