import { describe, expect, it } from "vitest";
import { GAME, TICKS_PER_SECOND, WAVES } from "../src/index";
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

  it("the next wave counts down only after the current one is over", () => {
    const game = scenario({ seed: 3, waves: true }).run(GAME.firstWaveTick + 1);
    expect(game.state().wave).toBe(1);
    expect(game.state().nextWaveTick).toBeNull();
    game.run(GAME.waveGapTicks * 3);
    expect(game.state().wave).toBe(1);
    expect(game.state().nextWaveTick).toBeNull();
  });

  it("once a wave is over the next one starts after the gap, or right away when called", () => {
    const defended = scenario({ seed: 3, waves: true, gold: 0 });
    for (let x = 0; x < 8; x++) defended.tower("archer", { x, y: 0 });
    defended.runUntil((st) => st.wavesClosed === 1, 10000);
    const closedAt = defended.state().tick;
    expect(defended.state().nextWaveTick).toBe(closedAt + GAME.waveGapTicks);
    defended.run(GAME.waveGapTicks);
    expect(defended.state().tick).toBe(defended.state().nextWaveTick);
    expect(defended.state().wave).toBe(1);
    defended.run(1);
    expect(defended.state().wave).toBe(2);
    expect(defended.state().nextWaveTick).toBeNull();

    const called = scenario({ seed: 3, waves: true, gold: 0 });
    for (let x = 0; x < 8; x++) called.tower("archer", { x, y: 0 });
    called.runUntil((st) => st.wavesClosed === 1, 10000);
    const goldAtClose = called.gold(0);
    called.callWave().run(1);
    expect(called.state().wave).toBe(2);
    expect(called.gold(0)).toBe(goldAtClose + Math.floor(GAME.waveGapTicks / TICKS_PER_SECOND));
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
