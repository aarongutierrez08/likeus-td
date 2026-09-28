/**
 * Attack type vs armor, in percent. A Latin square: every attack type has exactly one armor it
 * hits at 150% and one at 50%, every armor is weak to one type and resists one, and every row
 * and column averages 100%, so no tower type is better on average and no enemy is soft to all.
 */
export const ATTACK_TYPES = ["pierce", "blunt", "magic", "explosive"] as const;
export type AttackType = (typeof ATTACK_TYPES)[number];

export const ARMORS = ["none", "light", "heavy", "enchanted"] as const;
export type Armor = (typeof ARMORS)[number];

export const DAMAGE_TABLE: Record<AttackType, Record<Armor, number>> = {
  pierce: { none: 100, light: 150, heavy: 100, enchanted: 50 },
  blunt: { none: 100, light: 50, heavy: 150, enchanted: 100 },
  magic: { none: 50, light: 100, heavy: 100, enchanted: 150 },
  explosive: { none: 150, light: 100, heavy: 50, enchanted: 100 },
};

export function damageMultiplier(attack: AttackType, armor: Armor): number {
  return DAMAGE_TABLE[attack][armor];
}

export const ATTACK_LABELS: Record<AttackType, string> = {
  pierce: "perforante",
  blunt: "contundente",
  magic: "mágico",
  explosive: "explosivo",
};

export const ARMOR_LABELS: Record<Armor, string> = {
  none: "sin armadura",
  light: "ligera",
  heavy: "pesada",
  enchanted: "encantada",
};
