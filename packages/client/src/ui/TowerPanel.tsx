import { Show } from "solid-js";
import {
  FP,
  TEAM_OWNER,
  TICKS_PER_SECOND,
  TOWERS,
  UPGRADE,
  auraBonusOf,
  mayManage,
  sellRefund,
  towerDamage,
  towerIncome,
  upgradeCost,
  type Tower,
} from "@td/sim";
import type { GameStore } from "../game/store";

export interface TowerActions {
  upgrade: (towerId: number) => void;
  sell: (towerId: number) => void;
}

const LABELS: Record<Tower["kind"], string> = { archer: "Arquero", cannon: "Cañón", aura: "Aura", mine: "Mina" };

function stats(tower: Tower): string {
  const def = TOWERS[tower.kind];
  if (def.income > 0) return `+${towerIncome(tower)} oro por oleada`;
  if (def.damage === 0) return `+${auraBonusOf(tower)} % daño a torres en ${def.auraRadius * 2 + 1}×${def.auraRadius * 2 + 1}`;
  const damage = towerDamage(tower);
  const perSecond = ((damage * TICKS_PER_SECOND) / def.cooldown).toFixed(0);
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
  const next = () => {
    const t = tower();
    return t && t.level < UPGRADE.maxLevel ? { ...t, level: t.level + 1 } : undefined;
  };
  return (
    <Show when={tower()}>
      {(t) => (
        <div class="tower-panel">
          <div class="row">
            <b>
              {LABELS[t().kind]} nv{t().level}
            </b>
            <Show when={t().owner === TEAM_OWNER}>
              <span class="muted">del equipo</span>
            </Show>
            <Show when={!mine()}>
              <span class="muted">de {props.ownerName?.(t().owner) ?? `Jugador ${t().owner + 1}`}</span>
            </Show>
            <span>{stats(t())}</span>
          </div>
          <Show when={next()} fallback={<div class="row muted">Nivel máximo</div>}>
            {(n) => (
              <div class="row">
                <span class="muted">
                  Nv{n().level} (−{upgradeCost(t().kind)}):
                </span>
                <span>{stats(n())}</span>
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
