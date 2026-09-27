import { ENEMIES } from "../balance/enemies";
import { GAME } from "../balance/game";
import { WAVES } from "../balance/waves";
import { interestOn, scaledEnemyHp } from "../economy";
import { rollJitter } from "../rng";
import type { GameState } from "../types";

function pct(value: number, percent: number): number {
  return Math.floor((value * percent) / 100);
}

/** Starts the next wave when its tick arrives, queueing every spawn with RNG jitter. */
export function scheduleWave(state: GameState): void {
  if (state.wave >= WAVES.length || state.tick < state.nextWaveTick) return;
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
      const baseHp = pct(base.hp, wave.hpPct);
      const hp = baseHp + rollJitter(state, pct(baseHp, GAME.hpJitterPct));
      state.spawnQueue.push({ tick: t, kind: group.kind, hp, wave: state.wave });
    }
  }
  state.nextWaveTick = t + GAME.waveGapTicks;
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
    for (const player of state.players) player.gold += interestOn(player.gold);
    state.wavesClosed = wave;
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
