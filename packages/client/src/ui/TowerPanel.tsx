import { For, Show } from "solid-js";
import {
  FP,
  TEAM_OWNER,
  TICKS_PER_SECOND,
  TOWERS,
  UPGRADE,
  ARMOR_LABELS,
  ENEMIES,
  auraBonusOf,
  controlDurationOf,
  controlPctOf,
  currentTarget,
  damageAgainst,
  effectiveCooldown,
  hasAttack,
  hasAura,
  hasControl,
  hasIncome,
  hasReveal,
  hasWall,
  mayManage,
  sellRefund,
  towerDamage,
  towerDef,
  towerIncome,
  upgradeCost,
  type Branch,
  type GameState,
  type Tower,
} from "@td/sim";
import type { GameStore } from "../game/store";
import { attackSummary, auraSummary, controlSummary, revealSummary, wallSummary } from "./Shop";
import { playerCss } from "./colors";

/** A static list keeps the two rows mounted across ticks; rebuilding them would drop clicks in a running game. */
const BRANCHES: readonly Branch[] = ["a", "b"];

export interface TowerActions {
  upgrade: (towerId: number, branch?: Branch) => void;
  sell: (towerId: number) => void;
}

function stats(state: GameState, tower: Tower): string {
  const def = towerDef(tower);
  if (hasIncome(def)) return `+${towerIncome(tower)} oro por oleada`;
  if (hasAura(def)) return auraSummary(def, auraBonusOf(tower));
  if (hasControl(def)) return controlSummary(def, controlPctOf(tower), controlDurationOf(tower));
  if (hasReveal(def)) return revealSummary(def);
  if (hasWall(def)) return wallSummary(def, tower.hp);
  if (!hasAttack(def)) return "";
  const damage = towerDamage(tower);
  const perSecond = ((damage * TICKS_PER_SECOND) / effectiveCooldown(state, tower)).toFixed(0);
  const splash = def.splash > 0 ? ` · área ${def.splash / FP}` : "";
  return `${damage} daño · ${perSecond}/s · alcance ${def.range / FP}${splash}`;
}

/** Stats of the selected tower, what the next level adds, and the owner's actions. */
export function TowerPanel(props: { store: GameStore; actions?: TowerActions; ownerName?: (id: number) => string }) {
  const tower = () => {
    const id = props.store.selectedTowerId();
    return id === null ? undefined : props.store.state().towers.find((t) => t.id === id);
  };
  const mine = () => {
    const t = tower();
    return t !== undefined && mayManage(t, props.store.you);
  };
  const target = () => {
    const t = tower();
    return t === undefined ? null : currentTarget(props.store.state(), t);
  };
  const next = () => {
    const t = tower();
    return t && t.level < UPGRADE.maxLevel ? { ...t, level: t.level + 1 } : undefined;
  };
  /** Whether the next level is the last one and this tower offers branches. */
  const choosing = () => {
    const n = next();
    return n !== undefined && n.level === UPGRADE.maxLevel && TOWERS[n.kind].branches !== null;
  };
  const branchInfo = (branch: Branch) => TOWERS[tower()!.kind].branches![branch];
  const preview = (branch: Branch) => ({ ...next()!, branch });
  return (
    <Show when={tower()}>
      {(t) => (
        <div class="tower-panel">
          <div class="row">
            <b title={towerDef(t()).line}>
              {towerDef(t()).label} nv{t().level}
            </b>
            <Show when={t().owner === TEAM_OWNER}>
              <span class="muted">del equipo</span>
            </Show>
            <Show when={!mine()}>
              <span style={{ color: playerCss(props.store.state(), t().owner) }}>
                de {props.ownerName?.(t().owner) ?? `Jugador ${t().owner + 1}`}
              </span>
            </Show>
            <span>{stats(props.store.state(), t())}</span>
          </div>
          <Show when={towerDef(t()).attackType}>{(attack) => <div class="row muted">{attackSummary(attack())}</div>}</Show>
          <Show when={target()}>
            {(e) => (
              <div class="row">
                <span class="muted">Apuntando a</span>
                <span>
                  {ENEMIES[e().kind].label} ({ARMOR_LABELS[ENEMIES[e().kind].armor]})
                </span>
                <span>{damageAgainst(props.store.state(), t(), e())} daño por golpe</span>
              </div>
            )}
          </Show>
          <Show when={next()} fallback={<div class="row muted">Nivel máximo</div>}>
            {(n) => (
              <Show
                when={!choosing()}
                fallback={
                  <For each={BRANCHES}>
                    {(branch) => (
                      <div class="row">
                        <span class="muted">
                          Nv{n().level} {branchInfo(branch).label} (−{upgradeCost(t().kind)}):
                        </span>
                        <span>{branchInfo(branch).line}</span>
                        <span class="muted">{stats(props.store.state(), preview(branch))}</span>
                        <Show when={mine() && props.actions}>
                          <button
                            type="button"
                            class="inline"
                            disabled={props.store.gold() < upgradeCost(t().kind)}
                            onClick={() => props.actions!.upgrade(t().id, branch)}
                          >
                            {branchInfo(branch).label}
                          </button>
                        </Show>
                      </div>
                    )}
                  </For>
                }
              >
                <div class="row">
                  <span class="muted">
                    Nv{n().level} (−{upgradeCost(t().kind)}):
                  </span>
                  <span>{stats(props.store.state(), n())}</span>
                  <Show when={mine() && props.actions}>
                    <button
                      type="button"
                      class="inline"
                      disabled={props.store.gold() < upgradeCost(t().kind)}
                      onClick={() => props.actions!.upgrade(t().id)}
                    >
                      Mejorar
                    </button>
                  </Show>
                </div>
              </Show>
            )}
          </Show>
          <Show when={mine() && props.actions}>
            <div class="row">
              <button type="button" class="inline sell" onClick={() => props.actions!.sell(t().id)}>
                Vender +{sellRefund(t())}
              </button>
            </div>
          </Show>
        </div>
      )}
    </Show>
  );
}
