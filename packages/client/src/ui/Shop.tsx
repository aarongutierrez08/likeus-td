import { For } from "solid-js";
import { TOWERS, TOWER_KINDS, type TowerKind } from "@td/sim";
import type { GameStore } from "../game/store";

const LABELS: Record<TowerKind, string> = { archer: "Arquero", cannon: "Cañón", aura: "Aura +25%" };
const SWATCH: Record<TowerKind, string> = { archer: "var(--archer)", cannon: "var(--cannon)", aura: "var(--aura)" };

export function Shop(props: { store: GameStore }) {
  const gold = () => props.store.state().gold;
  return (
    <div class="shop">
      <For each={TOWER_KINDS}>
        {(kind) => (
          <button
            type="button"
            classList={{ selected: props.store.selectedTower() === kind }}
            disabled={gold() < TOWERS[kind].cost}
            style={{ "--swatch": SWATCH[kind] }}
            onClick={() => props.store.setSelectedTower(props.store.selectedTower() === kind ? null : kind)}
          >
            <span class="name">{LABELS[kind]}</span>
            <span class="cost">{TOWERS[kind].cost} oro</span>
          </button>
        )}
      </For>
      <span class="hint">Tocá una celda libre para construir · ~ debug</span>
    </div>
  );
}
