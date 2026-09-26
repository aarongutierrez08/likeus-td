import { describe, expect, it } from "vitest";
import { createBot, createInitialState, hashState, step, type GameState } from "../src/index";

function play(seed: number, ticks: number): { states: GameState[]; hashes: string[] } {
  const bot = createBot("trivial");
  let state = createInitialState({ seed });
  const states: GameState[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < ticks; i++) {
    state = step(state, bot.decide(state));
    states.push(state);
    hashes.push(hashState(state));
  }
  return { states, hashes };
}

describe("determinism", () => {
  it("two sims with the same seed and commands produce identical states every tick", () => {
    const first = play(42, 2000);
    const second = play(42, 2000);
    for (let i = 0; i < first.states.length; i++) {
      expect(JSON.stringify(first.states[i])).toBe(JSON.stringify(second.states[i]));
      expect(first.hashes[i]).toBe(second.hashes[i]);
    }
    const last = first.states[first.states.length - 1]!;
    expect(last.enemies.length + last.towers.length).toBeGreaterThan(0);
  });

  it("different seeds diverge", () => {
    const a = play(42, 600);
    const b = play(43, 600);
    expect(a.hashes[a.hashes.length - 1]).not.toBe(b.hashes[b.hashes.length - 1]);
  });

  it("step never mutates its input", () => {
    const initial = createInitialState({ seed: 7 });
    const snapshot = JSON.stringify(initial);
    let state = initial;
    for (let i = 0; i < 300; i++) state = step(state);
    expect(JSON.stringify(initial)).toBe(snapshot);
  });

  it("state survives a JSON round trip unchanged", () => {
    const { states } = play(5, 500);
    const last = states[states.length - 1]!;
    const revived = JSON.parse(JSON.stringify(last)) as GameState;
    expect(hashState(revived)).toBe(hashState(last));
    expect(hashState(step(revived))).toBe(hashState(step(last)));
  });
});
