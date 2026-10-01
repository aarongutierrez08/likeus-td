import { FP, TICKS_PER_SECOND } from "../constants";
import { getMap, distanceToPath, isBuildable, pathCells } from "../grid";
import { hasAttack, hasControl, hasReveal, hasWall, type Branch } from "../balance/define";
import { TOWER_KINDS, TOWERS, UPGRADE, towerDef } from "../balance/towers";
import { buildCost, upgradeCost } from "../commands";
import { cellCenterFP } from "../path";
import { inAuraSquare } from "../systems/towers";
import { bestAttackTower, multiplierAgainstWaves, upcomingWaves, wavesNeedReveal } from "../preview";
import { nextRng, seedRng } from "../rng";
import type { WaveDef } from "../balance/waves";
import type { Command, Deck, GameState, Tower, TowerKind } from "../types";
import { ABILITY_KINDS } from "../balance/abilities";
import { DECK } from "../balance/deck";
import { deckProblem } from "../deck";

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

const LOOKAHEAD_WAVES = 3;
/** Attack towers of the team an aura square or a slowing tower should serve before the bot buys one. */
const SUPPORT_FROM_TOWERS = 4;
const VARIANT_CELL_CHOICES = 3;
/** One in this many purchases the random bot plans an upgrade instead of a build. */
const VARIANT_UPGRADE_ODDS = 4;
/** The "more of the same" branch: the informed bot never gambles on identity. */
const SAFE_BRANCH: Branch = "a";

/** The towers of each role this player may buy: only what their deck holds. */
interface Kinds {
  attack: TowerKind[];
  radar: TowerKind | undefined;
  wall: TowerKind | undefined;
  damageAura: TowerKind | undefined;
  slow: TowerKind | undefined;
}

/** A deck never changes during a game, so its roles are worked out once per deck. */
const kindsCache = new WeakMap<readonly TowerKind[], Kinds>();

function kindsOf(state: GameState, playerId: number): Kinds {
  const deck = state.players.find((p) => p.id === playerId)?.deck.towers ?? [];
  const cached = kindsCache.get(deck);
  if (cached) return cached;
  const inDeck = TOWER_KINDS.filter((kind) => deck.includes(kind));
  const kinds: Kinds = {
    attack: inDeck.filter((kind) => hasAttack(TOWERS[kind])),
    radar: inDeck.find((kind) => hasReveal(TOWERS[kind])),
    wall: inDeck.find((kind) => hasWall(TOWERS[kind])),
    damageAura: inDeck.find((kind) => TOWERS[kind].auraStat === "damage"),
    slow: inDeck.find((kind) => TOWERS[kind].controlEffect === "slow"),
  };
  kindsCache.set(deck, kinds);
  return kinds;
}

/** Draws before giving up: a valid deck is the common case, so hitting this means the deck rules cannot be met. */
const RANDOM_DECK_ATTEMPTS = 1000;

