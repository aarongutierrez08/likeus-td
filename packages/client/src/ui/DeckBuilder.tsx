import { For, Show } from "solid-js";
import {
  ABILITIES,
  ABILITY_KINDS,
  ARMORS,
  ARMOR_LABELS,
  ATTACK_LABELS,
  DAMAGE_TABLE,
  DECK,
  NEUTRAL_PCT,
  deckProblem,
  TOWERS,
  TOWER_KINDS,
  type AbilityKind,
  type Armor,
  type Deck,
  type TowerKind,
} from "@td/sim";

/** What the player still has to fix, in words; null when the sim would take the deck. The rule is the sim's; this only words it. */
export function deckIssue(deck: Deck, towers: number): string | null {
  if (deckProblem(deck, towers) === null) return null;
  if (deck.towers.length !== towers) return `Elegí ${towers} torres (tenés ${deck.towers.length})`;
  if (deck.abilities.length !== DECK.abilities) return `Elegí ${DECK.abilities} habilidades (tenés ${deck.abilities.length})`;
  const types = new Set(deck.towers.map((k) => TOWERS[k].attackType).filter((t) => t !== null));
  if (types.size < DECK.minAttackTypes) return `Hacen falta al menos ${DECK.minAttackTypes} tipos de ataque`;
  return "Ese mazo no vale";
}

/** Armors no tower in these decks hits at more than 100%. */
export function uncoveredArmors(decks: readonly Deck[]): Armor[] {
  const types = new Set(decks.flatMap((d) => d.towers.map((k) => TOWERS[k].attackType)).filter((t) => t !== null));
  return ARMORS.filter((armor) => ![...types].some((type) => DAMAGE_TABLE[type][armor] > NEUTRAL_PCT));
}

function toggled<T>(items: readonly T[], item: T, max: number): T[] {
  if (items.includes(item)) return items.filter((i) => i !== item);
  return items.length < max ? [...items, item] : [...items];
}

function towerNote(kind: TowerKind): string {
  const type = TOWERS[kind].attackType;
  return `${TOWERS[kind].cost} oro${type ? ` · ${ATTACK_LABELS[type]}` : ""}`;
}

/** Controlled: shows `deck`, reports every toggle through `onChange`; `team` are the other players' decks, for the armor warning. */
export function DeckBuilder(props: { towers: number; deck: Deck; onChange: (deck: Deck) => void; team?: readonly Deck[] }) {
  const has = (kind: TowerKind) => props.deck.towers.includes(kind);
  const hasAbility = (kind: AbilityKind) => props.deck.abilities.includes(kind);
  const uncovered = () => uncoveredArmors([props.deck, ...(props.team ?? [])]);
  /** A full deck ignores a new card: nothing changed, so nothing is reported. */
  const toggleTower = (kind: TowerKind) => {
    const towers = TOWER_KINDS.filter((k) => toggled(props.deck.towers, kind, props.towers).includes(k));
    if (towers.length !== props.deck.towers.length) props.onChange({ ...props.deck, towers });
  };
  const toggleAbility = (kind: AbilityKind) => {
    const abilities = ABILITY_KINDS.filter((k) => toggled(props.deck.abilities, kind, DECK.abilities).includes(k));
    if (abilities.length !== props.deck.abilities.length) props.onChange({ ...props.deck, abilities });
  };
  return (
    <div class="deck-builder">
      <h3>
        Tu mazo · {props.deck.towers.length}/{props.towers} torres · {props.deck.abilities.length}/{DECK.abilities} habilidades
      </h3>
      <div class="deck-cards">
        <For each={TOWER_KINDS}>
          {(kind) => (
            <button
              type="button"
              class="deck-card"
              classList={{ in: has(kind), full: !has(kind) && props.deck.towers.length >= props.towers }}
              aria-pressed={has(kind)}
              title={TOWERS[kind].line}
              onClick={() => toggleTower(kind)}
            >
              <span class="name">{TOWERS[kind].label}</span>
              <span class="note">{towerNote(kind)}</span>
              <span class="note">{TOWERS[kind].line}</span>
            </button>
          )}
        </For>
      </div>
      <div class="deck-cards">
        <For each={ABILITY_KINDS}>
          {(kind) => (
            <button
              type="button"
              class="deck-card ability-card"
              classList={{ in: hasAbility(kind), full: !hasAbility(kind) && props.deck.abilities.length >= DECK.abilities }}
              aria-pressed={hasAbility(kind)}
              title={ABILITIES[kind].line}
              onClick={() => toggleAbility(kind)}
            >
              <span class="name">{ABILITIES[kind].label}</span>
              <span class="note">{ABILITIES[kind].line}</span>
            </button>
          )}
        </For>
      </div>
      <Show when={deckIssue(props.deck, props.towers)}>{(issue) => <p class="error">{issue()}</p>}</Show>
      <Show when={uncovered().length > 0}>
        <p class="muted">
          {props.team ? "Nadie en el equipo" : "Nada en tu mazo"} le pega fuerte a:{" "}
          {uncovered()
            .map((a) => ARMOR_LABELS[a])
            .join(", ")}
        </p>
      </Show>
    </div>
  );
}
