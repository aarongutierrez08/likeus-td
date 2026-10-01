import { describe, expect, it } from "vitest";
import { GAME, TICKS_PER_SECOND, WAVES } from "../src/index";
import { FULL_GAME_MS, scenario } from "./helpers/scenario";

const enemiesIn = (wave: number): number => WAVES[wave - 1]!.groups.reduce((n, g) => n + g.count, 0);

const spawnOrder = (seed: number, wave: number): string[] => {
  const state = scenario({ seed, waves: true, startWave: wave })
    .run(GAME.firstWaveTick + 1)
    .state();
  return [...state.enemies, ...state.spawnQueue].map((e) => e.kind);
};

const countByKind = (kinds: readonly string[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  return counts;
};

describe("waves", () => {
  it("there are twenty waves", () => {
    expect(WAVES).toHaveLength(20);
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

  it("spawn spacing carries seeded jitter but every enemy of a kind has the same hp", () => {
    const queue = scenario({ seed: 3, waves: true })
      .run(GAME.firstWaveTick + 1)
      .state().spawnQueue;
    const gaps = new Set(queue.slice(1).map((s, i) => s.tick - queue[i]!.tick));
    expect(gaps.size).toBeGreaterThan(1);
    for (let i = 1; i < queue.length; i++) expect(queue[i]!.tick).toBeGreaterThan(queue[i - 1]!.tick);
    const hpByKind = new Map<string, Set<number>>();
    for (const s of queue) hpByKind.set(s.kind, (hpByKind.get(s.kind) ?? new Set()).add(s.hp));
    for (const hps of hpByKind.values()) expect(hps.size).toBe(1);
  });

  it("enemies of different groups come out mixed, keeping the wave's composition", () => {
    const order = spawnOrder(3, 2);
    const lastNormal = order.lastIndexOf("normal");
    const firstFast = order.indexOf("fast");
    expect(firstFast).toBeLessThan(lastNormal);
    const composition = new Map(WAVES[1]!.groups.map((g) => [g.kind as string, g.count]));
    expect(countByKind(order)).toEqual(composition);
  });

  it("the spawn order is fixed by the seed", () => {
    expect(spawnOrder(3, 10)).toEqual(spawnOrder(3, 10));
    expect(spawnOrder(3, 10)).not.toEqual(spawnOrder(4, 10));
  });

  it("the boss comes out after every other enemy of its wave", () => {
    for (const wave of [10, 20]) {
      const order = spawnOrder(3, wave);
      expect(order.indexOf("boss")).toBe(order.length - 1);
    }
  });

  it("each enemy waits its own group's spacing, give or take the jitter", () => {
    const queue = scenario({ seed: 3, waves: true, startWave: 10 })
      .run(GAME.firstWaveTick + 1)
      .state().spawnQueue;
    const spacingOf = new Map(WAVES[9]!.groups.map((g) => [g.kind as string, g.spacing]));
    for (let i = 1; i < queue.length; i++) {
      const spacing = spacingOf.get(queue[i]!.kind)!;
      const jitter = Math.floor((spacing * GAME.spacingJitterPct) / 100);
      const gap = queue[i]!.tick - queue[i - 1]!.tick;
      expect(gap).toBeGreaterThanOrEqual(spacing - jitter);
      expect(gap).toBeLessThanOrEqual(spacing + jitter);
    }
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

  it(
    "clearing the last wave wins the game and freezes it",
    () => {
      const game = scenario({ seed: 11, gold: 5000, waves: true, bot: true }).runUntil(() => false, 30000);
      expect(game.status()).toBe("won");
      expect(game.state().wave).toBe(WAVES.length);
      expect(game.enemies()).toHaveLength(0);
      const frozen = game.state();
      game.run(1);
      expect(game.state()).toBe(frozen);
    },
    FULL_GAME_MS,
  );
});
