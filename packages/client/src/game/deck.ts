import { ABILITY_KINDS, DECK, DEFAULT_DECKS, TOWER_KINDS, deckProblem, type Deck } from "@td/sim";

export type DeckMode = "solo" | "coop";

const KEY = (mode: DeckMode): string => `td.deck.${mode}`;

export function deckSize(mode: DeckMode): number {
  return mode === "solo" ? DECK.soloTowers : DECK.coopTowers;
}

/** The last deck played in this browser for that mode, or the default one. Not a collection: a local convenience. */
export function readDeck(mode: DeckMode): Deck {
  try {
    const raw = localStorage.getItem(KEY(mode));
    const deck = raw === null ? null : (JSON.parse(raw) as Deck);
    if (deck && deckProblem(deck, deckSize(mode)) === null) return deck;
  } catch {
    /* blocked or corrupt storage: fall back to the default deck */
  }
  return DEFAULT_DECKS[mode];
}

export function writeDeck(mode: DeckMode, deck: Deck): void {
  try {
    localStorage.setItem(KEY(mode), JSON.stringify(deck));
  } catch {
    /* private mode: the deck is simply not kept */
  }
}

/** "archer,mage,hammer;bombard,repair" from the dev URL param; unknown names are dropped. Null when absent. */
export function parseDeckParam(raw: string | null): Deck | null {
  if (!raw) return null;
  const [towers = "", abilities = ""] = raw.split(";");
  return {
    towers: TOWER_KINDS.filter((k) => towers.split(",").includes(k)),
    abilities: ABILITY_KINDS.filter((k) => abilities.split(",").includes(k)),
  };
}
