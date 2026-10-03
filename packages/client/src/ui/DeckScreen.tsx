import { createSignal, onCleanup } from "solid-js";
import type { Deck } from "@td/sim";
import type { SoloKind } from "../params";
import { ACCOUNT_DECKS_EVENT, deckSize, readDeck } from "../game/deck";
import { DeckBuilder, deckIssue } from "./DeckBuilder";

/** Solo starts here: the last deck played, ready to tweak, and one button to play. */
export function DeckScreen(props: { onPlay: (deck: Deck, kind: SoloKind) => void }) {
  const [deck, setDeck] = createSignal(readDeck("solo"));
  const [edited, setEdited] = createSignal(false);
  const edit = (next: Deck) => {
    setEdited(true);
    setDeck(next);
  };
  // The profile loads after this screen shows: the account's deck replaces the browser's until the player touches it.
  const adopt = () => {
    if (!edited()) setDeck(readDeck("solo"));
  };
  window.addEventListener(ACCOUNT_DECKS_EVENT, adopt);
  onCleanup(() => window.removeEventListener(ACCOUNT_DECKS_EVENT, adopt));
  const towers = deckSize("solo");
  return (
    <div class="deck-screen">
      <div class="inner">
        <h2>Likeus TD · Solo</h2>
        <DeckBuilder towers={towers} deck={deck()} onChange={edit} />
        <div class="row">
          <button
            type="button"
            class="primary"
            disabled={deckIssue(deck(), towers) !== null}
            onClick={() => props.onPlay(deck(), "campaign")}
          >
            Jugar
          </button>
          <button type="button" disabled={deckIssue(deck(), towers) !== null} onClick={() => props.onPlay(deck(), "endless")}>
            Infinito
          </button>
          <button
            type="button"
            title="Infinito con la seed de hoy, la misma para todos; el puntaje entra al ranking del día"
            disabled={deckIssue(deck(), towers) !== null}
            onClick={() => props.onPlay(deck(), "daily")}
          >
            Desafío del día
          </button>
          <a href="?mode=coop">Jugar en co-op</a>
        </div>
      </div>
    </div>
  );
}
