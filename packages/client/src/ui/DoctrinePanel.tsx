import { For, Show } from "solid-js";
import { DOCTRINE, DOCTRINES, DOCTRINE_KINDS, doctrineOdds, findPlayer, type DoctrineKind } from "@td/sim";
import type { GameStore } from "../game/store";

export interface DoctrineActions {
  choose: (doctrine: DoctrineKind) => void;
  reroll: () => void;
}

/** "Barrio 100% · Rebaja 40% · …": what the next draw can bring, as the design asks to show. */
function oddsLine(odds: Record<DoctrineKind, number>): string {
  return DOCTRINE_KINDS.filter((kind) => odds[kind] > 0)
    .map((kind) => `${DOCTRINES[kind].label} ${odds[kind]}%`)
    .join(" · ");
}

/** The offer, while it lasts until the next wave starts; and the doctrines already picked, always. */
export function DoctrinePanel(props: { store: GameStore; actions: DoctrineActions }) {
  const me = () => findPlayer(props.store.state(), props.store.you);
  const offer = () => me()?.doctrineOffer ?? [];
  const taken = () => me()?.doctrines ?? [];
  return (
    <>
      <Show when={offer().length > 0}>
        <div class="doctrine-offer">
          <strong>Elegí una doctrina antes de la próxima oleada</strong>
          <div class="doctrine-cards">
            <For each={DOCTRINE_KINDS}>
              {(kind) => (
                <Show when={offer().includes(kind)}>
                  <button type="button" class="doctrine-card" onClick={() => props.actions.choose(kind)}>
                    <span class="name">{DOCTRINES[kind].label}</span>
                    <span class="note">{DOCTRINES[kind].line}</span>
                  </button>
                </Show>
              )}
            </For>
          </div>
          <div class="row">
            <button
              type="button"
              class="reroll"
              disabled={me()?.doctrineRerolled || props.store.gold() < DOCTRINE.rerollCost}
              onClick={() => props.actions.reroll()}
            >
              Cambiar las tres ({DOCTRINE.rerollCost} oro)
            </button>
            <span class="muted">Si cambiás: {oddsLine(doctrineOdds(props.store.state(), props.store.you))}</span>
          </div>
        </div>
      </Show>
      <Show when={taken().length > 0}>
        <p class="doctrines-taken">
          Doctrinas:{" "}
          {taken()
            .map((kind) => DOCTRINES[kind].label)
            .join(" · ")}
        </p>
      </Show>
    </>
  );
}
