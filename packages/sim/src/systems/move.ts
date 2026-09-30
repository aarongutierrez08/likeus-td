import { AFFIXES } from "../balance/affixes";
import { hasWall } from "../balance/define";
import { ENEMIES } from "../balance/enemies";
import { towerDef } from "../balance/towers";
import { FP } from "../constants";
import { pathIndex } from "../grid";
import { pathLength, positionAt } from "../path";
import { frostZonePct } from "./abilities";
import type { Enemy, GameState, Tower } from "../types";

/** Speed this tick: zero while stunned, reduced by the strongest of its own slow and the frost zone it stands in. */
export function currentSpeed(state: GameState, enemy: Enemy): number {
  if (state.tick < enemy.stunUntil) return 0;
  const base = ENEMIES[enemy.kind].speed;
  const speed = enemy.affix === "fast" ? Math.floor((base * (100 + AFFIXES.fast.speedPct)) / 100) : base;
  const own = state.tick < enemy.slowUntil ? enemy.slowPct : 0;
  const p = state.frostZones.length > 0 ? positionAt(state.mapId, enemy.progress) : null;
  const pct = Math.max(own, p ? frostZonePct(state, p.x, p.y) : 0);
  return pct > 0 ? Math.floor((speed * (100 - pct)) / 100) : speed;
}

interface Block {
  wall: Tower;
  /** Progress at which enemies stop: the edge before the wall's cell. */
  at: number;
}

/** Standing walls, nearest to the spawn first. */
function blocks(state: GameState): Block[] {
  const out: Block[] = [];
  for (const wall of state.towers) {
    if (!hasWall(towerDef(wall))) continue;
    out.push({ wall, at: Math.max(0, pathIndex(state.mapId, wall.x, wall.y) * FP - FP / 2) });
  }
  return out.sort((a, b) => a.at - b.at || a.wall.id - b.wall.id);
}

/** The first wall at or ahead of this enemy; an enemy that already passed a wall ignores it. */
function blockAhead(walls: readonly Block[], enemy: Enemy): Block | null {
  return walls.find((b) => b.at >= enemy.progress) ?? null;
}

/** Enemies walk, stop in front of a wall and hit it. Walls that fall put their owner on cooldown. */
export function moveEnemies(state: GameState): void {
  const end = pathLength(state.mapId);
  const walls = blocks(state);
  const survivors: Enemy[] = [];
  for (const enemy of state.enemies) {
    const next = enemy.progress + currentSpeed(state, enemy);
    const block = blockAhead(walls, enemy);
    if (block !== null && next >= block.at) {
      enemy.progress = block.at;
      block.wall.hp -= ENEMIES[enemy.kind].wallDamage;
      block.wall.lastHitTick = state.tick;
      survivors.push(enemy);
      continue;
    }
    enemy.progress = next;
    if (enemy.progress >= end) {
      state.lives = Math.max(0, state.lives - ENEMIES[enemy.kind].livesCost);
      state.stats.leaks++;
    } else {
      survivors.push(enemy);
    }
  }
  state.enemies = survivors;
  crumbleWalls(state);
}

function crumbleWalls(state: GameState): void {
  const standing: Tower[] = [];
  for (const tower of state.towers) {
    const def = towerDef(tower);
    if (!hasWall(def) || tower.hp > 0) {
      standing.push(tower);
      continue;
    }
    const owner = state.players.find((p) => p.id === tower.owner);
    if (owner) owner.wallReadyTick = state.tick + 1 + def.wallCooldown;
  }
  state.towers = standing;
}
