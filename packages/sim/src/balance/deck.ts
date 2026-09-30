import type { AbilityKind } from "./abilities";
import type { TowerKind } from "./towers";

export interface Deck {
  towers: TowerKind[];
  abilities: AbilityKind[];
}

/** Deck rules (design: Mazo). Solo gets more towers because nobody else fills the gaps. */
export const DECK = {
  soloTowers: 8,
  coopTowers: 5,
  abilities: 2,
  /** A deck with a single attack type cannot answer the armor cycle. */
  minAttackTypes: 2,
} as const;

/** The deck new players start from and the reference bot plays with: every attack type, plus what the waves ask for. */
export const DEFAULT_DECKS: { solo: Deck; coop: Deck } = {
  solo: {
    towers: ["archer", "mage", "hammer", "cannon", "frost", "radar", "wall", "aura"],
    abilities: ["bombard", "repair"],
  },
  coop: {
    towers: ["archer", "mage", "hammer", "cannon", "radar"],
    abilities: ["bombard", "repair"],
  },
};
