import { describe, expect, it } from "vitest";
import { DOCTRINE, DOCTRINE_KINDS, ENDLESS, GAME, WAVES, canSubmitRecord, dailySeed, scoreOf, upcomingWaves, waveDef } from "../src/index";
import { scenario } from "./helpers/scenario";

const last = WAVES.length;
const endlessState = (seed: number) => scenario({ seed, mode: "endless" }).run(0).state();

describe("endless mode", () => {
  it("a campaign game has twenty waves; an endless one keeps scheduling generated ones past them", () => {
    expect(waveDef(scenario({ seed: 1 }).run(0).state(), last + 1)).toBeNull();
    const game = scenario({ seed: 1, mode: "endless", waves: true, startWave: last + 1 }).run(GAME.firstWaveTick + 1);
    expect(game.state().wave).toBe(last + 1);
    const def = waveDef(game.state(), last + 1)!;
    const count = def.groups.reduce((n, g) => n + g.count, 0);
    expect(game.state().spawnQueue.length + game.enemies().length).toBe(count);
  });

  it("generated waves are fixed by the seed, grow in hit points and bring a boss every ten", () => {
    expect(waveDef(endlessState(7), last + 3)).toEqual(waveDef(endlessState(7), last + 3));
    expect(waveDef(endlessState(7), last + 1)!.hpPct).toBe(WAVES[last - 1]!.hpPct + ENDLESS.hpStepPct);
    expect(waveDef(endlessState(7), last + 2)!.hpPct).toBeGreaterThan(waveDef(endlessState(7), last + 1)!.hpPct);
    const bossWave = last + ENDLESS.bossEvery;
    expect(waveDef(endlessState(7), bossWave)!.groups.some((g) => g.kind === "boss")).toBe(true);
    expect(waveDef(endlessState(7), bossWave - 1)!.groups.some((g) => g.kind === "boss")).toBe(false);
    const kindsOf = (seed: number) =>
      waveDef(endlessState(seed), last + 1)!
        .groups.map((g) => g.kind)
        .join();
    expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(kindsOf)).size).toBeGreaterThan(1);
  });

  it("the calendar shows generated waves past the campaign", () => {
    const game = scenario({ seed: 1, mode: "endless", waves: true, startWave: last - 1 }).run(0);
    expect(upcomingWaves(game.state(), 3).map((w) => w.number)).toEqual([last - 1, last, last + 1]);
  });

  it("an endless game never wins: it ends when lives run out, and only then can it post a record", () => {
    const game = scenario({ seed: 1, mode: "endless", waves: true, startWave: last + 1 }).runUntil(() => false, 40000);
    expect(game.status()).toBe("lost");
    expect(game.state().wave).toBeGreaterThan(last);
    expect(canSubmitRecord({ ...game.state(), ranked: true })).toBe(true);
    expect(canSubmitRecord({ ...game.state(), ranked: true, status: "playing" })).toBe(false);
    expect(scoreOf(game.state())).toBe(game.state().wavesClosed);
  });

  it("an endless game keeps offering doctrines past the campaign, while any are left", () => {
    const fifth = last + DOCTRINE.everyWaves;
    const close = (doctrines: (typeof DOCTRINE_KINDS)[number][]) =>
      scenario({ seed: 1, mode: "endless", waves: true, startWave: fifth, gold: 1000, doctrines: { 0: doctrines } }).runUntil(
        (st) => st.wavesClosed === fifth,
        40000,
      );
    expect(close([]).state().wavesClosed).toBe(fifth);
    expect(close([]).player().doctrineOffer).toHaveLength(DOCTRINE.offerSize);
    expect(close([...DOCTRINE_KINDS]).player().doctrineOffer).toEqual([]);
  });

  it("the daily seed is the same all day and changes from one day to the next", () => {
    expect(dailySeed("2026-09-30")).toBe(dailySeed("2026-09-30"));
    expect(dailySeed("2026-09-30")).not.toBe(dailySeed("2026-10-01"));
    expect(Number.isInteger(dailySeed("2026-09-30"))).toBe(true);
  });
});
