import { For, Show } from "solid-js";
import { TICKS_PER_SECOND, hashState } from "@td/sim";
import type { GameStore } from "../game/store";

export interface DebugActions {
  togglePause: () => void;
  stepOnce: () => void;
}

export function DebugPanel(props: { store: GameStore; actions: DebugActions; remote?: boolean }) {
  const s = () => props.store.state();
  const dps = (damage: number, builtTick: number): string => {
    const seconds = (s().tick - builtTick) / TICKS_PER_SECOND;
    return seconds <= 0 ? "-" : (damage / seconds).toFixed(1);
  };
  return (
    <div class="debug">
      <h3>Debug (~)</h3>
      <div class="row">
        <Show when={!props.remote} fallback={<span>reloj del server</span>}>
          <button type="button" onClick={props.actions.togglePause}>
            {props.store.paused() ? "Reanudar" : "Pausar"}
          </button>
          <button type="button" onClick={props.actions.stepOnce}>
            +1 tick
          </button>
        </Show>
        <label>
          <input type="checkbox" checked={props.store.showRanges()} onChange={(e) => props.store.setShowRanges(e.currentTarget.checked)} />
          rangos
        </label>
      </div>
      <div class="row">
        seed {s().seed} · rng {s().rng} · próx. oleada tick {s().nextWaveTick ?? "-"} · cola {s().spawnQueue.length} · hash {hashState(s())}
      </div>
      <table>
        <thead>
          <tr>
            <th>Torre</th>
            <th>Celda</th>
            <th>Daño</th>
            <th>Kills</th>
            <th>DPS</th>
          </tr>
        </thead>
        <tbody>
          <For each={s().towers}>
            {(t) => (
              <tr>
                <td>
                  #{t.id} {t.kind}
                </td>
                <td>
                  {t.x},{t.y}
                </td>
                <td>{t.damageDealt}</td>
                <td>{t.kills}</td>
                <td>{dps(t.damageDealt, t.builtTick)}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
