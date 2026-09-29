import { FP } from "../constants";
import { getMap, distanceToPath, isBuildable, pathCells } from "../grid";
import { hasAttack, hasReveal, hasWall } from "../balance/define";
import { TOWER_KINDS, TOWERS } from "../balance/towers";
import { bestAttackTower, upcomingWaves, wavesNeedReveal } from "../preview";
import { nextRng, seedRng } from "../rng";
import type { Command, GameState, TowerKind } from "../types";

export type BotMode = "trivial" | "variant";

export interface Bot {
  decide(state: GameState): Command[];
}

interface Cell {
  x: number;
  y: number;
  /** Path cells whose center a tower of the given range reaches from here. */
  coverage: number;
  dist: number;
}

const coverageCache = new Map<string, number[]>();

/** Path cells within `range` of every cell of the map, indexed by y * width + x. Static per map and range. */
function coverageByCell(mapId: GameState["mapId"], range: number): number[] {
  const key = `${mapId}:${range}`;
  const cached = coverageCache.get(key);
  if (cached) return cached;
  const map = getMap(mapId);
  const path = pathCells(mapId);
  const coverage: number[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      let n = 0;
      for (const c of path) {
        const dx = (c.x - x) * FP;
        const dy = (c.y - y) * FP;
        if (dx * dx + dy * dy <= range * range) n++;
      }
      coverage.push(n);
    }
  }
  coverageCache.set(key, coverage);
  return coverage;
}

/** Free cells, the ones a tower of this kind covers more path from first; ties go to the closest to the path. */
function freeCellsByCoverage(state: GameState, kind: TowerKind): Cell[] {
  const map = getMap(state.mapId);
  const occupied = new Set(state.towers.map((t) => t.y * map.width + t.x));
  const coverage = coverageByCell(state.mapId, TOWERS[kind].range);
  const cells: Cell[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (!isBuildable(state.mapId, x, y) || occupied.has(y * map.width + x)) continue;
      cells.push({ x, y, coverage: coverage[y * map.width + x]!, dist: distanceToPath(state.mapId, x, y) });
    }
  }
  cells.sort((a, b) => b.coverage - a.coverage || a.dist - b.dist || a.y - b.y || a.x - b.x);
  return cells;
}

const LOOKAHEAD_WAVES = 3;

const ATTACK_KINDS = TOWER_KINDS.filter((kind) => hasAttack(TOWERS[kind]));
/** What the random bot may buy: anything that goes on a free cell, so no walls. */
const OFF_PATH_KINDS = TOWER_KINDS.filter((kind) => !hasWall(TOWERS[kind]));

/**
 * The attack tower that hits what is coming best, saving for it if needed; the cheapest one once no wave is left
 * to look at. Without any tower yet, the best it can pay right now: saving with an empty map loses the opening waves.
 */
function preferredTower(state: GameState, gold: number, ownsTowers: boolean): TowerKind | null {
  const waves = upcomingWaves(state, LOOKAHEAD_WAVES).map((w) => w.def);
  const radar = TOWER_KINDS.find((kind) => hasReveal(TOWERS[kind]));
  if (radar && wavesNeedReveal(waves) && !state.towers.some((t) => hasReveal(TOWERS[t.kind]))) return radar;
  const best =
    bestAttackTower(waves) ?? TOWER_KINDS.reduce((cheapest, kind) => (TOWERS[kind].cost < TOWERS[cheapest].cost ? kind : cheapest));
  if (TOWERS[best].cost <= gold || ownsTowers) return best;
  return bestAttackTower(
    waves,
    ATTACK_KINDS.filter((kind) => TOWERS[kind].cost <= gold),
  );
}

function build(state: GameState, playerId: number, tower: TowerKind, cell: Cell): Command {
  return { type: "build", tick: state.tick, playerId, tower, x: cell.x, y: cell.y };
}

/**
 * Reference bot. "trivial" buys the attack tower with the best multiplier against the next waves,
 * on the free cell where its range covers the most path (deterministic), and waits until it can afford it. "variant"
 * picks a random tower kind, saves until it can pay it, and builds on one of the best covering cells, driven by its
 * own seeded RNG so many games per seed differ. Placing next to the path instead covers a single lane and makes every
 * measurement three times easier than a player who builds between two lanes. Choosing among the affordable kinds instead would skew every random game to the cheapest
 * tower. Its first tower is always an attack tower: a mine or an aura alone is not a reasonable opening.
 */
export function createBot(mode: BotMode, seed = 0, playerId = 0): Bot {
  let rng = seedRng(seed);
  const roll = (n: number): number => {
    rng = nextRng(rng);
    return rng % n;
  };
  const VARIANT_CELL_CHOICES = 3;
  let wanted: TowerKind | null = null;
  return {
    decide(state: GameState): Command[] {
      if (state.status !== "playing") return [];
      const gold = state.players.find((p) => p.id === playerId)?.gold ?? 0;
      const ownsTowers = state.towers.some((t) => t.owner === playerId);
      if (mode === "trivial") {
        const kind = preferredTower(state, gold, ownsTowers);
        if (kind === null || TOWERS[kind].cost > gold) return [];
        const cells = freeCellsByCoverage(state, kind);
        return cells.length === 0 ? [] : [build(state, playerId, kind, cells[0]!)];
      }
      const pool = ownsTowers ? OFF_PATH_KINDS : ATTACK_KINDS;
      wanted ??= pool[roll(pool.length)]!;
      if (TOWERS[wanted].cost > gold) return [];
      const cells = freeCellsByCoverage(state, wanted);
      if (cells.length === 0) return [];
      const command = build(state, playerId, wanted, cells[roll(Math.min(VARIANT_CELL_CHOICES, cells.length))]!);
      wanted = null;
      return [command];
    },
  };
}
