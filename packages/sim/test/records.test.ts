import { describe, expect, it } from "vitest";
import { GAME, canSubmitRecord } from "../src/index";
import { scenario } from "./helpers/scenario";

describe("records eligibility", () => {
  it("a game started with only a seed is ranked", () => {
    expect(scenario({ seed: 1, waves: true }).ranked()).toBe(true);
  });

  it("a custom starting gold makes the game unranked even if ranked is requested", () => {
    expect(scenario({ seed: 1, gold: GAME.startGold + 1, ranked: true }).ranked()).toBe(false);
  });

  it("starting at a later wave makes the game unranked", () => {
    expect(scenario({ seed: 1, waves: true, startWave: 5 }).ranked()).toBe(false);
  });

  it("the caller can mark a game unranked without touching gold or waves", () => {
    expect(scenario({ seed: 1, waves: true, ranked: false }).ranked()).toBe(false);
  });

  it("ranked survives ticks", () => {
    expect(
      scenario({ seed: 1, waves: true })
        .run(GAME.firstWaveTick + 50)
        .ranked(),
    ).toBe(true);
  });

  it("only a ranked game that was won can submit a record", () => {
    const inProgress = scenario({ seed: 1, waves: true }).run(10);
    expect(canSubmitRecord(inProgress.state())).toBe(false);
    const devWin = scenario({ seed: 11, gold: 5000, waves: true, bot: true }).runUntil(() => false, 30000);
    expect(devWin.status()).toBe("won");
    expect(canSubmitRecord(devWin.state())).toBe(false);
    const rankedWin = { ...devWin.state(), ranked: true };
    expect(canSubmitRecord(rankedWin)).toBe(true);
  });
});
