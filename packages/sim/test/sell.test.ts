import { describe, expect, it } from "vitest";
import { TOWERS, sellRefund, validateCommand, type Command } from "../src/index";
import type { Tower } from "../src/index";
import { scenario } from "./helpers/scenario";

describe("selling towers", () => {
  it("the owner gets the refund and the tower disappears", () => {
    const game = scenario({ seed: 1, gold: 0 }).tower("archer", { x: 3, y: 3 }).run(0);
    const archer: Tower = { ...game.tower(0) };
    game.sell(archer.id).run(1);
    expect(game.towers()).toHaveLength(0);
    expect(game.gold(0)).toBe(sellRefund(archer));
    expect(sellRefund(archer)).toBeLessThan(TOWERS.archer.cost);
    expect(sellRefund(archer)).toBeGreaterThan(0);
  });

  it("only the owner can sell a tower", () => {
    const game = scenario({ seed: 1, players: [0, 1], gold: 0 })
      .tower("cannon", { x: 3, y: 3, owner: 0 })
      .run(0);
    const byOther: Command = { type: "sell", tick: 0, playerId: 1, towerId: game.tower(0).id };
    expect(validateCommand(game.state(), byOther)).toBe("not_owner");
    game.sell(game.tower(0).id, 1).run(1);
    expect(game.towers()).toHaveLength(1);
    expect(game.gold(1)).toBe(0);
  });

  it("selling a tower that does not exist is rejected", () => {
    const game = scenario({ seed: 1 });
    expect(validateCommand(game.state(), { type: "sell", tick: 0, playerId: 0, towerId: 99 })).toBe("no_tower");
  });

  it("the freed cell can be built on again", () => {
    const game = scenario({ seed: 1, gold: TOWERS.archer.cost }).tower("aura", { x: 3, y: 3 }).run(0);
    game.sell(game.tower(0).id).run(1);
    game.build("archer", { x: 3, y: 3 }).run(1);
    expect(game.towers().map((t) => t.kind)).toEqual(["archer"]);
  });
});
