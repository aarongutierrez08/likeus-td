import { describe, expect, it } from "vitest";
import { DOCTRINES, MARKET, SELL_REFUND_PCT, TOWERS, buildCost, validateCommand } from "../src/index";
import { scenario } from "./helpers/scenario";

const archer = TOWERS.archer.cost;
const raised = (steps: number) => archer + Math.floor((archer * Math.min(MARKET.raisePct * steps, MARKET.maxRaisePct)) / 100);

describe("market", () => {
  it("each tower of a kind a player buys makes the next one of that kind dearer for them", () => {
    const game = scenario({ seed: 1, gold: 1000 }).build("archer", { x: 3, y: 3 }).run(1);
    expect(game.gold()).toBe(1000 - archer);
    game.build("archer", { x: 4, y: 3 }).run(1);
    expect(game.gold()).toBe(1000 - archer - raised(1));
    expect(buildCost(game.state(), game.player(), "archer")).toBe(raised(2));
    expect(buildCost(game.state(), game.player(), "mage")).toBe(TOWERS.mage.cost);
  });

  it("the surcharge stops at its cap", () => {
    const game = scenario({ seed: 1, gold: 5000 });
    for (let i = 0; i < 8; i++) game.build("archer", { x: i, y: 3 });
    game.run(1);
    expect(buildCost(game.state(), game.player(), "archer")).toBe(raised(100));
  });

  it("buying never raises a teammate's prices", () => {
    const game = scenario({ seed: 1, gold: 1000, players: [0, 1] })
      .build("archer", { x: 3, y: 3, player: 0 })
      .run(1);
    expect(buildCost(game.state(), game.player(1), "archer")).toBe(archer);
  });

  it("every wave close lowers each surcharge a step", () => {
    const game = scenario({ seed: 3, waves: true, gold: 1000 }).build("archer", { x: 3, y: 3 }).build("archer", { x: 4, y: 3 }).run(1);
    expect(buildCost(game.state(), game.player(), "archer")).toBe(raised(2));
    game.runUntil((st) => st.wavesClosed === 1, 20000);
    expect(buildCost(game.state(), game.player(), "archer")).toBe(
      archer + Math.floor((archer * (2 * MARKET.raisePct - MARKET.decayPct)) / 100),
    );
  });

  it("the gold check uses the market price", () => {
    const game = scenario({ seed: 1, gold: archer + raised(1) - 1 })
      .build("archer", { x: 3, y: 3 })
      .run(1);
    const second = { type: "build" as const, tick: 0, playerId: 0, tower: "archer" as const, x: 4, y: 3 };
    expect(validateCommand(game.state(), second)).toBe("no_gold");
  });

  it("the first-tower discount applies on top of the market price", () => {
    const cut = (price: number) => price - Math.floor((price * DOCTRINES.firstCheap.firstTowerDiscountPct) / 100);
    const game = scenario({ seed: 3, waves: true, gold: 1000, doctrines: { 0: ["firstCheap"] } })
      .build("archer", { x: 3, y: 3 })
      .build("archer", { x: 4, y: 3 })
      .build("archer", { x: 5, y: 3 })
      .runUntil((st) => st.wave === 1, 20000);
    const before = game.gold();
    expect(buildCost(game.state(), game.player(), "archer")).toBe(cut(raised(3)));
    game.build("archer", { x: 6, y: 3 }).run(1);
    expect(before - game.gold()).toBe(cut(raised(3)));
  });

  it("selling a tower bought with a surcharge refunds its share of the base cost, never the surcharge", () => {
    const game = scenario({ seed: 1, gold: 1000 }).build("archer", { x: 3, y: 3 }).build("archer", { x: 4, y: 3 }).run(1);
    const before = game.gold();
    game.sell(game.tower(1).id).run(1);
    expect(game.gold() - before).toBe(Math.floor((archer * SELL_REFUND_PCT) / 100));
  });
});
