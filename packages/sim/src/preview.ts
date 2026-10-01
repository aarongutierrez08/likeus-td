import { damageMultiplier } from "./balance/damage";
import { hasAttack } from "./balance/define";
import { ENEMIES } from "./balance/enemies";
import { TOWER_KINDS, TOWERS } from "./balance/towers";
import type { WaveDef } from "./balance/waves";
import { waveDef } from "./waveDefs";
import type { GameState, TowerKind } from "./types";

/** The next `count` waves still to come, in order. Empty once the last wave has started. */
export function upcomingWaves(state: GameState, count: number): { number: number; def: WaveDef }[] {
  const out: { number: number; def: WaveDef }[] = [];
  for (let n = state.wave + 1; n <= state.wave + count; n++) {
    const def = waveDef(state, n);
    if (!def) break;
    out.push({ number: n, def });
  }
  return out;
}

/** Average attack-vs-armor multiplier of a tower kind over these waves, weighted by enemy hp. 100 when it has no attack. */
export function multiplierAgainstWaves(kind: TowerKind, waves: readonly WaveDef[]): number {
  const attack = TOWERS[kind].attackType;
  if (attack === null) return 100;
  let weighted = 0;
  let total = 0;
  for (const wave of waves) {
    for (const group of wave.groups) {
      const hp = ENEMIES[group.kind].hp * group.count;
      weighted += hp * damageMultiplier(attack, ENEMIES[group.kind].armor);
      total += hp;
    }
  }
  return total === 0 ? 100 : Math.floor(weighted / total);
}

/** Attack tower with the best multiplier against the waves; ties go to the cheaper, then to declaration order. */
export function bestAttackTower(waves: readonly WaveDef[], candidates: readonly TowerKind[] = TOWER_KINDS): TowerKind | null {
  let best: TowerKind | null = null;
  let bestScore = -1;
  for (const kind of candidates) {
    if (!hasAttack(TOWERS[kind])) continue;
    const score = multiplierAgainstWaves(kind, waves);
    if (score > bestScore || (score === bestScore && best !== null && TOWERS[kind].cost < TOWERS[best].cost)) {
      best = kind;
      bestScore = score;
    }
  }
  return best;
}

/** Whether any of these waves brings stealth enemies, which no tower can target without a radar. */
export function wavesNeedReveal(waves: readonly WaveDef[]): boolean {
  return waves.some((wave) => wave.groups.some((g) => ENEMIES[g.kind].stealth));
}
