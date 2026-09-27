import { describe, expect, it } from "vitest";
import { TOWERS, UPGRADE, sellRefund, towerDamage, validateCommand, type Command } from "../src/index";
import { scenario } from "./helpers/scenario";

const hp = 100;

describe("upgrading towers", () => {
  it("each upgrade costs the base price and raises the damage by 50% of the base", () => {
    const game = scenario({ seed: 1, gold: TOWERS.archer.cost * 2 }).tower("archer", { x: 4, y: 2 }).run(0);
    const archer = game.tower(0);
    expect(archer.level).toBe(1);
    game.upgrade(archer.id).run(1);
    expect(game.tower(0).level).toBe(2);
    expect(game.gold(0)).toBe(TOWERS.archer.cost);
    expect(towerDamage(game.tower(0))).toBe(12);
    game.upgrade(archer.id).run(1);
    expect(game.tower(0).level).toBe(3);
    expect(game.gold(0)).toBe(0);
    expect(towerDamage(game.tower(0))).toBe(16);
    expect(UPGRADE.maxLevel).toBe(3);
  });

  it("an upgraded archer hits harder", () => {
    const game = scenario({ seed: 1, gold: TOWERS.archer.cost })
      .tower("archer", { x: 4, y: 2 })
      .enemy("normal", { x: 4, y: 1, hp })
      .upgrade(1)
      .run(1);
    expect(game.enemy(0).hp).toBe(hp - 12);
  });

  it("a level 3 tower cannot be upgraded further", () => {
    const game = scenario({ seed: 1, gold: 500 }).tower("archer", { x: 4, y: 2 }).upgrade(1).run(1).upgrade(1).run(1);
    expect(game.tower(0).level).toBe(3);
    const again: Command = { type: "upgrade", tick: 0, playerId: 0, towerId: 1 };
    expect(validateCommand(game.state(), again)).toBe("max_level");
    game.upgrade(1).run(1);
    expect(game.gold(0)).toBe(500 - TOWERS.archer.cost * 2);
  });

  it("only the owner with enough gold can upgrade an existing tower", () => {
    const game = scenario({ seed: 1, players: [0, 1], gold: 10 }).tower("cannon", { x: 4, y: 3, owner: 0 }).run(0);
    expect(validateCommand(game.state(), { type: "upgrade", tick: 0, playerId: 1, towerId: 1 })).toBe("not_owner");
    expect(validateCommand(game.state(), { type: "upgrade", tick: 0, playerId: 0, towerId: 1 })).toBe("no_gold");
    expect(validateCommand(game.state(), { type: "upgrade", tick: 0, playerId: 0, towerId: 9 })).toBe("no_tower");
  });

  it("selling refunds 75% of everything invested", () => {
    const game = scenario({ seed: 1, gold: TOWERS.archer.cost }).tower("archer", { x: 4, y: 2 }).upgrade(1).run(1);
    expect(game.gold(0)).toBe(0);
    expect(sellRefund(game.tower(0))).toBe(Math.floor((TOWERS.archer.cost * 2 * 75) / 100));
    game.sell(1).run(1);
    expect(game.gold(0)).toBe(Math.floor((TOWERS.archer.cost * 2 * 75) / 100));
  });

  it("an upgraded aura boosts more, and overlapping auras apply only the strongest", () => {
    const boostedByLevel2 = Math.floor((TOWERS.archer.damage * (100 + TOWERS.aura.auraBonusPct + UPGRADE.auraBonusPctPerLevel)) / 100);
    const game = scenario({ seed: 1, gold: TOWERS.aura.cost })
      .tower("aura", { x: 4, y: 3 })
      .tower("aura", { x: 6, y: 3 })
      .tower("archer", { x: 5, y: 2 })
      .enemy("normal", { x: 5, y: 1, hp })
      .upgrade(1)
      .run(1);
    expect(game.tower(0).level).toBe(2);
    expect(game.enemy(0).hp).toBe(hp - boostedByLevel2);
  });
});
