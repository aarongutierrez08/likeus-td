import { describe, expect, it } from "vitest";
import { TOWERS } from "../src/index";
import { scenario } from "./helpers/scenario";

const hp = 100;
const plain = TOWERS.archer.damage;
const boosted = Math.floor((TOWERS.archer.damage * (100 + TOWERS.aura.auraBonusPct)) / 100);

describe("damage aura", () => {
  it("boosts an archer two cells away by 25%", () => {
    expect(boosted).toBeGreaterThan(plain);
    const game = scenario({ seed: 1 })
      .tower("aura", { x: 5, y: 3 })
      .tower("archer", { x: 7, y: 3 })
      .enemy("normal", { x: 7, y: 1, hp })
      .run(1);
    expect(game.enemy(0).hp).toBe(hp - boosted);
  });

  it("reaches the diagonal corner of its square radius", () => {
    const game = scenario({ seed: 1 })
      .tower("aura", { x: 5, y: 4 })
      .tower("archer", { x: 7, y: 2 })
      .enemy("normal", { x: 7, y: 1, hp })
      .run(1);
    expect(game.enemy(0).hp).toBe(hp - boosted);
  });

  it("does not reach towers three cells away", () => {
    const game = scenario({ seed: 1 })
      .tower("aura", { x: 5, y: 3 })
      .tower("archer", { x: 8, y: 3 })
      .enemy("normal", { x: 8, y: 1, hp })
      .run(1);
    expect(game.enemy(0).hp).toBe(hp - plain);
  });

  it("two auras do not stack", () => {
    const game = scenario({ seed: 1 })
      .tower("aura", { x: 4, y: 3 })
      .tower("aura", { x: 6, y: 3 })
      .tower("archer", { x: 5, y: 2 })
      .enemy("normal", { x: 5, y: 1, hp })
      .run(1);
    expect(game.enemy(0).hp).toBe(hp - boosted);
  });
});
