import { describe, expect, it } from "vitest";
import { TOWERS, validateBuild, type BuildCommand } from "../src/index";
import { scenario } from "./helpers/scenario";

describe("build command", () => {
  it("a valid build spends gold and places the tower", () => {
    const game = scenario({ seed: 1, gold: 100 }).build("archer", { x: 3, y: 3 }).run(1);
    expect(game.gold()).toBe(100 - TOWERS.archer.cost);
    expect(game.towers()).toHaveLength(1);
    expect(game.tower(0)).toMatchObject({ id: 1, kind: "archer", x: 3, y: 3, builtTick: 0 });
  });

  it("rejects builds outside the grid", () => {
    const game = scenario({ seed: 1, gold: 100 }).build("archer", { x: 20, y: 0 }).build("archer", { x: 0, y: -1 }).run(1);
    expect(game.towers()).toHaveLength(0);
    expect(game.gold()).toBe(100);
  });

  it("rejects builds on the path", () => {
    const game = scenario({ seed: 1, gold: 100 }).build("archer", { x: 5, y: 1 }).run(1);
    expect(game.towers()).toHaveLength(0);
    expect(game.gold()).toBe(100);
  });

  it("rejects builds on an occupied cell", () => {
    const game = scenario({ seed: 1, gold: 500 }).tower("archer", { x: 3, y: 3 }).build("cannon", { x: 3, y: 3 }).run(1);
    expect(game.towers().map((t) => t.kind)).toEqual(["archer"]);
    expect(game.gold()).toBe(500);
  });

  it("rejects builds without enough gold", () => {
    const game = scenario({ seed: 1, gold: 10 }).build("archer", { x: 3, y: 3 }).run(1);
    expect(game.towers()).toHaveLength(0);
    expect(game.gold()).toBe(10);
  });

  it("applies several commands in the given order within one tick", () => {
    const almostBoth = TOWERS.archer.cost + TOWERS.cannon.cost - 1;
    const game = scenario({ seed: 1, gold: almostBoth }).build("cannon", { x: 3, y: 3 }).build("archer", { x: 4, y: 3 }).run(1);
    expect(game.towers().map((t) => t.kind)).toEqual(["cannon"]);
  });

  it("reports the rejection reason the client shows", () => {
    const game = scenario({ seed: 1, gold: 10 }).tower("archer", { x: 3, y: 3 }).run(0);
    const build = (x: number, y: number): BuildCommand => ({ type: "build", tick: 0, playerId: 0, tower: "archer", x, y });
    expect(validateBuild(game.state(), build(20, 0))).toBe("outside");
    expect(validateBuild(game.state(), build(5, 1))).toBe("on_path");
    expect(validateBuild(game.state(), build(3, 3))).toBe("occupied");
    expect(validateBuild(game.state(), build(4, 3))).toBe("no_gold");
  });
});
