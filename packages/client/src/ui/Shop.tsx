import { For } from "solid-js";
import { FP, TICKS_PER_SECOND, TOWERS, TOWER_KINDS, type TowerKind } from "@td/sim";
import type { GameStore } from "../game/store";

const LABELS: Record<TowerKind, string> = { archer: "Arquero", cannon: "Cañón", aura: "Aura +25%", mine: "Mina" };
const SWATCH: Record<TowerKind, string> = { archer: "var(--archer)", cannon: "var(--cannon)", aura: "var(--aura)", mine: "var(--gold)" };

function describe(kind: TowerKind): string {
  const def = TOWERS[kind];
  if (def.income > 0) return `+${def.income} oro por oleada, solo para vos`;
  if (def.damage === 0) return `+${def.auraBonusPct}% daño en ${def.auraRadius * 2 + 1}×${def.auraRadius * 2 + 1}`;
  const perSecond = (def.damage * TICKS_PER_SECOND) / def.cooldown;
  const splash = def.splash > 0 ? ` · área ${def.splash / FP}` : "";
  return `${def.damage} daño · ${perSecond.toFixed(0)}/s · alcance ${def.range / FP}${splash}`;
}

export function Shop(props: { store: GameStore }) {
  const gold = () => props.store.gold();
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
            <span class="info">{describe(kind)}</span>
          </button>
        )}
      </For>
      <span class="hint">Tocá una celda libre para construir · ~ debug</span>
    </div>
  );
}
