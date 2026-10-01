import { describe, expect, it } from "vitest";
import { scenario } from "./helpers/scenario";

describe("stats", () => {
  it("count each tower kind's shots and the enemies those shots hit, so area damage can be measured", () => {
    const game = scenario({ seed: 1 })
      .tower("cannon", { x: 5, y: 2 })
      .enemy("normal", { x: 5, y: 1, hp: 1000 })
      .enemy("normal", { x: 5, y: 1, hp: 1000 })
      .run(1);
    expect(game.state().stats.shotsByTower.cannon).toBe(1);
    expect(game.state().stats.hitsByTower.cannon).toBe(2);
    expect(game.state().stats.shotsByTower.archer).toBe(0);
  });
});
