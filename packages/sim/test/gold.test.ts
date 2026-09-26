import { describe, expect, it } from "vitest";
import { ENEMIES, MAPS, TOWERS } from "../src/index";
import { scenario } from "./helpers/scenario";

const exit = MAPS.s.waypoints[MAPS.s.waypoints.length - 1]!;

describe("gold", () => {
  it("killing an enemy pays its bounty into the shared pool", () => {
    const game = scenario({ seed: 1, gold: 0 })
      .tower("archer", { x: 4, y: 2 })
      .enemy("fast", { x: 4, y: 1, hp: TOWERS.archer.damage })
      .run(1);
    expect(game.alive(0)).toBe(false);
    expect(game.gold(0)).toBe(ENEMIES.fast.bounty);
    expect(game.state().stats.kills).toBe(1);
    expect(game.state().stats.goldEarned).toBe(ENEMIES.fast.bounty);
    expect(game.tower(0).kills).toBe(1);
  });

  it("a leaked enemy pays nothing", () => {
    const game = scenario({ seed: 1, gold: 0 }).enemy("normal", exit).run(1);
    expect(game.gold()).toBe(0);
    expect(game.state().stats.kills).toBe(0);
  });

  it("a splash that kills two enemies pays both bounties once each", () => {
    const game = scenario({ seed: 1, gold: 0 })
      .tower("cannon", { x: 5, y: 3 })
      .enemy("normal", { x: 5, y: 1, hp: TOWERS.cannon.damage })
      .enemy("normal", { x: 5, y: 1, hp: TOWERS.cannon.damage })
      .run(1);
    expect(game.enemies()).toHaveLength(0);
    expect(game.gold()).toBe(ENEMIES.normal.bounty * 2);
    expect(game.tower(0).kills).toBe(2);
  });

  it("the kill is credited to the tower that lands the last hit", () => {
    const game = scenario({ seed: 1, gold: 0 })
      .tower("archer", { x: 5, y: 2 })
      .tower("archer", { x: 6, y: 2 })
      .enemy("normal", { x: 5, y: 1, hp: TOWERS.archer.damage * 2 })
      .run(1);
    expect(game.alive(0)).toBe(false);
    expect(game.tower(0).kills).toBe(0);
    expect(game.tower(1).kills).toBe(1);
  });
});
