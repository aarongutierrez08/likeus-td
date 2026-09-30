import { abilityLevel } from "../balance/abilities";
import { damageMultiplier } from "../balance/damage";
import { ENEMIES } from "../balance/enemies";
import { cellCenterFP } from "../path";
import type { Enemy, GameState, UseAbilityCommand } from "../types";
import { locate, markOn, squaredDistance } from "./targeting";

/** Applies a validated useAbility: puts it on cooldown and leaves its effect in the state. */
export function castAbility(state: GameState, cmd: UseAbilityCommand): void {
  const player = state.players.find((p) => p.id === cmd.playerId)!;
  const slot = player.abilities[cmd.ability];
  const level = abilityLevel(cmd.ability, slot.level);
  slot.readyTick = state.tick + level.cooldown;
  switch (cmd.ability) {
    case "bombard":
      state.blasts.push({
        id: state.nextId++,
        tick: state.tick + level.delay,
        x: cellCenterFP(cmd.x!),
        y: cellCenterFP(cmd.y!),
        radius: level.radius,
        damage: level.damage,
      });
      return;
    case "frost":
      state.frostZones.push({
        id: state.nextId++,
        until: state.tick + level.duration,
        x: cellCenterFP(cmd.x!),
        y: cellCenterFP(cmd.y!),
        radius: level.radius,
        slowPct: level.slowPct,
      });
      return;
    case "overcharge": {
      const tower = state.towers.find((t) => t.id === cmd.towerId)!;
      const active = state.tick < tower.overchargeUntil;
      tower.overchargeUntil = Math.max(active ? tower.overchargeUntil : 0, state.tick + level.duration);
      tower.overchargePct = Math.max(active ? tower.overchargePct : 0, level.ratePct);
      return;
    }
    case "repair":
      state.lives += level.lives;
      return;
  }
}

/** A blast hits like an explosive area attack: armor and marks apply, a shield absorbs it, stealth does not hide from it. */
function blastHit(state: GameState, enemy: Enemy, damage: number): void {
  if (enemy.shield > 0) {
    enemy.shield--;
    return;
  }
  const base = Math.floor((damage * damageMultiplier("explosive", ENEMIES[enemy.kind].armor)) / 100);
  const dealt = Math.floor((base * (100 + markOn(state, enemy))) / 100);
  state.stats.damageByAbility.bombard += Math.min(dealt, Math.max(0, enemy.hp));
  enemy.hp -= dealt;
}

/** Lands the blasts due this tick and melts the frost zones whose time is up, before enemies move. */
export function abilitiesAct(state: GameState): void {
  if (state.frostZones.length > 0) state.frostZones = state.frostZones.filter((z) => z.until > state.tick);
  if (state.blasts.length === 0) return;
  const located = locate(state);
  const landing = state.blasts.filter((b) => b.tick <= state.tick);
  state.blasts = state.blasts.filter((b) => b.tick > state.tick);
  for (const blast of landing) {
    for (const e of located)
      if (squaredDistance(blast.x, blast.y, e.x, e.y) <= blast.radius * blast.radius) blastHit(state, e.enemy, blast.damage);
  }
}

/** Strongest slow of the frost zones this point stands in; zones never write on the enemy, so a tower's own slow outlives them. */
export function frostZonePct(state: GameState, x: number, y: number): number {
  let best = 0;
  for (const zone of state.frostZones) {
    if (squaredDistance(zone.x, zone.y, x, y) <= zone.radius * zone.radius) best = Math.max(best, zone.slowPct);
  }
  return best;
}
