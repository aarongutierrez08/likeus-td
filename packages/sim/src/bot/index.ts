import { getMap, distanceToPath, isBuildable } from "../grid";
import { TOWER_KINDS, TOWERS } from "../balance/towers";
import { nextRng, seedRng } from "../rng";
import type { Command, GameState, TowerKind } from "../types";

export type BotMode = "trivial" | "variant";

export interface Bot {
  decide(state: GameState): Command[];
}

interface Cell {
  x: number;
  y: number;
  dist: number;
}

function freeCellsByPathDistance(state: GameState): Cell[] {
  const map = getMap(state.mapId);
  const occupied = new Set(state.towers.map((t) => t.y * map.width + t.x));
  const cells: Cell[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (!isBuildable(state.mapId, x, y) || occupied.has(y * map.width + x)) continue;
      cells.push({ x, y, dist: distanceToPath(state.mapId, x, y) });
    }
  }
  cells.sort((a, b) => a.dist - b.dist || a.y - b.y || a.x - b.x);
  return cells;
}

function cheapestTower(): TowerKind {
  return TOWER_KINDS.reduce((best, kind) => (TOWERS[kind].cost < TOWERS[best].cost ? kind : best));
}

function build(state: GameState, tower: TowerKind, cell: Cell): Command {
  return { type: "build", tick: state.tick, playerId: 0, tower, x: cell.x, y: cell.y };
}

/**
 * Reference bot. "trivial" buys the cheapest tower on the free cell closest to the path
 * (deterministic). "variant" picks a random affordable tower and one of the closest cells,
 * driven by its own seeded RNG so many games per seed differ.
 */
export function createBot(mode: BotMode, seed = 0): Bot {
  let rng = seedRng(seed);
  const roll = (n: number): number => {
    rng = nextRng(rng);
    return rng % n;
  };
  const VARIANT_CELL_CHOICES = 3;
  return {
    decide(state: GameState): Command[] {
      if (state.status !== "playing") return [];
      const affordable = TOWER_KINDS.filter((k) => TOWERS[k].cost <= state.gold);
      if (affordable.length === 0) return [];
      const cells = freeCellsByPathDistance(state);
      if (cells.length === 0) return [];
      if (mode === "trivial") {
        const kind = cheapestTower();
        if (TOWERS[kind].cost > state.gold) return [];
        return [build(state, kind, cells[0]!)];
      }
      const kind = affordable[roll(affordable.length)]!;
      const cell = cells[roll(Math.min(VARIANT_CELL_CHOICES, cells.length))]!;
      return [build(state, kind, cell)];
    },
  };
}
