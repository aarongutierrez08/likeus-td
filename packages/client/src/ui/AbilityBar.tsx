import { For, Show, createSignal } from "solid-js";
import { ABILITIES, ABILITY_KINDS, FP, TICKS_PER_SECOND, abilityLevel, findPlayer, type AbilityKind, type AbilityLevel } from "@td/sim";
import type { GameStore } from "../game/store";

export interface AbilityRequest {
  ability: AbilityKind;
  x?: number;
  y?: number;
  towerId?: number;
}

export interface AbilityActions {
  /** Returns false when the sim refused it; the reason was already shown. */
  cast: (req: AbilityRequest) => boolean;
  upgrade: (ability: AbilityKind) => void;
}

function seconds(ticks: number): string {
  return String(Math.ceil(ticks / TICKS_PER_SECOND));
}

/** "60 explosivo · área 1.5 · cada 30 s" */
export function abilitySummary(level: AbilityLevel): string {
  const parts: string[] = [];
  if (level.damage > 0) parts.push(`${level.damage} explosivo`);
  if (level.slowPct > 0) parts.push(`frena ${level.slowPct}%`);
  if (level.ratePct > 0) parts.push(`+${level.ratePct}% cadencia`);
  if (level.lives > 0) parts.push(`+${level.lives} vida`);
  if (level.radius > 0) parts.push(`área ${level.radius / FP}`);
  if (level.duration > 0) parts.push(`${seconds(level.duration)} s`);
  parts.push(`cada ${seconds(level.cooldown)} s`);
  return parts.join(" · ");
}

/** An ability without a target goes off at once; the others wait for a tap on the map, and picking them again cancels. */
export function pickAbility(store: GameStore, actions: AbilityActions, kind: AbilityKind): void {
  if (ABILITIES[kind].target === "none") {
    actions.cast({ ability: kind });
    return;
  }
  store.setSelectedTower(null);
  store.setAimingAbility(store.aimingAbility() === kind ? null : kind);
}

export function AbilityBar(props: { store: GameStore; actions: AbilityActions }) {
  const me = () => findPlayer(props.store.state(), props.store.you);
  const pick = (kind: AbilityKind): void => pickAbility(props.store, props.actions, kind);
  /** Touch has no hover: the ability being aimed, or the last one touched or pointed at, gets its detail in plain text. */
  const [touched, setTouched] = createSignal<AbilityKind | null>(null);
  const shown = () => props.store.aimingAbility() ?? touched();
  const detail = () => {
    const kind = shown();
    const player = me();
    if (!kind || !player) return null;
    const def = ABILITIES[kind];
    const level = player.abilities[kind].level;
    const now = `${def.label} nivel ${level}: ${abilitySummary(abilityLevel(kind, level))}`;
    if (level >= def.levels.length) return now;
    return `${now} · mejora por ${def.upgradeCost}: ${abilitySummary(abilityLevel(kind, level + 1))}`;
  };
  return (
    <div class="abilities" onPointerLeave={(e) => e.pointerType === "mouse" && setTouched(null)}>
      <Show when={detail()}>{(text) => <p class="ability-detail">{text()}</p>}</Show>
      <For each={ABILITY_KINDS}>
        {(kind) => {
          const def = ABILITIES[kind];
          const level = () => me()?.abilities[kind].level ?? 1;
          const left = () => {
            const player = me();
            return player ? Math.max(0, player.abilities[kind].readyTick - props.store.state().tick) : 0;
          };
          const maxed = () => level() >= def.levels.length;
          return (
            <div
              class="ability"
              classList={{ aiming: props.store.aimingAbility() === kind, cooling: left() > 0 }}
              onPointerEnter={() => setTouched(kind)}
              onPointerDown={() => setTouched(kind)}
            >
              <button
                type="button"
                class="use"
                title={`${def.line} · ${abilitySummary(abilityLevel(kind, level()))}`}
                onClick={() => pick(kind)}
              >
                <span class="name">
                  {def.label} <span class="level">{"•".repeat(level())}</span>
                </span>
                <span class="when">{left() > 0 ? `${seconds(left())} s` : "lista"}</span>
              </button>
              <Show when={!maxed()}>
                <button
                  type="button"
                  class="up"
                  classList={{ poor: props.store.gold() < def.upgradeCost }}
                  title={`Nivel ${level() + 1}: ${abilitySummary(abilityLevel(kind, level() + 1))}`}
                  onClick={() => props.actions.upgrade(kind)}
                >
                  +{def.upgradeCost}
                </button>
              </Show>
            </div>
          );
        }}
      </For>
    </div>
  );
}
