import { describe, expect, it } from "vitest";
import { ECONOMY, ENEMIES, GAME, TICKS_PER_SECOND, TOWERS, attenuatedBounty, interestOn } from "../src/index";
import { scenario } from "./helpers/scenario";

const earned = (game: ReturnType<typeof scenario>, id: number): number => game.state().players.find((p) => p.id === id)!.earned;

describe("gold earned per player", () => {
  it("starts at zero and grows with bounties", () => {
    const game = scenario({ seed: 1, players: [0, 1], gold: 0 })
      .tower("archer", { x: 4, y: 2 })
      .enemy("fast", { x: 4, y: 1, hp: 1 })
      .run(1);
    expect(earned(game, 0)).toBe(attenuatedBounty(ENEMIES.fast.bounty, 2));
    expect(earned(game, 1)).toBe(attenuatedBounty(ENEMIES.fast.bounty, 2));
  });

  it("counts interest, mine income and the wave call bonus", () => {
    const game = scenario({ seed: 3, waves: true, gold: 100 }).tower("mine", { x: 5, y: 3 }).run(0);
    const bonus = Math.floor((game.state().nextWaveTick! - game.state().tick) / TICKS_PER_SECOND);
    game.callWave().run(1);
    expect(earned(game, 0)).toBe(bonus);
    game.runUntil((st) => st.wavesClosed === 1, 10000);
    const income = TOWERS.mine.income;
    expect(earned(game, 0)).toBe(bonus + income + interestOn(100 + bonus + income));
  });

  it("ignores gifts and sales", () => {
    const game = scenario({ seed: 1, players: [0, 1], waves: true, startWave: ECONOMY.giftFromWave, gold: 100 })
      .tower("archer", { x: 3, y: 3, owner: 0 })
      .run(GAME.firstWaveTick + 1);
    game.gift(0, 1, 30).sell(1).run(1);
    expect(game.gold(1)).toBe(130);
    expect(earned(game, 1)).toBe(0);
    expect(earned(game, 0)).toBe(0);
  });
});
