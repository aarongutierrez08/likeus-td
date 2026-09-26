import { describe, expect, it } from "vitest";
import { GAME, WAVES } from "../src/index";
import { scenario } from "./helpers/scenario";

const enemiesIn = (wave: number): number => WAVES[wave - 1]!.groups.reduce((n, g) => n + g.count, 0);

describe("waves", () => {
  it("there are ten waves", () => {
    expect(WAVES).toHaveLength(10);
  });

  it("the first wave starts at firstWaveTick with the configured enemies", () => {
    const game = scenario({ seed: 3, waves: true }).run(GAME.firstWaveTick);
    expect(game.state().wave).toBe(0);
    expect(game.state().spawnQueue).toHaveLength(0);
    game.run(1);
    expect(game.state().wave).toBe(1);
    expect(game.state().spawnQueue.length + game.enemies().length).toBe(enemiesIn(1));
    expect(game.enemies()).toHaveLength(1);
  });

  it("spawn ticks increase and hp carries seeded jitter", () => {
    const queue = scenario({ seed: 3, waves: true }).run(GAME.firstWaveTick + 1).state().spawnQueue;
    const hps = new Set(queue.map((s) => s.hp));
    expect(hps.size).toBeGreaterThan(1);
    for (let i = 1; i < queue.length; i++) expect(queue[i]!.tick).toBeGreaterThan(queue[i - 1]!.tick);
  });

  it("startWave skips straight to that wave", () => {
    const game = scenario({ seed: 3, waves: true, startWave: 7 }).run(GAME.firstWaveTick + 1);
    expect(game.state().wave).toBe(7);
    expect(game.state().spawnQueue.length + game.enemies().length).toBe(enemiesIn(7));
  });

  it("clearing the tenth wave wins the game and freezes it", () => {
    const game = scenario({ seed: 11, gold: 5000, waves: true, bot: true }).runUntil(() => false, 30000);
    expect(game.status()).toBe("won");
    expect(game.state().wave).toBe(WAVES.length);
    expect(game.enemies()).toHaveLength(0);
    const frozen = game.state();
    game.run(1);
    expect(game.state()).toBe(frozen);
  });
});
