import { describe, expect, it } from "vitest";
import { GAME } from "../src/balance/game";
import { WAVES } from "../src/balance/waves";
import { createBot } from "../src/bot";
import { createInitialState } from "../src/state";
import { step } from "../src/step";
import { runTicks } from "./helpers";

const enemiesIn = (wave: number): number => WAVES[wave - 1]!.groups.reduce((n, g) => n + g.count, 0);

describe("waves", () => {
  it("there are ten waves", () => {
    expect(WAVES).toHaveLength(10);
  });

  it("the first wave starts at firstWaveTick with the configured enemies", () => {
    const before = runTicks(createInitialState({ seed: 3 }), GAME.firstWaveTick);
    expect(before.wave).toBe(0);
    expect(before.spawnQueue).toHaveLength(0);
    const started = step(before);
    expect(started.wave).toBe(1);
    expect(started.spawnQueue.length + started.enemies.length).toBe(enemiesIn(1));
    expect(started.enemies).toHaveLength(1);
  });

  it("spawn spacing and hp carry seeded jitter", () => {
    const started = runTicks(createInitialState({ seed: 3 }), GAME.firstWaveTick + 1);
    const ticks = started.spawnQueue.map((s) => s.tick);
    const hps = started.spawnQueue.map((s) => s.hp);
    expect(new Set(hps).size).toBeGreaterThan(1);
    for (let i = 1; i < ticks.length; i++) expect(ticks[i]!).toBeGreaterThan(ticks[i - 1]!);
  });

  it("startWave skips straight to that wave", () => {
    const state = runTicks(createInitialState({ seed: 3, startWave: 7 }), GAME.firstWaveTick + 1);
    expect(state.wave).toBe(7);
    expect(state.spawnQueue.length + state.enemies.length).toBe(enemiesIn(7));
  });

  it("clearing the tenth wave wins the game and freezes it", () => {
    let state = createInitialState({ seed: 11, gold: 5000 });
    const bot = createBot("trivial");
    for (let i = 0; i < 30000 && state.status === "playing"; i++) state = step(state, bot.decide(state));
    expect(state.status).toBe("won");
    expect(state.wave).toBe(WAVES.length);
    expect(state.enemies).toHaveLength(0);
    expect(step(state)).toBe(state);
  });
});
