import { describe, expect, it } from "vitest";
import { ENEMIES } from "../src/balance/enemies";
import { FP } from "../src/constants";
import { TOWERS } from "../src/balance/towers";
import { step } from "../src/step";
import { addEnemy, buildCmd, sandbox } from "./helpers";

describe("gold", () => {
  it("killing an enemy pays its bounty into the shared pool", () => {
    const startGold = TOWERS.archer.cost;
    const state = sandbox({ gold: startGold });
    addEnemy(state, "fast", TOWERS.archer.damage, 4 * FP);
    const next = step(state, [buildCmd(state, "archer", 4, 2)]);
    expect(next.enemies).toHaveLength(0);
    expect(next.gold).toBe(ENEMIES.fast.bounty);
    expect(next.stats.kills).toBe(1);
    expect(next.stats.goldEarned).toBe(ENEMIES.fast.bounty);
    expect(next.towers[0]!.kills).toBe(1);
  });

  it("a leaked enemy pays nothing", () => {
    const state = sandbox({ gold: 0 });
    addEnemy(state, "normal", 10, 10 ** 9);
    const next = step(state);
    expect(next.gold).toBe(0);
    expect(next.stats.kills).toBe(0);
  });
});
