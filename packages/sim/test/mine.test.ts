import { describe, expect, it } from "vitest";
import { TOWERS, UPGRADE, interestOn, sellRefund, towerIncome, type Tower } from "../src/index";
import { scenario } from "./helpers/scenario";

const untilFirstClose = (players: number[], gold = 0) =>
  scenario({ seed: 3, players, waves: true, gold }).tower("mine", { x: 5, y: 3, owner: players[0]! });

describe("mine", () => {
  it("pays its owner at every wave close and nobody else", () => {
    const game = untilFirstClose([0, 1]).runUntil((st) => st.wavesClosed === 1, 10000);
    expect(game.state().wavesClosed).toBe(1);
    expect(game.gold(0)).toBe(TOWERS.mine.income + interestOn(TOWERS.mine.income));
    expect(game.gold(1)).toBe(0);
    game.runUntil((st) => st.wavesClosed === 2, 10000);
    expect(game.gold(0)).toBeGreaterThan(2 * TOWERS.mine.income);
  });

  it("does not attenuate its income with more players", () => {
    const game = untilFirstClose([0, 1, 2, 3]).runUntil((st) => st.wavesClosed === 1, 10000);
    expect(game.gold(0)).toBe(TOWERS.mine.income + interestOn(TOWERS.mine.income));
    for (const id of [1, 2, 3]) expect(game.gold(id)).toBe(0);
  });

  it("an upgraded mine pays more", () => {
    const game = untilFirstClose([0], TOWERS.mine.cost).upgrade(1).run(1);
    expect(game.tower(0).level).toBe(2);
    expect(game.gold(0)).toBe(0);
    const level2 = Math.floor((TOWERS.mine.income * (100 + UPGRADE.incomePctPerLevel)) / 100);
    expect(towerIncome(game.tower(0))).toBe(level2);
    game.runUntil((st) => st.wavesClosed === 1, 10000);
    expect(game.gold(0)).toBe(level2 + interestOn(level2));
  });

  it("never attacks", () => {
    const game = scenario({ seed: 1 }).tower("mine", { x: 5, y: 2 }).enemy("normal", { x: 5, y: 1, hp: 50 }).run(20);
    expect(game.enemy(0).hp).toBe(50);
    expect(TOWERS.mine.damage).toBe(0);
  });

  it("sells for 75% of its cost and other towers produce nothing", () => {
    const mine: Tower = { id: 1, owner: 0, kind: "mine", level: 1, x: 5, y: 3, cooldown: 0, builtTick: 0, damageDealt: 0, kills: 0 };
    expect(sellRefund(mine)).toBe(Math.floor((TOWERS.mine.cost * 75) / 100));
    expect(towerIncome({ ...mine, kind: "archer" })).toBe(0);
  });
});
