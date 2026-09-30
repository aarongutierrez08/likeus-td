import { defineAbilities, type AbilityLevel } from "./define";

/** Adding an ability is adding an entry here (ADR 010). Placeholder numbers: cards are balanced in step 15 of the design. */
export const ABILITIES = defineAbilities({
  bombard: {
    label: "Bombardeo",
    line: "marcás el lugar y al rato cae",
    target: "cell",
    upgradeCost: 60,
    base: { cooldown: 600, damage: 60, radius: 1500, delay: 20 },
    upgrades: [{ cooldown: 480 }, { damage: 90 }],
  },
  frost: {
    label: "Escarcha",
    line: "ese tramo del camino se pone pesado",
    target: "path",
    upgradeCost: 60,
    base: { cooldown: 600, radius: 1500, duration: 100, slowPct: 50 },
    upgrades: [{ duration: 140 }, { cooldown: 450 }],
  },
  overcharge: {
    label: "Sobrecarga",
    line: "una torre tuya se apura un rato",
    target: "ownTower",
    upgradeCost: 60,
    base: { cooldown: 600, duration: 100, ratePct: 100 },
    upgrades: [{ duration: 140 }, { cooldown: 450 }],
  },
  repair: {
    label: "Reparación",
    line: "una vida más para el equipo",
    target: "none",
    upgradeCost: 80,
    base: { cooldown: 1800, lives: 1 },
    upgrades: [{ cooldown: 1500 }, { cooldown: 1200 }],
  },
});

export type AbilityKind = keyof typeof ABILITIES;

export const ABILITY_KINDS = Object.keys(ABILITIES) as AbilityKind[];

/** What an ability does at this level (1-based). */
export function abilityLevel(kind: AbilityKind, level: number): AbilityLevel {
  return ABILITIES[kind].levels[level - 1]!;
}
