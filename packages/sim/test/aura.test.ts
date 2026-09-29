import { describe, expect, it } from "vitest";
import { ENEMIES, TOWERS, attenuatedBounty } from "../src/index";
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

describe("rate aura", () => {
  const cooldown = TOWERS.archer.cooldown;
  const hastened = Math.floor((cooldown * 100) / (100 + TOWERS.haste.auraBonusPct));

  it("makes an archer fire again sooner, and two rate auras do not stack", () => {
    expect(hastened).toBeLessThan(cooldown);
    const alone = scenario({ seed: 1 })
      .tower("archer", { x: 5, y: 2 })
      .enemy("normal", { x: 5, y: 1, hp: 1000 })
      .run(hastened + 1);
    expect(alone.enemy(0).hp).toBe(1000 - plain);
    const hastenedTwice = scenario({ seed: 1 })
      .tower("haste", { x: 4, y: 3 })
      .tower("haste", { x: 6, y: 3 })
      .tower("archer", { x: 5, y: 2 })
      .enemy("normal", { x: 5, y: 1, hp: 1000 })
      .run(hastened + 1);
    expect(hastenedTwice.enemy(0).hp).toBe(1000 - plain * 2);
  });

  it("stacks with a damage aura because they are different stats", () => {
    const game = scenario({ seed: 1 })
      .tower("haste", { x: 4, y: 3 })
      .tower("aura", { x: 6, y: 3 })
      .tower("archer", { x: 5, y: 2 })
      .enemy("normal", { x: 5, y: 1, hp: 1000 })
      .run(hastened + 1);
    expect(game.enemy(0).hp).toBe(1000 - boosted * 2);
  });
});

describe("gold aura", () => {
  const bounty = ENEMIES.normal.bounty;
  const bonus = Math.floor((bounty * TOWERS.greed.auraBonusPct) / 100);
  const share = attenuatedBounty(bounty, 2);
  const start = 300;

  it("pays its owner a share of every kill made by a tower in its radius, on top of the team bounty", () => {
    expect(bonus).toBeGreaterThan(0);
    const game = scenario({ seed: 1, players: [0, 1], gold: start })
      .tower("archer", { x: 5, y: 2, owner: 0 })
      .tower("greed", { x: 6, y: 3, owner: 1 })
      .enemy("normal", { x: 5, y: 1, hp: 1 })
      .run(1);
    expect(game.enemies()).toHaveLength(0);
    expect(game.gold(0)).toBe(start + share);
    expect(game.gold(1)).toBe(start + share + bonus);
  });

  it("does not pay for kills outside its radius and two gold auras pay only once", () => {
    const outside = scenario({ seed: 1, players: [0, 1], gold: start })
      .tower("archer", { x: 5, y: 2, owner: 0 })
      .tower("greed", { x: 9, y: 3, owner: 1 })
      .enemy("normal", { x: 5, y: 1, hp: 1 })
      .run(1);
    expect(outside.gold(1)).toBe(start + share);
    const twice = scenario({ seed: 1, players: [0, 1], gold: start })
      .tower("archer", { x: 5, y: 2, owner: 0 })
      .tower("greed", { x: 4, y: 3, owner: 1 })
      .tower("greed", { x: 6, y: 3, owner: 1 })
      .enemy("normal", { x: 5, y: 1, hp: 1 })
      .run(1);
    expect(twice.gold(1)).toBe(start + share + bonus);
  });
});
