import { For, Show } from "solid-js";
import { playerCss } from "./colors";
import { TICKS_PER_SECOND, WAVES, type GameState } from "@td/sim";

export interface EndActions {
  /** New game on the same map with a fresh seed (solo) or back to the lobby (coop creator). */
  again?: () => void;
  /** Solo only: same seed. */
  repeat?: () => void;
  leave?: () => void;
  /** Coop: this player's ready flag and how to flip it. */
  ready?: { mine: boolean; toggle: () => void };
  /** Coop creator: names still not ready; "Otra partida" waits for them. */
  notReady?: string[];
}

function playerName(names: Map<number, string> | undefined, id: number): string {
  return names?.get(id) ?? `Jugador ${id + 1}`;
}

/** Result of a finished game with a short per-player tally. */
export function EndScreen(props: { state: GameState; you: number; names?: Map<number, string>; actions: EndActions; waitingFor?: string }) {
  const seconds = () => Math.round(props.state.tick / TICKS_PER_SECOND);
  const rows = () =>
    props.state.players.map((p) => ({
      id: p.id,
      gold: p.gold,
      earned: p.earned,
      towers: props.state.towers.filter((t) => t.owner === p.id).length,
      kills: props.state.towers.filter((t) => t.owner === p.id).reduce((n, t) => n + t.kills, 0),
    }));
  return (
    <div class="overlay end">
      <div class="end-panel">
        <h2>{props.state.status === "won" ? "Victoria" : "Derrota"}</h2>
        <p class="muted">
          Oleada {props.state.wave}/{WAVES.length} · {seconds()} s · {props.state.lives} vidas · mapa {props.state.mapId} · seed{" "}
          {props.state.seed}
        </p>
        <table>
          <thead>
            <tr>
              <th>Jugador</th>
              <th>Ganado</th>
              <th>Sin gastar</th>
              <th>Torres</th>
              <th>Muertes</th>
            </tr>
          </thead>
          <tbody>
            <For each={rows()}>
              {(r) => (
                <tr classList={{ you: r.id === props.you }}>
                  <td style={{ color: playerCss(props.state, r.id) }}>{playerName(props.names, r.id)}</td>
                  <td>{r.earned}</td>
                  <td>{r.gold}</td>
                  <td>{r.towers}</td>
                  <td>{r.kills}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
        <div class="row">
          <Show when={props.actions.again}>
            <button
              type="button"
              class="primary"
              disabled={(props.actions.notReady?.length ?? 0) > 0}
              onClick={() => props.actions.again?.()}
            >
              Otra partida
            </button>
          </Show>
          <Show when={props.actions.ready}>
            {(ready) => (
              <button type="button" class="primary" onClick={() => ready().toggle()}>
                {ready().mine ? "Listo ✓ (cancelar)" : "Listo para otra"}
              </button>
            )}
          </Show>
          <Show when={(props.actions.notReady?.length ?? 0) > 0}>
            <span class="muted">Falta que estén listos: {props.actions.notReady!.join(", ")}</span>
          </Show>
          <Show when={props.actions.repeat}>
            <button type="button" onClick={() => props.actions.repeat?.()}>
              Repetir (misma seed)
            </button>
          </Show>
          <Show when={props.actions.leave}>
            <button type="button" onClick={() => props.actions.leave?.()}>
              Salir
            </button>
          </Show>
          <Show when={props.waitingFor}>
            <span class="muted">{props.waitingFor}</span>
          </Show>
        </div>
      </div>
    </div>
  );
}