/** A valid deck drawn with its own RNG, for bots that play a random deck. */
export function randomDeck(seed: number, towers: number): Deck {
  let rng = seedRng(seed);
  const shuffled = <T>(items: readonly T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      rng = nextRng(rng);
      const j = rng % (i + 1);
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  };
  for (let attempt = 0; attempt < RANDOM_DECK_ATTEMPTS; attempt++) {
    const deck = { towers: shuffled(TOWER_KINDS).slice(0, towers), abilities: shuffled(ABILITY_KINDS).slice(0, DECK.abilities) };
    if (deckProblem(deck, towers) === null) return deck;
  }
  throw new Error(`no valid deck of ${towers} towers in ${RANDOM_DECK_ATTEMPTS} draws: check DECK against the towers`);
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

function occupiedCells(state: GameState): Set<number> {
  const map = getMap(state.mapId);
  return new Set(state.towers.map((t) => t.y * map.width + t.x));
}

/** Free cells, the ones a tower of this kind covers more path from first; ties go to the closest to the path. */
function freeCellsByCoverage(state: GameState, kind: TowerKind): Cell[] {
  const map = getMap(state.mapId);
  const occupied = occupiedCells(state);
  const def = TOWERS[kind];
  const coverage = coverageByCell(state.mapId, Math.max(def.range, def.controlRange, def.revealRange));
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

function build(state: GameState, playerId: number, tower: TowerKind, cell: { x: number; y: number }): Command {
  return { type: "build", tick: state.tick, playerId, tower, x: cell.x, y: cell.y };
}

function upgrade(state: GameState, playerId: number, tower: Tower, branch: Branch): Command {
  const last = tower.level + 1 === UPGRADE.maxLevel && TOWERS[tower.kind].branches !== null;
  return last
    ? { type: "upgrade", tick: state.tick, playerId, towerId: tower.id, branch }
    : { type: "upgrade", tick: state.tick, playerId, towerId: tower.id };
}

function ownAttackTowers(state: GameState, playerId: number): Tower[] {
  return state.towers.filter((t) => t.owner === playerId && hasAttack(towerDef(t)));
}

/** Stealth is coming and no tower of the team can reveal it yet. */
function needsRadar(state: GameState, waves: readonly WaveDef[]): boolean {
  return wavesNeedReveal(waves) && !state.towers.some((t) => hasReveal(towerDef(t)));
}

function teamAttackTowers(state: GameState): Tower[] {
  return state.towers.filter((t) => hasAttack(towerDef(t)));
}

/** Base damage per second: what makes towers of different kinds comparable per gold. */
function damagePerSecond(kind: TowerKind): number {
  const def = TOWERS[kind];
  return hasAttack(def) ? (def.damage * TICKS_PER_SECOND) / def.cooldown : 0;
}

/** Whether a damage aura of anyone already boosts this tower: auras of one kind do not stack. */
function boostedByDamageAura(state: GameState, tower: Tower): boolean {
  return state.towers.some((a) => towerDef(a).auraStat === "damage" && inAuraSquare(a, towerDef(a).auraRadius, tower));
}

function reaches(tower: Tower, x: number, y: number): boolean {
  const def = towerDef(tower);
  const dx = cellCenterFP(tower.x) - cellCenterFP(x);
  const dy = cellCenterFP(tower.y) - cellCenterFP(y);
  return dx * dx + dy * dy <= def.range * def.range;
}

/** Before a boss: the path cell the bot's attack towers reach the most, nearest to the spawn on ties. */
function wallCell(state: GameState, playerId: number): { x: number; y: number } | null {
  const own = ownAttackTowers(state, playerId);
  const occupied = occupiedCells(state);
  const map = getMap(state.mapId);
  let best: { x: number; y: number; covered: number } | null = null;
  for (const c of pathCells(state.mapId)) {
    if (occupied.has(c.y * map.width + c.x)) continue;
    const covered = own.filter((t) => reaches(t, c.x, c.y)).length;
    if (best === null || covered > best.covered) best = { x: c.x, y: c.y, covered };
  }
  return best && best.covered > 0 ? best : null;
}

/** A free cell whose aura square holds at least SUPPORT_FROM_TOWERS attack towers of the team no damage aura boosts yet, the fullest first. */
function auraCell(state: GameState, kind: TowerKind): { x: number; y: number } | null {
  const unboosted = teamAttackTowers(state).filter((t) => !boostedByDamageAura(state, t));
  const radius = TOWERS[kind].auraRadius;
  let best: { x: number; y: number; inside: number } | null = null;
  for (const cell of freeCellsByCoverage(state, kind)) {
    const inside = unboosted.filter((t) => inAuraSquare(cell, radius, t)).length;
    if (inside >= SUPPORT_FROM_TOWERS && (best === null || inside > best.inside)) best = { x: cell.x, y: cell.y, inside };
  }
  return best;
}

interface Option {
  command: Command;
  cost: number;
  /** Path covered times the damage per second it adds against the coming armors, per gold: comparable between building and upgrading. */
  value: number;
}

/** What this player would pay for the tower right now, market and doctrines included. */
function priceFor(state: GameState, playerId: number, kind: TowerKind): number {
  const player = state.players.find((p) => p.id === playerId);
  return player ? buildCost(state, player, kind) : TOWERS[kind].cost;
}

function buildOption(state: GameState, playerId: number, kind: TowerKind, waves: readonly WaveDef[]): Option | null {
  const cell = freeCellsByCoverage(state, kind)[0];
  if (!cell) return null;
  const cost = priceFor(state, playerId, kind);
  return {
    command: build(state, playerId, kind, cell),
    cost,
    value: (cell.coverage * multiplierAgainstWaves(kind, waves) * damagePerSecond(kind)) / cost,
  };
}

/** Upgrading adds damagePctPerLevel of the base on the tower's own cell: worth it once the free cells are poor. */
function upgradeOption(state: GameState, playerId: number, waves: readonly WaveDef[]): Option | null {
  let best: Option | null = null;
  for (const tower of ownAttackTowers(state, playerId)) {
    if (tower.level >= UPGRADE.maxLevel) continue;
    const def = towerDef(tower);
    const map = getMap(state.mapId);
    const coverage = coverageByCell(state.mapId, def.range)[tower.y * map.width + tower.x]!;
    const cost = upgradeCost(tower.kind);
    const added = (damagePerSecond(tower.kind) * UPGRADE.damagePctPerLevel) / 100;
    const value = (coverage * multiplierAgainstWaves(tower.kind, waves) * added) / cost;
    if (best === null || value > best.value) best = { command: upgrade(state, playerId, tower, SAFE_BRANCH), cost, value };
  }
  return best;
}

/** One slowing tower in the team for every SUPPORT_FROM_TOWERS attack towers of the team. */
function teamNeedsControl(state: GameState): boolean {
  const control = state.towers.filter((t) => hasControl(towerDef(t))).length;
  return teamAttackTowers(state).length >= SUPPORT_FROM_TOWERS * (control + 1);
}

/**
 * What the informed bot wants next, in order: a wall right before a boss, a radar when stealth is coming,
 * a damage aura where enough unboosted towers of the team share a square, a slowing tower once the team has a line of attackers,
 * and otherwise the best attack tower for the next waves or an upgrade, whichever adds more damage over the path per gold.
 * It saves for what it wants; without any tower it buys the best attack tower it can pay, since waiting loses waves.
 */
function informedChoice(state: GameState, playerId: number, gold: number): Option | null {
  const waves = upcomingWaves(state, LOOKAHEAD_WAVES).map((w) => w.def);
  const own = ownAttackTowers(state, playerId);
  const player = state.players.find((p) => p.id === playerId);
  const next = upcomingWaves(state, 1)[0]?.def;
  const bossAhead = next?.groups.some((g) => g.kind === "boss") ?? false;
  const wallStanding = state.towers.some((t) => t.owner === playerId && hasWall(towerDef(t)));
  const kinds = kindsOf(state, playerId);
  if (kinds.wall && bossAhead && !wallStanding && player && state.tick >= player.wallReadyTick) {
    const cell = wallCell(state, playerId);
    if (cell) return { command: build(state, playerId, kinds.wall, cell), cost: priceFor(state, playerId, kinds.wall), value: 0 };
  }
  if (kinds.radar && needsRadar(state, waves)) {
    return buildOption(state, playerId, kinds.radar, waves);
  }
  if (own.length > 0) {
    const cell = kinds.damageAura ? auraCell(state, kinds.damageAura) : null;
    if (kinds.damageAura && cell)
      return { command: build(state, playerId, kinds.damageAura, cell), cost: priceFor(state, playerId, kinds.damageAura), value: 0 };
    const slow = kinds.slow && teamNeedsControl(state) ? buildOption(state, playerId, kinds.slow, waves) : null;
    if (slow) return slow;
  }
  const kind = bestAttackTower(waves, kinds.attack) ?? kinds.attack[0];
  if (kind === undefined) return null;
  const construct = buildOption(state, playerId, kind, waves);
  const improve = own.length > 0 ? upgradeOption(state, playerId, waves) : null;
  const chosen = improve && (construct === null || improve.value > construct.value) ? improve : construct;
  if (chosen && chosen.cost > gold && own.length === 0) {
    const affordable = bestAttackTower(
      waves,
      kinds.attack.filter((k) => priceFor(state, playerId, k) <= gold),
    );
    return affordable ? buildOption(state, playerId, affordable, waves) : null;
  }
  return chosen;
}

/**
 * Reference bot. "trivial" is the informed player: it looks three waves ahead, places towers where they cover
 * the most path, upgrades well-placed towers, adds support once it has a line of attackers and walls before
 * bosses. "variant" is the clumsy but reasonable player: for each purchase it plans a radar when stealth is coming
 * and the team has none, otherwise an upgrade with a random branch or a random attack tower, saves for it and builds
 * on one of the best cells, all driven by its own seeded RNG so many games per seed differ. It never buys economy or
 * support: without a model of their return it would measure a player who throws gold away, not the game.
 * Offered doctrines come first: the informed bot takes the one that fits what it built, the random one any.
 */
export function createBot(mode: BotMode, seed = 0, playerId = 0): Bot {
  let rng = seedRng(seed);
  const roll = (n: number): number => {
    rng = nextRng(rng);
    return rng % n;
  };
  let plan: { build: TowerKind } | { upgrade: number } | null = null;
  const nextPlan = (state: GameState, ownTowers: Tower[]): { build: TowerKind } | { upgrade: number } | null => {
    const kinds = kindsOf(state, playerId);
    if (
      kinds.radar &&
      needsRadar(
        state,
        upcomingWaves(state, LOOKAHEAD_WAVES).map((w) => w.def),
      )
    )
      return { build: kinds.radar };
    const upgradable = ownTowers.filter((t) => t.level < UPGRADE.maxLevel && !hasWall(towerDef(t)));
    if (upgradable.length > 0 && roll(VARIANT_UPGRADE_ODDS) === 0) return { upgrade: upgradable[roll(upgradable.length)]!.id };
    return kinds.attack.length > 0 ? { build: kinds.attack[roll(kinds.attack.length)]! } : null;
  };
  return {
    decide(state: GameState): Command[] {
      if (state.status !== "playing") return [];
      const offer = state.players.find((p) => p.id === playerId)?.doctrineOffer ?? [];
      if (offer.length > 0) {
        const doctrine = mode === "trivial" ? offer[0]! : offer[roll(offer.length)]!;
        return [{ type: "chooseDoctrine", tick: state.tick, playerId, doctrine }];
      }
      const gold = state.players.find((p) => p.id === playerId)?.gold ?? 0;
      if (mode === "trivial") {
        const choice = informedChoice(state, playerId, gold);
        return choice && choice.cost <= gold ? [choice.command] : [];
      }
      const ownTowers = state.towers.filter((t) => t.owner === playerId);
      plan ??= nextPlan(state, ownTowers);
      if (plan === null) return [];
      if ("upgrade" in plan) {
        const towerId = plan.upgrade;
        const tower = ownTowers.find((t) => t.id === towerId && t.level < UPGRADE.maxLevel);
        if (!tower) {
          plan = null;
          return [];
        }
        if (upgradeCost(tower.kind) > gold) return [];
        plan = null;
        return [upgrade(state, playerId, tower, roll(2) === 0 ? "a" : "b")];
      }
      const wanted = plan.build;
      if (
        wanted === kindsOf(state, playerId).radar &&
        !needsRadar(
          state,
          upcomingWaves(state, LOOKAHEAD_WAVES).map((w) => w.def),
        )
      ) {
        plan = null;
        return [];
      }
      if (priceFor(state, playerId, wanted) > gold) return [];
      const cells = freeCellsByCoverage(state, wanted);
      if (cells.length === 0) return [];
      plan = null;
      return [build(state, playerId, wanted, cells[roll(Math.min(VARIANT_CELL_CHOICES, cells.length))]!)];
    },
  };
}
