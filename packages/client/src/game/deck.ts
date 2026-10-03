import { ABILITY_KINDS, DECK, DEFAULT_DECKS, TOWER_KINDS, deckProblem, type Deck } from "@td/sim";
import type { DeckMode } from "@td/server/protocol";
import { readSession, updateProfile } from "../net/account";

export type { DeckMode };

const KEY = (mode: DeckMode): string => `td.deck.${mode}`;

export function deckSize(mode: DeckMode): number {
  return mode === "solo" ? DECK.soloTowers : DECK.coopTowers;
}

/** The last deck played for that mode in this browser or, once the profile loads, in the account; the default one otherwise. */
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

function keepLocally(mode: DeckMode, deck: Deck): void {
  try {
    localStorage.setItem(KEY(mode), JSON.stringify(deck));
  } catch {
    /* private mode: the deck is simply not kept */
  }
}

const ACCOUNT_SYNC_DELAY_MS = 1_000;
const pendingSync = new Map<DeckMode, ReturnType<typeof setTimeout>>();

/**
 * Keeps the deck in this browser and in the account, when there is one; the account is best effort. Only the last of a
 * burst of changes goes to the server, so an older one arriving late cannot overwrite it.
 */
export function writeDeck(mode: DeckMode, deck: Deck): void {
  keepLocally(mode, deck);
  if (!readSession()) return;
  clearTimeout(pendingSync.get(mode));
  pendingSync.set(
    mode,
    setTimeout(() => void updateProfile({ deck: { mode, deck } }), ACCOUNT_SYNC_DELAY_MS),
  );
}

export const ACCOUNT_DECKS_EVENT = "td:account-decks";

/** The account's decks win over this browser's: they are the last ones played anywhere. Open deck screens hear about it. */
export function adoptAccountDecks(decks: Partial<Record<DeckMode, Deck>>): void {
  for (const mode of ["solo", "coop"] as const) {
    const deck = decks[mode];
    if (deck && deckProblem(deck, deckSize(mode)) === null) keepLocally(mode, deck);
  }
  window.dispatchEvent(new Event(ACCOUNT_DECKS_EVENT));
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
