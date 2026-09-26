import { describe, expect, it } from "vitest";
import { nextRng, rollInt, rollJitter, seedRng } from "../src/rng";
import { sandbox } from "./helpers";

describe("rng", () => {
  it("same seed yields the same sequence", () => {
    let a = seedRng(123);
    let b = seedRng(123);
    for (let i = 0; i < 100; i++) {
      a = nextRng(a);
      b = nextRng(b);
      expect(a).toBe(b);
    }
  });

  it("seed zero is not a fixed point", () => {
    const first = seedRng(0);
    expect(first).not.toBe(0);
    expect(nextRng(first)).not.toBe(first);
  });

  it("rollInt stays within range and varies", () => {
    const state = sandbox();
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const v = rollInt(state, 6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
  });

  it("rollJitter is symmetric around zero and zero spread returns zero", () => {
    const state = sandbox();
    for (let i = 0; i < 200; i++) {
      const v = rollJitter(state, 4);
      expect(Math.abs(v)).toBeLessThanOrEqual(4);
    }
    expect(rollJitter(state, 0)).toBe(0);
  });
});
