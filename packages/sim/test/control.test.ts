import { describe, expect, it } from "vitest";
import { ENEMIES, FP, TOWERS, UPGRADE } from "../src/index";
import { scenario } from "./helpers/scenario";

const speed = ENEMIES.normal.speed;
const slowPct = TOWERS.frost.controlPct;
const slowed = Math.floor((speed * (100 - slowPct)) / 100);
const stunTicks = TOWERS.thunder.controlDuration;
const startCell = 5;
const start = startCell * FP;

describe("frost tower", () => {
  it("slows the enemy in range from the next tick on", () => {
    expect(slowed).toBeLessThan(speed);
    const game = scenario({ seed: 1 }).tower("frost", { x: startCell, y: 2 }).enemy("normal", { x: startCell, y: 1 }).run(2);
    expect(game.enemy(0).progress).toBe(start + speed + slowed);
  });

  it("two frost towers slow like one", () => {
    const game = scenario({ seed: 1 })
      .tower("frost", { x: startCell, y: 2 })
      .tower("frost", { x: startCell + 1, y: 2 })
      .enemy("normal", { x: startCell, y: 1 })
      .run(2);
    expect(game.enemy(0).progress).toBe(start + speed + slowed);
  });

  it("each level slows harder by a quarter of the base", () => {
    const stronger = Math.floor((speed * (100 - Math.floor((slowPct * (100 + UPGRADE.controlPctPerLevel)) / 100))) / 100);
    expect(stronger).toBeLessThan(slowed);
    const game = scenario({ seed: 1, gold: TOWERS.frost.cost })
      .tower("frost", { x: startCell, y: 2 })
      .enemy("normal", { x: startCell, y: 1 });
    game.upgrade(game.tower(0).id).run(2);
    expect(game.enemy(0).progress).toBe(start + speed + stronger);
  });
});

describe("thunder tower", () => {
  it("stuns every enemy around its target for its duration, then they walk again", () => {
    const game = scenario({ seed: 1 })
      .tower("thunder", { x: startCell, y: 2 })
      .enemy("normal", { x: startCell, y: 1 })
      .enemy("normal", { x: startCell, y: 1, offset: -TOWERS.thunder.controlSplash })
      .enemy("normal", { x: startCell, y: 1, offset: -TOWERS.thunder.controlSplash * 2 })
      .run(1 + stunTicks);
    expect(game.enemy(0).progress).toBe(start + speed);
    expect(game.enemy(1).progress).toBe(start - TOWERS.thunder.controlSplash + speed);
    expect(game.enemy(2).progress).toBe(start - TOWERS.thunder.controlSplash * 2 + speed * (1 + stunTicks));
    game.run(1);
    expect(game.enemy(0).progress).toBe(start + speed * 2);
  });

  it("two thunder towers refresh the stun instead of adding it up", () => {
    const game = scenario({ seed: 1 })
      .tower("thunder", { x: startCell, y: 2 })
      .tower("thunder", { x: startCell + 1, y: 2 })
      .enemy("normal", { x: startCell, y: 1 })
      .run(2 + stunTicks);
    expect(game.enemy(0).progress).toBe(start + speed * 2);
  });
});
