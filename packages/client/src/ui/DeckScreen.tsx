import { createSignal } from "solid-js";
import type { Deck } from "@td/sim";
import { deckSize, readDeck } from "../game/deck";
import { DeckBuilder, deckIssue } from "./DeckBuilder";

/** Solo starts here: the last deck played, ready to tweak, and one button to play. */
export function DeckScreen(props: { onPlay: (deck: Deck) => void }) {
  const [deck, setDeck] = createSignal(readDeck("solo"));
  const towers = deckSize("solo");
  return (
    <div class="deck-screen">
      <div class="inner">
        <h2>Likeus TD · Solo</h2>
        <DeckBuilder towers={towers} deck={deck()} onChange={setDeck} />
        <div class="row">
          <button type="button" class="primary" disabled={deckIssue(deck(), towers) !== null} onClick={() => props.onPlay(deck())}>
            Jugar
          </button>
          <a href="?mode=coop">Jugar en co-op</a>
        </div>
      </div>
    </div>
  );
}
