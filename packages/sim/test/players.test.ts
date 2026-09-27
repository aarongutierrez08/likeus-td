import { describe, expect, it } from "vitest";
import { ENEMIES, GAME, TOWERS, attenuatedBounty, startingGold, validateBuild, type BuildCommand } from "../src/index";
import { scenario } from "./helpers/scenario";

describe("gold per player", () => {
  it("a solo player starts with the balance gold and a duo with the multiplayer share", () => {
    expect(scenario({ seed: 1 }).gold(0)).toBe(GAME.startGold);
    const duo = scenario({ seed: 1, players: [0, 1] });
    expect(duo.gold(0)).toBe(startingGold(2));
    expect(duo.gold(1)).toBe(startingGold(2));
    expect(startingGold(2)).toBeLessThan(GAME.startGold);
  });

  it("a build is paid only by the player who orders it and the tower is theirs", () => {
    const game = scenario({ seed: 1, players: [0, 1], gold: 100 })
      .build("archer", { x: 3, y: 3, player: 1 })
      .run(1);
    expect(game.gold(1)).toBe(100 - TOWERS.archer.cost);
    expect(game.gold(0)).toBe(100);
    expect(game.tower(0).owner).toBe(1);
  });

  it("a player cannot spend a teammate's gold", () => {
    const game = scenario({ seed: 1, players: [0, 1], gold: 10 })
      .tower("archer", { x: 0, y: 0, owner: 0 })
      .run(0);
    const byPoor = (x: number): BuildCommand => ({ type: "build", tick: 0, playerId: 1, tower: "archer", x, y: 3 });
    expect(validateBuild(game.state(), byPoor(3))).toBe("no_gold");
    game.build("archer", { x: 3, y: 3, player: 1 }).run(1);
    expect(game.towers()).toHaveLength(1);
    expect(game.gold(1)).toBe(10);
  });

  it("commands from a player who is not in the game are rejected", () => {
    const game = scenario({ seed: 1, gold: 500 }).build("archer", { x: 3, y: 3, player: 7 }).run(1);
    expect(game.towers()).toHaveLength(0);
    const stranger: BuildCommand = { type: "build", tick: 0, playerId: 7, tower: "archer", x: 4, y: 3 };
    expect(validateBuild(game.state(), stranger)).toBe("no_player");
  });

  it("the kill is credited to the last hitter but every player collects the shared bounty", () => {
    const game = scenario({ seed: 1, players: [0, 1], gold: 0 })
      .tower("archer", { x: 5, y: 2, owner: 0 })
      .tower("archer", { x: 6, y: 2, owner: 1 })
      .enemy("normal", { x: 5, y: 1, hp: TOWERS.archer.damage * 2 })
      .run(1);
    expect(game.alive(0)).toBe(false);
    expect(game.tower(1).kills).toBe(1);
    expect(game.tower(0).kills).toBe(0);
    expect(game.gold(0)).toBe(attenuatedBounty(ENEMIES.normal.bounty, 2));
    expect(game.gold(1)).toBe(attenuatedBounty(ENEMIES.normal.bounty, 2));
  });

  it("an aura owner collects the same as the archer owner it boosts", () => {
    const game = scenario({ seed: 1, players: [0, 1], gold: 0 })
      .tower("aura", { x: 5, y: 3, owner: 1 })
      .tower("archer", { x: 5, y: 2, owner: 0 })
      .enemy("fast", { x: 5, y: 1, hp: 1 })
      .run(1);
    expect(game.gold(0)).toBe(attenuatedBounty(ENEMIES.fast.bounty, 2));
    expect(game.gold(1)).toBe(game.gold(0));
  });

  it("a join command adds a player with starting gold, once, keeping ids sorted", () => {
    const game = scenario({ seed: 1, gold: 50 }).join(5).run(1);
    expect(game.playerIds()).toEqual([0, 5]);
    expect(game.gold(5)).toBe(startingGold(2));
    game.build("archer", { x: 3, y: 3, player: 5 }).join(5).join(3).run(1);
    expect(game.playerIds()).toEqual([0, 3, 5]);
    expect(game.gold(5)).toBe(startingGold(2) - TOWERS.archer.cost);
    expect(game.gold(3)).toBe(startingGold(3));
  });
});
