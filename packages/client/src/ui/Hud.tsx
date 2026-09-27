import { For, Show, createSignal } from "solid-js";
import { ECONOMY, TICKS_PER_SECOND, WAVES, callWaveBonus } from "@td/sim";
import type { GameStore } from "../game/store";
import type { NetStore } from "../net/store";

export interface EconomyActions {
  callWave: () => void;
  gift: (to: number, amount: number) => void;
  sell: (towerId: number) => void;
  upgrade: (towerId: number) => void;
}

export function Hud(props: { store: GameStore; net?: NetStore; economy?: EconomyActions }) {
  const s = () => props.store.state();
  const room = () => props.net?.roomInfo() ?? null;
  const countdownTicks = () => (s().nextWaveTick === null ? null : s().nextWaveTick! - s().tick);
  const wavePending = () => {
    const left = countdownTicks();
    return s().status === "playing" && s().wave < WAVES.length && left !== null && left > 0 && s().wavesClosed === s().wave;
  };
  const alreadyCalled = () => s().waveCalls.includes(props.store.you);
  const bonus = () => callWaveBonus(countdownTicks() ?? 0);
  const countdownSeconds = () => Math.ceil((countdownTicks() ?? 0) / TICKS_PER_SECOND);
  const others = () => s().players.filter((p) => p.id !== props.store.you);
  const canGift = () => s().wave >= ECONOMY.giftFromWave && others().length > 0;
  const seconds = () => (s().tick / TICKS_PER_SECOND).toFixed(1);
  return (
    <>
      <div class="topbar">
        <span class="gold">Oro {props.store.gold()}</span>
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
        <Show when={wavePending()}>
          <span class="countdown">
            {s().wave === 0 ? "Primera" : "Próxima"} oleada en {countdownSeconds()} s
          </span>
        </Show>
        <Show when={props.economy && wavePending()}>
          <button type="button" class="inline" disabled={alreadyCalled()} onClick={() => props.economy!.callWave()}>
            {alreadyCalled() ? "Oleada pedida" : `Llamar oleada +${bonus()}`}
          </button>
        </Show>
        <Show when={props.economy && canGift()}>
          <GiftControl others={others().map((p) => p.id)} names={room()?.players ?? []} max={props.store.gold()} gift={props.economy!.gift} />
        </Show>
        <Show when={!s().ranked}>
          <span class="dev">sin récords</span>
        </Show>
        <Show when={room()}>
          {(info) => (
            <span class="dev">
              sala {info().code} · {info().players.filter((p) => p.connected).length}/{info().players.length} jugadores
            </span>
          )}
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

function GiftControl(props: { others: number[]; names: { playerId: number; name: string }[]; max: number; gift: (to: number, amount: number) => void }) {
  const [to, setTo] = createSignal(props.others[0] ?? 0);
  const [amount, setAmount] = createSignal(10);
  const label = (id: number): string => props.names.find((p) => p.playerId === id)?.name ?? `Jugador ${id + 1}`;
  return (
    <form
      class="gift"
      onSubmit={(e) => {
        e.preventDefault();
        props.gift(to(), amount());
      }}
    >
      <select value={to()} onChange={(e) => setTo(Number(e.currentTarget.value))}>
        <For each={props.others}>{(id) => <option value={id}>{label(id)}</option>}</For>
      </select>
      <input type="number" min={1} max={props.max} value={amount()} onInput={(e) => setAmount(Number(e.currentTarget.value))} />
      <button type="submit" class="inline" disabled={amount() < 1 || amount() > props.max}>
        Regalar
      </button>
    </form>
  );
}
