import { describe, expect, it } from "vitest";
import { ARMORS, ATTACK_TYPES, DAMAGE_TABLE, ENEMIES, TOWERS, damageMultiplier } from "../src/index";
import { scenario } from "./helpers/scenario";

const hp = 1000;

describe("damage table", () => {
  it("every attack type has exactly one 150% armor, one 50% armor and 100% against the rest", () => {
    for (const attack of ATTACK_TYPES) {
      const row = ARMORS.map((armor) => DAMAGE_TABLE[attack][armor]);
      expect(row.filter((m) => m === 150)).toHaveLength(1);
      expect(row.filter((m) => m === 50)).toHaveLength(1);
      expect(row.filter((m) => m === 100)).toHaveLength(ARMORS.length - 2);
    }
  });

  it("every armor is weak to exactly one attack type and resists exactly one", () => {
    for (const armor of ARMORS) {
      const column = ATTACK_TYPES.map((attack) => DAMAGE_TABLE[attack][armor]);
      expect(column.filter((m) => m === 150)).toHaveLength(1);
      expect(column.filter((m) => m === 50)).toHaveLength(1);
    }
  });

  it("archer is pierce, cannon is explosive, and enchanted armor halves pierce", () => {
    expect(TOWERS.archer.attackType).toBe("pierce");
    expect(TOWERS.cannon.attackType).toBe("explosive");
    expect(damageMultiplier("pierce", ENEMIES.enchanted.armor)).toBe(50);
  });
});

describe("damage against armor", () => {
  it("archer deals 150% to light armor and 50% to enchanted armor", () => {
    const light = scenario({ seed: 1 }).tower("archer", { x: 4, y: 2 }).enemy("fast", { x: 4, y: 1, hp }).run(1);
    expect(light.enemy(0).hp).toBe(hp - Math.floor((TOWERS.archer.damage * 150) / 100));
    const enchanted = scenario({ seed: 1 }).tower("archer", { x: 4, y: 2 }).enemy("enchanted", { x: 4, y: 1, hp }).run(1);
    expect(enchanted.enemy(0).hp).toBe(hp - Math.floor((TOWERS.archer.damage * 50) / 100));
  });

  it("cannon splash applies each enemy's own armor", () => {
    const slowerTankLagAfterOneTick = ENEMIES.normal.speed - ENEMIES.tank.speed;
    const game = scenario({ seed: 1 })
      .tower("cannon", { x: 5, y: 3 })
      .enemy("normal", { x: 5, y: 1, hp })
      .enemy("tank", { x: 5, y: 1, hp, offset: -TOWERS.cannon.splash + slowerTankLagAfterOneTick })
      .run(1);
    expect(game.enemy(0).hp).toBe(hp - Math.floor((TOWERS.cannon.damage * 150) / 100));
    expect(game.enemy(1).hp).toBe(hp - Math.floor((TOWERS.cannon.damage * 50) / 100));
  });

  it("damage dealt stats count the multiplied damage", () => {
    const game = scenario({ seed: 1 }).tower("archer", { x: 4, y: 2 }).enemy("fast", { x: 4, y: 1, hp }).run(1);
    expect(game.tower(0).damageDealt).toBe(Math.floor((TOWERS.archer.damage * 150) / 100));
  });
});
