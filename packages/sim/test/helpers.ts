import { createInitialState, type InitialStateOptions } from "../src/state";
import { step } from "../src/step";
import type { Command, Enemy, EnemyKind, GameState, TowerKind } from "../src/types";

const NEVER = Number.MAX_SAFE_INTEGER;

/** State with waves disabled so tests can place enemies and towers by hand. */
export function sandbox(opts: Partial<InitialStateOptions> = {}): GameState {
  const state = createInitialState({ seed: 1, ...opts });
  state.nextWaveTick = NEVER;
  return state;
}

export function addEnemy(state: GameState, kind: EnemyKind, hp: number, progress = 0): Enemy {
  const enemy: Enemy = { id: state.nextId++, kind, hp, maxHp: hp, progress, lastHitBy: 0 };
  state.enemies.push(enemy);
  return enemy;
}

export function buildCmd(state: GameState, tower: TowerKind, x: number, y: number): Command {
  return { type: "build", tick: state.tick, playerId: 0, tower, x, y };
}

export function runTicks(state: GameState, ticks: number, commands: readonly Command[] = []): GameState {
  let s = state;
  for (let i = 0; i < ticks; i++) s = step(s, i === 0 ? commands : []);
  return s;
}
