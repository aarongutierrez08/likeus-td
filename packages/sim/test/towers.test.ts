import { describe, expect, it } from "vitest";
import { FP } from "../src/constants";
import { TOWERS } from "../src/balance/towers";
import { step } from "../src/step";
import { addEnemy, buildCmd, runTicks, sandbox } from "./helpers";

describe("towers", () => {
  it("archer hits the enemy furthest along the path within range", () => {
    const state = sandbox({ gold: 1000 });
    const behind = addEnemy(state, "normal", 100, 3 * FP);
    const ahead = addEnemy(state, "normal", 100, 5 * FP);
    const far = addEnemy(state, "normal", 100, 15 * FP);
    const next = step(state, [buildCmd(state, "archer", 4, 2)]);
    const byId = new Map(next.enemies.map((e) => [e.id, e]));
    expect(byId.get(ahead.id)!.hp).toBe(100 - TOWERS.archer.damage);
    expect(byId.get(behind.id)!.hp).toBe(100);
    expect(byId.get(far.id)!.hp).toBe(100);
    expect(next.towers[0]!.damageDealt).toBe(TOWERS.archer.damage);
  });

  it("archer fires once per cooldown period", () => {
    const state = sandbox({ gold: 1000 });
    addEnemy(state, "tank", 100000, 4 * FP);
    const ticks = TOWERS.archer.cooldown * 3;
    const after = runTicks(state, ticks, [buildCmd(state, "archer", 4, 2)]);
    expect(after.towers[0]!.damageDealt).toBe(TOWERS.archer.damage * 3);
  });

  it("enemies outside the range are not attacked", () => {
    const state = sandbox({ gold: 1000 });
    addEnemy(state, "tank", 1000, 10 * FP);
    const after = runTicks(state, 5, [buildCmd(state, "archer", 0, 0)]);
    expect(after.enemies[0]!.hp).toBe(1000);
  });

  it("cannon splash damages every enemy near the target", () => {
    const state = sandbox({ gold: 1000 });
    const target = addEnemy(state, "tank", 1000, 5 * FP);
    const close = addEnemy(state, "tank", 1000, 5 * FP - TOWERS.cannon.splash);
    const outside = addEnemy(state, "tank", 1000, 5 * FP - TOWERS.cannon.splash - 1);
    const next = step(state, [buildCmd(state, "cannon", 5, 3)]);
    const byId = new Map(next.enemies.map((e) => [e.id, e]));
    expect(byId.get(target.id)!.hp).toBe(1000 - TOWERS.cannon.damage);
    expect(byId.get(close.id)!.hp).toBe(1000 - TOWERS.cannon.damage);
    expect(byId.get(outside.id)!.hp).toBe(1000);
  });

  it("aura towers never attack", () => {
    const state = sandbox({ gold: 1000 });
    addEnemy(state, "normal", 100, 5 * FP);
    const after = runTicks(state, 20, [buildCmd(state, "aura", 5, 2)]);
    expect(after.enemies[0]!.hp).toBe(100);
  });
});
