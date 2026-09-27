import { ENEMIES } from "../balance/enemies";
import { GAME } from "../balance/game";
import { WAVES } from "../balance/waves";
import { towerIncome } from "../commands";
import { interestOn, scaledEnemyHp } from "../economy";
import { rollJitter } from "../rng";
import type { GameState } from "../types";

function pct(value: number, percent: number): number {
  return Math.floor((value * percent) / 100);
}

/** Starts the next wave when its tick arrives, queueing every spawn with RNG jitter. */
export function scheduleWave(state: GameState): void {
  if (state.wave >= WAVES.length || state.nextWaveTick === null || state.tick < state.nextWaveTick) return;
  const wave = WAVES[state.wave]!;
  state.wave++;
  state.waveCalls = [];
  let t = state.tick;
  let first = true;
  for (const group of wave.groups) {
    const base = ENEMIES[group.kind];
    for (let i = 0; i < group.count; i++) {
      if (!first) t += group.spacing + rollJitter(state, pct(group.spacing, GAME.spacingJitterPct));
      first = false;
      state.spawnQueue.push({ tick: t, kind: group.kind, hp: pct(base.hp, wave.hpPct), wave: state.wave });
    }
  }
  state.nextWaveTick = null;
}

export function spawnDue(state: GameState): void {
  while (state.spawnQueue.length > 0 && state.spawnQueue[0]!.tick <= state.tick) {
    const entry = state.spawnQueue.shift()!;
    const hp = scaledEnemyHp(entry.hp, state.players.length);
    state.enemies.push({
      id: state.nextId++,
      kind: entry.kind,
      hp,
      maxHp: hp,
      progress: 0,
      lastHitBy: 0,
      wave: entry.wave,
    });
  }
}

/** A wave closes when it is fully spawned and none of its enemies remain; each close pays interest once. */
export function closeWaves(state: GameState): void {
  while (state.wavesClosed < state.wave) {
    const wave = state.wavesClosed + 1;
    const pending = state.spawnQueue.some((e) => e.wave === wave) || state.enemies.some((e) => e.wave === wave);
    if (pending) return;
    for (const tower of state.towers) {
      const income = towerIncome(tower);
      if (income === 0) continue;
      const owner = state.players.find((p) => p.id === tower.owner);
      if (!owner) continue;
      owner.gold += income;
      owner.earned += income;
    }
    for (const player of state.players) {
      const interest = interestOn(player.gold);
      player.gold += interest;
      player.earned += interest;
    }
    state.wavesClosed = wave;
    if (wave < WAVES.length) state.nextWaveTick = state.tick + 1 + GAME.waveGapTicks;
  }
}

export function checkEnd(state: GameState): void {
  if (state.lives <= 0) {
    state.status = "lost";
    return;
  }
  if (state.wave >= WAVES.length && state.spawnQueue.length === 0 && state.enemies.length === 0) {
    state.status = "won";
  }
}
