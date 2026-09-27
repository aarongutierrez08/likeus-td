import { FP } from "./constants";
import { WAVES } from "./balance/waves";
import { hashState } from "./hash";
import { positionAt } from "./path";
import type { GameState } from "./types";

function cells(v: number): string {
  return (v / FP).toFixed(2);
}

export function dumpState(state: GameState): string {
  const lines: string[] = [];
  lines.push(
    `tick ${state.tick}  status ${state.status}  wave ${state.wave}/${WAVES.length}  lives ${state.lives}  hash ${hashState(state)}`,
  );
  lines.push(`seed ${state.seed}  map ${state.mapId}  balance v${state.balanceVersion}  nextWaveTick ${state.nextWaveTick ?? "-"}  wavesClosed ${state.wavesClosed}`);
  lines.push(`players: ${state.players.map((p) => `#${p.id} gold ${p.gold}`).join(", ")}`);
  lines.push(`towers (${state.towers.length}):`);
  for (const t of state.towers) {
    lines.push(`  #${t.id} ${t.kind} nv${t.level} (${t.x},${t.y}) owner ${t.owner} cd ${t.cooldown} dmg ${t.damageDealt} kills ${t.kills}`);
  }
  lines.push(`enemies (${state.enemies.length}):`);
  for (const e of state.enemies) {
    const p = positionAt(state.mapId, e.progress);
    lines.push(`  #${e.id} ${e.kind} hp ${e.hp}/${e.maxHp} progress ${cells(e.progress)} at (${cells(p.x)},${cells(p.y)})`);
  }
  const next = state.spawnQueue[0];
  lines.push(`spawnQueue: ${state.spawnQueue.length} pending${next ? `, next at tick ${next.tick}` : ""}`);
  const s = state.stats;
  lines.push(
    `stats: kills ${s.kills} leaks ${s.leaks} goldEarned ${s.goldEarned} dmg archer ${s.damageByTower.archer} cannon ${s.damageByTower.cannon}`,
  );
  return lines.join("\n");
}
