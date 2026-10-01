import { describe, expect, it } from "vitest";
import { DETOUR, FP, GAME, MAPS, detourCells, pathCells, pathLength, positionAt, routeOf, validateCommand } from "../src/index";
import { scenario } from "./helpers/scenario";

const detour = 0;
const { via, skipped } = detourCells("s", detour);
const open = (playerId = 0) => ({ type: "openDetour" as const, tick: 0, playerId, detour });

describe("detours", () => {
  it("every map has a couple of detours at most, on ordered stretches that never overlap", () => {
    for (const map of Object.values(MAPS)) {
      expect(map.detours.length).toBeGreaterThan(0);
      expect(map.detours.length).toBeLessThanOrEqual(2);
      for (let i = 0; i < map.detours.length; i++) {
        const d = map.detours[i]!;
        expect(d.from).toBeLessThan(d.to);
        if (i > 0) expect(map.detours[i - 1]!.to).toBeLessThanOrEqual(d.from);
      }
    }
  });

  it("two detours open at once both reshape the path", () => {
    const game = scenario({ seed: 1, gold: 1000 }).openDetour(0).run(1).openDetour(1).run(1);
    expect(game.state().detours).toEqual([0, 1]);
    const cells = pathCells(routeOf(game.state()));
    for (const i of [0, 1]) {
      const cellsOf = detourCells("s", i);
      for (const c of cellsOf.via) expect(cells).toContainEqual(c);
      for (const c of cellsOf.skipped) expect(cells).not.toContainEqual(c);
    }
  });

  it("a wave already called keeps the path shut, even before its first enemy shows up", () => {
    const game = scenario({ seed: 1, gold: 1000, waves: true }).run(GAME.firstWaveTick + 1);
    expect(game.state().wave).toBe(1);
    expect(validateCommand(game.state(), open())).toBe("wave_in_progress");
  });

  it("the host opens one between waves for gold, and the path gets longer through its cells", () => {
    const game = scenario({ seed: 1, gold: 1000, waves: true }).run(0);
    const before = pathLength(routeOf(game.state()));
    game.openDetour(detour).run(1);
    expect(game.state().detours).toEqual([detour]);
    expect(game.gold()).toBe(1000 - DETOUR.cost);
    const route = routeOf(game.state());
    expect(pathLength(route)).toBeGreaterThan(before);
    const cells = pathCells(route);
    for (const c of via) expect(cells).toContainEqual(c);
    for (const c of skipped) expect(cells).not.toContainEqual(c);
  });

  it("enemies of the next wave walk the detour", () => {
    const deepest = via.reduce((a, c) => (c.y > a.y ? c : a));
    const inDeepest = (route: string, progress: number) => {
      const p = positionAt(route, progress);
      return Math.floor(p.x / FP) === deepest.x && Math.floor(p.y / FP) === deepest.y;
    };
    const game = scenario({ seed: 1, gold: 1000, waves: true }).openDetour(detour).run(1);
    game.runUntil((st) => st.enemies.some((e) => inDeepest(routeOf(st), e.progress)), 20000);
    expect(game.enemies().some((e) => inDeepest(routeOf(game.state()), e.progress))).toBe(true);
  });

  it("only the host, only between waves, only once, only with gold and with its cells free", () => {
    const game = scenario({ seed: 1, gold: 1000, players: [0, 1] }).run(0);
    expect(validateCommand(game.state(), open(1))).toBe("not_host");
    expect(validateCommand(game.state(), { ...open(), detour: 9 })).toBe("bad_detour");
    const broke = scenario({ seed: 1, gold: DETOUR.cost - 1 }).run(0);
    expect(validateCommand(broke.state(), open())).toBe("no_gold");
    const blocked = scenario({ seed: 1, gold: 1000 }).tower("archer", { x: via[1]!.x, y: via[1]!.y }).run(0);
    expect(validateCommand(blocked.state(), open())).toBe("detour_blocked");
    const walled = scenario({ seed: 1, gold: 1000 }).tower("wall", { x: skipped[0]!.x, y: skipped[0]!.y }).run(0);
    expect(validateCommand(walled.state(), open())).toBe("detour_blocked");
    const busy = scenario({ seed: 1, gold: 1000 }).enemy("normal", { x: 0, y: 1 }).run(0);
    expect(validateCommand(busy.state(), open())).toBe("wave_in_progress");
    game.openDetour(detour).run(1);
    expect(validateCommand(game.state(), open())).toBe("already_open");
  });

  it("once open, its cells are path and the stretch it skips takes no towers", () => {
    const game = scenario({ seed: 1, gold: 1000 }).openDetour(detour).run(1);
    const build = (x: number, y: number, tower: "archer" | "wall") => ({ type: "build" as const, tick: 0, playerId: 0, tower, x, y });
    expect(validateCommand(game.state(), build(via[1]!.x, via[1]!.y, "archer"))).toBe("on_path");
    expect(validateCommand(game.state(), build(via[1]!.x, via[1]!.y, "wall"))).toBeNull();
    expect(validateCommand(game.state(), build(skipped[0]!.x, skipped[0]!.y, "archer"))).toBe("on_path");
    expect(validateCommand(game.state(), build(skipped[0]!.x, skipped[0]!.y, "wall"))).toBe("not_on_path");
  });
});
