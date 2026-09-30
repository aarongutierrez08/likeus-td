import { describe, expect, it } from "vitest";
import {
  ENEMIES,
  FP,
  TOWERS,
  TOWER_KINDS,
  WAVES,
  createBot,
  getMap,
  hasAttack,
  isBuildable,
  isPathCell,
  pathCells,
  type Command,
  type GameState,
  type TowerKind,
} from "../src/index";
import { scenario, type Scenario } from "./helpers/scenario";

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

describe("informed bot and radar", () => {
  it("buys a radar before a stealth wave when the map has none", () => {
    const stealthWave = WAVES.findIndex((w) => w.groups.some((g) => ENEMIES[g.kind].stealth)) + 1;
    expect(stealthWave).toBeGreaterThan(0);
    const before = scenario({ seed: 1, waves: true, startWave: stealthWave, gold: richest }).state();
    expect(builtKind(createBot("trivial").decide(before))).toBe("radar");
    const covered = scenario({ seed: 1, waves: true, startWave: stealthWave, gold: richest }).tower("radar", { x: 4, y: 2 }).state();
    expect(builtKind(createBot("trivial").decide(covered))).not.toBe("radar");
  });
});

describe("informed bot spending", () => {
  const longest = Math.max(...TOWER_KINDS.map((k) => TOWERS[k].range));
  const coverageOf = (x: number, y: number): number =>
    pathCells("s").filter((c) => ((c.x - x) * FP) ** 2 + ((c.y - y) * FP) ** 2 <= longest * longest).length;
  /** Every free cell that covers at least `min` path cells gets a rival's archer, so building elsewhere is a poor deal. */
  const crowded = (min: number, mine: { x: number; y: number; level: number }): Scenario => {
    const game = scenario({ seed: 1, players: [0, 1], gold: TOWERS.archer.cost });
    const map = getMap("s");
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        if (!isBuildable("s", x, y) || (x === mine.x && y === mine.y)) continue;
        if (coverageOf(x, y) >= min) game.tower("archer", { x, y, owner: 1 });
      }
    game.tower("archer", { x: mine.x, y: mine.y, owner: 0 });
    game.run(0);
    const own = game.towers().find((t) => t.owner === 0)!;
    own.level = mine.level;
    return game;
  };

  it("upgrades its well-placed tower when every remaining cell covers much less path", () => {
    const game = crowded(5, { x: 15, y: 3, level: 1 });
    const command = createBot("trivial").decide(game.state())[0];
    expect(command?.type).toBe("upgrade");
  });

  it("takes the first branch when the upgrade is the last level", () => {
    const game = crowded(5, { x: 15, y: 3, level: 2 });
    const command = createBot("trivial").decide(game.state())[0];
    expect(command?.type === "upgrade" && command.branch).toBe("a");
  });

  it("builds a damage aura where four of its attack towers share the square", () => {
    const game = scenario({ seed: 1, gold: TOWERS.aura.cost })
      .tower("archer", { x: 14, y: 3 })
      .tower("archer", { x: 16, y: 3 })
      .tower("archer", { x: 14, y: 2 })
      .tower("archer", { x: 16, y: 2 })
      .run(0);
    const command = createBot("trivial").decide(game.state())[0];
    expect(command?.type === "build" && command.tower).toBe("aura");
    expect(command?.type === "build" && Math.max(Math.abs(command.x - 15), Math.abs(command.y - 2.5))).toBeLessThanOrEqual(2);
  });

  it("adds a slowing tower once it has four attack towers and no control", () => {
    const game = scenario({ seed: 1, gold: TOWERS.frost.cost })
      .tower("archer", { x: 14, y: 3 })
      .tower("archer", { x: 16, y: 3 })
      .tower("archer", { x: 13, y: 3 })
      .tower("archer", { x: 12, y: 3 })
      .tower("aura", { x: 15, y: 3 })
      .run(0);
    const command = createBot("trivial").decide(game.state())[0];
    expect(command?.type === "build" && command.tower).toBe("frost");
  });

  it("puts a wall on the path cell its towers cover best right before a boss wave", () => {
    const bossWave = WAVES.findIndex((w) => w.groups.some((g) => g.kind === "boss")) + 1;
    const game = scenario({ seed: 1, waves: true, startWave: bossWave, gold: TOWERS.wall.cost })
      .tower("archer", { x: 15, y: 3 })
      .tower("archer", { x: 16, y: 3 })
      .run(0);
    const command = createBot("trivial").decide(game.state())[0];
    expect(command?.type === "build" && command.tower).toBe("wall");
    expect(command?.type === "build" && isPathCell("s", command.x, command.y)).toBe(true);
    expect(command?.type === "build" && command.y).toBe(1);
  });
});

describe("random bot spending", () => {
  it("sometimes upgrades one of its towers instead of building, choosing any branch", () => {
    const kinds = new Set<string>();
    let upgrades = 0;
    for (let seed = 0; seed < 40; seed++) {
      const game = scenario({ seed: 1, gold: richest }).tower("archer", { x: 15, y: 3 }).run(0);
      game.tower(0).level = 2;
      const command = createBot("variant", seed).decide(game.state())[0];
      if (command?.type === "upgrade") {
        upgrades++;
        kinds.add(command.branch ?? "none");
      }
    }
    expect(upgrades).toBeGreaterThan(0);
    expect(upgrades).toBeLessThan(40);
    expect(kinds.has("a") || kinds.has("b")).toBe(true);
  });
});
