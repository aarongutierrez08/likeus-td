import { For } from "solid-js";
import { FP, TICKS_PER_SECOND, TOWERS, TOWER_KINDS, hasAttack, hasAura, hasIncome, type TowerKind } from "@td/sim";
import type { GameStore } from "../game/store";

function label(kind: TowerKind): string {
  const def = TOWERS[kind];
  return hasAura(def) ? `${def.label} +${def.auraBonusPct}%` : def.label;
}

function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function describe(kind: TowerKind): string {
  const def = TOWERS[kind];
  if (hasIncome(def)) return `+${def.income} oro por oleada, solo para vos`;
  if (hasAura(def)) return `+${def.auraBonusPct}% daño en ${def.auraRadius * 2 + 1}×${def.auraRadius * 2 + 1}`;
  if (!hasAttack(def)) return "";
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
            style={{ "--swatch": cssColor(TOWERS[kind].color) }}
            onClick={() => props.store.setSelectedTower(props.store.selectedTower() === kind ? null : kind)}
          >
            <span class="name">{label(kind)}</span>
            <span class="cost">{TOWERS[kind].cost} oro</span>
            <span class="info">{describe(kind)}</span>
          </button>
        )}
      </For>
      <span class="hint">Tocá una celda libre para construir · ~ debug</span>
    </div>
  );
}
