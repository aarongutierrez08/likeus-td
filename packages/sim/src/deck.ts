import { ABILITY_KINDS } from "./balance/abilities";
import { DECK, type Deck } from "./balance/deck";
import { TOWER_KINDS, TOWERS } from "./balance/towers";

const unique = (items: readonly string[]): boolean => new Set(items).size === items.length;

/** Why this deck cannot be played in a game whose decks hold `towers` towers; null when it can. */
export function deckProblem(deck: Deck | undefined, towers: number): "bad_deck" | null {
  if (!deck || !Array.isArray(deck.towers) || !Array.isArray(deck.abilities)) return "bad_deck";
  if (deck.towers.length !== towers || deck.abilities.length !== DECK.abilities) return "bad_deck";
  if (!unique(deck.towers) || !unique(deck.abilities)) return "bad_deck";
  if (!deck.towers.every((k) => TOWER_KINDS.includes(k)) || !deck.abilities.every((k) => ABILITY_KINDS.includes(k))) return "bad_deck";
  const attackTypes = new Set(deck.towers.map((k) => TOWERS[k].attackType).filter((t) => t !== null));
  return attackTypes.size >= DECK.minAttackTypes ? null : "bad_deck";
}
