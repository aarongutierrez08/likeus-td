import { describe, expect, it } from "vitest";
import { GAME } from "../src/index";
import { scenario } from "./helpers/scenario";

function firstWaveSpawns(seed: number): { tick: number; hp: number }[] {
  return scenario({ seed, waves: true })
    .run(GAME.firstWaveTick + 1)
    .state()
    .spawnQueue.map((s) => ({ tick: s.tick, hp: s.hp }));
}

describe("seeded randomness", () => {
  it("the same seed schedules the same spawns", () => {
    expect(firstWaveSpawns(123)).toEqual(firstWaveSpawns(123));
  });

  it("seed zero still produces varied spawns", () => {
    const hps = new Set(firstWaveSpawns(0).map((s) => s.hp));
    expect(hps.size).toBeGreaterThan(1);
  });

  it("different seeds schedule different spawns", () => {
    expect(firstWaveSpawns(1)).not.toEqual(firstWaveSpawns(2));
  });
});
