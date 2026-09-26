import { describe, expect, it } from "vitest";
import { TOWERS } from "../src/balance/towers";
import { effectiveDamage, isAuraBoosted } from "../src/systems/towers";
import { step } from "../src/step";
import { buildCmd, sandbox } from "./helpers";

const boosted = Math.floor((TOWERS.archer.damage * (100 + TOWERS.aura.auraBonusPct)) / 100);

describe("damage aura", () => {
  it("boosts towers within radius 2 by 25%", () => {
    const state = step(sandbox({ gold: 1000 }), [
      buildCmd(sandbox(), "aura", 5, 3),
      buildCmd(sandbox(), "archer", 7, 3),
      buildCmd(sandbox(), "archer", 3, 5),
    ]);
    expect(boosted).toBeGreaterThan(TOWERS.archer.damage);
    for (const tower of state.towers.filter((t) => t.kind === "archer")) {
      expect(isAuraBoosted(state, tower)).toBe(true);
      expect(effectiveDamage(state, tower)).toBe(boosted);
    }
  });

  it("does not reach towers further than 2 cells", () => {
    const state = step(sandbox({ gold: 1000 }), [buildCmd(sandbox(), "aura", 5, 3), buildCmd(sandbox(), "archer", 8, 3)]);
    const archer = state.towers.find((t) => t.kind === "archer")!;
    expect(isAuraBoosted(state, archer)).toBe(false);
    expect(effectiveDamage(state, archer)).toBe(TOWERS.archer.damage);
  });

  it("two auras do not stack", () => {
    const state = step(sandbox({ gold: 1000 }), [
      buildCmd(sandbox(), "aura", 4, 3),
      buildCmd(sandbox(), "aura", 6, 3),
      buildCmd(sandbox(), "archer", 5, 4),
    ]);
    const archer = state.towers.find((t) => t.kind === "archer")!;
    expect(effectiveDamage(state, archer)).toBe(boosted);
  });
});
