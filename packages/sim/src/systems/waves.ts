import { bossAffix, initialShield } from "../affixes";
import { ENEMIES } from "../balance/enemies";
import { ECONOMY, MARKET } from "../balance/economy";
import { GAME } from "../balance/game";
import { TOWER_KINDS, towerDef } from "../balance/towers";
import type { SpawnGroup, WaveDef } from "../balance/waves";
import { waveDef } from "../waveDefs";
import { towerIncome } from "../commands";
import { interestOn, scaledEnemyHp } from "../economy";
import { rollInt, rollJitter } from "../rng";
import type { GameState, Player } from "../types";
import { doctrineEffect, expireOffers, offerDoctrines } from "./doctrines";

function pct(value: number, percent: number): number {
  return Math.floor((value * percent) / 100);
}

/** Spawn order of a wave: its common enemies shuffled with the sim RNG, then its bosses. */
function spawnOrder(state: GameState, wave: WaveDef): SpawnGroup[] {
  const commons: SpawnGroup[] = [];
  const bosses: SpawnGroup[] = [];
  for (const group of wave.groups) {
    for (let i = 0; i < group.count; i++) (group.kind === "boss" ? bosses : commons).push(group);
  }
  for (let i = commons.length - 1; i > 0; i--) {
    const j = rollInt(state, i + 1);
    [commons[i], commons[j]] = [commons[j]!, commons[i]!];
  }
  return [...commons, ...bosses];
}

/** Starts the next wave when its tick arrives, queueing every spawn in mixed order with RNG jitter. */
export function scheduleWave(state: GameState): void {
  const wave = waveDef(state, state.wave + 1);
  if (!wave || state.nextWaveTick === null || state.tick < state.nextWaveTick) return;
  state.wave++;
  expireOffers(state);
  let t = state.tick;
  let first = true;
  for (const { kind, spacing } of spawnOrder(state, wave)) {
    if (!first) t += spacing + rollJitter(state, pct(spacing, GAME.spacingJitterPct));
    first = false;
    const affix = kind === "boss" ? bossAffix(state.seed, state.wave) : null;
    state.spawnQueue.push({ tick: t, kind, hp: pct(ENEMIES[kind].hp, wave.hpPct), wave: state.wave, affix });
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
      slowPct: 0,
      slowUntil: 0,
      stunUntil: 0,
      shield: initialShield(entry.kind, entry.affix),
      affix: entry.affix,
    });
  }
}

/** A wave closes when it is fully spawned and none of its enemies remain; each close pays interest once. */
export function closeWaves(state: GameState): void {
  while (state.wavesClosed < state.wave) {
    const wave = state.wavesClosed + 1;
    const pending = state.spawnQueue.some((e) => e.wave === wave) || state.enemies.some((e) => e.wave === wave);
    if (pending) return;
    const capBonus = new Map<number, number>();
    for (const tower of state.towers) {
      const income = towerIncome(tower);
      if (income === 0) continue;
      const owner = state.players.find((p) => p.id === tower.owner);
      if (!owner) continue;
      if (towerDef(tower).incomeMode === "interestCap") {
        capBonus.set(owner.id, (capBonus.get(owner.id) ?? 0) + income);
        continue;
      }
      owner.gold += income;
      owner.earned += income;
    }
    for (const player of state.players) {
      const cap = ECONOMY.interestCapGold + (capBonus.get(player.id) ?? 0) + doctrineEffect(state, player.id, "interestCapGold");
      const interest = interestOn(player.gold, cap, ECONOMY.interestPct + doctrineEffect(state, player.id, "interestPct"));
      player.gold += interest;
      player.earned += interest;
    }
    for (const player of state.players) coolMarket(player);
    state.wavesClosed = wave;
    offerDoctrines(state, wave, waveDef(state, wave + 1) !== null);
    if (waveDef(state, wave + 1)) state.nextWaveTick = state.tick + 1 + GAME.waveGapTicks;
  }
}

/** Each surcharge drops a step at a wave close; a kind at zero leaves the record, so a fresh market is empty. */
function coolMarket(player: Player): void {
  for (const kind of TOWER_KINDS) {
    const left = (player.surcharge[kind] ?? 0) - MARKET.decayPct;
    if (left > 0) player.surcharge[kind] = left;
    else delete player.surcharge[kind];
  }
}

export function checkEnd(state: GameState): void {
  if (state.lives <= 0) {
    state.status = "lost";
    return;
  }
  if (!waveDef(state, state.wave + 1) && state.spawnQueue.length === 0 && state.enemies.length === 0) {
    state.status = "won";
  }
}
