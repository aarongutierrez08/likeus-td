import { BALANCE_VERSION } from "./constants";
import { GAME } from "./balance/game";
import { DEFAULT_MAP, isMapId, type MapId } from "./balance/maps";
import { WAVES } from "./balance/waves";
import { seedRng } from "./rng";
import type { GameState } from "./types";

export interface InitialStateOptions {
  seed: number;
  mapId?: string;
  gold?: number;
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
    gold: opts.gold ?? GAME.startGold,
    lives: GAME.lives,
    wave: startWave - 1,
    nextWaveTick: GAME.firstWaveTick,
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
  return (opts.ranked ?? true) && opts.gold === undefined && opts.startWave === undefined;
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
