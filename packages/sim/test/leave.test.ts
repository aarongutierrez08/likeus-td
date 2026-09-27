import { describe, expect, it } from "vitest";
import { TEAM_OWNER, TOWERS, sellRefund, validateCommand } from "../src/index";
import { scenario } from "./helpers/scenario";

describe("a player leaving for good", () => {
  it("is removed and their gold is split among the remaining players, remainder to the lowest id", () => {
    const game = scenario({ seed: 1, players: [0, 1, 2], gold: 0 }).run(0);
    game.state().players.find((p) => p.id === 2)!.gold = 100;
    game.leave(2).run(1);
    expect(game.playerIds()).toEqual([0, 1]);
    expect(game.gold(0)).toBe(50);
    expect(game.gold(1)).toBe(50);
    const odd = scenario({ seed: 1, players: [0, 1, 2], gold: 0 }).run(0);
    odd.state().players.find((p) => p.id === 2)!.gold = 101;
    odd.leave(2).run(1);
    expect(odd.gold(0)).toBe(51);
    expect(odd.gold(1)).toBe(50);
  });

  it("their towers become the team's: anyone can sell or upgrade them", () => {
    const game = scenario({ seed: 1, players: [0, 1], gold: TOWERS.archer.cost }).tower("archer", { x: 3, y: 3, owner: 1 }).run(0);
    expect(validateCommand(game.state(), { type: "sell", tick: 0, playerId: 0, towerId: 1 })).toBe("not_owner");
    game.leave(1).run(1);
    expect(game.tower(0).owner).toBe(TEAM_OWNER);
    expect(validateCommand(game.state(), { type: "upgrade", tick: 0, playerId: 0, towerId: 1 })).toBeNull();
    game.upgrade(1, 0).run(1);
    expect(game.tower(0).level).toBe(2);
    const refund = sellRefund(game.tower(0));
    const before = game.gold(0);
    game.sell(1, 0).run(1);
    expect(game.towers()).toHaveLength(0);
    expect(game.gold(0)).toBe(before + refund);
  });

  it("the last player leaving leaves the map with team towers and nobody to pay", () => {
    const game = scenario({ seed: 1, gold: 0 }).tower("archer", { x: 4, y: 2 }).enemy("fast", { x: 4, y: 1, hp: 1 }).leave(0).run(1);
    expect(game.playerIds()).toEqual([]);
    expect(game.tower(0).owner).toBe(TEAM_OWNER);
    expect(game.alive(0)).toBe(false);
  });

  it("leaving twice or as an unknown player is rejected", () => {
    const game = scenario({ seed: 1, players: [0, 1] }).leave(1).run(1);
    expect(validateCommand(game.state(), { type: "leave", tick: 0, playerId: 1 })).toBe("no_player");
    expect(validateCommand(game.state(), { type: "leave", tick: 0, playerId: 7 })).toBe("no_player");
  });
});
