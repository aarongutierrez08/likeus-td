import { For, createMemo } from "solid-js";
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
  hasControl,
  hasIncome,
  hasReveal,
  hasWall,
  findPlayer,
  buildCost,
  type AttackType,
  type AuraStat,
  type TowerDef,
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

const AURA_STAT_LABELS: Record<AuraStat, string> = { damage: "daño", rate: "cadencia", gold: "oro por muerte, para vos", range: "alcance" };

/** "+25% daño en 5×5" */
export function auraSummary(def: TowerDef, bonusPct: number): string {
  const side = def.auraRadius * 2 + 1;
  return `+${bonusPct}% ${AURA_STAT_LABELS[def.auraStat ?? "damage"]} en ${side}×${side}`;
}

/** "ralentiza 40% por 2 s · alcance 2.5" or "aturde 1 s en área 1 · alcance 2.5" */
export function controlSummary(def: TowerDef, pct: number, duration: number): string {
  const seconds = (duration / TICKS_PER_SECOND).toFixed(duration % TICKS_PER_SECOND === 0 ? 0 : 1);
  const effect = def.controlEffect === "slow" ? `ralentiza ${pct}% por ${seconds} s` : `aturde ${seconds} s`;
  const area = def.controlSplash > 0 ? ` en área ${def.controlSplash / FP}` : "";
  return `${effect}${area} · alcance ${def.controlRange / FP}`;
}

/** "revela invisibles · alcance 6" */
export function revealSummary(def: TowerDef): string {
  return `revela invisibles · alcance ${def.revealRange / FP}`;
}

/** "300 de vida · frena la oleada sobre el camino · uno por jugador, 20 s tras caer" */
export function wallSummary(def: TowerDef, hp: number): string {
  return `${hp} de vida · frena la oleada sobre el camino · uno por jugador, ${def.wallCooldown / TICKS_PER_SECOND} s tras caer`;
}

function describe(kind: TowerKind): string {
  const def = TOWERS[kind];
  if (hasIncome(def)) return `+${def.income} oro por oleada, solo para vos`;
  if (hasAura(def)) return auraSummary(def, def.auraBonusPct);
  if (hasControl(def)) return controlSummary(def, def.controlPct, def.controlDuration);
  if (hasReveal(def)) return revealSummary(def);
  if (hasWall(def)) return wallSummary(def, def.wallHp);
  if (!hasAttack(def)) return "";
  const perSecond = (def.damage * TICKS_PER_SECOND) / def.cooldown;
  const splash = def.splash > 0 ? ` · área ${def.splash / FP}` : "";
  return `${def.damage} daño · ${perSecond.toFixed(0)}/s · alcance ${def.range / FP}${splash}`;
}

function attackLine(kind: TowerKind): string {
  const attack = TOWERS[kind].attackType;
  return attack === null ? "" : ` · ${ATTACK_LABELS[attack]}`;
}

function tooltip(kind: TowerKind): string {
  const def = TOWERS[kind];
  return def.attackType === null ? def.line : `${def.line} · ${attackSummary(def.attackType)}`;
}

export function Shop(props: { store: GameStore }) {
  const gold = () => props.store.gold();
  /** Only the towers of your deck; the memo keeps the list stable across ticks, since the deck never changes in play. */
  const deck = createMemo(() => findPlayer(props.store.state(), props.store.you)?.deck.towers ?? []);
  const kinds = createMemo(() => TOWER_KINDS.filter((kind) => deck().includes(kind)));
  return (
    <div class="shop">
      <For each={kinds()}>
        {(kind) => {
          /** The market price for you right now; above the base it is marked so a second copy does not surprise. */
          const price = () => {
            const me = findPlayer(props.store.state(), props.store.you);
            return me ? buildCost(props.store.state(), me, kind) : TOWERS[kind].cost;
          };
          const poor = () => gold() < price();
          return (
            <button
              type="button"
              classList={{ selected: props.store.selectedTower() === kind, poor: poor() }}
              style={{ "--swatch": cssColor(TOWERS[kind].color) }}
              title={poor() ? `${tooltip(kind)} · te falta oro` : tooltip(kind)}
              onClick={() => {
                props.store.setAimingAbility(null);
                props.store.setSelectedTower(props.store.selectedTower() === kind ? null : kind);
              }}
            >
              <span class="name">{label(kind)}</span>
              <span class="cost">
                {price()} oro{price() > TOWERS[kind].cost ? " ↑" : price() < TOWERS[kind].cost ? " ↓" : ""}
                {attackLine(kind)}
              </span>
              <span class="info">{describe(kind)}</span>
            </button>
          );
        }}
      </For>
      <span class="hint">Elegí una torre y tocá una celda · 1-4 habilidades · Esc suelta · ~ debug</span>
    </div>
  );
}
