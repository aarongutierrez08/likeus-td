import { describe, expect, it } from "vitest";
import { TOWERS } from "../src/balance/towers";
import { validateBuild } from "../src/commands";
import { step } from "../src/step";
import { buildCmd, sandbox } from "./helpers";

describe("build command", () => {
  it("a valid build spends gold and places the tower", () => {
    const state = sandbox({ gold: 100 });
    const next = step(state, [buildCmd(state, "archer", 3, 3)]);
    expect(next.gold).toBe(100 - TOWERS.archer.cost);
    expect(next.towers).toHaveLength(1);
    expect(next.towers[0]).toMatchObject({ id: 1, kind: "archer", x: 3, y: 3, builtTick: 0 });
    expect(next.nextId).toBe(2);
  });

  it("rejects builds outside the grid", () => {
    const state = sandbox();
    expect(validateBuild(state, { ...buildCmd(state, "archer", 20, 0) })).toBe("outside");
    expect(validateBuild(state, { ...buildCmd(state, "archer", 0, -1) })).toBe("outside");
  });

  it("rejects builds on the path", () => {
    const state = sandbox();
    expect(validateBuild(state, buildCmd(state, "archer", 5, 1))).toBe("on_path");
  });

  it("rejects builds on an occupied cell", () => {
    const state = step(sandbox({ gold: 500 }), [buildCmd(sandbox(), "archer", 3, 3)]);
    expect(validateBuild(state, buildCmd(state, "cannon", 3, 3))).toBe("occupied");
  });

  it("rejects builds without enough gold and leaves the state untouched", () => {
    const state = sandbox({ gold: 10 });
    expect(validateBuild(state, buildCmd(state, "archer", 3, 3))).toBe("no_gold");
    const next = step(state, [buildCmd(state, "archer", 3, 3)]);
    expect(next.towers).toHaveLength(0);
    expect(next.gold).toBe(10);
  });

  it("applies several commands in the given order within one tick", () => {
    const state = sandbox({ gold: TOWERS.archer.cost + TOWERS.cannon.cost - 1 });
    const next = step(state, [buildCmd(state, "cannon", 3, 3), buildCmd(state, "archer", 4, 3)]);
    expect(next.towers.map((t) => t.kind)).toEqual(["cannon"]);
  });
});
