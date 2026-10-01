import { BALANCE_VERSION } from "./constants";
import { GAME } from "./balance/game";
import { DEFAULT_MAP, isMapId, type MapId } from "./balance/maps";
import { ABILITY_KINDS } from "./balance/abilities";
import { TOWER_KINDS } from "./balance/towers";
import { WAVES } from "./balance/waves";
import { startingGold } from "./economy";
import { pickColor } from "./colors";
import { seedRng } from "./rng";
import { deckProblem } from "./deck";
import { DECK } from "./balance/deck";
import { dailySeed } from "./waveDefs";
import type { AbilityKind, AbilitySlot, Deck, DoctrineKind, GameMode, GameState, Player, TowerKind } from "./types";

export interface PlayerSetup {
  id: number;
  gold?: number;
  /** Required when the game plays with decks. */
  deck?: Deck;
  /** Preferred color; the first free one when absent or taken. */
  color?: number;
  /** Doctrines this player starts with, for tests and dev URLs; any makes the game unranked. */
  doctrines?: DoctrineKind[];
}

export interface InitialStateOptions {
  seed: number;
  mapId?: string;
  /** Starting gold for every initial player. Any override makes the game unranked. */
  gold?: number;
  /** Players present from tick 0. Default: player 0 only. */
  players?: PlayerSetup[];
  /** 1-based wave to start at. The game begins right before that wave spawns. */
  startWave?: number;
  /** Set false to opt out of records; any gold or startWave override forces false. */
  ranked?: boolean;
  mode?: GameMode;
  /** Player who calls waves early; default the lowest id. */
  host?: number;
  /** Towers each player's deck holds (DECK.soloTowers or DECK.coopTowers). Absent: no decks, every card for everyone. */
  deckTowers?: number;
}

export function createInitialState(opts: InitialStateOptions): GameState {
  const mapId: MapId = resolveMapId(opts.mapId);
  const startWave = clampWave(opts.startWave ?? 1, opts.mode ?? "campaign");
  return {
    balanceVersion: BALANCE_VERSION,
    seed: opts.seed,
    rng: seedRng(opts.seed),
    mapId,
    tick: 0,
    status: "playing",
    ranked: isRanked(opts),
    deckTowers: opts.deckTowers ?? 0,
    mode: opts.mode ?? "campaign",
    players: initialPlayers(opts),
    lives: GAME.lives,
    wave: startWave - 1,
    nextWaveTick: GAME.firstWaveTick,
    wavesClosed: startWave - 1,
    host: opts.host ?? defaultHost(opts),
    detours: [],
    spawnQueue: [],
    nextId: 1,
    towers: [],
    enemies: [],
    blasts: [],
    frostZones: [],
    stats: {
      kills: 0,
      leaks: 0,
      goldEarned: 0,
      damageByTower: perTower(),
      shotsByTower: perTower(),
      hitsByTower: perTower(),
      damageByAbility: perAbility(() => 0),
    },
  };
}

/** The daily challenge: a solo endless game on the day's seed and the default map. Client, server and tests build it here. */
export function dailyStart(day: string, deck: Deck): GameState {
  return createInitialState({ seed: dailySeed(day), mode: "endless", deckTowers: DECK.soloTowers, players: [{ id: 0, deck }] });
}

function perTower(): Record<TowerKind, number> {
  return Object.fromEntries(TOWER_KINDS.map((kind) => [kind, 0])) as Record<TowerKind, number>;
}

function perAbility<T>(value: () => T): Record<AbilityKind, T> {
  return Object.fromEntries(ABILITY_KINDS.map((kind) => [kind, value()])) as Record<AbilityKind, T>;
}

/** Every player carries every ability, ready at level 1, until decks arrive (design step 10). */
export function freshAbilities(): Record<AbilityKind, AbilitySlot> {
  return perAbility(() => ({ level: 1, readyTick: 0 }));
}

/** A player who has not picked or been offered any doctrine yet. */
export function freshDoctrines(): Pick<Player, "doctrines" | "doctrineOffer" | "doctrineRerolled" | "lastBuildWave" | "surcharge"> {
  return { doctrines: [], doctrineOffer: [], doctrineRerolled: false, lastBuildWave: -1, surcharge: {} };
}

/** Every card: the deck of a player in a game without decks. */
export function fullDeck(): Deck {
  return { towers: [...TOWER_KINDS], abilities: [...ABILITY_KINDS] };
}

function initialDeck(setup: PlayerSetup, towers: number): Deck {
  if (towers === 0) return fullDeck();
  if (deckProblem(setup.deck, towers) !== null) throw new Error(`player ${setup.id} has no valid deck of ${towers} towers`);
  return { towers: [...setup.deck!.towers], abilities: [...setup.deck!.abilities] };
}

/** The lowest seat, or 0 for a lobby sim with nobody in it yet. */
function defaultHost(opts: InitialStateOptions): number {
  const ids = (opts.players ?? [{ id: 0 }]).map((p) => p.id);
  return ids.length === 0 ? 0 : Math.min(...ids);
}

function isRanked(opts: InitialStateOptions): boolean {
  const perPlayerOverride = opts.players?.some((p) => p.gold !== undefined || (p.doctrines?.length ?? 0) > 0) ?? false;
  return (opts.ranked ?? true) && opts.gold === undefined && !perPlayerOverride && opts.startWave === undefined;
}

function initialPlayers(opts: InitialStateOptions): Player[] {
  const setups = [...(opts.players ?? [{ id: 0 }])].sort((a, b) => a.id - b.id);
  const players: Player[] = [];
  for (const p of setups) {
    const color = pickColor(players, p.color);
    players.push({
      id: p.id,
      gold: p.gold ?? opts.gold ?? startingGold(setups.length),
      earned: 0,
      wallReadyTick: 0,
      color,
      abilities: freshAbilities(),
      deck: initialDeck(p, opts.deckTowers ?? 0),
      ...freshDoctrines(),
      doctrines: [...(p.doctrines ?? [])],
    });
  }
  return players;
}

function resolveMapId(id: string | undefined): MapId {
  if (id === undefined) return DEFAULT_MAP;
  if (!isMapId(id)) throw new Error(`Unknown map: ${id}`);
  return id;
}

/** Endless games may start past the campaign; campaign ones stop at its last wave. */
function clampWave(wave: number, mode: GameMode): number {
  if (!Number.isInteger(wave)) return 1;
  return Math.max(1, mode === "endless" ? wave : Math.min(wave, WAVES.length));
}
