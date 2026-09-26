import { describe, expect, it } from "vitest";
import { ENEMIES, TOWERS } from "../src/index";
import { scenario } from "./helpers/scenario";

const hp = 100;

describe("towers", () => {
  it("archer hits the enemy furthest along the path within range", () => {
    const game = scenario({ seed: 1 })
      .tower("archer", { x: 4, y: 2 })
      .enemy("normal", { x: 3, y: 1, hp })
      .enemy("normal", { x: 5, y: 1, hp })
      .enemy("normal", { x: 15, y: 1, hp })
      .run(1);
    expect(game.enemy(0).hp).toBe(hp);
    expect(game.enemy(1).hp).toBe(hp - TOWERS.archer.damage);
    expect(game.enemy(2).hp).toBe(hp);
    expect(game.tower(0).damageDealt).toBe(TOWERS.archer.damage);
  });

  it("on equal progress the lowest id is targeted", () => {
    const game = scenario({ seed: 1 })
      .tower("archer", { x: 5, y: 2 })
      .enemy("normal", { x: 5, y: 1, hp })
      .enemy("normal", { x: 5, y: 1, hp })
      .run(1);
    expect(game.enemy(0).hp).toBe(hp - TOWERS.archer.damage);
    expect(game.enemy(1).hp).toBe(hp);
  });

  it("an enemy exactly at range is hit and one unit further is not", () => {
    const halfCell = 500;
    const movedBeforeShot = ENEMIES.normal.speed;
    const game = scenario({ seed: 1 })
      .tower("archer", { x: 2, y: 3 })
      .enemy("normal", { x: 3, y: 1, hp, offset: halfCell - movedBeforeShot })
      .enemy("normal", { x: 3, y: 1, hp, offset: halfCell + 1 - movedBeforeShot })
      .run(1);
    expect(game.enemy(0).hp).toBe(hp - TOWERS.archer.damage);
    expect(game.enemy(1).hp).toBe(hp);
  });

  it("archer fires once per cooldown period", () => {
    const game = scenario({ seed: 1 })
      .tower("archer", { x: 4, y: 2 })
      .enemy("tank", { x: 4, y: 1, hp: 100000 })
      .run(TOWERS.archer.cooldown * 3);
    expect(game.tower(0).damageDealt).toBe(TOWERS.archer.damage * 3);
  });

  it("enemies outside the range are not attacked", () => {
    const game = scenario({ seed: 1 }).tower("archer", { x: 0, y: 0 }).enemy("tank", { x: 10, y: 1, hp: 1000 }).run(5);
    expect(game.enemy(0).hp).toBe(1000);
  });

  it("cannon splash damages every enemy near the target", () => {
    const game = scenario({ seed: 1 })
      .tower("cannon", { x: 5, y: 3 })
      .enemy("tank", { x: 5, y: 1, hp: 1000 })
      .enemy("tank", { x: 5, y: 1, hp: 1000, offset: -TOWERS.cannon.splash })
      .enemy("tank", { x: 5, y: 1, hp: 1000, offset: -TOWERS.cannon.splash - 1 })
      .run(1);
    expect(game.enemy(0).hp).toBe(1000 - TOWERS.cannon.damage);
    expect(game.enemy(1).hp).toBe(1000 - TOWERS.cannon.damage);
    expect(game.enemy(2).hp).toBe(1000);
  });

  it("aura towers never attack", () => {
    const game = scenario({ seed: 1 }).tower("aura", { x: 5, y: 2 }).enemy("normal", { x: 5, y: 1, hp }).run(20);
    expect(game.enemy(0).hp).toBe(hp);
  });
});
