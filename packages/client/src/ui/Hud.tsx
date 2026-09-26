import { Show } from "solid-js";
import { TICKS_PER_SECOND, WAVES } from "@td/sim";
import type { GameStore } from "../game/store";

export function Hud(props: { store: GameStore }) {
  const s = () => props.store.state();
  const seconds = () => (s().tick / TICKS_PER_SECOND).toFixed(1);
  return (
    <>
      <div class="topbar">
        <span class="gold">Oro {s().gold}</span>
        <span class="lives">Vidas {s().lives}</span>
        <span>
          Oleada {s().wave}/{WAVES.length}
        </span>
        <span>
          Enemigos {s().enemies.length}
        </span>
        <span>
          Tick {s().tick} ({seconds()}s)
        </span>
        <Show when={!s().ranked}>
          <span class="dev">sin récords</span>
        </Show>
        <span class="status" classList={{ won: s().status === "won", lost: s().status === "lost" }}>
          {s().status === "playing" ? (props.store.paused() ? "pausa" : "") : s().status === "won" ? "VICTORIA" : "DERROTA"}
        </span>
      </div>
      <Show when={s().status !== "playing"}>
        <div class="overlay">
          <span>{s().status === "won" ? "Victoria" : "Derrota"}</span>
        </div>
      </Show>
      <Show when={props.store.notice()}>{(msg) => <div class="toast">{msg()}</div>}</Show>
    </>
  );
}
