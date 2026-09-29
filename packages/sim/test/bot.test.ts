import { describe, expect, it } from "vitest";
import {
  FP,
  TOWERS,
  TOWER_KINDS,
  createBot,
  getMap,
  hasAttack,
  isBuildable,
  pathCells,
  type Command,
  type GameState,
  type TowerKind,
} from "../src/index";
import { scenario } from "./helpers/scenario";

const cheapest = Math.min(...TOWER_KINDS.map((k) => TOWERS[k].cost));
const richest = Math.max(...TOWER_KINDS.map((k) => TOWERS[k].cost));

const builtKind = (commands: Command[]): TowerKind | null => {
  const first = commands[0];
  return first?.type === "build" ? first.tower : null;
};

describe("random bot", () => {
  it("chooses the kind first and saves until it can pay it instead of buying whatever is affordable", () => {
    const bought = new Set<TowerKind>();
    for (let seed = 0; seed < 20; seed++) {
      const fresh = createBot("variant", seed);
      const wanted = builtKind(fresh.decide(scenario({ seed: 1, gold: richest }).state()));
      expect(wanted).not.toBeNull();
      bought.add(wanted!);

      const saver = createBot("variant", seed);
      const decisionWhilePoor = builtKind(saver.decide(scenario({ seed: 1, gold: cheapest }).state()));
      if (TOWERS[wanted!].cost <= cheapest) {
        expect(decisionWhilePoor).toBe(wanted);
      } else {
        expect(decisionWhilePoor).toBeNull();
        expect(builtKind(saver.decide(scenario({ seed: 1, gold: richest }).state()))).toBe(wanted);
      }
    }
    expect(bought.size).toBeGreaterThan(1);
  });

  it("picks a new kind after each purchase", () => {
    const kinds = new Set<TowerKind>();
    const bot = createBot("variant", 3);
    for (let i = 0; i < 20; i++) kinds.add(builtKind(bot.decide(scenario({ seed: 1, gold: richest }).state()))!);
    expect(kinds.size).toBeGreaterThan(1);
  });
});

describe("informed bot", () => {
  const bestForOpeningWaves = "cannon";
  const cheaperAttack = "archer";

  it("buys the best attack tower it can pay when it owns nothing and cannot afford the best answer", () => {
    const opening = scenario({ seed: 1, gold: TOWERS[cheaperAttack].cost }).state();
    expect(builtKind(createBot("trivial").decide(opening))).toBe(cheaperAttack);
  });

  it("saves for the best answer once it owns a tower", () => {
    const defended = scenario({ seed: 1, gold: TOWERS[cheaperAttack].cost }).tower(cheaperAttack, { x: 4, y: 2 }).state();
    expect(createBot("trivial").decide(defended)).toEqual([]);
    const rich = scenario({ seed: 1, gold: TOWERS[bestForOpeningWaves].cost }).tower(cheaperAttack, { x: 4, y: 2 }).state();
    expect(builtKind(createBot("trivial").decide(rich))).toBe(bestForOpeningWaves);
  });
});

describe("random bot opening", () => {
  it("always starts with an attack tower and may buy anything afterwards", () => {
    const later = new Set<TowerKind>();
    for (let seed = 0; seed < 30; seed++) {
      const first = builtKind(createBot("variant", seed).decide(scenario({ seed: 1, gold: richest }).state()))!;
      expect(hasAttack(TOWERS[first])).toBe(true);
      const owning = scenario({ seed: 1, gold: richest }).tower("archer", { x: 4, y: 2 }).state();
      later.add(builtKind(createBot("variant", seed).decide(owning))!);
    }
    expect([...later].some((kind) => !hasAttack(TOWERS[kind]))).toBe(true);
  });
});

describe("bot placement", () => {
  const pathCellsCovered = (state: GameState, x: number, y: number, range: number): number =>
    pathCells(state.mapId).filter((c) => ((c.x - x) * FP) ** 2 + ((c.y - y) * FP) ** 2 <= range * range).length;
  const bestCoverage = (state: GameState, range: number): number => {
    const map = getMap(state.mapId);
    let best = 0;
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) if (isBuildable(state.mapId, x, y)) best = Math.max(best, pathCellsCovered(state, x, y, range));
    return best;
  };

  it("the informed bot builds where the tower's range covers the most path cells", () => {
    const opening = scenario({ seed: 1, gold: richest }).state();
    const command = createBot("trivial").decide(opening)[0]!;
    expect(command.type).toBe("build");
    if (command.type !== "build") return;
    const range = TOWERS[command.tower].range;
    expect(pathCellsCovered(opening, command.x, command.y, range)).toBe(bestCoverage(opening, range));
    expect(bestCoverage(opening, range)).toBeGreaterThan(pathCellsCovered(opening, 1, 2, range));
  });

  it("the random bot builds on one of the best covering cells for its tower", () => {
    for (let seed = 0; seed < 10; seed++) {
      const opening = scenario({ seed: 1, gold: richest }).state();
      const command = createBot("variant", seed).decide(opening)[0]!;
      if (command.type !== "build") throw new Error("expected a build");
      const range = TOWERS[command.tower].range;
      expect(pathCellsCovered(opening, command.x, command.y, range)).toBeGreaterThanOrEqual(bestCoverage(opening, range) - 1);
    }
  });
});
