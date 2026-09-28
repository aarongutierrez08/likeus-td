import { For } from "solid-js";
import {
  ARMORS,
  ARMOR_LABELS,
  ATTACK_LABELS,
  DAMAGE_TABLE,
  FP,
  TICKS_PER_SECOND,
  TOWERS,
  TOWER_KINDS,
  hasAttack,
  hasAura,
  hasIncome,
  type AttackType,
  type TowerKind,
} from "@td/sim";
import type { GameStore } from "../game/store";

function label(kind: TowerKind): string {
  const def = TOWERS[kind];
  return hasAura(def) ? `${def.label} +${def.auraBonusPct}%` : def.label;
}

function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** "perforante · 150% ligera · 50% encantada" */
export function attackSummary(attack: AttackType): string {
  const strong = ARMORS.filter((a) => DAMAGE_TABLE[attack][a] > 100).map((a) => `150% ${ARMOR_LABELS[a]}`);
  const weak = ARMORS.filter((a) => DAMAGE_TABLE[attack][a] < 100).map((a) => `50% ${ARMOR_LABELS[a]}`);
  return [ATTACK_LABELS[attack], ...strong, ...weak].join(" · ");
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

function attackLine(kind: TowerKind): string {
  const attack = TOWERS[kind].attackType;
  return attack === null ? "" : ` · ${ATTACK_LABELS[attack]}`;
}

function tooltip(kind: TowerKind): string | undefined {
  const attack = TOWERS[kind].attackType;
  return attack === null ? undefined : attackSummary(attack);
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
            title={tooltip(kind)}
            onClick={() => props.store.setSelectedTower(props.store.selectedTower() === kind ? null : kind)}
          >
            <span class="name">{label(kind)}</span>
            <span class="cost">
              {TOWERS[kind].cost} oro{attackLine(kind)}
            </span>
            <span class="info">{describe(kind)}</span>
          </button>
        )}
      </For>
      <span class="hint">Tocá una celda libre para construir · ~ debug</span>
    </div>
  );
}
