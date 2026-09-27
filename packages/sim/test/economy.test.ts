import { describe, expect, it } from "vitest";
import { ECONOMY, ENEMIES, GAME, TICKS_PER_SECOND, TOWERS, WAVES, validateCommand, type Command } from "../src/index";
import { scenario, type Scenario } from "./helpers/scenario";

const ids = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
const attenuated = (bounty: number, players: number): number => Math.floor((bounty * (players + 1)) / (2 * players));
const scaledHp = (hp: number, players: number): number => Math.floor((hp * (players + 1) * (players + 19)) / 40);

function killOneFast(players: number): Scenario {
  return scenario({ seed: 1, players: ids(players), gold: 0 })
    .tower("archer", { x: 4, y: 2, owner: 0 })
    .enemy("fast", { x: 4, y: 1, hp: 1 })
    .run(1);
}

function firstWaveHps(players: number): number[] {
  return scenario({ seed: 3, players: ids(players), waves: true })
    .runUntil((st) => st.wave === 1 && st.spawnQueue.length === 0, 1000)
    .enemies()
    .map((e) => e.hp);
}

describe("multiplayer economy", () => {
  it("with one player bounty, enemy hp and starting gold are the balance values", () => {
    expect(killOneFast(1).gold(0)).toBe(ENEMIES.fast.bounty);
    expect(attenuated(ENEMIES.normal.bounty, 1)).toBe(ENEMIES.normal.bounty);
    expect(scaledHp(ENEMIES.normal.hp, 1)).toBe(ENEMIES.normal.hp);
    expect(scenario({ seed: 1 }).gold(0)).toBe(GAME.startGold);
  });

  it("every player collects the attenuated bounty no matter whose tower killed", () => {
    for (const players of [2, 4, 8]) {
      const game = killOneFast(players);
      for (const id of ids(players)) expect(game.gold(id)).toBe(attenuated(ENEMIES.fast.bounty, players));
    }
    expect(attenuated(8, 2)).toBe(6);
    expect(attenuated(8, 4)).toBe(5);
    expect(attenuated(8, 8)).toBe(4);
  });

  it("enemies spawn with more hp per player while the count per wave stays the same", () => {
    const solo = firstWaveHps(1);
    for (const players of [2, 4, 8]) {
      const scaled = firstWaveHps(players);
      expect(scaled).toHaveLength(solo.length);
      expect(scaled).toEqual(solo.map((hp) => scaledHp(hp, players)));
    }
  });

  it("players in a multiplayer game start with 75% of the solo gold, late joiners included", () => {
    const duo = scenario({ seed: 1, players: [0, 1] });
    expect(duo.gold(0)).toBe(Math.floor((GAME.startGold * ECONOMY.multiplayerStartGoldPct) / 100));
    expect(duo.gold(1)).toBe(duo.gold(0));
    const joined = scenario({ seed: 1 }).join(1).run(1);
    expect(joined.gold(0)).toBe(GAME.startGold);
    expect(joined.gold(1)).toBe(Math.floor((GAME.startGold * ECONOMY.multiplayerStartGoldPct) / 100));
  });

  it("closing a wave pays interest on gold in hand, capped, once per wave, only when its last enemy is gone", () => {
    const lastSpawnTick = (s: Scenario): number => Math.max(...s.state().spawnQueue.map((e) => e.tick));
    const game = scenario({ seed: 3, waves: true, gold: 150 }).run(GAME.firstWaveTick + 1);
    const walkTicks = Math.ceil(((17 + 4 + 15 + 4 + 17) * 1000) / ENEMIES.normal.speed);
    const lastLeakTick = lastSpawnTick(game) + walkTicks;
    game.runUntil((st) => st.tick >= lastLeakTick - 5, 10000);
    expect(game.state().wavesClosed).toBe(0);
    expect(game.gold(0)).toBe(150);
    game.runUntil((st) => st.wavesClosed === 1, 100);
    expect(game.state().wavesClosed).toBe(1);
    expect(game.gold(0)).toBe(150 + Math.floor((150 * ECONOMY.interestPct) / 100));
    const capped = scenario({ seed: 3, waves: true, gold: 500 }).runUntil((st) => st.wavesClosed === 1, 10000);
    expect(capped.gold(0)).toBe(500 + ECONOMY.interestCapGold);
    capped.run(1);
    expect(capped.gold(0)).toBe(500 + ECONOMY.interestCapGold);
  });

  it("any player can call the next wave early and everyone earns one gold per second saved", () => {
    const game = scenario({ seed: 1, players: [0, 1], waves: true, gold: 0 })
      .callWave(1)
      .run(1);
    const saved = Math.floor(GAME.firstWaveTick / TICKS_PER_SECOND);
    expect(game.state().wave).toBe(1);
    expect(game.gold(0)).toBe(saved);
    expect(game.gold(1)).toBe(saved);
  });

  it("with four or more players two different players must call the same wave", () => {
    const game = scenario({ seed: 1, players: ids(4), waves: true, gold: 0 })
      .callWave(2)
      .run(1);
    expect(game.state().wave).toBe(0);
    expect(game.gold(2)).toBe(0);
    const repeat: Command = { type: "callWave", tick: game.state().tick, playerId: 2 };
    expect(validateCommand(game.state(), repeat)).toBe("already_called");
    game.callWave(3).run(1);
    expect(game.state().wave).toBe(1);
    for (const id of ids(4)) expect(game.gold(id)).toBe(Math.floor((GAME.firstWaveTick - 1) / TICKS_PER_SECOND));
  });

  it("the next wave can be called only once the current one is over", () => {
    const game = scenario({ seed: 3, waves: true, gold: 0 });
    for (let x = 0; x < 8; x++) game.tower("archer", { x, y: 0 });
    game.run(GAME.firstWaveTick + 1);
    expect(game.state().wave).toBe(1);
    const call: Command = { type: "callWave", tick: game.state().tick, playerId: 0 };
    expect(validateCommand(game.state(), call)).toBe("wave_in_progress");
    const goldBefore = game.gold(0);
    game.callWave().run(1);
    expect(game.state().wave).toBe(1);
    expect(game.gold(0)).toBe(goldBefore);
    game.runUntil((st) => st.wavesClosed === 1, 10000);
    expect(game.state().wave).toBe(1);
    const saved = Math.floor((game.state().nextWaveTick! - game.state().tick) / TICKS_PER_SECOND);
    expect(saved).toBeGreaterThan(0);
    const goldAtClose = game.gold(0);
    game.callWave().run(1);
    expect(game.state().wave).toBe(2);
    expect(game.gold(0)).toBe(goldAtClose + saved);
  });

  it("calling is rejected when no wave is pending", () => {
    const game = scenario({ seed: 1, waves: true, startWave: WAVES.length }).run(GAME.firstWaveTick + 1);
    expect(game.state().wave).toBe(WAVES.length);
    const call: Command = { type: "callWave", tick: game.state().tick, playerId: 0 };
    expect(validateCommand(game.state(), call)).toBe("wave_not_pending");
  });

  it("gifts move gold between players from wave three on, up to what the giver has", () => {
    const early = scenario({ seed: 1, players: [0, 1], gold: 100 })
      .gift(0, 1, 30)
      .run(1);
    expect(early.gold(0)).toBe(100);
    expect(validateCommand(early.state(), { type: "gift", tick: 0, playerId: 0, to: 1, amount: 30 })).toBe("gift_too_early");
    const late = scenario({ seed: 1, players: [0, 1], waves: true, startWave: ECONOMY.giftFromWave, gold: 100 }).run(
      GAME.firstWaveTick + 1,
    );
    expect(late.state().wave).toBe(ECONOMY.giftFromWave);
    late.gift(0, 1, 30).run(1);
    expect(late.gold(0)).toBe(70);
    expect(late.gold(1)).toBe(130);
    const st = late.state();
    expect(validateCommand(st, { type: "gift", tick: 0, playerId: 0, to: 1, amount: 71 })).toBe("no_gold");
    expect(validateCommand(st, { type: "gift", tick: 0, playerId: 0, to: 0, amount: 1 })).toBe("bad_amount");
    expect(validateCommand(st, { type: "gift", tick: 0, playerId: 0, to: 9, amount: 1 })).toBe("no_player");
    expect(validateCommand(st, { type: "gift", tick: 0, playerId: 0, to: 1, amount: 0 })).toBe("bad_amount");
    expect(TOWERS.archer.cost).toBeGreaterThan(0);
  });
});
