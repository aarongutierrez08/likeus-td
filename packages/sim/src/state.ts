import { BALANCE_VERSION } from "./constants";
import { GAME } from "./balance/game";
import { DEFAULT_MAP, isMapId, type MapId } from "./balance/maps";
import { WAVES } from "./balance/waves";
import { startingGold } from "./economy";
import { seedRng } from "./rng";
import type { GameState, Player } from "./types";

export interface PlayerSetup {
  id: number;
  gold?: number;
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
}

export function createInitialState(opts: InitialStateOptions): GameState {
  const mapId: MapId = resolveMapId(opts.mapId);
  const startWave = clampWave(opts.startWave ?? 1);
  return {
    balanceVersion: BALANCE_VERSION,
    seed: opts.seed,
    rng: seedRng(opts.seed),
    mapId,
    tick: 0,
    status: "playing",
    ranked: isRanked(opts),
    players: initialPlayers(opts),
    lives: GAME.lives,
    wave: startWave - 1,
    nextWaveTick: GAME.firstWaveTick,
    wavesClosed: startWave - 1,
    waveCalls: [],
    spawnQueue: [],
    nextId: 1,
    towers: [],
    enemies: [],
    stats: {
      kills: 0,
      leaks: 0,
      goldEarned: 0,
      damageByTower: { archer: 0, cannon: 0, aura: 0 },
    },
  };
}

function isRanked(opts: InitialStateOptions): boolean {
  const perPlayerOverride = opts.players?.some((p) => p.gold !== undefined) ?? false;
  return (opts.ranked ?? true) && opts.gold === undefined && !perPlayerOverride && opts.startWave === undefined;
}

function initialPlayers(opts: InitialStateOptions): Player[] {
  const setups = opts.players ?? [{ id: 0 }];
  return setups
    .map((p) => ({ id: p.id, gold: p.gold ?? opts.gold ?? startingGold(setups.length) }))
    .sort((a, b) => a.id - b.id);
}

function resolveMapId(id: string | undefined): MapId {
  if (id === undefined) return DEFAULT_MAP;
  if (!isMapId(id)) throw new Error(`Unknown map: ${id}`);
  return id;
}

function clampWave(wave: number): number {
  if (!Number.isInteger(wave)) return 1;
  return Math.max(1, Math.min(wave, WAVES.length));
}
